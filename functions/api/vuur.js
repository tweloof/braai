/**
 * GET/POST /api/vuur
 * Reconstructed from live API + public/vuur/index.html (29 Aug 2026).
 * Not the original source.
 *
 * D1 schema is unknown (D1 API 401). This file CREATE TABLE IF NOT EXISTS
 * a conservative shape on a fresh database, then detects actual table and
 * column names so a production DB with different identifiers still works.
 * Never DROP, never rewrite existing rows.
 */
const FUEL_PER_LOG = 14;
const BURN_PER_HOUR = 0.42;
const MAX_FUEL = 100;
const MECHANICS = {
  fuelPerLog: FUEL_PER_LOG,
  burnPerHour: BURN_PER_HOUR,
  maxFuel: MAX_FUEL
};
const KINDS = new Set(['word', 'spot', 'wood', 'recipe', 'fire']);
const TOKEN_RE = /^[A-Za-z0-9-]{8,64}$/;

const CREATE_FIRES = `CREATE TABLE IF NOT EXISTS fires (
  no INTEGER PRIMARY KEY,
  lit_at INTEGER NOT NULL,
  out_at INTEGER
)`;
const CREATE_LOGS = `CREATE TABLE IF NOT EXISTS logs (
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
)`;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }
  });
}

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

function q(id) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(id)) throw new Error('bad ident');
  return '"' + id + '"';
}

function pick(cols, aliases) {
  const lower = new Map(cols.map((c) => [c.toLowerCase(), c]));
  for (const a of aliases) {
    const hit = lower.get(a.toLowerCase());
    if (hit) return hit;
  }
  return null;
}

async function listTables(db) {
  const r = await db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'"
    )
    .all();
  return (r.results || []).map((row) => row.name).filter((n) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(n));
}

async function columnsOf(db, table) {
  const r = await db.prepare('PRAGMA table_info(' + q(table) + ')').all();
  return (r.results || []).map((row) => row.name);
}

function scoreFireTable(cols) {
  const hasLit = pick(cols, ['lit_at', 'litAt', 'lit', 'started_at', 'startedAt']);
  const hasNo = pick(cols, ['no', 'number', 'fire_no', 'fireNo', 'id']);
  return hasLit && hasNo ? 2 : 0;
}

function scoreLogTable(cols) {
  let n = 0;
  if (pick(cols, ['who', 'name'])) n++;
  if (pick(cols, ['text', 'body', 'message'])) n++;
  if (pick(cols, ['kind', 'type'])) n++;
  if (pick(cols, ['town', 'place'])) n++;
  return n;
}

function mapFireCols(cols) {
  return {
    no: pick(cols, ['no', 'number', 'fire_no', 'fireNo', 'id']),
    litAt: pick(cols, ['lit_at', 'litAt', 'lit', 'started_at', 'startedAt']),
    outAt: pick(cols, ['out_at', 'outAt', 'ended_at', 'endedAt']),
    outFlag: pick(cols, ['is_out', 'isOut', 'dead', 'out'])
  };
}

function mapLogCols(cols) {
  return {
    id: pick(cols, ['id', 'log_id', 'logId']),
    fireNo: pick(cols, ['fire_no', 'fireNo', 'fire_id', 'fireId', 'fire']),
    ts: pick(cols, ['ts', 'created_at', 'createdAt', 'time', 'at']),
    kind: pick(cols, ['kind', 'type']),
    who: pick(cols, ['who', 'name']),
    town: pick(cols, ['town', 'place']),
    text: pick(cols, ['text', 'body', 'message']),
    token: pick(cols, ['token', 'vuur_token', 'vuurToken']),
    replyText: pick(cols, ['reply_text', 'replyText']),
    replyWho: pick(cols, ['reply_who', 'replyWho']),
    replyTown: pick(cols, ['reply_town', 'replyTown']),
    replyTs: pick(cols, ['reply_ts', 'replyTs'])
  };
}

function mapReplyCols(cols) {
  return {
    logId: pick(cols, ['log_id', 'logId', 'feed_id', 'feedId', 'id']),
    text: pick(cols, ['text', 'body', 'message']),
    who: pick(cols, ['who', 'name']),
    town: pick(cols, ['town', 'place']),
    token: pick(cols, ['token']),
    ts: pick(cols, ['ts', 'created_at', 'createdAt'])
  };
}

