// braai.co.za — Saturday heat map: who is braaiing tonight?
// Pages Function on the existing VUUR_DB binding. New table only
// (CREATE TABLE IF NOT EXISTS). Never DROP. No secrets. No accounts.
//
// Window: one Saturday in Africa/Johannesburg (UTC+2, no DST).
// Saturday 00:00 through Sunday 06:00 SAST counts as "tonight".
// Any other time is stored against the next Saturday (planning ahead).
// Rate limit: one check-in per IP hash per Saturday, plus a 20s burst gap.

const TOWN_RE = /^[A-Za-zÀ-ÿ0-9''. -]{2,40}$/;
const WHO_RE = /^[A-Za-zÀ-ÿ0-9''. -]{0,40}$/;
const SAST = 2 * 3600;
const BURST_S = 20;

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function clean(s, max) {
  return String(s || '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function slug(s) {
  return clean(s, 40)
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function clientIp(request) {
  return (
    request.headers.get('CF-Connecting-IP') ||
    (request.headers.get('X-Forwarded-For') || '').split(',')[0].trim() ||
    '0'
  );
}

async function hashIp(ip) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip + '|tonight'));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

function sastParts(nowSec) {
  const d = new Date((nowSec + SAST) * 1000);
  return {
    y: d.getUTCFullYear(),
    m: d.getUTCMonth(),
    day: d.getUTCDate(),
    dow: d.getUTCDay(),
    h: d.getUTCHours(),
  };
}

function ymd(y, m, day) {
  return y + '-' + String(m + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
}

function addDays(y, m, day, n) {
  const d = new Date(Date.UTC(y, m, day + n));
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), day: d.getUTCDate() };
}

function saturdayKey(nowSec) {
  const p = sastParts(nowSec);
  if (p.dow === 6) return ymd(p.y, p.m, p.day);
  if (p.dow === 0 && p.h < 6) {
    const s = addDays(p.y, p.m, p.day, -1);
    return ymd(s.y, s.m, s.day);
  }
  const ahead = (6 - p.dow + 7) % 7 || 7;
  const s = addDays(p.y, p.m, p.day, ahead);
  return ymd(s.y, s.m, s.day);
}

function isTonight(nowSec) {
  const p = sastParts(nowSec);
  return p.dow === 6 || (p.dow === 0 && p.h < 6);
}

async function ensureTables(db) {
  await db.batch([
    db.prepare(
      'CREATE TABLE IF NOT EXISTS tonight (' +
        'id INTEGER PRIMARY KEY AUTOINCREMENT,' +
        'ts INTEGER NOT NULL,' +
        'saturday TEXT NOT NULL,' +
        'town_key TEXT NOT NULL,' +
        'town_label TEXT NOT NULL,' +
        'who TEXT,' +
        'ip_hash TEXT NOT NULL' +
      ')'
    ),
    db.prepare('CREATE INDEX IF NOT EXISTS tonight_sat ON tonight (saturday)'),
    db.prepare('CREATE INDEX IF NOT EXISTS tonight_sat_ip ON tonight (saturday, ip_hash)'),
  ]);
}

async function loadCatalog(request) {
  try {
    const res = await fetch(new URL('/data/sa-towns.json', request.url));
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.towns) ? data.towns : [];
  } catch {
    return [];
  }
}

function matchTown(raw, catalog) {
  const label = clean(raw, 40);
  if (!TOWN_RE.test(label)) return null;
  const needle = label.toLowerCase();
  const keyNeedle = slug(label);
  for (const t of catalog) {
    if (t.key === keyNeedle || String(t.name || '').toLowerCase() === needle) {
      return { key: t.key, label: t.name, lat: t.lat, lng: t.lng };
    }
    const aliases = Array.isArray(t.aliases) ? t.aliases : [];
    for (const a of aliases) {
      if (String(a).toLowerCase() === needle || slug(a) === keyNeedle) {
        return { key: t.key, label: t.name, lat: t.lat, lng: t.lng };
      }
    }
  }
  return { key: keyNeedle || slug(label), label, lat: null, lng: null };
}

