//! Repository-layer integration tests against in-memory SQLite.

use std::collections::{BTreeMap, HashMap};
use std::sync::Mutex;

use rusqlite::Connection;
use strikebook_desktop_lib::db;
use strikebook_desktop_lib::error::{AppError, AppResult};
use strikebook_desktop_lib::models::{
    Account, Bar, BarsCacheKey, Execution, JournalExport, Leg, Note, Playbook, PriceLevel,
    ProviderConfigInput, Tag, Trade, UserSettings,
};
use strikebook_desktop_lib::repo;
use strikebook_desktop_lib::secrets::SecretStore;

const ACCOUNT: &str = "0199f0a2-0000-7000-8000-000000000001";
const PLAYBOOK: &str = "0199f0a2-0000-7000-8000-000000000002";
const TAG_A: &str = "0199f0a2-0000-7000-8000-000000000003";
const TAG_B: &str = "0199f0a2-0000-7000-8000-000000000004";
const TRADE: &str = "0199f0a2-0000-7000-8000-000000000010";
const LEG_1: &str = "0199f0a2-0000-7000-8000-000000000011";
const LEG_2: &str = "0199f0a2-0000-7000-8000-000000000012";
const EXEC_1: &str = "0199f0a2-0000-7000-8000-000000000021";
const EXEC_2: &str = "0199f0a2-0000-7000-8000-000000000022";
const EXEC_3: &str = "0199f0a2-0000-7000-8000-000000000023";
const LEVEL_1: &str = "0199f0a2-0000-7000-8000-000000000031";
const NOTE: &str = "0199f0a2-0000-7000-8000-000000000041";
const PROVIDER_A: &str = "0199f0a2-0000-7000-8000-000000000051";
const PROVIDER_B: &str = "0199f0a2-0000-7000-8000-000000000052";

const T0: &str = "2026-10-20T13:30:00.000Z";

/// In-memory secret store standing in for the OS keychain.
#[derive(Default)]
struct MemorySecrets(Mutex<HashMap<String, String>>);

impl SecretStore for MemorySecrets {
    fn get(&self, _: &Connection, account: &str) -> AppResult<Option<String>> {
        let map = self.0.lock().map_err(|_| AppError::LockPoisoned)?;
        Ok(map.get(account).cloned())
    }
    fn set(&self, _: &Connection, account: &str, value: &str) -> AppResult<()> {
        let mut map = self.0.lock().map_err(|_| AppError::LockPoisoned)?;
        map.insert(account.to_owned(), value.to_owned());
        Ok(())
    }
    fn delete(&self, _: &Connection, account: &str) -> AppResult<()> {
        let mut map = self.0.lock().map_err(|_| AppError::LockPoisoned)?;
        map.remove(account);
        Ok(())
    }
}

fn account() -> Account {
    Account {
        id: ACCOUNT.into(),
        name: "  Margin  ".into(),
        broker: "Schwab".into(),
        currency: "usd".into(),
        starting_balance: 25_000.0,
        archived: false,
        created_at: T0.into(),
    }
}

fn tag(id: &str, name: &str) -> Tag {
    Tag {
        id: id.into(),
        name: name.into(),
        category: "setup".into(),
        color: "#f2c14e".into(),
    }
}

fn playbook() -> Playbook {
    Playbook {
        id: PLAYBOOK.into(),
        name: "Earnings IV crush".into(),
        description: "Sell premium into earnings".into(),
        rules: vec!["IV rank > 50".into(), "Defined risk only".into()],
        color: "#3b82f6".into(),
        archived: false,
        created_at: T0.into(),
    }
}

fn option_leg(id: &str, kind: &str, strike: f64) -> Leg {
    Leg {
        id: id.into(),
        kind: kind.into(),
        underlying: "SPY".into(),
        strike: Some(strike),
        expiration: Some("2026-11-20".into()),
        multiplier: 100.0,
    }
}

fn execution(id: &str, leg_id: &str, side: &str, price: f64) -> Execution {
    Execution {
        id: id.into(),
        leg_id: leg_id.into(),
        side: side.into(),
        kind: "fill".into(),
        quantity: 1.0,
        price,
        fees: 0.65,
        executed_at: T0.into(),
        underlying_price: Some(580.25),
        note: String::new(),
    }
}