async function detect(db, tables) {
  const infos = [];
  for (const name of tables) {
    const cols = await columnsOf(db, name);
    infos.push({ name, cols });
  }

  const preferFire = ['fires', 'fire', 'vuur'];
  const preferLog = ['logs', 'log', 'vuur_logs', 'feeds', 'entries'];
  const preferReply = ['replies', 'reply', 'vuur_replies'];

  let fireInfo = infos.find((t) => preferFire.includes(t.name.toLowerCase()) && scoreFireTable(t.cols) >= 2);
  if (!fireInfo) fireInfo = infos.filter((t) => scoreFireTable(t.cols) >= 2).sort((a, b) => scoreFireTable(b.cols) - scoreFireTable(a.cols))[0];

  let logInfo = infos.find((t) => preferLog.includes(t.name.toLowerCase()) && scoreLogTable(t.cols) >= 3);
  if (!logInfo) logInfo = infos.filter((t) => scoreLogTable(t.cols) >= 3).sort((a, b) => scoreLogTable(b.cols) - scoreLogTable(a.cols))[0];

  let replyInfo = infos.find((t) => preferReply.includes(t.name.toLowerCase()) && pick(t.cols, ['text', 'body']));
  if (!replyInfo) {
    replyInfo = infos.find((t) => {
      if (fireInfo && t.name === fireInfo.name) return false;
      if (logInfo && t.name === logInfo.name) return false;
      return pick(t.cols, ['log_id', 'logId', 'feed_id', 'feedId']) && pick(t.cols, ['text', 'body']);
    });
  }

  return {
    fireTable: fireInfo ? fireInfo.name : null,
    fireCols: fireInfo ? mapFireCols(fireInfo.cols) : null,
    logTable: logInfo ? logInfo.name : null,
    logCols: logInfo ? mapLogCols(logInfo.cols) : null,
    replyTable: replyInfo ? replyInfo.name : null,
    replyCols: replyInfo ? mapReplyCols(replyInfo.cols) : null
  };
}

async function ensureSchema(db) {
  let tables = await listTables(db);
  let schema = await detect(db, tables);

  if (!schema.fireTable) {
    await db.prepare(CREATE_FIRES).run();
  }
  if (!schema.logTable) {
    await db.prepare(CREATE_LOGS).run();
  }

  tables = await listTables(db);
  schema = await detect(db, tables);
  if (!schema.fireTable || !schema.logTable || !schema.fireCols.no || !schema.fireCols.litAt) {
    throw new Error('vuur schema missing');
  }
  if (!schema.logCols.who || !schema.logCols.text) {
    throw new Error('vuur logs schema missing');
  }
  return schema;
}

function projectFuel(litAt, storedOutAt, logs, now) {
  if (storedOutAt && storedOutAt <= now) {
    return { fuel: 0, out: true, outAt: storedOutAt };
  }
  const events = logs.slice().sort((a, b) => a.ts - b.ts);
  let fuel = 0;
  let t = litAt || (events[0] ? events[0].ts : now);
  for (let i = 0; i < events.length; i++) {
    const log = events[i];
    const burned = BURN_PER_HOUR * Math.max(0, log.ts - t) / 3600;
    fuel = Math.max(0, fuel - burned);
    fuel = Math.min(MAX_FUEL, fuel + FUEL_PER_LOG);
    t = log.ts;
  }
  const burned = BURN_PER_HOUR * Math.max(0, now - t) / 3600;
  const remaining = fuel - burned;
  if (remaining <= 0) {
    const outAt = t + Math.round((fuel / BURN_PER_HOUR) * 3600);
    return { fuel: 0, out: true, outAt };
  }
  return { fuel: remaining, out: false, outAt: null };
}

function emptyState(now, token) {
  return {
    ok: true,
    now,
    fire: { no: 0, litAt: 0, outAt: null },
    out: true,
    fuel: 0,
    count: 0,
    people: 0,
    spoken: false,
    logs: [],
    mechanics: MECHANICS
  };
}

function readFireRow(row, cols) {
  if (!row) return null;
  return {
    no: Number(row[cols.no]),
    litAt: Number(row[cols.litAt] || 0),
    outAt: cols.outAt && row[cols.outAt] != null ? Number(row[cols.outAt]) : null,
    outFlag: cols.outFlag ? !!row[cols.outFlag] : null
  };
}

