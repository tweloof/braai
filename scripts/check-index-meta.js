// Fails the deploy if the Index title, description, Open Graph text, or
// WebPage JSON-LD description drift from public/data/braai-index.json.
// The expected sentences are built from that file's week_label and family
// total, so a new published week cannot leave a stale snippet behind.
// Also checks the weekly signup and the press line are still on the page.

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'public/data/braai-index.json'), 'utf8'));
const week = data.week_label;
const family = data.variants && data.variants.family ? data.variants.family.total_zar : null;
const total = family != null ? family : data.total_zar;

if (!week || total == null || !Number.isFinite(Number(total))) {
  console.error('::error::braai-index.json is missing week_label or the family total');
  process.exit(1);
}

const rand = 'R' + Number(total).toFixed(2);
const dash = '\u2014';

const pages = [
  {
    file: 'public/braai-index/index.html',
    title: `National Braai Index ${dash} latest published family fire ${rand} (${week}) | braai.co.za`,
    ogTitle: `National Braai Index ${dash} latest published family fire ${rand} (${week})`,
    description: `Latest published family Saturday braai: ${rand} for the week of ${week}. Meat, fire, sides, extras and a cooldrink, from confirmed public prices. Not a shop.`,
    line: 'One email a week with the latest published Index. Free. Unsubscribe any time.',
    press: 'For press and data requests:',
    randId: 'idxRand',
  },
  {
    file: 'public/af/braai-index/index.html',
    title: `Nasionale Braai-indeks ${dash} jongste gepubliseerde gesinsbraai ${rand} (${week}) | braai.co.za`,
    ogTitle: `Nasionale Braai-indeks ${dash} jongste gepubliseerde gesinsbraai ${rand} (${week})`,
    description: `Jongste gepubliseerde gesinsbraai: ${rand} vir die week ${week}. Vleis, vuur, bykosse, ekstras en koeldrank, uit bevestigde openbare pryse. Nie \u2019n winkel nie.`,
    line: 'Een e-pos \u2019n week met die jongste gepubliseerde indeks. Gratis. Teken enige tyd uit.',
    press: 'Vir pers- en datanavrae:',
  },
  {
    file: 'public/zu/braai-index/index.html',
    title: `I-Braai Index Kazwelonke ${dash} umlilo womndeni owashicilelwa kamuva ${rand} (${week}) | braai.co.za`,
    ogTitle: `I-Braai Index Kazwelonke ${dash} umlilo womndeni owashicilelwa kamuva ${rand} (${week})`,
    description: `Umlilo womndeni owashicilelwa kamuva: ${rand} ngeviki lika-${week}. Inyama, umlilo, okuhambisana, okungeziwe nokuphuzwayo, ngezintengo zomphakathi eziqinisekisiwe. Akusona isitolo.`,
    line: 'I-imeyili eyodwa ngeviki nge-Index eshicilelwe kamuva. Mahhala. Ungazikhipha noma nini.',
    press: 'Ngezicelo zabezindaba nedatha:',
  },
];

const stale = ['this week', 'R690.87', '31 August'];
let failed = false;

function fail(msg) {
  failed = true;
  console.error('::error::' + msg);
}

function attr(html, key, value) {
  const re = new RegExp('<meta\\s[^>]*\\b' + key + '="' + value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"[^>]*>', 'i');
  const tag = html.match(re);
  if (!tag) return null;
  const content = tag[0].match(/\bcontent="([^"]*)"/);
  return content ? decode(content[1]) : null;
}

function decode(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function webPageDescription(html) {
  const blocks = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) || [];
  for (const block of blocks) {
    const raw = block.replace(/^<script type="application\/ld\+json">/, '').replace(/<\/script>$/, '');
    let data;
    try { data = JSON.parse(raw); } catch (err) {
      fail('JSON-LD did not parse: ' + err.message);
      continue;
    }
    if (data && data['@type'] === 'WebPage') return data.description || '';
  }
  return null;
}

function elementText(html, id) {
  const re = new RegExp('id="' + id + '"[^>]*>([^<]*)');
  const m = html.match(re);
  return m ? decode(m[1].trim()) : null;
}

for (const page of pages) {
  const html = fs.readFileSync(path.join(root, page.file), 'utf8');
  const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1];
  const description = attr(html, 'name', 'description');
  const ogTitle = attr(html, 'property', 'og:title');
  const ogDescription = attr(html, 'property', 'og:description');
  const twTitle = attr(html, 'name', 'twitter:title');
  const twDescription = attr(html, 'name', 'twitter:description');
  const ld = webPageDescription(html);
  const fields = {
    title: title,
    description: description,
    'og:title': ogTitle,
    'og:description': ogDescription,
    'twitter:title': twTitle,
    'twitter:description': twDescription,
    'json-ld description': ld,
  };

  const expect = {
    title: page.title,
    description: page.description,
    'og:title': page.ogTitle,
    'og:description': page.description,
    'twitter:title': page.ogTitle,
    'twitter:description': page.description,
    'json-ld description': page.description,
  };

  for (const [name, actual] of Object.entries(fields)) {
    if (actual == null) {
      fail(page.file + ' is missing ' + name);
      continue;
    }
    if (actual !== expect[name]) {
      fail(page.file + ' ' + name + ' does not match braai-index.json\n  expected: ' + expect[name] + '\n  actual:   ' + actual);
    }
    const hay = actual.toLowerCase();
    for (const needle of stale) {
      if (hay.includes(needle.toLowerCase())) {
        fail(page.file + ' ' + name + ' still says "' + needle + '"');
      }
    }
  }

  if (!html.includes('action="/api/subscribe"')) fail(page.file + ' form does not post to /api/subscribe');
  if (!html.includes('name="hp"')) fail(page.file + ' signup form is missing the honeypot');
  if (!html.includes('name="email"')) fail(page.file + ' signup form is missing the email field');
  if (!html.includes(page.line)) fail(page.file + ' is missing the weekly Index line');
  if (!html.includes(page.press)) fail(page.file + ' is missing the press line');
  if (!html.includes('mailto:lekker@braai.co.za?subject=Braai%20Index%20weekly')) {
    fail(page.file + ' is missing the mailto fallback (subject Braai Index weekly)');
  }
  if (!html.includes('href="mailto:lekker@braai.co.za"')) fail(page.file + ' press mailto is missing');
  if (/checkers\.co\.za/i.test(html)) fail(page.file + ' contains a checkers.co.za link');
  if (/meatmasters/i.test(html)) fail(page.file + ' mentions Meatmasters');

  const painted = elementText(html, 'idxRand');
  if (painted !== rand) fail(page.file + ' visible total is ' + painted + ', JSON family total is ' + rand);
  const weekLine = elementText(html, 'idxWeek') || '';
  if (!weekLine.includes(week)) fail(page.file + ' visible week line does not include ' + week);
}

const thanks = [
  'public/braai-index/thanks/index.html',
  'public/af/braai-index/thanks/index.html',
  'public/zu/braai-index/thanks/index.html',
];
for (const file of thanks) {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  if (!/noindex/i.test(html)) fail(file + ' must be noindex');
  if (/this week/i.test(html)) fail(file + ' says "this week"');
  if (/meatmasters/i.test(html)) fail(file + ' mentions Meatmasters');
}

if (failed) process.exit(1);
console.log('Index meta matches ' + week + ' ' + rand);
