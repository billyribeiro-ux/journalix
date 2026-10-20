# 5. Pinned toolchain and a 24-hour release delay

- Status: accepted
- Date: 2026-10-20

## Decision

- Node 24 LTS and pnpm 12 are pinned with `devEngines` (`onFail: download`), `.nvmrc` and `mise.toml`; npm and yarn are refused inside the repo.
- `minimumReleaseAge: 1440` blocks any npm version less than 24 hours old, and pnpm runs install scripts only for packages listed in `allowBuilds`.
- Every shared dependency is pinned once in the pnpm catalog. Rust crates are pinned with `=` and were all published more than 24 hours before adoption.
- Quality gates, run locally with `pnpm verify` and in `.github/workflows/ci.yml`: Prettier, ESLint (typescript-eslint strict), `svelte-check --fail-on-warnings`, Vitest, Playwright, `cargo fmt`, `cargo clippy -D warnings`, `cargo test`.

## Consequences

- A compromised release has a day to be caught before it can enter the lockfile.
- Upgrades are deliberate: bump the catalog entry, then run `pnpm verify`.
- When Node 26 becomes Active LTS, update the three pins together.
