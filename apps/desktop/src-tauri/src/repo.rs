//! Journal persistence. Every function takes a borrowed connection so the same code runs
//! against the app database and the in-memory databases used by tests.
//!
//! Upserts use `INSERT … ON CONFLICT DO UPDATE` (never `INSERT OR REPLACE`, which deletes the
//! old row first and would cascade-delete its children).

use std::collections::{BTreeMap, HashMap};

use rusqlite::{Connection, OptionalExtension, Row, Transaction, params};

use crate::error::{AppError, AppResult, map_db};
use crate::models::{
    Account, Bar, BarsCacheKey, EXPORT_FORMAT, EXPORT_VERSION, Execution, ImportSummary,
    JournalExport, Leg, Note, Playbook, PriceLevel, ProviderConfigInput, ProviderConfigView,
    ProviderSecret, Tag, Trade, UserSettings,
};
use crate::secrets::SecretStore;
use crate::validate as check;

/// Current instant as ISO-8601 UTC with milliseconds, matching `new Date().toISOString()`.
pub fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
}

fn bool_int(value: bool) -> i64 {
    i64::from(value)
}

/// Array index stored as the child row's `position`.
fn position(index: usize) -> AppResult<i64> {
    i64::try_from(index).map_err(|_| AppError::validation("Too many items"))
}

// ---------------------------------------------------------------------------------------------
// Accounts

fn account_from_row(row: &Row<'_>) -> rusqlite::Result<Account> {
    Ok(Account {
        id: row.get("id")?,
        name: row.get("name")?,
        broker: row.get("broker")?,
        currency: row.get("currency")?,
        starting_balance: row.get("starting_balance")?,
        archived: row.get::<_, i64>("archived")? != 0,
        created_at: row.get("created_at")?,
    })
}