fn trade() -> Trade {
    Trade {
        id: TRADE.into(),
        account_id: ACCOUNT.into(),
        underlying: "spy".into(),
        asset_class: "option".into(),
        strategy: Some("bull_call_spread".into()),
        playbook_id: Some(PLAYBOOK.into()),
        tag_ids: vec![TAG_B.into(), TAG_A.into()],
        legs: vec![
            option_leg(LEG_1, "call", 580.0),
            option_leg(LEG_2, "call", 590.0),
        ],
        executions: vec![
            execution(EXEC_1, LEG_1, "buy", 6.4),
            execution(EXEC_2, LEG_2, "sell", 2.1),
        ],
        levels: vec![PriceLevel {
            id: LEVEL_1.into(),
            kind: "stop".into(),
            price: 572.0,
            set_at: T0.into(),
            note: "Below VWAP".into(),
        }],
        planned_risk: Some(430.0),
        thesis: "Breakout over 580".into(),
        review: String::new(),
        rating: Some(4),
        confidence: None,
        mfe: None,
        mae: None,
        created_at: T0.into(),
        updated_at: T0.into(),
    }
}

/// A database holding one account, playbook, two tags and the sample trade.
fn seeded() -> AppResult<Connection> {
    let mut conn = db::open_in_memory()?;
    repo::save_account(&conn, account())?;
    repo::save_playbook(&conn, playbook())?;
    repo::save_tag(&conn, tag(TAG_A, "Breakout"))?;
    repo::save_tag(&conn, tag(TAG_B, "FOMO"))?;
    repo::save_trade(&mut conn, trade())?;
    Ok(conn)
}

fn count(conn: &Connection, table: &str) -> AppResult<i64> {
    Ok(conn.query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |r| r.get(0))?)
}

#[test]
fn migrations_create_every_table() -> AppResult<()> {
    let conn = db::open_in_memory()?;
    for table in [
        "schema_migrations",
        "trading_account",
        "tag",
        "playbook",
        "trade",
        "trade_leg",
        "trade_execution",
        "trade_level",
        "trade_tag",
        "note",
        "user_settings",
        "provider_config",
        "bar_cache",
        "bar_coverage",
        "app_secrets",
    ] {
        let exists: bool = conn.query_row(
            "SELECT EXISTS (SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?1)",
            [table],
            |r| r.get(0),
        )?;
        assert!(exists, "missing table {table}");
    }
    let fk: i64 = conn.query_row("PRAGMA foreign_keys", [], |r| r.get(0))?;
    assert_eq!(fk, 1);
    Ok(())
}

#[test]
fn file_database_uses_wal() -> AppResult<()> {
    let dir = tempfile::tempdir()?;
    let conn = db::open(&dir.path().join("strikebook.db"))?;
    let mode: String = conn.query_row("PRAGMA journal_mode", [], |r| r.get(0))?;
    assert_eq!(mode.to_lowercase(), "wal");
    drop(conn);
    // Re-opening applies no migration twice.
    let conn = db::open(&dir.path().join("strikebook.db"))?;
    assert_eq!(count(&conn, "schema_migrations")?, 1);
    Ok(())
}

#[test]
fn trade_aggregate_round_trips_with_normalisation() -> AppResult<()> {
    let conn = seeded()?;
    let stored = repo::get_trade(&conn, TRADE)?.ok_or_else(|| AppError::not_found("trade"))?;
    let mut expected = trade();
    expected.underlying = "SPY".into();
    assert_eq!(stored, expected);
    // Tag order is preserved.
    assert_eq!(stored.tag_ids, vec![TAG_B.to_owned(), TAG_A.to_owned()]);
    assert_eq!(repo::list_trades(&conn)?.len(), 1);
    let accounts = repo::list_accounts(&conn)?;
    assert_eq!(accounts[0].name, "Margin");
    assert_eq!(accounts[0].currency, "USD");
    Ok(())
}

#[test]
fn saving_replaces_children() -> AppResult<()> {
    let mut conn = seeded()?;
    let mut edited = trade();
    edited.legs.truncate(1);
    edited.executions = vec![
        execution(EXEC_1, LEG_1, "buy", 6.4),
        execution(EXEC_3, LEG_1, "sell", 9.0),
    ];
    edited.levels.clear();
    edited.tag_ids = vec![TAG_A.into()];
    edited.review = "Took profit at target".into();
    repo::save_trade(&mut conn, edited)?;

    let stored = repo::get_trade(&conn, TRADE)?.ok_or_else(|| AppError::not_found("trade"))?;
    assert_eq!(stored.legs.len(), 1);
    let ids: Vec<&str> = stored.executions.iter().map(|e| e.id.as_str()).collect();
    assert_eq!(ids, vec![EXEC_1, EXEC_3]);
    assert!(stored.levels.is_empty());
    assert_eq!(stored.tag_ids, vec![TAG_A.to_owned()]);
    assert_eq!(stored.review, "Took profit at target");
    assert_eq!(count(&conn, "trade_leg")?, 1);
    assert_eq!(count(&conn, "trade_execution")?, 2);
    assert_eq!(count(&conn, "trade_level")?, 0);
    Ok(())
}

