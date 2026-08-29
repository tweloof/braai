# functions/

Reconstructed Cloudflare Pages Functions for braai.co.za.

These files were inferred from the live API contract and the page JavaScript in `public/` (verified 29 Aug 2026 against https://braai.co.za). They are **not** the original source.

- Do not deploy from this tree until reviewed.
- Do not git commit unless asked.
- Do not put API keys here. `RESEND_API_KEY` is a Pages secret already bound in production. From address is `lekker@braai.co.za`.
- Production D1 `vuur` (`VUUR_DB`, id `1f639f7b-2e48-4d1a-b3c6-8db38429fab7`) already has data. `schema.sql` is `CREATE TABLE IF NOT EXISTS` plus `INSERT OR IGNORE` for a fresh local database only. `/api/vuur` detects existing tables/columns and will not drop or overwrite rows.

## Routes

| File | Route | Methods |
| --- | --- | --- |
| `api/subscribe.js` | `/api/subscribe` | POST only. GET is 404 HTML (no handler). |
| `api/contribute.js` | `/api/contribute` | POST only. GET is 404 HTML (no handler). |
| `api/vuur.js` | `/api/vuur` | GET + POST. Anything else (PUT, …) is 405 empty. |

## Uncertainties

- **D1 schema** is unknown (no live `PRAGMA`). The function infers `fires` + `logs` (and an optional `replies` table) from column names. If production uses different names, it adapts; if the shape is too far off, GET/POST will 500.
- **Resend audience id** is unknown. `/api/subscribe` emails `lekker@braai.co.za` with the new address instead of calling Contacts/Audiences. No confirmation mail is sent to the subscriber.
- **Resend `from` display name** is unknown. Both mailers use the bare `lekker@braai.co.za`.
- **Mail failure copy** was not captured live. Missing key / Resend error returns 500 `{ok:false,error:"Something went wrong. Please try again in a minute."}`.
- Some vuur errors were reconstructed from client copy, not captured on the wire: short text, already-replied, reply without having fed, light-while-burning, unknown kind (coerced to `word`).
- `people` is distinct tokens (fallback who+town). `spoken` / `mine` need a `token` column on logs; without it both stay false.
- Fuel is recomputed from logs, not stored. Matches the live out fire: one founding log of 14 fuel burned out in exactly `14 / 0.42` hours (`outAt − litAt = 120000`).
