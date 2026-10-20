#![deny(clippy::all)]

//! Journalix desktop: a Tauri 2 shell around the shared SvelteKit UI, with the journal stored
//! in SQLite and provider secrets in the operating system's credential store.

pub mod commands;
pub mod db;
pub mod error;
pub mod models;
pub mod repo;
pub mod secrets;
mod validate;

use std::sync::Arc;

use tauri::Manager;

use crate::commands::{AppState, SharedState};
use crate::error::{AppError, AppResult};
use crate::secrets::KeychainStore;

const DATABASE_FILE: &str = "journalix.db";
const SECRET_KEY_FILE: &str = "secrets.key";

/// Opens the database in the app data directory and builds the shared state.
fn init_state(app: &tauri::App) -> AppResult<SharedState> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|error| AppError::AppDir(error.to_string()))?;
    std::fs::create_dir_all(&dir)?;
    let conn = db::open(&dir.join(DATABASE_FILE))?;
    let secrets = KeychainStore::new(dir.join(SECRET_KEY_FILE));
    log::info!("Journal database: {}", dir.join(DATABASE_FILE).display());
    Ok(Arc::new(AppState::new(conn, Box::new(secrets))))
}

/// Builds and runs the application. Exits the process with an error message if Tauri fails
/// to start (for example when no display or webview runtime is available).
pub fn run() {
    let result = tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .setup(|app| {
            let state = init_state(app)?;
            app.manage(state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::accounts_list,
            commands::accounts_save,
            commands::accounts_remove,
            commands::tags_list,
            commands::tags_save,
            commands::tags_remove,
            commands::playbooks_list,
            commands::playbooks_save,
            commands::playbooks_remove,
            commands::notes_list,
            commands::notes_save,
            commands::notes_remove,
            commands::trades_list,
            commands::trades_get,
            commands::trades_save,
            commands::trades_remove,
            commands::settings_get,
            commands::settings_save,
            commands::providers_list,
            commands::providers_save,
            commands::providers_remove,
            commands::providers_secret,
            commands::bars_read,
            commands::bars_write,
            commands::data_export,
            commands::data_import,
            commands::data_reset,
            commands::file_save,
        ])
        .run(tauri::generate_context!());

    if let Err(error) = result {
        eprintln!("Journalix failed to start: {error}");
        std::process::exit(1);
    }
}
