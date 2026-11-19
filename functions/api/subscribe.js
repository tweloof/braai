// braai.co.za — /api/subscribe (Cloudflare Pages Function)
//
// Two lists share this URL.
//
// 1. The Braai Letter. Homepage JSON `{email, hp}` still goes to the editor
//    via Resend. Recipient, subject, and error text are unchanged.
// 2. The weekly National Braai Index. The form on the Index pages (and JSON
//    with list=index) stores {email, lang, ts} in the KV binding SUBSCRIBERS
//    when that binding exists. No Resend call, no third-party signup service.
//
// SUBSCRIBERS is a Pages project setting. It is not in wrangler.toml on
// purpose. Create the namespace in the Cloudflare dashboard and bind it as
// SUBSCRIBERS before this list stores anything. Until then an Index signup
// gets 503 "Signup opening soon." and the page offers a mailto.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const THANKS = {
  en: '/braai-index/thanks/',
  af: '/af/braai-index/thanks/',
  zu: '/zu/braai-index/thanks/',
};

const BACK = {
  en: '/braai-index/',
  af: '/af/braai-index/',
  zu: '/zu/braai-index/',
};

const COPY = {
  en: {
    htmlLang: 'en-ZA',
    badTitle: 'That email doesn\u2019t look right.',
    bad: 'That email doesn\u2019t look right. Try it again, or go back to the Index.',
    soonTitle: 'Signup opening soon.',
    soon: 'The weekly Index is not storing addresses yet. Email lekker@braai.co.za with the subject \u201cBraai Index weekly\u201d and we will add you when it opens.',
    back: 'Back to the Index',
    skip: 'Skip to content',
    home: '/',
  },
  af: {
    htmlLang: 'af',
    badTitle: 'Daardie e-pos lyk nie reg nie.',
    bad: 'Daardie e-pos lyk nie reg nie. Probeer weer, of gaan terug na die indeks.',
    soonTitle: 'Aanmelding maak binnekort oop.',
    soon: 'Die weeklikse indeks stoor nog nie adresse nie. E-pos lekker@braai.co.za met die onderwerp \u201cBraai Index weekly\u201d en ons voeg jou by wanneer dit oopmaak.',
    back: 'Terug na die indeks',
    skip: 'Spring na inhoud',
    home: '/af/',
  },
  zu: {
    htmlLang: 'zu',
    badTitle: 'Leyo imeyili ayibukeki ilungile.',
    bad: 'Leyo imeyili ayibukeki ilungile. Zama futhi, noma buyela ku-Index.',
    soonTitle: 'Ukubhalisa kuzovuleka maduze.',
    soon: 'I-Index yamaviki onke ayikagcini amakheli okwamanje. Thumela i-imeyili ku-lekker@braai.co.za nesihloko esithi \u201cBraai Index weekly\u201d, sizokufaka uma ivuleka.',
    back: 'Buyela ku-Index',
    skip: 'Yeqela okuqukethwe',
    home: '/zu/',
  },
};

export async function onRequestPost(context) {
  const { request, env } = context;
  const parsed = await readBody(request);
  if (!parsed.ok) return json({ ok: false, error: 'Bad request.' }, 400);

  const indexSignup = parsed.form || parsed.body.list === 'index';
  if (indexSignup) return handleIndex(request, env, parsed.body, parsed.form);
  return handleLetter(env, parsed.body);
}

async function handleIndex(request, env, body, asHtml) {
  const lang = normaliseLang(body.lang);
  const copy = COPY[lang];

  if (body.hp) return indexOk(request, asHtml, lang);

  const email = String(body.email || '').trim().slice(0, 200);
  if (!EMAIL_RE.test(email)) {
    if (asHtml) return htmlPage(copy, 400, copy.badTitle, copy.bad, BACK[lang]);
    return json({ ok: false, error: 'That email doesn\'t look right.' }, 400);
  }

  if (!env.SUBSCRIBERS || typeof env.SUBSCRIBERS.put !== 'function') {
    if (asHtml) return htmlPage(copy, 503, copy.soonTitle, copy.soon, BACK[lang]);
    return json({ ok: false, error: 'Signup opening soon.' }, 503);
  }

  const record = {
    email: email.toLowerCase(),
    lang: lang,
    ts: new Date().toISOString(),
  };

  try {
    await env.SUBSCRIBERS.put(record.email, JSON.stringify(record));
  } catch {
    if (asHtml) return htmlPage(copy, 503, copy.soonTitle, copy.soon, BACK[lang]);
    return json({ ok: false, error: 'Signup opening soon.' }, 503);
  }

  return indexOk(request, asHtml, lang);
}

function indexOk(request, asHtml, lang) {
  if (!asHtml) return json({ ok: true });
  return Response.redirect(new URL(THANKS[lang], request.url), 303);
}

// Braai Letter. Kept as its own path so the homepage contract stays put.
async function handleLetter(env, body) {
  if (body.hp) return json({ ok: true });

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

async function readBody(request) {
  const ct = request.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    try {
      const body = await request.json();
      if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false };
      return { ok: true, form: false, body };
    } catch {
      return { ok: false };
    }
  }
  try {
    const fd = await request.formData();
    return {
      ok: true,
      form: true,
      body: {
        email: fd.get('email') || '',
        hp: fd.get('hp') || '',
        lang: fd.get('lang') || '',
        list: fd.get('list') || 'index',
      },
    };
  } catch {
    return { ok: false };
  }
}

function normaliseLang(value) {
  const lang = String(value || '').trim().toLowerCase();
  return THANKS[lang] ? lang : 'en';
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function htmlPage(copy, status, title, message, back) {
  const mailto = 'mailto:lekker@braai.co.za?subject=Braai%20Index%20weekly';
  const doc = `<!DOCTYPE html>
<html lang="${copy.htmlLang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)} | braai.co.za</title>
<link rel="icon" type="image/svg+xml" href="/assets/favicon.svg">
<link rel="stylesheet" href="/assets/style.css">
</head>
<body>
<a class="skip-link" href="#main">${escapeHtml(copy.skip)}</a>
<header class="site-head">
  <div class="wrap">
    <a class="brand" href="${escapeHtml(copy.home)}" aria-label="braai.co.za">
      <svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 7c1.5 6.5 5.8 9.4 8.9 13.1 3 3.6 4.6 7.4 4.1 12.1-.6 6.2-5 10.6-10.4 11.6 2.1-2.2 3.2-4.6 3.2-7.4 0-4.9-3.6-7.4-5.5-11.8-1.1 2.6-3.4 4.5-4.9 7-1.3 2.1-1.9 4.1-1.7 6.5.2 2.2 1.1 4.1 2.8 5.8-5.5-.9-10-5.4-10.5-11.7-.4-4.5 1.2-8.3 4-11.8C25.2 16.6 30.6 13.6 32 7z" fill="#f49d37"/><rect x="14" y="48" width="36" height="3" rx="1.5" fill="#c89b3c"/><rect x="18" y="54" width="28" height="3" rx="1.5" fill="#7a6d62"/></svg>
      <span class="word">braai<em>.co.za</em></span>
    </a>
  </div>
</header>
<div class="hero hero-small" id="main">
  <h1>${escapeHtml(title)}</h1>
  <p class="lead">${escapeHtml(message)}</p>
  <p class="lead"><a class="idx-mail" href="${mailto}">lekker@braai.co.za</a></p>
  <p><a class="btn" href="${escapeHtml(back)}">${escapeHtml(copy.back)}</a></p>
</div>
</body>
</html>`;
  return new Response(doc, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex',
    },
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