function readLogRow(row, cols, token) {
  const logToken = cols.token ? row[cols.token] : null;
  let reply = null;
  if (cols.replyText && row[cols.replyText]) {
    reply = {
      text: String(row[cols.replyText]),
      who: cols.replyWho ? String(row[cols.replyWho] || '') : '',
      town: cols.replyTown ? String(row[cols.replyTown] || '') : ''
    };
  }
  return {
    id: cols.id ? Number(row[cols.id]) : 0,
    ts: cols.ts ? Number(row[cols.ts] || 0) : 0,
    kind: cols.kind ? String(row[cols.kind] || '') : '',
    who: String(row[cols.who] || ''),
    town: cols.town ? String(row[cols.town] || '') : '',
    text: String(row[cols.text] || ''),
    token: logToken ? String(logToken) : null,
    mine: !!(token && logToken && String(logToken) === token),
    reply
  };
}

async function loadReplies(db, schema, logs) {
  if (!schema.replyTable || !schema.replyCols || !schema.replyCols.text) return logs;
  const ids = logs.map((l) => l.id).filter((id) => id > 0);
  if (!ids.length) return logs;
  const rc = schema.replyCols;
  const placeholders = ids.map(() => '?').join(',');
  const sql =
    'SELECT * FROM ' +
    q(schema.replyTable) +
    ' WHERE ' +
    q(rc.logId) +
    ' IN (' +
    placeholders +
    ')';
  const r = await db.prepare(sql).bind(...ids).all();
  const byLog = new Map();
  for (const row of r.results || []) {
    const id = Number(row[rc.logId]);
    if (!byLog.has(id) && row[rc.text]) {
      byLog.set(id, {
        text: String(row[rc.text]),
        who: rc.who ? String(row[rc.who] || '') : '',
        town: rc.town ? String(row[rc.town] || '') : ''
      });
    }
  }
  return logs.map((l) => (l.reply ? l : { ...l, reply: byLog.get(l.id) || null }));
}

async function loadCurrentFire(db, schema) {
  const fc = schema.fireCols;
  const order = q(fc.no) + ' DESC';
  const row = await db.prepare('SELECT * FROM ' + q(schema.fireTable) + ' ORDER BY ' + order + ' LIMIT 1').first();
  return readFireRow(row, fc);
}

async function loadLogs(db, schema, fireNo, token) {
  const lc = schema.logCols;
  if (!lc.fireNo) {
    const r = await db.prepare('SELECT * FROM ' + q(schema.logTable) + ' ORDER BY ' + q(lc.ts || lc.id) + ' ASC').all();
    return (r.results || []).map((row) => readLogRow(row, lc, token));
  }
  const r = await db
    .prepare(
      'SELECT * FROM ' +
        q(schema.logTable) +
        ' WHERE ' +
        q(lc.fireNo) +
        ' = ? ORDER BY ' +
        q(lc.ts || lc.id) +
        ' ASC'
    )
    .bind(fireNo)
    .all();
  return (r.results || []).map((row) => readLogRow(row, lc, token));
}

function countPeople(logs) {
  const seen = new Set();
  for (const l of logs) {
    seen.add(l.token || 'who:' + l.who + '|' + l.town);
  }
  return seen.size;
}

async function persistOut(db, schema, fire, outAt) {
  if (!fire || fire.outAt) return;
  const fc = schema.fireCols;
  if (!fc.outAt && !fc.outFlag) return;
  const sets = [];
  const binds = [];
  if (fc.outAt) {
    sets.push(q(fc.outAt) + ' = ?');
    binds.push(outAt);
  }
  if (fc.outFlag) {
    sets.push(q(fc.outFlag) + ' = ?');
    binds.push(1);
  }
  binds.push(fire.no);
  await db
    .prepare('UPDATE ' + q(schema.fireTable) + ' SET ' + sets.join(', ') + ' WHERE ' + q(fc.no) + ' = ?')
    .bind(...binds)
    .run();
  fire.outAt = outAt;
}

function publicLogs(logs) {
  return logs.map((l) => ({
    id: l.id,
    ts: l.ts,
    kind: l.kind,
    who: l.who,
    town: l.town,
    text: l.text,
    mine: !!l.mine,
    reply: l.reply || null
  }));
}

