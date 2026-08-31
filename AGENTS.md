# AGENTS.md — the rulebook for anyone (or anything) contributing to braai.co.za

This repo is the town square of braai.co.za, a community-built South African
braai site. Contributions are welcome from **people and AI agents alike** — Grok, Claude,
whoever pulls up a chair. These are the house rules. PRs that follow them get merged fast;
PRs that break them get sent back with a comment.

## The three iron rules

1. **Agents sign as agents.** Never write, post, or commit as a fictional person. The site's
   own agents (Vuurwag, the weekly loop) always carry their own names. Community entries on
   The Braai come from real people or clearly-named agents — no personas, ever.
2. **Meatmasters is never mentioned on the site.**
3. **Never delete history.** `public/_redirects` carries 17 years of backlinks (64+ rules).
   You may ADD redirect rules; you may never remove or loosen existing ones. Same spirit for
   `public/_headers`.

## Protected files — change only with a very good reason, explained in the PR

- `public/_redirects`, `public/_headers` (see rule 3)
- `functions/api/*.js` — the live API contract. The Braai's mechanics are canon:
  `FUEL_PER_LOG=14`, `BURN_PER_HOUR=0.42`, `MAX_FUEL=100`, D1 tables `fires` and `feeds`.
  Email notifications go to the editor's address with the `[braai.co.za]` subject prefix —
  changing recipients or subjects breaks the editorial workflow.
- `wrangler.toml` — bindings for the production D1 database.
- `public/sw.js` — never let the service worker cache `/api/`.

## Content standards

- **Voice:** South African, warm, funny, precise. Read two existing pages before writing one.
  English is canonical; Afrikaans (`/af/`) and isiZulu (`/zu/`) mirror the six core pages.
- **Truth:** braai facts must be true. Wood is bought from permitted suppliers; boerewors is
  ≥90% meat by law; the hand test is 4-6-8-10 seconds. If unsure, leave it out.
- **Languages:** if you touch a core page, update all three language versions or say in the
  PR that translations are pending.
- **Images:** AI-generated images are welcome (founder's call, Aug 2026) — but they must be
  culturally correct (a snoek is braaied butterflied, flat, skin-side down — we learned this
  the hard way), converted to WebP ≤ ~250 KB at 1200px wide, placed in `public/assets/photos/`,
  with honest alt text. Branded PNG cards in `public/assets/og/` are for social shares — leave them.
- **New pages:** include title/description/canonical/hreflang metadata, the shared nav
  (10 items incl. language switcher), footer, JSON-LD where applicable, sitemap.xml entry,
  and an llms.txt line.

## Technical gates every PR must pass (the maintainer runs these)

- HTML: valid structure, no inline secrets, no external scripts beyond the existing set
- Engineer's-table validator (rowspan/colspan grid check) for any recipe table
- JS: `node --check` on every script block
- No secrets, tokens, or keys anywhere in the diff or history
- Lighthouse sanity: no page regresses to multi-MB payloads
- The three iron rules, verified by a human-quality read

## How to contribute

Branch → PR against `main` with a clear description of what and why. Every PR gets an
automatic Cloudflare Pages preview URL — check your own work there first. The maintainer
(Claude, on a daily schedule) reviews, merges what passes, and comments on what doesn't.
Merged = live on braai.co.za within minutes. Credit is given by name in commit history and,
for content, on the page where it lands.

## Licensing

Decision pending with the founder. Until a LICENSE file lands: contributions are credited,
copyright remains with braai.co.za, and by contributing you agree your work may be published
on the site with credit.

*Questions? lekker@braai.co.za — a person (or an honest agent) will answer.*
