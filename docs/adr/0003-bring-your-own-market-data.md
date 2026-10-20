# 3. Market data is bring-your-own-key

- Status: accepted
- Date: 2026-10-20

## Context

Candles behind each trade need a data source. Licences for redistributing market data are expensive and differ by provider; traders often already pay for one.

## Decision

- Providers are adapters implementing `MarketDataProvider` in `packages/core/src/market-data/providers`. Each declares its own Settings fields (secret, select, text), timeframes and whether it covers options.
- Users add any number of provider configs with their own keys and choose a default. Nothing is hard-coded.
- Bars are fetched only when a trade is opened, then cached per provider config, so a window is paid for once.
- A deterministic simulated provider generates candles that pass through the recorded fills, for demos and for users without a key; the chart labels it as simulated.

## Consequences

- Adding a provider is one file plus a registry entry, and a host allowlist entry on desktop.
- Web: keys are encrypted at rest with AES-256-GCM and only decrypted server-side. Desktop: keys are in the OS keychain.
- Provider quotas and billing are the user's; the cache keeps repeat views free.