async function buildState(db, schema, token, now) {
  const fire = await loadCurrentFire(db, schema);
  if (!fire) return emptyState(now, token);

  let logs = await loadLogs(db, schema, fire.no, token);
  logs = await loadReplies(db, schema, logs);

  const proj = projectFuel(fire.litAt, fire.outAt, logs, now);
  if (proj.out && !fire.outAt) {
    await persistOut(db, schema, fire, proj.outAt);
  }

  const spoken = !!(token && logs.some((l) => l.token && l.token === token));
  return {
    ok: true,
    now,
    fire: {
      no: fire.no,
      litAt: fire.litAt,
      outAt: proj.out ? proj.outAt : fire.outAt
    },
    out: proj.out,
    fuel: proj.out ? 0 : proj.fuel,
    count: logs.length,
    people: countPeople(logs),
    spoken,
    logs: publicLogs(logs),
    mechanics: MECHANICS
  };
}

function insertSql(table, colMap, data) {
  const cols = [];
  const vals = [];
  for (const [key, value] of Object.entries(data)) {
    const col = colMap[key];
    if (!col || value === undefined) continue;
    cols.push(q(col));
    vals.push(value);
  }
  if (!cols.length) throw new Error('no columns to insert');
  return {
    sql: 'INSERT INTO ' + q(table) + ' (' + cols.join(', ') + ') VALUES (' + cols.map(() => '?').join(', ') + ')',
    vals
  };
}

async function insertLog(db, schema, data) {
  const spec = insertSql(schema.logTable, schema.logCols, data);
  const r = await db.prepare(spec.sql).bind(...spec.vals).run();
  return r.meta && r.meta.last_row_id != null ? Number(r.meta.last_row_id) : null;
}

function validToken(t) {
  return typeof t === 'string' && TOKEN_RE.test(t);
}

