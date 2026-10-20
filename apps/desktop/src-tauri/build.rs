/// Commands exposed to the webview. `tauri-build` generates an `allow-<command>` / `deny-<command>`
/// permission for each one (underscores become dashes); `permissions/journal.toml` groups them
/// into the `journal` set that `capabilities/default.json` grants. Keep this list in sync with
/// `generate_handler!` in `src/lib.rs`.
const COMMANDS: &[&str] = &[
    "accounts_list",
    "accounts_save",
    "accounts_remove",
    "tags_list",
    "tags_save",
    "tags_remove",
    "playbooks_list",
    "playbooks_save",
    "playbooks_remove",
    "notes_list",
    "notes_save",
    "notes_remove",
    "trades_list",
    "trades_get",
    "trades_save",
    "trades_remove",
    "settings_get",
    "settings_save",
    "providers_list",
    "providers_save",
    "providers_remove",
    "providers_secret",
    "bars_read",
    "bars_write",
    "data_export",
    "data_import",
    "data_reset",
    "file_save",
];

fn main() {
    tauri_build::try_build(
        tauri_build::Attributes::new()
            .app_manifest(tauri_build::AppManifest::new().commands(COMMANDS)),
    )
    .unwrap_or_else(|error| panic!("tauri-build failed: {error:#}"));
}