#[test]
fn invalid_trades_are_rejected_without_partial_writes() -> AppResult<()> {
    let mut conn = seeded()?;

    let mut orphan = trade();
    orphan.executions.push(execution(
        EXEC_3,
        "0199f0a2-0000-7000-8000-0000000000ff",
        "buy",
        1.0,
    ));
    assert!(matches!(
        repo::save_trade(&mut conn, orphan),
        Err(AppError::Validation(_))
    ));

    let mut no_strike = trade();
    no_strike.legs[0].strike = None;
    assert!(matches!(
        repo::save_trade(&mut conn, no_strike),
        Err(AppError::Validation(_))
    ));

    let mut zero_qty = trade();
    zero_qty.executions[0].quantity = 0.0;
    assert!(matches!(
        repo::save_trade(&mut conn, zero_qty),
        Err(AppError::Validation(_))
    ));

    let mut negative_price = trade();
    negative_price.executions[0].price = -1.0;
    assert!(matches!(
        repo::save_trade(&mut conn, negative_price),
        Err(AppError::Validation(_))
    ));

    let mut bad_id = trade();
    bad_id.id = "trade-1".into();
    assert!(matches!(
        repo::save_trade(&mut conn, bad_id),
        Err(AppError::Validation(_))
    ));

    // A dangling tag passes validation but fails the foreign key; the transaction rolls back.
    let mut dangling = trade();
    dangling.review = "should not persist".into();
    dangling.tag_ids = vec!["0199f0a2-0000-7000-8000-0000000000ee".into()];
    assert!(matches!(
        repo::save_trade(&mut conn, dangling),
        Err(AppError::Constraint(_))
    ));
    let stored = repo::get_trade(&conn, TRADE)?.ok_or_else(|| AppError::not_found("trade"))?;
    assert_eq!(stored.review, "");
    assert_eq!(stored.tag_ids.len(), 2);
    Ok(())
}

#[test]
fn deletes_cascade() -> AppResult<()> {
    let conn = seeded()?;

    // Removing a tag drops its links but keeps the trade.
    repo::remove_tag(&conn, TAG_B)?;
    let stored = repo::get_trade(&conn, TRADE)?.ok_or_else(|| AppError::not_found("trade"))?;
    assert_eq!(stored.tag_ids, vec![TAG_A.to_owned()]);

    // Removing a playbook nulls the reference.
    repo::remove_playbook(&conn, PLAYBOOK)?;
    let stored = repo::get_trade(&conn, TRADE)?.ok_or_else(|| AppError::not_found("trade"))?;
    assert_eq!(stored.playbook_id, None);

    // Removing the trade removes every child row.
    repo::remove_trade(&conn, TRADE)?;
    assert_eq!(repo::get_trade(&conn, TRADE)?, None);
    for table in ["trade_leg", "trade_execution", "trade_level", "trade_tag"] {
        assert_eq!(count(&conn, table)?, 0, "{table} not emptied");
    }
    Ok(())
}

#[test]
fn deleting_an_account_removes_its_trades() -> AppResult<()> {
    let conn = seeded()?;
    repo::remove_account(&conn, ACCOUNT)?;
    assert_eq!(count(&conn, "trade")?, 0);
    assert_eq!(count(&conn, "trade_execution")?, 0);
    Ok(())
}

#[test]
fn settings_default_and_save() -> AppResult<()> {
    let conn = db::open_in_memory()?;
    assert_eq!(repo::get_settings(&conn)?, UserSettings::default());
    let saved = repo::save_settings(
        &conn,
        UserSettings {
            display_name: " Billy ".into(),
            base_currency: "eur".into(),
            theme: "dark".into(),
            week_starts_on: 0,
            ..UserSettings::default()
        },
    )?;
    assert_eq!(saved.display_name, "Billy");
    assert_eq!(saved.base_currency, "EUR");
    assert_eq!(repo::get_settings(&conn)?, saved);

    let invalid = UserSettings {
        risk_free_rate: 0.5,
        ..UserSettings::default()
    };
    assert!(repo::save_settings(&conn, invalid).is_err());
    Ok(())
}

