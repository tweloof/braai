/**
 * POST /api/contribute
 * Reconstructed from live API + public/contribute/index.html (29 Aug 2026).
 * Not the original source.
 *
 * Only POST is handled. GET falls through to Pages 404 HTML (matches live).
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TYPES = new Set(['recipe', 'word', 'photo', 'tip']);
const TYPE_LABEL = {
  recipe: 'A braai recipe',
  word: 'A Braaictionary word',
  photo: 'A braai photo story',
  tip: 'A braai tip'
};
const FROM = 'lekker@braai.co.za';
const EDITOR = 'lekker@braai.co.za';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function resend(apiKey, payload) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  return res.ok;
}

export async function onRequestPost({ request, env }) {
  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  // Honeypot (input id="oond", sent as `hp`) — silent success, no mail.
  if (body && String(body.hp || '').trim()) {
    return json({ ok: true });
  }

  const name = String((body && body.name) || '').trim();
  const type = String((body && body.type) || '').trim();
  const email = String((body && body.email) || '').trim();
  const text = String((body && body.text) || '').trim();

  if (!name || name.length > 120) {
    return json({ ok: false, error: 'Tell us your name — contributions get credited.' }, 400);
  }
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return json({ ok: false, error: "That email doesn't look right." }, 400);
  }
  if (text.length < 20) {
    return json({ ok: false, error: 'Give us a bit more than that — at least a few sentences.' }, 400);
  }
  if (text.length > 8000) {
    return json({ ok: false, error: 'Give us a bit more than that — at least a few sentences.' }, 400);
  }
  if (!TYPES.has(type)) {
    return json({ ok: false, error: "Pick what you're contributing." }, 400);
  }

  const key = env.RESEND_API_KEY;
  if (!key) {
    return json({ ok: false, error: 'Something went wrong. Please try again in a minute.' }, 500);
  }

  const label = TYPE_LABEL[type] || type;
  const sent = await resend(key, {
    from: FROM,
    to: [EDITOR],
    reply_to: email,
    subject: 'Contribution (' + type + '): ' + name,
    text:
      'Type: ' + label + ' (' + type + ')\n' +
      'Name: ' + name + '\n' +
      'Email: ' + email + '\n\n' +
      text +
      '\n'
  });
  if (!sent) {
    return json({ ok: false, error: 'Something went wrong. Please try again in a minute.' }, 500);
  }

  return json({ ok: true });
}
