# Strikebook web

SvelteKit 3.1 app with the marketing site (`src/routes/(marketing)`), sign-in (`src/routes/(auth)`), the journal (`src/routes/app`, client-rendered with the shared screens from `@strikebook/ui`) and a JSON API (`src/routes/api`).

## Environment

Copy `.env.example` to `.env`. The four required variables are validated at start-up in `src/env.ts`; the other two are read by adapter-node.

| Variable              | Required       | Purpose                                                                                                                                  |
| --------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`        | Yes            | PostgreSQL 15+ connection string.                                                                                                        |
| `ORIGIN`              | Yes            | Public origin, such as `https://app.example.com`. Better Auth and the API origin check use it.                                           |
| `BETTER_AUTH_SECRET`  | Yes            | At least 32 characters. `openssl rand -base64 32`.                                                                                       |
| `PROVIDER_KEY_SECRET` | Yes            | Exactly 32 bytes, base64. Encrypts market-data API keys (AES-256-GCM). `openssl rand -base64 32`.                                        |
| `ADDRESS_HEADER`      | Behind a proxy | adapter-node header holding the client IP (for example `X-Forwarded-For` with `XFF_DEPTH`), used by the sign-in rate limits.             |
| `BODY_SIZE_LIMIT`     | No             | adapter-node request limit. The default (512 KB) is too small to import a large journal export; set `BODY_SIZE_LIMIT=50M` in production. |

Rotating `PROVIDER_KEY_SECRET` makes stored provider keys unreadable; users re-enter them in Settings.

## Database

```sh
pnpm db:migrate     # apply drizzle/*.sql
pnpm db:generate    # after editing src/lib/server/db/schema.ts
pnpm auth:schema    # after changing Better Auth plugins; then db:generate
```

Tables: Better Auth's `user`, `session`, `account`, `verification`; journal tables (`trading_account`, `trade`, `trade_leg`, `trade_execution`, `trade_level`, `trade_tag`, `tag`, `playbook`, `note`, `user_settings`); `provider_config` (encrypted key and a short hint only); `bar_cache` and `bar_coverage` (market data cached per provider config); `contact_message`.

## Security model

- Every journal query is scoped to the signed-in user, and nested writes (legs, fills, levels, tags) check ownership inside one transaction.
- `/api/*` (except Better Auth's own routes) requires a session, a same-origin `Origin` header on writes, and `application/json` bodies. Responses carry `Cache-Control: no-store`.
- Provider keys are encrypted with the config id as associated data and are only decrypted inside the request that calls the provider. The API returns a hint such as `••••3F9A`, never the key.
- A strict CSP is set through SvelteKit's `csp` option, so there are no inline scripts; the theme is applied before paint by `static/theme-init.js`.
- Passwords need at least 15 characters (NIST SP 800-63B).
- Sign-in is limited per client address and per account, and sign-up per address (`src/lib/server/rate-limit.ts`). The form actions call `auth.api.*` directly, which bypasses Better Auth's own HTTP rate limiter, so the limits are applied there. Counters live in process memory: run one instance, or move them to a shared store before scaling out.

## Running

```sh
pnpm dev            # http://localhost:5173
pnpm build && pnpm start
```

`pnpm start` runs `node build` (adapter-node). Put it behind a TLS-terminating proxy and set `ORIGIN` to the public URL.

## Tests

```sh
pnpm test                                   # server unit tests
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chrome pnpm test:e2e
```

The end-to-end suite builds the app, serves it with `vite preview` on port 4173 against the database in `.env`, signs up throwaway users and checks the marketing site, the auth guard, the sample journal (dashboard, reports, trade chart) and entering a trade fill by fill. Leave out `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to use the browser installed by `pnpm exec playwright install chromium`.

## Not yet included

- Password reset and email verification (no mail transport is configured).
- Account deletion from the UI. Users can delete all journal data in Settings.
- Stripe. The billing page and pricing page are UI only.