fn provider_input(id: &str, is_default: bool, key: Option<&str>) -> ProviderConfigInput {
    ProviderConfigInput {
        id: id.into(),
        provider: "massive".into(),
        label: format!("Massive {id}"),
        options: BTreeMap::from([("baseUrl".to_owned(), "https://api.massive.com".to_owned())]),
        is_default,
        secret: key.map(|k| HashMap::from([("apiKey".to_owned(), k.to_owned())])),
    }
}

#[test]
fn provider_default_switching_and_secrets() -> AppResult<()> {
    let mut conn = db::open_in_memory()?;
    let secrets = MemorySecrets::default();

    // The first provider becomes the default even when not asked.
    let a = repo::save_provider(
        &mut conn,
        &secrets,
        provider_input(PROVIDER_A, false, Some("abcd1234WXYZ")),
    )?;
    assert!(a.is_default);
    assert_eq!(a.secret_hint.as_deref(), Some("••••WXYZ"));

    // A second, non-default provider leaves A as the default.
    let b = repo::save_provider(&mut conn, &secrets, provider_input(PROVIDER_B, false, None))?;
    assert!(!b.is_default);
    assert_eq!(b.secret_hint, None);

    // Choosing B as default clears A.
    repo::save_provider(&mut conn, &secrets, provider_input(PROVIDER_B, true, None))?;
    let defaults: Vec<String> = repo::list_providers(&conn)?
        .into_iter()
        .filter(|p| p.is_default)
        .map(|p| p.id)
        .collect();
    assert_eq!(defaults, vec![PROVIDER_B.to_owned()]);

    // Editing without a secret keeps the stored one and its hint.
    let edited = repo::save_provider(&mut conn, &secrets, provider_input(PROVIDER_A, false, None))?;
    assert_eq!(edited.secret_hint.as_deref(), Some("••••WXYZ"));
    assert_eq!(edited.created_at, a.created_at);
    let secret = repo::provider_secret(&conn, &secrets, PROVIDER_A)?;
    assert_eq!(
        secret.get("apiKey").map(String::as_str),
        Some("abcd1234WXYZ")
    );

    // The list never carries secrets.
    let listed = serde_json::to_string(&repo::list_providers(&conn)?)?;
    assert!(!listed.contains("abcd1234WXYZ"));

    // Removing the default promotes the remaining provider and deletes the secret.
    repo::remove_provider(&mut conn, &secrets, PROVIDER_B)?;
    let remaining = repo::list_providers(&conn)?;
    assert_eq!(remaining.len(), 1);
    assert!(remaining[0].is_default);
    repo::remove_provider(&mut conn, &secrets, PROVIDER_A)?;
    assert!(
        secrets
            .0
            .lock()
            .map_err(|_| AppError::LockPoisoned)?
            .is_empty()
    );
    assert!(matches!(
        repo::provider_secret(&conn, &secrets, PROVIDER_A),
        Err(AppError::NotFound(_))
    ));
    Ok(())
}

fn bar(time_s: f64) -> Bar {
    Bar {
        time: time_s,
        open: 100.0,
        high: 101.0,
        low: 99.0,
        close: 100.5,
        volume: 1_000.0,
    }
}

