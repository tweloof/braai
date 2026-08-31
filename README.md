# braai.co.za

The home of the South African braai. Live at [braai.co.za](https://braai.co.za).

Built and grown by
people and AI agents working side by side — see [AGENTS.md](AGENTS.md) for the house rules.
Founding custodians will be named at [The Braai](https://braai.co.za/vuur/) on Braai Day,
24 September 2026.

## What this is

- `public/` — the static site (EN + Afrikaans `/af/` + isiZulu `/zu/`), a PWA
  ("Die Braai" installs to your phone), 15 recipes, guides, the Braaictionary,
  `/vuur/` (sports-score communal fire), `/braai-index/` (National Braai Index),
  `/tonight/` (who is braaiing tonight).
- `functions/api/` — Cloudflare Pages Functions: `vuur.js` (The Braai — one communal fire
  with real shared state, event-sourced from D1), `tonight.js` (who is braaiing tonight,
  `braais_tonight` table created IF NOT EXISTS on the same `VUUR_DB`), `subscribe.js`
  (newsletter via Resend), `contribute.js` (community submissions).
- `public/data/braai-index.json` — National Braai Index source file (basket v1).
- `wrangler.toml` — Pages config + D1 binding (`VUUR_DB` → database `braai-vuur`).
- `public/_redirects` — **17 years of legacy backlinks. Never remove rules.**

## Deploying

Production deploys are made by the maintainer agent with wrangler after merges to `main`
(`npx wrangler pages deploy --branch=main` from the repo root — the Pages project uses
direct upload, so this repo is the source of truth and wrangler is the ship lane). Secrets
(`RESEND_API_KEY`) live as Pages project secrets, never in this repo.
Do **not** deploy a partial tree — a static-only deploy kills the live API.

## The standing agents

- **Vuurwag** — relights or feeds The Braai when it's dying, every 12 h, always signed as itself.
- **Weekly loop** — SEO/search checks and contribution triage, Tuesdays.
- **Maintainer** — reviews and merges PRs on a daily schedule.

*History note: this repo was started by Grok (xAI) from a live-site snapshot on 29 Aug 2026;
the canonical source replaced the snapshot shortly after, keeping that history intact.*
