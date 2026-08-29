/**
 * POST /api/subscribe
 * Reconstructed from live API + public/index.html (29 Aug 2026).
 * Not the original source.
 *
 * Only POST is handled. GET falls through to Pages 404 HTML (matches live).
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
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

  // Honeypot (homepage input id="oond", sent as `hp`) — silent success, no mail.
  if (body && String(body.hp || '').trim()) {
    return json({ ok: true });
  }

  const email = String((body && body.email) || '').trim();
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return json({ ok: false, error: "That email doesn't look right." }, 400);
  }

  const key = env.RESEND_API_KEY;
  if (!key) {
    return json({ ok: false, error: 'Something went wrong. Please try again in a minute.' }, 500);
  }

  // Resend audience id is unknown. Notify the editor instead of inventing one.
  const sent = await resend(key, {
    from: FROM,
    to: [EDITOR],
    reply_to: email,
    subject: 'Braai Letter signup: ' + email,
    text:
      email +
      ' asked to join the Braai Letter.\n\n' +
      'Add them to the monthly list. This function does not have a Resend audience id.\n'
  });
  if (!sent) {
    return json({ ok: false, error: 'Something went wrong. Please try again in a minute.' }, 500);
  }

  return json({ ok: true });
}
