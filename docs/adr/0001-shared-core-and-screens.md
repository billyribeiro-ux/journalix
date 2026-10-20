# 1. One core and one set of screens for web and desktop

- Status: accepted
- Date: 2026-10-20

## Context

Journalix ships as a hosted web app and a Tauri desktop app. Both need the same position math, reports and screens, but store data differently (PostgreSQL behind an HTTP API, SQLite behind Tauri commands).

## Decision

- `packages/core` holds everything that is not UI: schemas, the position engine, options math, analytics, market-data providers. It has no framework or I/O dependencies beyond `fetch` passed in by the caller.
- `packages/ui` holds every screen. Screens depend on two interfaces only: `JournalRepository` (storage) and `AppEnv` (routing, current user, file saving). They never import a router or build URLs.
- Each app supplies its own repository and env and maps `AppRoute` values to its own paths.

## Consequences

- A feature is written once and appears in both apps.
- Storage-specific rules (ownership checks, encryption, keychain) live in each app's backend and must be kept equivalent; the desktop Rust models mirror the core schemas and both are tested.
- The web journal pages are client-rendered (`ssr = false`); the marketing site is prerendered.
