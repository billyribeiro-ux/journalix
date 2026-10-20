//! SQLite connection setup and embedded, versioned migrations.

use std::path::Path;
use std::time::Duration;

use rusqlite::{Connection, OptionalExtension, params};

use crate::error::{AppError, AppResult};

/// Ordered migrations. Never edit a shipped entry; append a new one instead.
const MIGRATIONS: &[(i64, &str, &str)] =
    &[(1, "initial", include_str!("../migrations/0001_initial.sql"))];

/// Opens (or creates) the journal database at `path` and brings its schema up to date.
pub fn open(path: &Path) -> AppResult<Connection> {
    let conn = Connection::open(path)?;
    // WAL lets readers proceed while a write is in progress and survives crashes cleanly.
    let mode: String =
        conn.pragma_update_and_check(None, "journal_mode", "WAL", |row| row.get(0))?;
    if !mode.eq_ignore_ascii_case("wal") {
        log::warn!("SQLite refused WAL mode; using {mode}");
    }
    configure(conn)
}

/// Opens a private in-memory database with the full schema (tests and tooling).
pub fn open_in_memory() -> AppResult<Connection> {
    configure(Connection::open_in_memory()?)
}

fn configure(mut conn: Connection) -> AppResult<Connection> {
    conn.busy_timeout(Duration::from_secs(5))?;
    conn.pragma_update(None, "foreign_keys", "ON")?;
    conn.pragma_update(None, "synchronous", "NORMAL")?;
    let enabled: i64 = conn.pragma_query_value(None, "foreign_keys", |row| row.get(0))?;
    if enabled != 1 {
        return Err(AppError::validation(
            "This SQLite build does not support foreign keys",
        ));
    }
    migrate(&mut conn)?;
    Ok(conn)
}

/// Applies every pending migration in a single transaction.
pub fn migrate(conn: &mut Connection) -> AppResult<()> {
    let tx = conn.transaction()?;
    tx.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
             version    INTEGER PRIMARY KEY NOT NULL,
             name       TEXT NOT NULL,
             applied_at TEXT NOT NULL
         ) STRICT;",
    )?;
    let current: i64 = tx
        .query_row("SELECT MAX(version) FROM schema_migrations", [], |row| {
            row.get::<_, Option<i64>>(0)
        })
        .optional()?
        .flatten()
        .unwrap_or(0);
    let latest = MIGRATIONS.last().map_or(0, |(version, _, _)| *version);
    if current > latest {
        return Err(AppError::validation(format!(
            "The journal database was created by a newer Journalix (schema {current}); update the app"
        )));
    }
    for (version, name, sql) in MIGRATIONS.iter().filter(|(v, _, _)| *v > current) {
        tx.execute_batch(sql)?;
        tx.execute(
            "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?1, ?2, ?3)",
            params![version, name, crate::repo::now_iso()],
        )?;
        log::info!("Applied database migration {version} ({name})");
    }
    tx.commit()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn migrations_are_idempotent() -> AppResult<()> {
        let mut conn = open_in_memory()?;
        migrate(&mut conn)?;
        let applied: i64 =
            conn.query_row("SELECT COUNT(*) FROM schema_migrations", [], |r| r.get(0))?;
        assert_eq!(applied, MIGRATIONS.len() as i64);
        Ok(())
    }
}