export async function onRequestGet({ request, env }) {
  if (!env.VUUR_DB) {
    return json({ ok: false, error: 'The fire is briefly unreachable. Try again in a minute.' }, 500);
  }
  const tokenHeader = request.headers.get('X-Vuur-Token') || '';
  const token = validToken(tokenHeader) ? tokenHeader : '';
  try {
    const schema = await ensureSchema(env.VUUR_DB);
    const state = await buildState(env.VUUR_DB, schema, token, nowSec());
    return json(state);
  } catch (err) {
    return json({ ok: false, error: 'The fire is briefly unreachable. Try again in a minute.' }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  if (!env.VUUR_DB) {
    return json({ ok: false, error: 'The fire is briefly unreachable. Try again in a minute.' }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Bad request.' }, 400);
  }

  const action = body && body.action;
  const token = body && body.token;
  if (action !== 'feed' && action !== 'light' && action !== 'reply') {
    return json({ ok: false, error: 'Reload the page and try again.' }, 400);
  }
  if (!validToken(token)) {
    return json({ ok: false, error: 'Reload the page and try again.' }, 400);
  }

  // Honeypot (sheet input id="sWeb") — silent success, no write.
  // Live returns {ok:true} only, not full fire state.
  if (body.hp) return json({ ok: true });

  const db = env.VUUR_DB;
  let schema;
  try {
    schema = await ensureSchema(db);
  } catch {
    return json({ ok: false, error: 'The fire is briefly unreachable. Try again in a minute.' }, 500);
  }

  const now = nowSec();

  try {
    if (action === 'reply') {
      return await handleReply(db, schema, body, token, now);
    }
    return await handleFeedOrLight(db, schema, action, body, token, now);
  } catch {
    return json({ ok: false, error: 'The fire is briefly unreachable. Try again in a minute.' }, 500);
  }
}

function readFeedFields(body) {
  const kind = String((body && body.kind) || '').trim();
  const text = String((body && body.text) || '').trim();
  const who = String((body && body.who) || '').trim();
  const town = String((body && body.town) || '').trim();
  if (text.length < 12) return { error: 'Tell us a bit more — one good sentence is enough.' };
  if (text.length > 500) return { error: 'Tell us a bit more — one good sentence is enough.' };
  if (!who) return { error: 'We need a name to put on it.' };
  if (who.length > 40) return { error: 'We need a name to put on it.' };
  if (!town) return { error: 'Which town? It matters more than you think.' };
  if (town.length > 40) return { error: 'Which town? It matters more than you think.' };
  if (!KINDS.has(kind)) return { error: 'Pick what it is first.' };
  return { kind, text, who, town };
}

async function handleFeedOrLight(db, schema, action, body, token, now) {
  const fields = readFeedFields(body);
  if (fields.error) return json({ ok: false, error: fields.error }, 400);

  const fire = await loadCurrentFire(db, schema);
  let logs = fire ? await loadLogs(db, schema, fire.no, token) : [];
  const proj = fire ? projectFuel(fire.litAt, fire.outAt, logs, now) : { out: true, outAt: now, fuel: 0 };
  if (fire && proj.out && !fire.outAt) {
    await persistOut(db, schema, fire, proj.outAt);
  }

  if (action === 'feed') {
    if (!fire || proj.out) {
      return json({ ok: false, error: 'This fire is out. Someone has to light the next one.' }, 400);
    }
    await insertLog(db, schema, {
      fireNo: fire.no,
      ts: now,
      kind: fields.kind,
      who: fields.who,
      town: fields.town,
      text: fields.text,
      token
    });
    return json(await buildState(db, schema, token, now));
  }

  // light
  if (fire && !proj.out) {
    return json({ ok: false, error: 'This fire is still burning. Put something on it instead.' }, 400);
  }

  const nextNo = fire ? fire.no + 1 : 1;
  const fireInsert = insertSql(schema.fireTable, schema.fireCols, {
    no: nextNo,
    litAt: now,
    outAt: null,
    outFlag: 0
  });
  await db.prepare(fireInsert.sql).bind(...fireInsert.vals).run();
  await insertLog(db, schema, {
    fireNo: nextNo,
    ts: now,
    kind: fields.kind,
    who: fields.who,
    town: fields.town,
    text: fields.text,
    token
  });
  return json(await buildState(db, schema, token, now));
}

async function handleReply(db, schema, body, token, now) {
  const fire = await loadCurrentFire(db, schema);
  if (!fire) {
    return json({ ok: false, error: 'This fire is out. Nobody advises a dead fire.' }, 400);
  }
  let logs = await loadLogs(db, schema, fire.no, token);
  logs = await loadReplies(db, schema, logs);
  const proj = projectFuel(fire.litAt, fire.outAt, logs, now);
  if (proj.out) {
    if (!fire.outAt) await persistOut(db, schema, fire, proj.outAt);
    return json({ ok: false, error: 'This fire is out. Nobody advises a dead fire.' }, 400);
  }

  const text = String((body && body.text) || '').trim();
  const who = String((body && body.who) || '').trim();
  const town = String((body && body.town) || '').trim();
  const feedId = Number(body && body.feedId);

  if (!who) return json({ ok: false, error: 'We need a name to put on it.' }, 400);
  if (!town) return json({ ok: false, error: 'Which town? It matters more than you think.' }, 400);
  if (!text) return json({ ok: false, error: 'Tell us a bit more — one good sentence is enough.' }, 400);
  if (text.length > 300) return json({ ok: false, error: 'Tell us a bit more — one good sentence is enough.' }, 400);
  if (!Number.isFinite(feedId) || feedId <= 0) {
    return json({ ok: false, error: 'That log is not on this fire.' }, 400);
  }

  const spoken = logs.some((l) => l.token && l.token === token);
  if (!spoken) {
    return json({ ok: false, error: 'Put something on the fire and you may reply once.' }, 400);
  }

  const target = logs.find((l) => l.id === feedId);
  if (!target) {
    return json({ ok: false, error: 'That log is not on this fire.' }, 400);
  }
  if (target.reply) {
    return json({ ok: false, error: 'Someone has already advised on this one. Never twice.' }, 400);
  }

  const lc = schema.logCols;
  if (lc.replyText) {
    const sets = [q(lc.replyText) + ' = ?'];
    const binds = [text];
    if (lc.replyWho) {
      sets.push(q(lc.replyWho) + ' = ?');
      binds.push(who);
    }
    if (lc.replyTown) {
      sets.push(q(lc.replyTown) + ' = ?');
      binds.push(town);
    }
    if (lc.replyTs) {
      sets.push(q(lc.replyTs) + ' = ?');
      binds.push(now);
    }
    binds.push(feedId);
    const where = lc.id ? q(lc.id) + ' = ?' : q(lc.ts) + ' = ?';
    await db
      .prepare('UPDATE ' + q(schema.logTable) + ' SET ' + sets.join(', ') + ' WHERE ' + where)
      .bind(...binds)
      .run();
  } else if (schema.replyTable && schema.replyCols && schema.replyCols.logId && schema.replyCols.text) {
    const spec = insertSql(schema.replyTable, schema.replyCols, {
      logId: feedId,
      text,
      who,
      town,
      token,
      ts: now
    });
    await db.prepare(spec.sql).bind(...spec.vals).run();
  } else {
    return json({ ok: false, error: 'The fire is briefly unreachable. Try again in a minute.' }, 500);
  }

  return json(await buildState(db, schema, token, now));
}
