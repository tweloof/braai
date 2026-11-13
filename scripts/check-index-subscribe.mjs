// Contract check for /api/subscribe. No network. The Index list stores
// {email, lang, ts} only when SUBSCRIBERS.put exists. The Braai Letter JSON
// path stays on Resend and does not write to that namespace.

import { onRequestPost } from '../functions/api/subscribe.js';

let failed = false;
function fail(msg) {
  failed = true;
  console.error('::error::' + msg);
}

function kv() {
  const store = new Map();
  return {
    store,
    binding: {
      async put(key, value) { store.set(key, value); },
      async get(key) { return store.has(key) ? store.get(key) : null; },
    },
  };
}

async function post(body, { headers, env } = {}) {
  const req = new Request('https://preview.example/api/subscribe', {
    method: 'POST',
    headers: headers || { 'content-type': 'application/json' },
    body,
  });
  return onRequestPost({ request: req, env: env || {} });
}

const saved = kv();
const ok = await post(JSON.stringify({
  email: 'Sam@Example.co.za',
  hp: '',
  lang: 'af',
  list: 'index',
}), { env: { SUBSCRIBERS: saved.binding } });
const okBody = await ok.json();
if (ok.status !== 200 || !okBody.ok) fail('Index JSON signup should store and return ok, got ' + ok.status);
const raw = saved.store.get('sam@example.co.za');
if (!raw) fail('Index signup was not stored under the lowercased email');
else {
  const rec = JSON.parse(raw);
  const keys = Object.keys(rec).sort().join(',');
  if (keys !== 'email,lang,ts') fail('stored record keys were ' + keys);
  if (rec.email !== 'sam@example.co.za') fail('stored email was ' + rec.email);
  if (rec.lang !== 'af') fail('stored lang was ' + rec.lang);
  if (!Number.isFinite(Date.parse(rec.ts))) fail('stored ts was not a time');
}

const honey = kv();
const honeyRes = await post(JSON.stringify({
  email: 'bot@example.co.za',
  hp: 'filled',
  lang: 'en',
  list: 'index',
}), { env: { SUBSCRIBERS: honey.binding } });
const honeyBody = await honeyRes.json();
if (honeyRes.status !== 200 || !honeyBody.ok) fail('honeypot should pretend success');
if (honey.store.size !== 0) fail('honeypot wrote to KV');

const closed = await post(JSON.stringify({
  email: 'a@example.co.za',
  hp: '',
  lang: 'en',
  list: 'index',
}), { env: {} });
const closedBody = await closed.json();
if (closed.status !== 503 || closedBody.error !== 'Signup opening soon.') {
  fail('missing SUBSCRIBERS should be 503 Signup opening soon, got ' + closed.status + ' ' + JSON.stringify(closedBody));
}

const bad = await post(JSON.stringify({ email: 'not-an-email', list: 'index' }));
if (bad.status !== 400) fail('bad Index email should be 400, got ' + bad.status);

const params = new URLSearchParams({ email: 'a@example.co.za', lang: 'zu', list: 'index', hp: '' });
const form = await post(params.toString(), {
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  env: {},
});
const formHtml = await form.text();
if (form.status !== 503) fail('no-JS Index POST without KV should be 503, got ' + form.status);
if (!formHtml.includes('Signup opening soon') && !formHtml.includes('Ukubhalisa kuzovuleka maduze')) {
  fail('503 page did not explain that signup is opening soon');
}
if (!formHtml.includes('mailto:lekker@braai.co.za?subject=Braai%20Index%20weekly')) {
  fail('503 page is missing the mailto fallback');
}
if (formHtml.toLowerCase().includes('meatmasters')) fail('503 page mentions Meatmasters');

const stored = kv();
const formOk = await post(params.toString(), {
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  env: { SUBSCRIBERS: stored.binding },
});
if (formOk.status !== 303) fail('no-JS Index POST should redirect, got ' + formOk.status);
const loc = formOk.headers.get('location') || '';
if (!loc.endsWith('/zu/braai-index/thanks/')) fail('thanks redirect was ' + loc);
const formRec = JSON.parse(stored.store.get('a@example.co.za'));
if (formRec.lang !== 'zu' || formRec.email !== 'a@example.co.za') fail('form record was ' + JSON.stringify(formRec));

const letterKv = kv();
const letter = await post(JSON.stringify({ email: 'letter@example.co.za', hp: '' }), {
  env: { SUBSCRIBERS: letterKv.binding },
});
const letterBody = await letter.json();
if (letter.status !== 503 || letterBody.error !== 'Signups are briefly offline. Please try again later.') {
  fail('Braai Letter without Resend changed: ' + letter.status + ' ' + JSON.stringify(letterBody));
}
if (letterKv.store.size !== 0) fail('Braai Letter wrote to SUBSCRIBERS');

const evil = new URLSearchParams({ email: 'a@example.co.za', lang: 'https://evil.example', list: 'index' });
const evilRes = await post(evil.toString(), {
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  env: { SUBSCRIBERS: kv().binding },
});
const evilLoc = evilRes.headers.get('location') || '';
if (evilRes.status !== 303 || !evilLoc.endsWith('/braai-index/thanks/')) {
  fail('lang was not confined to the Index thanks pages: ' + evilLoc);
}

if (failed) process.exit(1);
console.log('subscribe contract ok');
