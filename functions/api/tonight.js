// braai.co.za — Saturday heat: who is braaiing tonight?
// Cloudflare Pages Function on the existing VUUR_DB D1 binding.
//
// Schema: CREATE TABLE IF NOT EXISTS only. Never DROP. Never touch
// the vuur tables (fires, feeds) or their contract.
//
// braais_tonight(id, town, created_at, day_sast)
//   one row per tap; GET aggregates n per town for the current SAST day.
//   Midnight SAST (UTC+2, no DST) rolls the slate.

const TOWN_MAX = 40;
const RATE_WINDOW_S = 60;      // one tap per IP per minute
const RATE_DAY_MAX = 6;        // and not a dozen times before supper
const RATE = new Map();        // isolate-local; simple, as specified

const ALIAS = {
  jhb: 'Johannesburg',
  jozi: 'Johannesburg',
  joburg: 'Johannesburg',
  johannesburg: 'Johannesburg',
  pta: 'Pretoria',
  tshwane: 'Pretoria',
  pretoria: 'Pretoria',
  pe: 'Gqeberha',
  'port elizabeth': 'Gqeberha',
  gqeberha: 'Gqeberha',
  ct: 'Cape Town',
  kaapstad: 'Cape Town',
  'cape town': 'Cape Town',
  dbn: 'Durban',
  durban: 'Durban',
  nelspruit: 'Mbombela',
  mbombela: 'Mbombela',
  bloem: 'Bloemfontein',
  bloemfontein: 'Bloemfontein',
  'east london': 'East London',
  eastlondon: 'East London',
  polokwane: 'Polokwane',
  pietersburg: 'Polokwane',
  kimberley: 'Kimberley',
  mahikeng: 'Mahikeng',
  mmabatho: 'Mahikeng',
  witbank: 'eMalahleni',
  emalahleni: 'eMalahleni',
  'port elizabeth / gqeberha': 'Gqeberha',
};

export function daySast(nowMs) {
  const ms = (nowMs == null ? Date.now() : nowMs) + 2 * 3600 * 1000;
  return new Date(ms).toISOString().slice(0, 10);
}

export function normaliseTown(raw) {
  let s = String(raw || '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, TOWN_MAX);
  if (!s) return '';
  const key = s.toLowerCase();
  if (ALIAS[key]) return ALIAS[key];
  // Title-case words; keep existing capitals inside a word (eMalahleni).
  return s
    .split(' ')
    .map((w) => {
      if (!w) return w;
      if (/^[a-z][A-Z]/.test(w) || /[A-Z].*[A-Z]/.test(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(' ');
}

function townOk(town) {
  if (town.length < 2 || town.length > TOWN_MAX) return false;
  if (/https?:|www\.|@/.test(town)) return false;
  // Letters (incl. Afrikaans), spaces, hyphen, apostrophe. A few digits for "R44" style names are out of scope.
  return /^[A-Za-zÀ-öø-ÿ'’ -]+$/.test(town);
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function clientIp(request) {
  const cf = request.headers.get('CF-Connecting-IP');
  if (cf) return cf.trim();
  const xff = request.headers.get('X-Forwarded-For');
  if (xff) return xff.split(',')[0].trim();
  return '0.0.0.0';
}

function rateCheck(ip, now, day) {
  const rec = RATE.get(ip);
  if (!rec || rec.day !== day) {
    RATE.set(ip, { day, n: 1, last: now });
    return null;
  }
  if (now - rec.last < RATE_WINDOW_S) {
    const wait = Math.max(1, Math.ceil((RATE_WINDOW_S - (now - rec.last)) / 1));
    return 'Easy — one tap is enough. Give it ' + wait + ' more second' + (wait === 1 ? '' : 's') + '.';
  }
  if (rec.n >= RATE_DAY_MAX) {
    return 'That town already heard from this connection today. Midnight SAST starts a new slate.';
  }
  rec.n += 1;
  rec.last = now;
  return null;
}

async function ensureTable(db) {
  await db
    .prepare(
      'CREATE TABLE IF NOT EXISTS braais_tonight (' +
        'id INTEGER PRIMARY KEY AUTOINCREMENT,' +
        'town TEXT NOT NULL,' +
        'created_at INTEGER NOT NULL,' +
        'day_sast TEXT NOT NULL' +
        ')'
    )
    .run();
  await db
    .prepare('CREATE INDEX IF NOT EXISTS idx_braais_tonight_day ON braais_tonight(day_sast)')
    .run();
}

async function snapshot(db, day) {
  const rows = (
    await db
      .prepare(
        'SELECT town, COUNT(*) AS n FROM braais_tonight WHERE day_sast = ? GROUP BY town ORDER BY n DESC, town ASC'
      )
      .bind(day)
      .all()
  ).results;
  const towns = (rows || []).map((r) => ({ town: r.town, n: Number(r.n) || 0 }));
  const total = towns.reduce((a, t) => a + t.n, 0);
  return { ok: true, day, towns, total };
}

export async function onRequestGet(context) {
  const { env } = context;
  if (!env.VUUR_DB) return json({ ok: false, error: 'Tonight is briefly unreachable.' }, 503);
  const day = daySast();
  try {
    await ensureTable(env.VUUR_DB);
    return json(await snapshot(env.VUUR_DB, day));
  } catch (err) {
    return json({ ok: false, error: 'Tonight is briefly unreachable.' }, 503);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.VUUR_DB) return json({ ok: false, error: 'Tonight is briefly unreachable.' }, 503);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Bad request.' }, 400);
  }

  // Honeypot: bots fill every field. Pretend success, write nothing.
  if (body.hp) return json({ ok: true });

  const town = normaliseTown(body.town);
  if (!townOk(town)) {
    return json({ ok: false, error: 'Which town? A South African place name, written plainly.' }, 400);
  }

  const now = Math.floor(Date.now() / 1000);
  const day = daySast();
  const limited = rateCheck(clientIp(request), now, day);
  if (limited) return json({ ok: false, error: limited }, 429);

  try {
    await ensureTable(env.VUUR_DB);
    await env.VUUR_DB
      .prepare('INSERT INTO braais_tonight (town, created_at, day_sast) VALUES (?, ?, ?)')
      .bind(town, now, day)
      .run();
    const state = await snapshot(env.VUUR_DB, day);
    return json({ ...state, you: town });
  } catch (err) {
    return json({ ok: false, error: 'Tonight is briefly unreachable.' }, 503);
  }
}