pub fn list_accounts(conn: &Connection) -> AppResult<Vec<Account>> {
    let mut stmt = conn.prepare_cached("SELECT * FROM trading_account ORDER BY created_at, id")?;
    let rows = stmt.query_map([], account_from_row)?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

fn upsert_account(conn: &Connection, account: &Account) -> AppResult<()> {
    conn.execute(
        "INSERT INTO trading_account (id, name, broker, currency, starting_balance, archived, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT (id) DO UPDATE SET
             name = excluded.name, broker = excluded.broker, currency = excluded.currency,
             starting_balance = excluded.starting_balance, archived = excluded.archived,
             created_at = excluded.created_at",
        params![
            account.id,
            account.name,
            account.broker,
            account.currency,
            account.starting_balance,
            bool_int(account.archived),
            account.created_at
        ],
    )
    .map_err(map_db)?;
    Ok(())
}

pub fn save_account(conn: &Connection, account: Account) -> AppResult<Account> {
    let account = account.validated()?;
    upsert_account(conn, &account)?;
    Ok(account)
}

/// Deletes the account and, through `ON DELETE CASCADE`, its trades.
pub fn remove_account(conn: &Connection, id: &str) -> AppResult<()> {
    check::uuid("Account id", id)?;
    conn.execute("DELETE FROM trading_account WHERE id = ?1", [id])
        .map_err(map_db)?;
    Ok(())
}

// ---------------------------------------------------------------------------------------------
// Tags

fn tag_from_row(row: &Row<'_>) -> rusqlite::Result<Tag> {
    Ok(Tag {
        id: row.get("id")?,
        name: row.get("name")?,
        category: row.get("category")?,
        color: row.get("color")?,
    })
}

pub fn list_tags(conn: &Connection) -> AppResult<Vec<Tag>> {
    let mut stmt =
        conn.prepare_cached("SELECT * FROM tag ORDER BY category, name COLLATE NOCASE, id")?;
    let rows = stmt.query_map([], tag_from_row)?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

fn upsert_tag(conn: &Connection, tag: &Tag) -> AppResult<()> {
    conn.execute(
        "INSERT INTO tag (id, name, category, color) VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT (id) DO UPDATE SET
             name = excluded.name, category = excluded.category, color = excluded.color",
        params![tag.id, tag.name, tag.category, tag.color],
    )
    .map_err(map_db)?;
    Ok(())
}

pub fn save_tag(conn: &Connection, tag: Tag) -> AppResult<Tag> {
    let tag = tag.validated()?;
    upsert_tag(conn, &tag)?;
    Ok(tag)
}

pub fn remove_tag(conn: &Connection, id: &str) -> AppResult<()> {
    check::uuid("Tag id", id)?;
    conn.execute("DELETE FROM tag WHERE id = ?1", [id])
        .map_err(map_db)?;
    Ok(())
}

// ---------------------------------------------------------------------------------------------
// Playbooks

fn playbook_from_row(row: &Row<'_>) -> rusqlite::Result<(Playbook, String)> {
    Ok((
        Playbook {
            id: row.get("id")?,
            name: row.get("name")?,
            description: row.get("description")?,
            rules: Vec::new(),
            color: row.get("color")?,
            archived: row.get::<_, i64>("archived")? != 0,
            created_at: row.get("created_at")?,
        },
        row.get("rules")?,
    ))
}

pub fn list_playbooks(conn: &Connection) -> AppResult<Vec<Playbook>> {
    let mut stmt = conn.prepare_cached("SELECT * FROM playbook ORDER BY created_at, id")?;
    let rows = stmt.query_map([], playbook_from_row)?;
    rows.map(|row| {
        let (mut playbook, rules) = row?;
        playbook.rules = serde_json::from_str(&rules)?;
        Ok(playbook)
    })
    .collect()
}

fn upsert_playbook(conn: &Connection, playbook: &Playbook) -> AppResult<()> {
    let rules = serde_json::to_string(&playbook.rules)?;
    conn.execute(
        "INSERT INTO playbook (id, name, description, rules, color, archived, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT (id) DO UPDATE SET
             name = excluded.name, description = excluded.description, rules = excluded.rules,
             color = excluded.color, archived = excluded.archived, created_at = excluded.created_at",
        params![
            playbook.id,
            playbook.name,
            playbook.description,
            rules,
            playbook.color,
            bool_int(playbook.archived),
            playbook.created_at
        ],
    )
    .map_err(map_db)?;
    Ok(())
}

pub fn save_playbook(conn: &Connection, playbook: Playbook) -> AppResult<Playbook> {
    let playbook = playbook.validated()?;
    upsert_playbook(conn, &playbook)?;
    Ok(playbook)
}

/// Deletes the playbook; trades that used it keep existing with `playbookId = null`.
pub fn remove_playbook(conn: &Connection, id: &str) -> AppResult<()> {
    check::uuid("Playbook id", id)?;
    conn.execute("DELETE FROM playbook WHERE id = ?1", [id])
        .map_err(map_db)?;
    Ok(())
}

// ---------------------------------------------------------------------------------------------
// Notes

fn note_from_row(row: &Row<'_>) -> rusqlite::Result<Note> {
    Ok(Note {
        id: row.get("id")?,
        date: row.get("date")?,
        title: row.get("title")?,
        body: row.get("body")?,
        kind: row.get("kind")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

pub fn list_notes(conn: &Connection) -> AppResult<Vec<Note>> {
    let mut stmt =
        conn.prepare_cached("SELECT * FROM note ORDER BY date DESC, created_at DESC, id")?;
    let rows = stmt.query_map([], note_from_row)?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

fn upsert_note(conn: &Connection, note: &Note) -> AppResult<()> {
    conn.execute(
        "INSERT INTO note (id, date, title, body, kind, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT (id) DO UPDATE SET
             date = excluded.date, title = excluded.title, body = excluded.body,
             kind = excluded.kind, created_at = excluded.created_at, updated_at = excluded.updated_at",
        params![
            note.id,
            note.date,
            note.title,
            note.body,
            note.kind,
            note.created_at,
            note.updated_at
        ],
    )
    .map_err(map_db)?;
    Ok(())
}

pub fn save_note(conn: &Connection, note: Note) -> AppResult<Note> {
    let note = note.validated()?;
    upsert_note(conn, &note)?;
    Ok(note)
}

pub fn remove_note(conn: &Connection, id: &str) -> AppResult<()> {
    check::uuid("Note id", id)?;
    conn.execute("DELETE FROM note WHERE id = ?1", [id])
        .map_err(map_db)?;
    Ok(())
}

// ---------------------------------------------------------------------------------------------
// Trades (aggregate: trade + legs + executions + levels + tags)

fn trade_from_row(row: &Row<'_>) -> rusqlite::Result<Trade> {
    Ok(Trade {
        id: row.get("id")?,
        account_id: row.get("account_id")?,
        underlying: row.get("underlying")?,
        asset_class: row.get("asset_class")?,
        strategy: row.get("strategy")?,
        playbook_id: row.get("playbook_id")?,
        tag_ids: Vec::new(),
        legs: Vec::new(),
        executions: Vec::new(),
        levels: Vec::new(),
        planned_risk: row.get("planned_risk")?,
        thesis: row.get("thesis")?,
        review: row.get("review")?,
        rating: row.get("rating")?,
        confidence: row.get("confidence")?,
        mfe: row.get("mfe")?,
        mae: row.get("mae")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

fn leg_from_row(row: &Row<'_>) -> rusqlite::Result<(String, Leg)> {
    Ok((
        row.get("trade_id")?,
        Leg {
            id: row.get("id")?,
            kind: row.get("kind")?,
            underlying: row.get("underlying")?,
            strike: row.get("strike")?,
            expiration: row.get("expiration")?,
            multiplier: row.get("multiplier")?,
        },
    ))
}

fn execution_from_row(row: &Row<'_>) -> rusqlite::Result<(String, Execution)> {
    Ok((
        row.get("trade_id")?,
        Execution {
            id: row.get("id")?,
            leg_id: row.get("leg_id")?,
            side: row.get("side")?,
            kind: row.get("kind")?,
            quantity: row.get("quantity")?,
            price: row.get("price")?,
            fees: row.get("fees")?,
            executed_at: row.get("executed_at")?,
            underlying_price: row.get("underlying_price")?,
            note: row.get("note")?,
        },
    ))
}

fn level_from_row(row: &Row<'_>) -> rusqlite::Result<(String, PriceLevel)> {
    Ok((
        row.get("trade_id")?,
        PriceLevel {
            id: row.get("id")?,
            kind: row.get("kind")?,
            price: row.get("price")?,
            set_at: row.get("set_at")?,
            note: row.get("note")?,
        },
    ))
}

/// Loads trades matching `filter` (`None` = all) with their children, in a handful of queries.
fn load_trades(conn: &Connection, filter: Option<&str>) -> AppResult<Vec<Trade>> {
    let clause = if filter.is_some() {
        "WHERE trade_id = ?1"
    } else {
        "WHERE ?1 IS NULL"
    };
    let trade_clause = if filter.is_some() {
        "WHERE id = ?1"
    } else {
        "WHERE ?1 IS NULL"
    };

    let mut stmt = conn.prepare_cached(&format!(
        "SELECT * FROM trade {trade_clause} ORDER BY created_at, id"
    ))?;
    let mut trades: Vec<Trade> = stmt
        .query_map([filter], trade_from_row)?
        .collect::<rusqlite::Result<_>>()?;
    if trades.is_empty() {
        return Ok(trades);
    }
    let index: HashMap<String, usize> = trades
        .iter()
        .enumerate()
        .map(|(i, t)| (t.id.clone(), i))
        .collect();

    let mut stmt = conn.prepare_cached(&format!(
        "SELECT * FROM trade_leg {clause} ORDER BY trade_id, position"
    ))?;
    for row in stmt.query_map([filter], leg_from_row)? {
        let (trade_id, leg) = row?;
        if let Some(&i) = index.get(&trade_id) {
            trades[i].legs.push(leg);
        }
    }

    let mut stmt = conn.prepare_cached(&format!(
        "SELECT * FROM trade_execution {clause} ORDER BY trade_id, position"
    ))?;
    for row in stmt.query_map([filter], execution_from_row)? {
        let (trade_id, execution) = row?;
        if let Some(&i) = index.get(&trade_id) {
            trades[i].executions.push(execution);
        }
    }

    let mut stmt = conn.prepare_cached(&format!(
        "SELECT * FROM trade_level {clause} ORDER BY trade_id, position"
    ))?;
    for row in stmt.query_map([filter], level_from_row)? {
        let (trade_id, level) = row?;
        if let Some(&i) = index.get(&trade_id) {
            trades[i].levels.push(level);
        }
    }

    let mut stmt = conn.prepare_cached(&format!(
        "SELECT trade_id, tag_id FROM trade_tag {clause} ORDER BY trade_id, position"
    ))?;
    let tag_rows = stmt.query_map([filter], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    })?;
    for row in tag_rows {
        let (trade_id, tag_id) = row?;
        if let Some(&i) = index.get(&trade_id) {
            trades[i].tag_ids.push(tag_id);
        }
    }

    Ok(trades)
}

pub fn list_trades(conn: &Connection) -> AppResult<Vec<Trade>> {
    load_trades(conn, None)
}

pub fn get_trade(conn: &Connection, id: &str) -> AppResult<Option<Trade>> {
    check::uuid("Trade id", id)?;
    Ok(load_trades(conn, Some(id))?.into_iter().next())
}

/// Writes a validated trade aggregate. Must run inside a transaction.
fn write_trade(tx: &Transaction<'_>, trade: &Trade) -> AppResult<()> {
    tx.execute(
        "INSERT INTO trade (id, account_id, underlying, asset_class, strategy, playbook_id,
                            planned_risk, thesis, review, rating, confidence, mfe, mae,
                            created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)
         ON CONFLICT (id) DO UPDATE SET
             account_id = excluded.account_id, underlying = excluded.underlying,
             asset_class = excluded.asset_class, strategy = excluded.strategy,
             playbook_id = excluded.playbook_id, planned_risk = excluded.planned_risk,
             thesis = excluded.thesis, review = excluded.review, rating = excluded.rating,
             confidence = excluded.confidence, mfe = excluded.mfe, mae = excluded.mae,
             created_at = excluded.created_at, updated_at = excluded.updated_at",
        params![
            trade.id,
            trade.account_id,
            trade.underlying,
            trade.asset_class,
            trade.strategy,
            trade.playbook_id,
            trade.planned_risk,
            trade.thesis,
            trade.review,
            trade.rating,
            trade.confidence,
            trade.mfe,
            trade.mae,
            trade.created_at,
            trade.updated_at
        ],
    )
    .map_err(map_db)?;

    // Replace children. Deleting legs cascades to their executions.
    tx.execute("DELETE FROM trade_leg WHERE trade_id = ?1", [&trade.id])?;
    tx.execute(
        "DELETE FROM trade_execution WHERE trade_id = ?1",
        [&trade.id],
    )?;
    tx.execute("DELETE FROM trade_level WHERE trade_id = ?1", [&trade.id])?;
    tx.execute("DELETE FROM trade_tag WHERE trade_id = ?1", [&trade.id])?;

    let mut stmt = tx.prepare_cached(
        "INSERT INTO trade_leg (id, trade_id, position, kind, underlying, strike, expiration, multiplier)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
    )?;
    for (index, leg) in trade.legs.iter().enumerate() {
        stmt.execute(params![
            leg.id,
            trade.id,
            position(index)?,
            leg.kind,
            leg.underlying,
            leg.strike,
            leg.expiration,
            leg.multiplier
        ])
        .map_err(map_db)?;
    }

    let mut stmt = tx.prepare_cached(
        "INSERT INTO trade_execution (id, trade_id, leg_id, position, side, kind, quantity, price,
                                      fees, executed_at, underlying_price, note)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
    )?;
    for (index, execution) in trade.executions.iter().enumerate() {
        stmt.execute(params![
            execution.id,
            trade.id,
            execution.leg_id,
            position(index)?,
            execution.side,
            execution.kind,
            execution.quantity,
            execution.price,
            execution.fees,
            execution.executed_at,
            execution.underlying_price,
            execution.note
        ])
        .map_err(map_db)?;
    }

    let mut stmt = tx.prepare_cached(
        "INSERT INTO trade_level (id, trade_id, position, kind, price, set_at, note)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
    )?;
    for (index, level) in trade.levels.iter().enumerate() {
        stmt.execute(params![
            level.id,
            trade.id,
            position(index)?,
            level.kind,
            level.price,
            level.set_at,
            level.note
        ])
        .map_err(map_db)?;
    }

    let mut stmt = tx
        .prepare_cached("INSERT INTO trade_tag (trade_id, tag_id, position) VALUES (?1, ?2, ?3)")?;
    for (index, tag_id) in trade.tag_ids.iter().enumerate() {
        stmt.execute(params![trade.id, tag_id, position(index)?])
            .map_err(map_db)?;
    }
    Ok(())
}

/// Upserts the trade row and replaces its legs, executions, levels and tags atomically.
pub fn save_trade(conn: &mut Connection, trade: Trade) -> AppResult<Trade> {
    let trade = trade.validated()?;
    let tx = conn.transaction()?;
    write_trade(&tx, &trade)?;
    tx.commit()?;
    Ok(trade)
}

pub fn remove_trade(conn: &Connection, id: &str) -> AppResult<()> {
    check::uuid("Trade id", id)?;
    conn.execute("DELETE FROM trade WHERE id = ?1", [id])
        .map_err(map_db)?;
    Ok(())
}

// ---------------------------------------------------------------------------------------------
// Settings

pub fn get_settings(conn: &Connection) -> AppResult<UserSettings> {
    let stored: Option<String> = conn
        .query_row("SELECT data FROM user_settings WHERE id = 1", [], |row| {
            row.get(0)
        })
        .optional()?;
    match stored {
        None => Ok(UserSettings::default()),
        Some(json) => match serde_json::from_str::<UserSettings>(&json) {
            Ok(settings) => Ok(settings),
            Err(error) => {
                log::warn!("Stored settings are unreadable ({error}); using defaults");
                Ok(UserSettings::default())
            }
        },
    }
}

fn write_settings(conn: &Connection, settings: &UserSettings) -> AppResult<()> {
    let json = serde_json::to_string(settings)?;
    conn.execute(
        "INSERT INTO user_settings (id, data) VALUES (1, ?1)
         ON CONFLICT (id) DO UPDATE SET data = excluded.data",
        [json],
    )?;
    Ok(())
}

pub fn save_settings(conn: &Connection, settings: UserSettings) -> AppResult<UserSettings> {
    let settings = settings.validated()?;
    write_settings(conn, &settings)?;
    Ok(settings)
}

// ---------------------------------------------------------------------------------------------
// Market-data providers

fn provider_from_row(row: &Row<'_>) -> rusqlite::Result<(ProviderConfigView, String)> {
    Ok((
        ProviderConfigView {
            id: row.get("id")?,
            provider: row.get("provider")?,
            label: row.get("label")?,
            options: BTreeMap::new(),
            is_default: row.get::<_, i64>("is_default")? != 0,
            secret_hint: row.get("secret_hint")?,
            created_at: row.get("created_at")?,
            updated_at: row.get("updated_at")?,
        },
        row.get("options")?,
    ))
}

fn decode_provider(
    row: rusqlite::Result<(ProviderConfigView, String)>,
) -> AppResult<ProviderConfigView> {
    let (mut view, options) = row?;
    view.options = serde_json::from_str(&options)?;
    Ok(view)
}

pub fn list_providers(conn: &Connection) -> AppResult<Vec<ProviderConfigView>> {
    let mut stmt = conn.prepare_cached("SELECT * FROM provider_config ORDER BY created_at, id")?;
    let rows = stmt.query_map([], provider_from_row)?;
    rows.map(decode_provider).collect()
}

fn get_provider(conn: &Connection, id: &str) -> AppResult<Option<ProviderConfigView>> {
    let mut stmt = conn.prepare_cached("SELECT * FROM provider_config WHERE id = ?1")?;
    stmt.query_row([id], provider_from_row)
        .optional()?
        .map(|row| decode_provider(Ok(row)))
        .transpose()
}

/// `••••` followed by the last four characters of `apiKey`, for recognition only.
pub fn secret_hint(secret: &ProviderSecret) -> Option<String> {
    let key = secret.get("apiKey")?;
    let chars: Vec<char> = key.chars().collect();
    if chars.len() < 8 {
        // Too short to reveal any of it safely.
        return Some("••••".to_owned());
    }
    let tail: String = chars[chars.len() - 4..].iter().collect();
    Some(format!("••••{tail}"))
}

/// Saves a provider configuration and, when given, its secret in the secret store.
///
/// Exactly one provider is the default whenever any exist: choosing a new default clears the
/// others, and a provider saved while no other one is default becomes the default.
pub fn save_provider(
    conn: &mut Connection,
    secrets: &dyn SecretStore,
    input: ProviderConfigInput,
) -> AppResult<ProviderConfigView> {
    let input = input.validated()?;
    let tx = conn.transaction()?;
    let existing = get_provider(&tx, &input.id)?;
    let other_default: bool = tx.query_row(
        "SELECT EXISTS (SELECT 1 FROM provider_config WHERE is_default = 1 AND id <> ?1)",
        [&input.id],
        |row| row.get(0),
    )?;
    let is_default = input.is_default || !other_default;
    if is_default {
        tx.execute(
            "UPDATE provider_config SET is_default = 0 WHERE id <> ?1 AND is_default = 1",
            [&input.id],
        )?;
    }

    let secret_hint = match &input.secret {
        Some(secret) => secret_hint(secret),
        None => existing.as_ref().and_then(|e| e.secret_hint.clone()),
    };
    let now = now_iso();
    let view = ProviderConfigView {
        id: input.id.clone(),
        provider: input.provider.clone(),
        label: input.label.clone(),
        options: input.options.clone(),
        is_default,
        secret_hint,
        created_at: existing
            .as_ref()
            .map_or_else(|| now.clone(), |e| e.created_at.clone()),
        updated_at: now,
    };
    let options = serde_json::to_string(&view.options)?;
    tx.execute(
        "INSERT INTO provider_config (id, provider, label, options, is_default, secret_hint, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
         ON CONFLICT (id) DO UPDATE SET
             provider = excluded.provider, label = excluded.label, options = excluded.options,
             is_default = excluded.is_default, secret_hint = excluded.secret_hint,
             updated_at = excluded.updated_at",
        params![
            view.id,
            view.provider,
            view.label,
            options,
            bool_int(view.is_default),
            view.secret_hint,
            view.created_at,
            view.updated_at
        ],
    )
    .map_err(map_db)?;

    // Cached bars belong to the old provider settings when the provider kind changes.
    if existing
        .as_ref()
        .is_some_and(|e| e.provider != view.provider)
    {
        clear_bar_cache(&tx, &view.id)?;
    }

    // The secret is written last so a failed database write never leaves a fresh secret behind;
    // a failed secret write rolls the configuration back.
    if let Some(secret) = &input.secret {
        if secret.is_empty() {
            secrets.delete(&tx, &view.id)?;
        } else {
            secrets.set(&tx, &view.id, &serde_json::to_string(secret)?)?;
        }
    }
    tx.commit()?;
    Ok(view)
}

pub fn remove_provider(
    conn: &mut Connection,
    secrets: &dyn SecretStore,
    id: &str,
) -> AppResult<()> {
    check::uuid("Provider id", id)?;
    let tx = conn.transaction()?;
    let was_default: Option<bool> = tx
        .query_row(
            "SELECT is_default FROM provider_config WHERE id = ?1",
            [id],
            |row| row.get::<_, i64>(0).map(|v| v != 0),
        )
        .optional()?;
    tx.execute("DELETE FROM provider_config WHERE id = ?1", [id])?;
    if was_default == Some(true) {
        // Promote the oldest remaining provider so a default always exists.
        tx.execute(
            "UPDATE provider_config SET is_default = 1
             WHERE id = (SELECT id FROM provider_config ORDER BY created_at, id LIMIT 1)",
            [],
        )?;
    }
    secrets.delete(&tx, id)?;
    tx.commit()?;
    Ok(())
}

/// The stored secret map for a provider (empty when none is stored, e.g. the simulator).
pub fn provider_secret(
    conn: &Connection,
    secrets: &dyn SecretStore,
    id: &str,
) -> AppResult<ProviderSecret> {
    check::uuid("Provider id", id)?;
    if get_provider(conn, id)?.is_none() {
        return Err(AppError::not_found("Market-data provider not found"));
    }
    match secrets.get(conn, id)? {
        Some(json) => Ok(serde_json::from_str(&json)?),
        None => Ok(ProviderSecret::new()),
    }
}

// ---------------------------------------------------------------------------------------------
// Bars cache

fn clear_bar_cache(conn: &Connection, provider_id: &str) -> AppResult<()> {
    conn.execute(
        "DELETE FROM bar_cache WHERE provider_config_id = ?1",
        [provider_id],
    )?;
    conn.execute(
        "DELETE FROM bar_coverage WHERE provider_config_id = ?1",
        [provider_id],
    )?;
    Ok(())
}

fn check_window(from: i64, to: i64) -> AppResult<()> {
    if from < 0 || to <= from {
        Err(AppError::validation(
            "The bars window must end after it starts",
        ))
    } else {
        Ok(())
    }
}

/// Returns cached bars when `[from, to]` (UTC ms) is fully covered by stored coverage ranges.
pub fn read_bars(
    conn: &Connection,
    key: &BarsCacheKey,
    from: i64,
    to: i64,
) -> AppResult<Option<Vec<Bar>>> {
    let bar_ms = key.validated_bar_ms()?;
    check_window(from, to)?;

    let mut stmt = conn.prepare_cached(
        "SELECT from_ms, to_ms FROM bar_coverage
         WHERE provider_config_id = ?1 AND instrument = ?2 AND timeframe = ?3
           AND from_ms <= ?5 AND to_ms >= ?4
         ORDER BY from_ms, to_ms",
    )?;
    let ranges = stmt
        .query_map(
            params![key.provider, key.instrument, key.timeframe, from, to],
            |row| Ok((row.get::<_, i64>(0)?, row.get::<_, i64>(1)?)),
        )?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    if !is_covered(&ranges, from, to) {
        return Ok(None);
    }

    let mut stmt = conn.prepare_cached(
        "SELECT time, open, high, low, close, volume FROM bar_cache
         WHERE provider_config_id = ?1 AND instrument = ?2 AND timeframe = ?3
           AND time * 1000 + ?6 > ?4 AND time * 1000 <= ?5
         ORDER BY time",
    )?;
    let bars = stmt
        .query_map(
            params![
                key.provider,
                key.instrument,
                key.timeframe,
                from,
                to,
                bar_ms
            ],
            |row| {
                Ok(Bar {
                    time: row.get(0)?,
                    open: row.get(1)?,
                    high: row.get(2)?,
                    low: row.get(3)?,
                    close: row.get(4)?,
                    volume: row.get(5)?,
                })
            },
        )?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(Some(bars))
}

/// True when the union of `ranges` (sorted by start) spans `[from, to]` without gaps.
fn is_covered(ranges: &[(i64, i64)], from: i64, to: i64) -> bool {
    let mut reached = from;
    for &(start, end) in ranges {
        if start > reached {
            return false;
        }
        reached = reached.max(end);
        if reached >= to {
            return true;
        }
    }
    false
}

/// Upserts bars and records `[from, to]` as covered, merging overlapping coverage rows.
pub fn write_bars(
    conn: &mut Connection,
    key: &BarsCacheKey,
    bars: &[Bar],
    from: i64,
    to: i64,
) -> AppResult<()> {
    key.validated_bar_ms()?;
    check_window(from, to)?;
    for bar in bars {
        bar.validate()?;
    }
    let tx = conn.transaction()?;
    {
        let mut stmt = tx.prepare_cached(
            "INSERT INTO bar_cache (provider_config_id, instrument, timeframe, time, open, high, low, close, volume)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
             ON CONFLICT (provider_config_id, instrument, timeframe, time) DO UPDATE SET
                 open = excluded.open, high = excluded.high, low = excluded.low,
                 close = excluded.close, volume = excluded.volume",
        )?;
        for bar in bars {
            stmt.execute(params![
                key.provider,
                key.instrument,
                key.timeframe,
                bar.time,
                bar.open,
                bar.high,
                bar.low,
                bar.close,
                bar.volume
            ])
            .map_err(map_db)?;
        }

        let (merged_from, merged_to): (Option<i64>, Option<i64>) = tx.query_row(
            "SELECT MIN(from_ms), MAX(to_ms) FROM bar_coverage
             WHERE provider_config_id = ?1 AND instrument = ?2 AND timeframe = ?3
               AND from_ms <= ?5 AND to_ms >= ?4",
            params![key.provider, key.instrument, key.timeframe, from, to],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )?;
        tx.execute(
            "DELETE FROM bar_coverage
             WHERE provider_config_id = ?1 AND instrument = ?2 AND timeframe = ?3
               AND from_ms <= ?5 AND to_ms >= ?4",
            params![key.provider, key.instrument, key.timeframe, from, to],
        )?;
        tx.execute(
            "INSERT INTO bar_coverage (provider_config_id, instrument, timeframe, from_ms, to_ms)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                key.provider,
                key.instrument,
                key.timeframe,
                merged_from.map_or(from, |m| m.min(from)),
                merged_to.map_or(to, |m| m.max(to))
            ],
        )
        .map_err(map_db)?;
    }
    tx.commit()?;
    Ok(())
}

// ---------------------------------------------------------------------------------------------
// Export / import / reset

pub fn export_all(conn: &Connection) -> AppResult<JournalExport> {
    Ok(JournalExport {
        format: EXPORT_FORMAT.to_owned(),
        version: EXPORT_VERSION,
        exported_at: now_iso(),
        settings: get_settings(conn)?,
        accounts: list_accounts(conn)?,
        tags: list_tags(conn)?,
        playbooks: list_playbooks(conn)?,
        notes: list_notes(conn)?,
        trades: list_trades(conn)?,
    })
}

/// Upserts every entity in the file in one transaction; nothing is deleted.
pub fn import_all(conn: &mut Connection, data: JournalExport) -> AppResult<ImportSummary> {
    if data.format != EXPORT_FORMAT || data.version != EXPORT_VERSION {
        return Err(AppError::validation(format!(
            "Unsupported file: expected {EXPORT_FORMAT} version {EXPORT_VERSION}"
        )));
    }
    check::timestamp("exportedAt", &data.exported_at)?;
    let settings = data.settings.validated()?;
    let accounts = data
        .accounts
        .into_iter()
        .map(Account::validated)
        .collect::<AppResult<Vec<_>>>()?;
    let tags = data
        .tags
        .into_iter()
        .map(Tag::validated)
        .collect::<AppResult<Vec<_>>>()?;
    let playbooks = data
        .playbooks
        .into_iter()
        .map(Playbook::validated)
        .collect::<AppResult<Vec<_>>>()?;
    let notes = data
        .notes
        .into_iter()
        .map(Note::validated)
        .collect::<AppResult<Vec<_>>>()?;
    let trades = data
        .trades
        .into_iter()
        .map(Trade::validated)
        .collect::<AppResult<Vec<_>>>()?;

    let tx = conn.transaction()?;
    write_settings(&tx, &settings)?;
    for account in &accounts {
        upsert_account(&tx, account)?;
    }
    for tag in &tags {
        upsert_tag(&tx, tag)?;
    }
    for playbook in &playbooks {
        upsert_playbook(&tx, playbook)?;
    }
    for note in &notes {
        upsert_note(&tx, note)?;
    }
    for trade in &trades {
        write_trade(&tx, trade)?;
    }
    tx.commit()?;
    Ok(ImportSummary {
        trades: trades.len(),
    })
}

/// Deletes every journal entity. Provider settings, secrets, cached bars and user settings stay.
pub fn reset(conn: &mut Connection) -> AppResult<()> {
    let tx = conn.transaction()?;
    tx.execute_batch(
        "DELETE FROM trade;
         DELETE FROM note;
         DELETE FROM tag;
         DELETE FROM playbook;
         DELETE FROM trading_account;",
    )?;
    tx.commit()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn coverage_union_detects_gaps() {
        assert!(is_covered(&[(0, 10)], 2, 8));
        assert!(is_covered(&[(0, 5), (4, 10)], 1, 10));
        assert!(is_covered(&[(0, 5), (5, 10)], 0, 10));
        assert!(!is_covered(&[(0, 5), (6, 10)], 0, 10));
        assert!(!is_covered(&[(3, 10)], 0, 10));
        assert!(!is_covered(&[], 0, 10));
    }

    #[test]
    fn hint_shows_last_four() {
        let mut secret = ProviderSecret::new();
        secret.insert("apiKey".into(), "abcdefgh3F9A".into());
        assert_eq!(secret_hint(&secret).as_deref(), Some("••••3F9A"));
        secret.insert("apiKey".into(), "abc".into());
        assert_eq!(secret_hint(&secret).as_deref(), Some("••••"));
        assert_eq!(secret_hint(&ProviderSecret::new()), None);
    }
}
