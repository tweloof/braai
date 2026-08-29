-- Inferred D1 schema for the communal fire (/api/vuur).
-- Reconstructed from the live JSON shape on 29 Aug 2026.
-- Production D1 database `vuur` (id 1f639f7b-2e48-4d1a-b3c6-8db38429fab7)
-- already has data. Do not DROP these tables. Do not run a destructive
-- migration against production. The Pages function uses
-- CREATE TABLE IF NOT EXISTS on first request for a fresh local D1, then
-- detects existing table/column names and adapts.

CREATE TABLE IF NOT EXISTS fires (
  no INTEGER PRIMARY KEY,
  lit_at INTEGER NOT NULL,
  out_at INTEGER
);

CREATE TABLE IF NOT EXISTS logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fire_no INTEGER NOT NULL,
  ts INTEGER NOT NULL,
  kind TEXT NOT NULL,
  who TEXT NOT NULL,
  town TEXT NOT NULL,
  text TEXT NOT NULL,
  token TEXT,
  reply_text TEXT,
  reply_who TEXT,
  reply_town TEXT,
  reply_ts INTEGER
);