#[test]
fn bars_cache_requires_full_coverage() -> AppResult<()> {
    let mut conn = db::open_in_memory()?;
    let secrets = MemorySecrets::default();
    repo::save_provider(
        &mut conn,
        &secrets,
        provider_input(PROVIDER_A, true, Some("k")),
    )?;
    let key = BarsCacheKey {
        provider: PROVIDER_A.into(),
        instrument: "SPY".into(),
        timeframe: "1h".into(),
    };
    let hour = 3_600_000_i64;

    // Nothing stored yet.
    assert_eq!(repo::read_bars(&conn, &key, 0, 10 * hour)?, None);

    // Hours 0..5 and 4..10 written as two overlapping windows.
    let first: Vec<Bar> = (0..5).map(|h| bar((h * 3600) as f64)).collect();
    let second: Vec<Bar> = (4..10).map(|h| bar((h * 3600) as f64)).collect();
    repo::write_bars(&mut conn, &key, &first, 0, 5 * hour)?;
    repo::write_bars(&mut conn, &key, &second, 4 * hour, 10 * hour)?;
    assert_eq!(count(&conn, "bar_coverage")?, 1, "overlapping ranges merge");

    let all =
        repo::read_bars(&conn, &key, 0, 10 * hour)?.ok_or_else(|| AppError::not_found("bars"))?;
    assert_eq!(all.len(), 10);
    assert!(all.windows(2).all(|w| w[0].time < w[1].time));

    // A sub-window returns just its bars (including the bar that opened before `from`).
    let part = repo::read_bars(&conn, &key, 2 * hour + 1, 4 * hour)?
        .ok_or_else(|| AppError::not_found("bars"))?;
    let times: Vec<f64> = part.iter().map(|b| b.time).collect();
    assert_eq!(times, vec![7200.0, 10_800.0, 14_400.0]);

    // Disjoint windows leave a gap that is not covered.
    repo::write_bars(&mut conn, &key, &[bar(20.0 * 3600.0)], 20 * hour, 21 * hour)?;
    assert_eq!(repo::read_bars(&conn, &key, 0, 21 * hour)?, None);
    assert!(repo::read_bars(&conn, &key, 20 * hour, 21 * hour)?.is_some());

    // Other timeframes and instruments do not share coverage.
    let daily = BarsCacheKey {
        timeframe: "1D".into(),
        ..key.clone()
    };
    assert_eq!(repo::read_bars(&conn, &daily, 0, hour)?, None);

    // Invalid input is rejected.
    let bad = BarsCacheKey {
        timeframe: "2h".into(),
        ..key.clone()
    };
    assert!(repo::read_bars(&conn, &bad, 0, hour).is_err());
    assert!(repo::read_bars(&conn, &key, hour, hour).is_err());

    // Removing the provider drops its cache.
    repo::remove_provider(&mut conn, &secrets, PROVIDER_A)?;
    assert_eq!(count(&conn, "bar_cache")?, 0);
    assert_eq!(count(&conn, "bar_coverage")?, 0);
    Ok(())
}

#[test]
fn export_import_round_trip() -> AppResult<()> {
    let mut source = seeded()?;
    repo::save_note(
        &source,
        Note {
            id: NOTE.into(),
            date: "2026-10-20".into(),
            title: "Premarket".into(),
            body: "CPI at 8:30".into(),
            kind: "premarket".into(),
            created_at: T0.into(),
            updated_at: T0.into(),
        },
    )?;
    repo::save_settings(
        &source,
        UserSettings {
            display_name: "Billy".into(),
            ..UserSettings::default()
        },
    )?;
    let exported = repo::export_all(&source)?;
    assert_eq!(exported.format, "strikebook.journal");
    assert_eq!(exported.version, 1);

    // Through JSON, exactly as the webview sends it.
    let json = serde_json::to_string(&exported)?;
    let parsed: JournalExport = serde_json::from_str(&json)?;

    let mut target = db::open_in_memory()?;
    let summary = repo::import_all(&mut target, parsed)?;
    assert_eq!(summary.trades, 1);
    let reexported = repo::export_all(&target)?;
    assert_eq!(
        JournalExport {
            exported_at: exported.exported_at.clone(),
            ..reexported
        },
        exported
    );

    // Importing twice upserts instead of duplicating.
    repo::import_all(&mut target, exported.clone())?;
    assert_eq!(count(&target, "trade")?, 1);
    assert_eq!(count(&target, "trade_execution")?, 2);

    // Wrong format is rejected.
    let wrong = JournalExport {
        format: "other".into(),
        ..exported
    };
    assert!(repo::import_all(&mut target, wrong).is_err());

    // Reset keeps providers and settings.
    let secrets = MemorySecrets::default();
    repo::save_provider(
        &mut source,
        &secrets,
        provider_input(PROVIDER_A, true, Some("k")),
    )?;
    repo::reset(&mut source)?;
    for table in [
        "trade",
        "trade_leg",
        "note",
        "tag",
        "playbook",
        "trading_account",
    ] {
        assert_eq!(count(&source, table)?, 0, "{table} not reset");
    }
    assert_eq!(repo::list_providers(&source)?.len(), 1);
    assert_eq!(repo::get_settings(&source)?.display_name, "Billy");
    Ok(())
}

#[test]
fn import_rolls_back_on_failure() -> AppResult<()> {
    let mut conn = db::open_in_memory()?;
    let mut data = repo::export_all(&seeded()?)?;
    // A trade whose account is not in the file and not in the database.
    data.accounts.clear();
    assert!(matches!(
        repo::import_all(&mut conn, data),
        Err(AppError::Constraint(_))
    ));
    assert_eq!(count(&conn, "tag")?, 0);
    assert_eq!(count(&conn, "user_settings")?, 0);
    Ok(())
}
