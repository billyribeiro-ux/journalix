//! Tauri commands. Each one runs its database work on the blocking thread pool so SQLite and
//! credential-store calls never stall the async runtime that drives the webview.

use std::sync::{Arc, Mutex};

use rusqlite::Connection;
use tauri::State;

use crate::error::{AppError, AppResult};
use crate::models::{
    Account, Bar, BarsCacheKey, ImportSummary, JournalExport, Note, Playbook, ProviderConfigInput,
    ProviderConfigView, ProviderSecret, Tag, Trade, UserSettings,
};
use crate::repo;
use crate::secrets::SecretStore;

/// Everything the commands share: one SQLite connection (SQLite serialises writers anyway, and
/// a personal journal is small) and the secret store.
pub struct AppState {
    conn: Mutex<Connection>,
    secrets: Box<dyn SecretStore>,
}

impl AppState {
    pub fn new(conn: Connection, secrets: Box<dyn SecretStore>) -> Self {
        Self {
            conn: Mutex::new(conn),
            secrets,
        }
    }
}

pub type SharedState = Arc<AppState>;

/// Runs `work` with the connection on the blocking pool.
async fn with_db<T, F>(state: &SharedState, work: F) -> AppResult<T>
where
    T: Send + 'static,
    F: FnOnce(&mut Connection, &dyn SecretStore) -> AppResult<T> + Send + 'static,
{
    let state = Arc::clone(state);
    tauri::async_runtime::spawn_blocking(move || {
        let mut conn = state.conn.lock().map_err(|_| AppError::LockPoisoned)?;
        work(&mut conn, state.secrets.as_ref())
    })
    .await
    .map_err(|error| AppError::Internal(error.to_string()))?
}

/// Converts a JavaScript millisecond timestamp to an integer, rejecting NaN and infinities.
fn millis(field: &str, value: f64) -> AppResult<i64> {
    if value.is_finite() && (0.0..=9.0e15).contains(&value) {
        Ok(value.round() as i64)
    } else {
        Err(AppError::validation(format!(
            "{field} must be a UTC millisecond timestamp"
        )))
    }
}

// --- Accounts --------------------------------------------------------------------------------

#[tauri::command]
pub async fn accounts_list(state: State<'_, SharedState>) -> AppResult<Vec<Account>> {
    with_db(&state, |conn, _| repo::list_accounts(conn)).await
}

#[tauri::command]
pub async fn accounts_save(state: State<'_, SharedState>, account: Account) -> AppResult<Account> {
    with_db(&state, move |conn, _| repo::save_account(conn, account)).await
}

#[tauri::command]
pub async fn accounts_remove(state: State<'_, SharedState>, id: String) -> AppResult<()> {
    with_db(&state, move |conn, _| repo::remove_account(conn, &id)).await
}

// --- Tags ------------------------------------------------------------------------------------

#[tauri::command]
pub async fn tags_list(state: State<'_, SharedState>) -> AppResult<Vec<Tag>> {
    with_db(&state, |conn, _| repo::list_tags(conn)).await
}

#[tauri::command]
pub async fn tags_save(state: State<'_, SharedState>, tag: Tag) -> AppResult<Tag> {
    with_db(&state, move |conn, _| repo::save_tag(conn, tag)).await
}

#[tauri::command]
pub async fn tags_remove(state: State<'_, SharedState>, id: String) -> AppResult<()> {
    with_db(&state, move |conn, _| repo::remove_tag(conn, &id)).await
}

// --- Playbooks -------------------------------------------------------------------------------

#[tauri::command]
pub async fn playbooks_list(state: State<'_, SharedState>) -> AppResult<Vec<Playbook>> {
    with_db(&state, |conn, _| repo::list_playbooks(conn)).await
}

#[tauri::command]
pub async fn playbooks_save(
    state: State<'_, SharedState>,
    playbook: Playbook,
) -> AppResult<Playbook> {
    with_db(&state, move |conn, _| repo::save_playbook(conn, playbook)).await
}

#[tauri::command]
pub async fn playbooks_remove(state: State<'_, SharedState>, id: String) -> AppResult<()> {
    with_db(&state, move |conn, _| repo::remove_playbook(conn, &id)).await
}

// --- Notes -----------------------------------------------------------------------------------

#[tauri::command]
pub async fn notes_list(state: State<'_, SharedState>) -> AppResult<Vec<Note>> {
    with_db(&state, |conn, _| repo::list_notes(conn)).await
}

#[tauri::command]
pub async fn notes_save(state: State<'_, SharedState>, note: Note) -> AppResult<Note> {
    with_db(&state, move |conn, _| repo::save_note(conn, note)).await
}

#[tauri::command]
pub async fn notes_remove(state: State<'_, SharedState>, id: String) -> AppResult<()> {
    with_db(&state, move |conn, _| repo::remove_note(conn, &id)).await
}

// --- Trades ----------------------------------------------------------------------------------

#[tauri::command]
pub async fn trades_list(state: State<'_, SharedState>) -> AppResult<Vec<Trade>> {
    with_db(&state, |conn, _| repo::list_trades(conn)).await
}

#[tauri::command]
pub async fn trades_get(state: State<'_, SharedState>, id: String) -> AppResult<Option<Trade>> {
    with_db(&state, move |conn, _| repo::get_trade(conn, &id)).await
}