async function snapshot(db, saturday, catalog) {
  const rows = (
    await db
      .prepare(
        'SELECT town_key, town_label, COUNT(*) AS n FROM tonight WHERE saturday = ? GROUP BY town_key, town_label ORDER BY n DESC, town_label ASC'
      )
      .bind(saturday)
      .all()
  ).results;

  const byKey = new Map(catalog.map((t) => [t.key, t]));
  const towns = rows.map((r) => {
    const known = byKey.get(r.town_key);
    return {
      key: r.town_key,
      name: r.town_label,
      count: r.n,
      lat: known ? known.lat : null,
      lng: known ? known.lng : null,
    };
  });
  const total = towns.reduce((s, t) => s + t.count, 0);
  return { towns, total };
}

function windowMeta(now, saturday) {
  return {
    kind: 'saturday',
    tz: 'Africa/Johannesburg',
    saturday,
    tonight: isTonight(now),
    note: 'A check-in belongs to one Saturday (SAST). Saturday 00:00 through Sunday 06:00 is tonight; any other time is the coming Saturday. Counts reset when the next Saturday key opens. One tap per connection per Saturday.',
  };
}

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!env.VUUR_DB) return json({ ok: false, error: 'The map is briefly unreachable.' }, 503);

  const now = Math.floor(Date.now() / 1000);
  const saturday = saturdayKey(now);
  await ensureTables(env.VUUR_DB);
  const catalog = await loadCatalog(request);
  const snap = await snapshot(env.VUUR_DB, saturday, catalog);

  return json({
    ok: true,
    ...windowMeta(now, saturday),
    total: snap.total,
    towns: snap.towns,
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.VUUR_DB) return json({ ok: false, error: 'The map is briefly unreachable.' }, 503);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Bad request.' }, 400);
  }

  // Honeypot: bots fill every field. Pretend success, change nothing.
  if (body.hp) return json({ ok: true });

  const townRaw = clean(body.town, 40);
  const who = clean(body.who, 40);
  if (!townRaw) return json({ ok: false, error: 'Which town? The map needs a place.' }, 400);
  if (!TOWN_RE.test(townRaw)) return json({ ok: false, error: 'That does not look like a town name.' }, 400);
  if (who && !WHO_RE.test(who)) return json({ ok: false, error: 'First name only — or leave it blank.' }, 400);

  const now = Math.floor(Date.now() / 1000);
  const saturday = saturdayKey(now);
  const db = env.VUUR_DB;
  await ensureTables(db);

  const catalog = await loadCatalog(request);
  const town = matchTown(townRaw, catalog);
  if (!town || !town.key) return json({ ok: false, error: 'That does not look like a town name.' }, 400);

  const ipHash = await hashIp(clientIp(request));
  const recent = await db
    .prepare('SELECT ts FROM tonight WHERE ip_hash = ? ORDER BY ts DESC LIMIT 1')
    .bind(ipHash)
    .first();
  if (recent && now - recent.ts < BURST_S) {
    return json({ ok: false, error: 'Easy — the map heard you.' }, 429);
  }

  const already = await db
    .prepare('SELECT id FROM tonight WHERE saturday = ? AND ip_hash = ? LIMIT 1')
    .bind(saturday, ipHash)
    .first();
  if (already) {
    const snap = await snapshot(db, saturday, catalog);
    return json({
      ok: true,
      already: true,
      ...windowMeta(now, saturday),
      total: snap.total,
      towns: snap.towns,
    });
  }

  await db
    .prepare('INSERT INTO tonight (ts, saturday, town_key, town_label, who, ip_hash) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(now, saturday, town.key, town.label, who || null, ipHash)
    .run();

  const snap = await snapshot(db, saturday, catalog);
  return json({
    ok: true,
    already: false,
    ...windowMeta(now, saturday),
    total: snap.total,
    towns: snap.towns,
  });
}
