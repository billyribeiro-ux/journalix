# Journalix

An options-first trading journal that runs as a web app and as a desktop app. You log every leg and every fill by hand (entries, adds, partial exits, exits, expirations and assignments), and Journalix rebuilds the position, draws the trade on a TradingView Lightweight Charts chart with its stops, targets and risk zones, and rolls everything up into reports.

There is no brokerage connection and no AI in this phase. Market data comes from whichever provider you add a key for in **Settings → Market data**.

## What is in the repo

| Path            | What it is                                                                                                                                                                                                     |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core` | Framework-free TypeScript: Valibot domain schemas, the position engine, OCC symbology, Black-Scholes and IV, strategy detection, payoff, Greeks attribution, analytics, market-data providers, sample journal. |
| `packages/ui`   | Svelte 5 design system, D3 charts, the trade chart, and every app screen. Screens talk to a `JournalRepository` and an `AppEnv`, so both apps share them.                                                      |
| `apps/web`      | SvelteKit 3.1 web app: marketing site, auth (Better Auth), REST API, PostgreSQL via Drizzle, encrypted provider keys, bars cache.                                                                              |
| `apps/desktop`  | Tauri 2 desktop app: the same screens over SQLite (rusqlite), provider keys in the OS keychain, provider calls through a host allowlist.                                                                       |
| `docs/adr`      | Architecture decisions.                                                                                                                                                                                        |

## Toolchain

Pinned in `package.json` (`devEngines`), `.nvmrc` and `mise.toml`:

- Node.js 24.22.0 (Active LTS)
- pnpm 12.14.0
- Rust 1.97.0 (desktop only; the crate's minimum is 1.90)
- PostgreSQL 15 or later (web only)

`pnpm-workspace.yaml` refuses any package version published less than 24 hours ago (`minimumReleaseAge: 1440`), and every shared dependency is pinned once in the catalog.

## Getting started

```sh
mise install          # or install Node 24.22.0 and pnpm 12.14.0 yourself
pnpm install
```

### Web

```sh
cp apps/web/.env.example apps/web/.env    # then fill in the secrets
pnpm --filter @journalix/web db:migrate
pnpm dev:web                              # http://localhost:5173
```

See [`apps/web/README.md`](apps/web/README.md) for environment variables, migrations and deployment.

### Desktop

```sh
pnpm dev:desktop
```

See [`apps/desktop/README.md`](apps/desktop/README.md) for platform prerequisites and packaging.

### Try it with sample data

Sign up, open **Settings → Import and export → Load sample journal**, and keep **Add the simulated data provider** ticked. You get about six months of stock and options trades in two accounts, with generated candles behind every trade.

## Market data

Add a provider in **Settings → Market data**. Each one is configured by its own API key; nothing is hard-coded.

| Provider             | Stocks | Options | Notes                                                      |
| -------------------- | ------ | ------- | ---------------------------------------------------------- |
| Massive (Polygon.io) | Yes    | Yes     | Options bars need a plan that includes options.            |
| Alpaca               | Yes    | Yes     | Options history starts February 2024.                      |
| Databento            | Yes    | Yes     | Billed per request; bars are cached after the first fetch. |
| Tiingo               | Yes    | No      | Intraday bars come from IEX.                               |
| Simulated            | Yes    | Yes     | Generated prices that pass through your fills. No key.     |

Adding another provider means one file in `packages/core/src/market-data/providers/` that implements `MarketDataProvider`, plus an entry in `registry.ts`. The Settings form, validation, caching, the web API and the desktop app all read the provider's `fields`, so nothing else changes. On desktop, also add the provider's host to `apps/desktop/src-tauri/capabilities/default.json`.

## Scripts

| Command                                 | Runs                                                       |
| --------------------------------------- | ---------------------------------------------------------- |
| `pnpm lint`                             | Prettier check and ESLint across the workspace             |
| `pnpm check`                            | `svelte-check --fail-on-warnings` in every package         |
| `pnpm test`                             | Vitest in every package                                    |
| `pnpm build`                            | Production builds of both apps                             |
| `pnpm verify`                           | All of the above, in that order                            |
| `pnpm --filter @journalix/web test:e2e` | Playwright against a production build (needs the database) |

Rust checks live in `apps/desktop/src-tauri`: `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, `cargo test`.

## Not in this phase

- Brokerage import and sync
- AI review
- Payments: the billing screen and pricing page are UI only; every account has full access during early access
- Password reset by email (there is no mail transport yet)

## Licence

Proprietary. All rights reserved.
