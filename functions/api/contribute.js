// braai.co.za — community contribution endpoint (Cloudflare Pages Function)
// Forwards each contribution to the editor via Resend, with reply-to set to
// the contributor so photos can follow by email. RESEND_API_KEY is a Pages
// project secret — never in source.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TYPES = ['recipe', 'word', 'photo', 'tip'];

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

  const name = String(body.name || '').trim().slice(0, 120);
  const email = String(body.email || '').trim().slice(0, 200);
  const type = String(body.type || '').trim();
  const text = String(body.text || '').trim().slice(0, 8000);

  if (!name) return json({ ok: false, error: 'Tell us your name — contributions get credited.' }, 400);
  if (!EMAIL_RE.test(email)) return json({ ok: false, error: 'That email doesn\'t look right.' }, 400);
  if (!TYPES.includes(type)) return json({ ok: false, error: 'Pick what you\'re contributing.' }, 400);
  if (text.length < 20) return json({ ok: false, error: 'Give us a bit more than that — at least a few sentences.' }, 400);

  if (!env.RESEND_API_KEY) {
    return json({ ok: false, error: 'Contributions are briefly offline. Please try again later.' }, 503);
  }

  const label = { recipe: 'Recipe', word: 'Braaictionary word', photo: 'Photo story', tip: 'Braai tip' }[type];

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Lekker · braai.co.za <lekker@braai.co.za>',
      to: ['bwkling@gmail.com'],
      reply_to: email,
      subject: `[braai.co.za] New contribution: ${label} from ${name}`,
      html: `<h3>${escapeHtml(label)} submitted on braai.co.za/contribute/</h3>
<p><strong>From:</strong> ${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;</p>
<pre style="white-space:pre-wrap;font-family:inherit;background:#f6f1ea;padding:12px;border-radius:8px">${escapeHtml(text)}</pre>
<p style="color:#888;font-size:12px">Reply to this email to reach the contributor directly (photos can be attached in replies). ${new Date().toISOString()}</p>`,
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
