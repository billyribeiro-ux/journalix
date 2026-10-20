# 2. Fills are the source of truth

- Status: accepted
- Date: 2026-10-20

## Context

Retail journals often store a trade as one entry and one exit. Options traders scale in, take partials, roll legs and get assigned, so that model cannot reproduce real P&L or show the trade on a chart.

## Decision

A trade is legs plus executions (`fill`, `expiration`, `assignment`, `exercise`) plus price levels (stops and targets, each change kept). Everything else (status, average entry and exit, P&L, R-multiple, strategy, max profit and loss, DTE) is derived by `packages/core/src/engine/position.ts` using average cost per leg. Nothing derived is stored.

## Consequences

- Editing any fill recomputes the whole trade consistently, in both apps.
- The chart can place every fill, and stops and targets can be drawn as step paths over time.
- Imports and exports only need the raw records, and the format is stable (`journalix.journal`, version 1).
