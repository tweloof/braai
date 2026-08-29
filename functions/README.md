# functions/

Reconstructed Cloudflare Pages Functions for braai.co.za.

These files were inferred from the live API contract and the page JavaScript in `public/` (verified 29 Aug 2026). They are **not** the original source.

- Do not deploy from this tree until reviewed.
- Do not put API keys here. `RESEND_API_KEY` is a Pages secret already bound in production.
- Production D1 `vuur` already has data. `schema.sql` is `CREATE TABLE IF NOT EXISTS` for a fresh local database only. `/api/vuur` detects existing tables/columns and will not drop or overwrite rows.
