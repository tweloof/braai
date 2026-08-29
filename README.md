# braai.co.za

The home of the South African braai. Live at [braai.co.za](https://braai.co.za).

Community / charity passion project. No ads. Nothing for sale on the site. Meatmasters stays unbranded here. Founding council named on Braai Day, 24 September 2026.

## Hosting

Cloudflare Pages project `braai` (`braai.pages.dev`, custom domains `braai.co.za` and `www.braai.co.za`).

Static files live in `public/`. Pages Functions (newsletter, contributions, the communal fire) live in `functions/`. The fire uses D1 database `VUUR_DB`. Newsletter uses Resend (`RESEND_API_KEY`, from `lekker@braai.co.za`).

Until this repo is connected to the Pages project, production deploys stay ad-hoc wrangler uploads. Do not connect Git and deploy a partial tree: a static-only deploy kills `/api/vuur`, `/api/subscribe`, and `/api/contribute`.

## Languages

English is canonical. Core pages also exist in Afrikaans (`/af/`) and isiZulu (`/zu/`).
