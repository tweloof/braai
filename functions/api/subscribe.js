/**
 * POST /api/subscribe
 * Reconstructed from live API + public/index.html (29 Aug 2026).
 * Not the original source.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const FROM = 'Braai Letter <lekker@braai.co.za>';
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
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Bad request.' }, 400);
  }

  // Honeypot (homepage input id="oond") — silent success, no mail.
  if (body && body.hp) return json({ ok: true });

  const email = String((body && body.email) || '').trim();
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return json({ ok: false, error: "That email doesn't look right." }, 400);
  }

  const key = env.RESEND_API_KEY;
  if (!key) {
    return json({ ok: false, error: 'Something went wrong. Please try again in a minute.' }, 500);
  }

  // No Resend audience ID is known. Capture the signup in the editor inbox.
  const notified = await resend(key, {
    from: FROM,
    to: [EDITOR],
    subject: 'Braai Letter signup: ' + email,
    text: email + ' asked to join the Braai Letter.\n'
  });
  if (!notified) {
    return json({ ok: false, error: 'Something went wrong. Please try again in a minute.' }, 500);
  }

  // Best-effort confirmation to the subscriber. Signup already succeeded.
  try {
    await resend(key, {
      from: FROM,
      to: [email],
      subject: "Lekker — you're on the Braai Letter",
      text:
        "You're on the list. One email a month: recipes, wood wisdom, Braai Day plans. " +
        'No spam — spam is a tinned meat, and we don\'t braai it.\n\n' +
        'Unsubscribe any time by writing to ' +
        EDITOR +
        '.\n\n— braai.co.za\n'
    });
  } catch {
    /* ignore */
  }

  return json({ ok: true });
}