#[tauri::command]
pub async fn trades_save(state: State<'_, SharedState>, trade: Trade) -> AppResult<Trade> {
    with_db(&state, move |conn, _| repo::save_trade(conn, trade)).await
}

#[tauri::command]
pub async fn trades_remove(state: State<'_, SharedState>, id: String) -> AppResult<()> {
    with_db(&state, move |conn, _| repo::remove_trade(conn, &id)).await
}

// --- Settings --------------------------------------------------------------------------------

#[tauri::command]
pub async fn settings_get(state: State<'_, SharedState>) -> AppResult<UserSettings> {
    with_db(&state, |conn, _| repo::get_settings(conn)).await
}

#[tauri::command]
pub async fn settings_save(
    state: State<'_, SharedState>,
    settings: UserSettings,
) -> AppResult<UserSettings> {
    with_db(&state, move |conn, _| repo::save_settings(conn, settings)).await
}

// --- Providers -------------------------------------------------------------------------------

#[tauri::command]
pub async fn providers_list(state: State<'_, SharedState>) -> AppResult<Vec<ProviderConfigView>> {
    with_db(&state, |conn, _| repo::list_providers(conn)).await
}

#[tauri::command]
pub async fn providers_save(
    state: State<'_, SharedState>,
    input: ProviderConfigInput,
) -> AppResult<ProviderConfigView> {
    with_db(&state, move |conn, secrets| {
        repo::save_provider(conn, secrets, input)
    })
    .await
}

#[tauri::command]
pub async fn providers_remove(state: State<'_, SharedState>, id: String) -> AppResult<()> {
    with_db(&state, move |conn, secrets| {
        repo::remove_provider(conn, secrets, &id)
    })
    .await
}

/// Returns the provider's secret so the (trusted, local) webview can call the provider API.
#[tauri::command]
pub async fn providers_secret(
    state: State<'_, SharedState>,
    id: String,
) -> AppResult<ProviderSecret> {
    with_db(&state, move |conn, secrets| {
        repo::provider_secret(conn, secrets, &id)
    })
    .await
}

// --- Bars cache ------------------------------------------------------------------------------

#[tauri::command]
pub async fn bars_read(
    state: State<'_, SharedState>,
    key: BarsCacheKey,
    from: f64,
    to: f64,
) -> AppResult<Option<Vec<Bar>>> {
    let (from, to) = (millis("from", from)?, millis("to", to)?);
    with_db(&state, move |conn, _| repo::read_bars(conn, &key, from, to)).await
}

#[tauri::command]
pub async fn bars_write(
    state: State<'_, SharedState>,
    key: BarsCacheKey,
    bars: Vec<Bar>,
    from: f64,
    to: f64,
) -> AppResult<()> {
    let (from, to) = (millis("from", from)?, millis("to", to)?);
    with_db(&state, move |conn, _| {
        repo::write_bars(conn, &key, &bars, from, to)
    })
    .await
}

// --- Data ------------------------------------------------------------------------------------

#[tauri::command]
pub async fn data_export(state: State<'_, SharedState>) -> AppResult<JournalExport> {
    with_db(&state, |conn, _| repo::export_all(conn)).await
}

#[tauri::command]
pub async fn data_import(
    state: State<'_, SharedState>,
    data: JournalExport,
) -> AppResult<ImportSummary> {
    with_db(&state, move |conn, _| repo::import_all(conn, data)).await
}

#[tauri::command]
pub async fn data_reset(state: State<'_, SharedState>) -> AppResult<()> {
    with_db(&state, |conn, _| repo::reset(conn)).await
}

// --- Files -----------------------------------------------------------------------------------

/// Largest file the webview may ask to write (exports and CSVs are far smaller).
const MAX_SAVE_BYTES: usize = 200 * 1024 * 1024;

/// Shows a native save dialog and writes `contents` to the chosen path. Returns `false` when the
/// user cancels. The webview never supplies a path, so it can only write where the user picks.
#[tauri::command]
pub async fn file_save(app: tauri::AppHandle, name: String, contents: String) -> AppResult<bool> {
    use tauri_plugin_dialog::DialogExt;

    if contents.len() > MAX_SAVE_BYTES {
        return Err(AppError::validation("The file is too large to save"));
    }
    let file_name: String = name
        .chars()
        .filter(|c| !matches!(c, '/' | '\\' | ':' | '\0'))
        .take(200)
        .collect();
    // Only the formats the app produces, so the page cannot suggest an executable file type.
    let (extension, label) = match file_name
        .rsplit_once('.')
        .map(|(_, ext)| ext.to_ascii_lowercase())
    {
        Some(ext) if ext == "json" => (ext, "Journalix journal"),
        Some(ext) if ext == "csv" => (ext, "CSV spreadsheet"),
        _ => {
            return Err(AppError::validation(
                "Only .json and .csv files can be saved",
            ));
        }
    };

    tauri::async_runtime::spawn_blocking(move || {
        let dialog = app
            .dialog()
            .file()
            .set_file_name(&file_name)
            .add_filter(label, &[extension.as_str()]);
        match dialog.blocking_save_file() {
            None => Ok(false),
            Some(target) => {
                let path = target
                    .into_path()
                    .map_err(|error| AppError::Internal(error.to_string()))?;
                std::fs::write(path, contents.as_bytes())?;
                Ok(true)
            }
        }
    })
    .await
    .map_err(|error| AppError::Internal(error.to_string()))?
}
