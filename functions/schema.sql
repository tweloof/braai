-- Inferred D1 schema for the communal fire (/api/vuur).
-- Reconstructed from the live JSON shape on 29 Aug 2026.
-- Not the original source.
--
-- Production D1 database `vuur` (id 1f639f7b-2e48-4d1a-b3c6-8db38429fab7)
-- already has data. Do not DROP these tables. Do not run a destructive
-- migration against production.
--
-- The Pages function uses CREATE TABLE IF NOT EXISTS on first request for a
-- fresh local D1, then detects existing table/column names and adapts.
-- Fuel is not stored: the server recomputes it from logs
-- (+14 per log, −0.42 per hour, cap 100) and persists out_at when it hits 0.
--
-- Live founding fire (29 Aug 2026): no=1, litAt=1787608021, outAt=1787728021,
-- one log id=1 kind=fire who=braai.co.za town=Suid-Afrika.
-- 14 / 0.42 hours = 120000 seconds, which matches outAt − litAt.

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

-- Seed only when the table is empty. Safe to re-run: INSERT OR IGNORE.
INSERT OR IGNORE INTO fires (no, lit_at, out_at)
VALUES (1, 1787608021, 1787728021);

INSERT OR IGNORE INTO logs (id, fire_no, ts, kind, who, town, text, token)
VALUES (
  1,
  1,
  1787608021,
  'fire',
  'braai.co.za',
  'Suid-Afrika',
  'The founding fire. Lit on the road to Braai Day, 24 September 2026. Everything on this fire from here on comes from a real person. Put something on it — the founding custodians of this site will be found standing around this fire.',
  'founding'
);
