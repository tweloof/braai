// braai.co.za — newsletter signup endpoint (Cloudflare Pages Function)
// Forwards each signup to the site owner via Resend. RESEND_API_KEY is a
// Pages project secret — never in source.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Bad request.' }, 400);
  }

  // Honeypot: bots fill every field. Pretend success, do nothing.
  if (body.hp) {
    return json({ ok: true });
  }

  const email = String(body.email || '').trim().slice(0, 200);
  if (!EMAIL_RE.test(email)) {
    return json({ ok: false, error: 'That email doesn\'t look right.' }, 400);
  }

  if (!env.RESEND_API_KEY) {
    return json({ ok: false, error: 'Signups are briefly offline. Please try again later.' }, 503);
  }

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Lekker · braai.co.za <lekker@braai.co.za>',
      to: ['bwkling@gmail.com'],
      subject: 'New Braai Letter subscriber',
      html: `<p><strong>${escapeHtml(email)}</strong> signed up for the Braai Letter on braai.co.za.</p><p style="color:#888;font-size:12px">${new Date().toISOString()}</p>`,
    }),
  });

  if (!resp.ok) {
    return json({ ok: false, error: 'Something went wrong on our side. Please try again in a minute.' }, 502);
  }

  return json({ ok: true });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
