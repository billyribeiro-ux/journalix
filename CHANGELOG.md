# Changelog

All notable changes to Journalix. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.1.0] - 2026-10-20

First early-access build: web and desktop.

### Added

- Trade journal with legs and individual fills (entries, adds, partial exits, exits, expirations, assignments, exercises), stop and target history, thesis, review, ratings, tags and playbooks.
- Position engine (average cost per leg, fees, multipliers, flips), R-multiples from planned risk, stop or defined structure, and automatic detection of 30+ option strategies.
- Trade chart on TradingView Lightweight Charts: every fill as a marker, stop and target paths, average entry, risk and reward zones, underlying or contract view, timeframe choice, MFE and MAE.
- Options analytics: payoff at expiry and today, implied volatility solved from fills, entry Greeks and P&L attribution (delta, gamma, theta, vega, residual), premium captured, DTE buckets.
- Dashboard, six report tabs, P&L calendar with weekly totals and a 52-week heatmap, notebook, accounts, global filters, CSV export.
- Market data by your own API key: Massive (Polygon.io), Alpaca, Databento, Tiingo, plus a simulated provider. Bars are cached per provider.
- JSON export and import, a sample journal, and full journal reset.
- Web app: marketing site, blog, legal drafts, contact form, email and password accounts, PostgreSQL storage, encrypted provider keys.
- Desktop app: SQLite storage, provider keys in the OS keychain, native save dialog.
- Billing and pricing screens (no payment processing yet).
