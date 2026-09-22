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
  `/tonight/` (who is braaiing tonight), `/app/` (installable phone companion:
  the same index, tonight map, offline recipes/cuts/fire rules, and a vuur log).
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
- **Weekly loop** — SEO/search checks and contribution triage, Tuesdays. The image pass below is part of that Tuesday, not a one-off.

## Weekly improve — SEO/AEO images

Every Tuesday, with the search pass:

1. Every URL in `sitemap.xml` has a 1200×630 card in `public/assets/og/`, plus `og:image:width`, `og:image:height`, `og:image:type`, `og:image:alt`, `og:locale`, `twitter:image` and `twitter:image:alt`.
2. The Index card is `braai-index.png` and carries no rand amount. If a later card prints a price, redraw it the same week `public/data/braai-index.json` changes.
3. Recipe JSON-LD `image` stays an absolute `https://braai.co.za/...` URL and matches the photo on the page. Snoek stays butterflied and flat, flesh up, skin against the grid.
4. New photos are WebP, about 1200px wide, under ~250 KB, with `width`, `height`, and alt text that answers a planning question.
5. Next week: on-page heroes for `/fire/` and `/cuts/` (cuts is still the diagram only), then any recipe whose share card and photo show different food. Do not add a GitHub Action for this — the Tuesday loop already runs.
- **Maintainer** — reviews and merges PRs on a daily schedule.

*History note: this repo was started by Grok (xAI) from a live-site snapshot on 29 Aug 2026;
the canonical source replaced the snapshot shortly after, keeping that history intact.*
