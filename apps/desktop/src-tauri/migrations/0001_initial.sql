-- Strikebook desktop schema, version 1.
-- Timestamps are ISO-8601 TEXT, numbers are REAL. Child rows keep their array order in `position`.

CREATE TABLE trading_account (
    id               TEXT PRIMARY KEY NOT NULL,
    name             TEXT NOT NULL CHECK (length(trim(name)) > 0),
    broker           TEXT NOT NULL,
    currency         TEXT NOT NULL CHECK (length(currency) = 3),
    starting_balance REAL NOT NULL CHECK (starting_balance >= 0),
    archived         INTEGER NOT NULL CHECK (archived IN (0, 1)),
    created_at       TEXT NOT NULL
) STRICT;

CREATE TABLE tag (
    id       TEXT PRIMARY KEY NOT NULL,
    name     TEXT NOT NULL CHECK (length(trim(name)) > 0),
    category TEXT NOT NULL,
    color    TEXT NOT NULL
) STRICT;

CREATE TABLE playbook (
    id          TEXT PRIMARY KEY NOT NULL,
    name        TEXT NOT NULL CHECK (length(trim(name)) > 0),
    description TEXT NOT NULL,
    rules       TEXT NOT NULL CHECK (json_valid(rules)),
    color       TEXT NOT NULL,
    archived    INTEGER NOT NULL CHECK (archived IN (0, 1)),
    created_at  TEXT NOT NULL
) STRICT;

CREATE TABLE trade (
    id           TEXT PRIMARY KEY NOT NULL,
    account_id   TEXT NOT NULL REFERENCES trading_account (id) ON DELETE CASCADE,
    underlying   TEXT NOT NULL,
    asset_class  TEXT NOT NULL,
    strategy     TEXT,
    playbook_id  TEXT REFERENCES playbook (id) ON DELETE SET NULL,
    planned_risk REAL CHECK (planned_risk IS NULL OR planned_risk > 0),
    thesis       TEXT NOT NULL,
    review       TEXT NOT NULL,
    rating       INTEGER CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
    confidence   INTEGER CHECK (confidence IS NULL OR confidence BETWEEN 1 AND 5),
    mfe          REAL,
    mae          REAL,
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL
) STRICT;

CREATE INDEX trade_account_idx ON trade (account_id);
CREATE INDEX trade_playbook_idx ON trade (playbook_id);
CREATE INDEX trade_created_idx ON trade (created_at);

CREATE TABLE trade_leg (
    id         TEXT PRIMARY KEY NOT NULL,
    trade_id   TEXT NOT NULL REFERENCES trade (id) ON DELETE CASCADE,
    position   INTEGER NOT NULL,
    kind       TEXT NOT NULL,
    underlying TEXT NOT NULL,
    strike     REAL CHECK (strike IS NULL OR strike > 0),
    expiration TEXT,
    multiplier REAL NOT NULL CHECK (multiplier > 0)
) STRICT;

CREATE INDEX trade_leg_trade_idx ON trade_leg (trade_id, position);

CREATE TABLE trade_execution (
    id               TEXT PRIMARY KEY NOT NULL,
    trade_id         TEXT NOT NULL REFERENCES trade (id) ON DELETE CASCADE,
    leg_id           TEXT NOT NULL REFERENCES trade_leg (id) ON DELETE CASCADE,
    position         INTEGER NOT NULL,
    side             TEXT NOT NULL,
    kind             TEXT NOT NULL,
    quantity         REAL NOT NULL CHECK (quantity > 0),
    price            REAL NOT NULL CHECK (price >= 0),
    fees             REAL NOT NULL CHECK (fees >= 0),
    executed_at      TEXT NOT NULL,
    underlying_price REAL CHECK (underlying_price IS NULL OR underlying_price > 0),
    note             TEXT NOT NULL
) STRICT;

CREATE INDEX trade_execution_trade_idx ON trade_execution (trade_id, position);
CREATE INDEX trade_execution_leg_idx ON trade_execution (leg_id);

CREATE TABLE trade_level (
    id       TEXT PRIMARY KEY NOT NULL,
    trade_id TEXT NOT NULL REFERENCES trade (id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    kind     TEXT NOT NULL CHECK (kind IN ('stop', 'target')),
    price    REAL NOT NULL CHECK (price > 0),
    set_at   TEXT NOT NULL,
    note     TEXT NOT NULL
) STRICT;

CREATE INDEX trade_level_trade_idx ON trade_level (trade_id, position);

CREATE TABLE trade_tag (
    trade_id TEXT NOT NULL REFERENCES trade (id) ON DELETE CASCADE,
    tag_id   TEXT NOT NULL REFERENCES tag (id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    PRIMARY KEY (trade_id, tag_id)
) STRICT;

CREATE INDEX trade_tag_tag_idx ON trade_tag (tag_id);

CREATE TABLE note (
    id         TEXT PRIMARY KEY NOT NULL,
    date       TEXT NOT NULL,
    title      TEXT NOT NULL,
    body       TEXT NOT NULL,
    kind       TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
) STRICT;

CREATE INDEX note_date_idx ON note (date);

-- Single row (id = 1) holding the settings object as JSON.
CREATE TABLE user_settings (
    id   INTEGER PRIMARY KEY CHECK (id = 1),
    data TEXT NOT NULL CHECK (json_valid(data))
) STRICT;

-- No secret column: secrets live in the OS keychain (or `app_secrets` as a Linux fallback).
CREATE TABLE provider_config (
    id          TEXT PRIMARY KEY NOT NULL,
    provider    TEXT NOT NULL,
    label       TEXT NOT NULL CHECK (length(trim(label)) > 0),
    options     TEXT NOT NULL CHECK (json_valid(options)),
    is_default  INTEGER NOT NULL CHECK (is_default IN (0, 1)),
    -- Recognition hint only (e.g. "••••3F9A"), never the key itself.
    secret_hint TEXT,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
) STRICT;

CREATE UNIQUE INDEX provider_config_single_default ON provider_config (is_default) WHERE is_default = 1;

CREATE TABLE bar_cache (
    provider_config_id TEXT NOT NULL REFERENCES provider_config (id) ON DELETE CASCADE,
    instrument         TEXT NOT NULL,
    timeframe          TEXT NOT NULL,
    time               REAL NOT NULL,
    open               REAL NOT NULL,
    high               REAL NOT NULL,
    low                REAL NOT NULL,
    close              REAL NOT NULL,
    volume             REAL NOT NULL,
    PRIMARY KEY (provider_config_id, instrument, timeframe, time)
) STRICT, WITHOUT ROWID;

CREATE TABLE bar_coverage (
    id                 INTEGER PRIMARY KEY,
    provider_config_id TEXT NOT NULL REFERENCES provider_config (id) ON DELETE CASCADE,
    instrument         TEXT NOT NULL,
    timeframe          TEXT NOT NULL,
    from_ms            INTEGER NOT NULL,
    to_ms              INTEGER NOT NULL CHECK (to_ms > from_ms)
) STRICT;

CREATE INDEX bar_coverage_key_idx ON bar_coverage (provider_config_id, instrument, timeframe, from_ms);

-- Encrypted provider secrets, used only on Linux when no Secret Service daemon is available.
CREATE TABLE app_secrets (
    account    TEXT PRIMARY KEY NOT NULL,
    nonce      BLOB NOT NULL,
    ciphertext BLOB NOT NULL
) STRICT;
