# Journalix Desktop

The native desktop edition of Journalix: a [Tauri 2](https://v2.tauri.app) shell around the shared
SvelteKit UI (`@journalix/ui`). The journal lives in a local SQLite database, and market-data API keys
are kept in the operating system's credential store. No account and no server are needed.

```
apps/desktop
├── src/                    SvelteKit 3 single-page app (adapter-static, SSR off)
│   ├── lib/env.ts          AppRoute → desktop paths, navigation, active route
│   ├── lib/tauri-repository.ts    JournalRepository over Tauri commands (the real app)
│   ├── lib/browser-repository.ts  localStorage JournalRepository (browser-only dev fallback)
│   └── routes/             one thin page per screen from @journalix/ui
├── static/theme-init.js    applies the saved theme before first paint (no inline script, so the CSP holds)
└── src-tauri/              Rust crate `journalix-desktop`
    ├── migrations/         versioned SQL, embedded in the binary
    ├── src/{db,repo,models,secrets,commands}.rs
    ├── capabilities/default.json  what the webview may call (commands + HTTP allowlist)
    ├── permissions/journal.toml   the `journal` permission set for the app's own commands
    └── tauri.conf.json
```

## Prerequisites

|                       |                                                                                                                                                                  |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node + pnpm           | versions pinned in the repo's `mise.toml` (`mise install`)                                                                                                       |
| Rust                  | stable toolchain via [rustup](https://rustup.rs) or `mise install` (the pinned `rust` entry)                                                                     |
| macOS                 | Xcode Command Line Tools: `xcode-select --install`                                                                                                               |
| Windows               | Microsoft C++ Build Tools ("Desktop development with C++") and the WebView2 runtime (preinstalled on Windows 10 1803+ and 11)                                    |
| Linux (Debian/Ubuntu) | `sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev libdbus-1-dev pkg-config` |

The full, current list is in Tauri's [prerequisites guide](https://v2.tauri.app/start/prerequisites/).

## Commands

Run from `apps/desktop` (or use the root `pnpm dev:desktop`).

| Command                                                           | What it does                                                                                                                                     |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm tauri dev`                                                  | Starts Vite on port 1420 and opens the app window with hot reload                                                                                |
| `pnpm tauri build`                                                | Release build plus installers for the current OS (`.dmg`/`.app`, `.msi`/`.exe`, `.deb`/`.rpm`/`.AppImage`) in `src-tauri/target/release/bundle/` |
| `pnpm tauri build --debug --no-bundle`                            | Fast debug binary, no installers                                                                                                                 |
| `pnpm dev`                                                        | The UI alone in a normal browser at http://localhost:1420 (uses the localStorage fallback)                                                       |
| `pnpm build`                                                      | Builds the static SPA into `build/` (Tauri runs this before bundling)                                                                            |
| `pnpm check`                                                      | `svelte-check` (type-checks Svelte and TypeScript)                                                                                               |
| `pnpm test`                                                       | Vitest unit tests                                                                                                                                |
| `cargo test`                                                      | Rust tests (run in `src-tauri`): migrations, trade aggregates, cascades, bars coverage, providers, import/export                                 |
| `cargo clippy --all-targets -- -D warnings` / `cargo fmt --check` | Rust lint and format gates                                                                                                                       |

`pnpm tauri icon <1024px.png>` regenerates `src-tauri/icons/` (the source is `src-tauri/icons/app-icon.png`).

## Where the data lives

The database is `journalix.db` (SQLite, WAL mode) in Tauri's app data directory for the identifier
`com.journalix.desktop`:

| OS      | Directory                                                                                 |
| ------- | ----------------------------------------------------------------------------------------- |
| macOS   | `~/Library/Application Support/com.journalix.desktop/`                                    |
| Windows | `%APPDATA%\com.journalix.desktop\`                                                        |
| Linux   | `$XDG_DATA_HOME/com.journalix.desktop/` (default `~/.local/share/com.journalix.desktop/`) |

Back up the journal with **Settings → Data → Export** (a `journalix.journal` JSON file) or by copying
the directory while the app is closed. Logs go to the platform log directory via `tauri-plugin-log`.

Schema changes are new files in `src-tauri/migrations/`, added to `MIGRATIONS` in `src/db.rs`. They are
applied in one transaction at startup and recorded in `schema_migrations`. Never edit a shipped migration.

## How secrets are stored

Provider API keys never touch the database or the UI's provider list (which only shows a hint such as
`••••3F9A`). Each provider's secret map is stored as JSON in the OS credential store under service
`com.journalix.desktop`, with the provider configuration's id as the account:

- **macOS:** Keychain
- **Windows:** Credential Manager
- **Linux:** Secret Service (GNOME Keyring, KWallet)

Linux machines without a running Secret Service daemon fall back automatically (with a logged warning).
Secrets are then stored encrypted with ChaCha20-Poly1305 in the `app_secrets` table. The key is a random
32-byte `secrets.key` file (mode `0600`) next to the database. macOS and Windows always use the native store.

The webview reads a provider's secret (`providers_secret`) only to call that provider's API. It is
trusted local code, and the CSP blocks any other script source.

## Network access (HTTP allowlist)

The webview's CSP allows no outbound connections (`connect-src ipc: http://ipc.localhost`). Market data
goes through `tauri-plugin-http`, whose scope in `src-tauri/capabilities/default.json` allows only:

- `https://api.massive.com/*`
- `https://api.polygon.io/*`
- `https://data.alpaca.markets/*`
- `https://api.tiingo.com/*`
- `https://hist.databento.com/*`

Any other URL is rejected by the plugin before a request is made.

### Adding a provider host

1. Implement the provider in `packages/core/src/market-data/providers/` and register it (shared with the web app).
2. Add its API origin to the `http:default` → `allow` list in `src-tauri/capabilities/default.json`,
   e.g. `{ "url": "https://api.example.com/*" }`. Use the narrowest origin; never use wildcard hosts.
3. Add the provider id to `PROVIDER_IDS` in `src-tauri/src/models.rs` so the backend accepts its configuration.
4. Rebuild (`pnpm tauri dev`). `tauri-build` validates the capability file at compile time.

## Adding a backend command

1. Write the `#[tauri::command]` in `src-tauri/src/commands.rs` and register it in `generate_handler!` (`src/lib.rs`).
2. Add its name to `COMMANDS` in `src-tauri/build.rs`. This generates the `allow-<name>` permission.
3. Add `allow-<name>` (underscores become dashes) to `src-tauri/permissions/journal.toml`.
4. Call it from `src/lib/tauri-repository.ts`, validating arguments and results with the core schemas.

## Browser fallback

When the UI runs outside Tauri (`isTauri()` is false), it uses `browser-repository.ts`. This stores
everything in `localStorage` under `journalix:` keys, uses `fetch` directly and keeps bars in memory.
It exists for UI development, screenshots and end-to-end tests. It keeps provider secrets in plain
`localStorage`, so never use it for real keys. Direct browser requests to providers may also be blocked
by CORS, which the desktop app avoids by fetching from Rust.
