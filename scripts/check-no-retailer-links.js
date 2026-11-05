#!/usr/bin/env node
/**
 * Fail if the National Braai Index grows a retailer product link again.
 *
 * The basket is a citation, not a shop. public/data/braai-index.json may
 * name the shelf read in plain text. It may not carry a product url, and
 * no public page may link a basket line (or anything else) to a retailer.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const publicDir = path.join(root, 'public');
const indexPath = path.join(publicDir, 'data', 'braai-index.json');

const RETAILER_HOSTS = [
  'checkers.co.za',
  'sixty60.co.za',
  'shoprite.co.za',
  'pnp.co.za',
  'picknpay.co.za',
  'woolworths.co.za',
  'takealot.com',
  'makro.co.za',
  'game.co.za',
  'spar.co.za',
  'foodloversmarket.co.za',
  'clicks.co.za',
  'dischem.co.za',
  'usave.co.za',
  'boxer.co.za',
  'massmart.co.za'
];

const LINK_KEYS = new Set([
  'url',
  'href',
  'link',
  'product_url',
  'producturl',
  'productUrl'
]);

const TEXT_EXT = new Set([
  '.html', '.js', '.json', '.txt', '.xml', '.css', '.webmanifest', '.svg', '.md'
]);

const INDEX_PAGES = [
  'public/braai-index/index.html',
  'public/af/braai-index/index.html',
  'public/zu/braai-index/index.html',
  'public/index.html',
  'public/app/app.js'
];

const errors = [];

function rel(file) {
  return path.relative(root, file);
}

function walk(dir, acc) {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const file = path.join(dir, name);
    const stat = fs.statSync(file);
    if (stat.isDirectory()) walk(file, acc);
    else acc.push(file);
  }
  return acc;
}

function scriptBodies(html) {
  const bodies = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = re.exec(html))) {
    const attrs = match[1] || '';
    if (/type\s*=\s*["']application\/ld\+json["']/i.test(attrs)) continue;
    bodies.push(match[2]);
  }
  return bodies;
}

const files = walk(publicDir, []);
for (const file of files) {
  if (!TEXT_EXT.has(path.extname(file).toLowerCase())) continue;
  const text = fs.readFileSync(file, 'utf8').toLowerCase();
  for (const host of RETAILER_HOSTS) {
    if (text.includes(host)) {
      errors.push(rel(file) + ' contains retailer host ' + host);
    }
  }
}

let data;
try {
  data = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
} catch (err) {
  errors.push('public/data/braai-index.json is not valid JSON: ' + err.message);
}

function walkJson(node, trail) {
  if (Array.isArray(node)) {
    node.forEach(function (value, i) {
      walkJson(value, trail + '[' + i + ']');
    });
    return;
  }
  if (node && typeof node === 'object') {
    Object.keys(node).forEach(function (key) {
      if (LINK_KEYS.has(key) || LINK_KEYS.has(key.toLowerCase())) {
        errors.push('public/data/braai-index.json has link field ' + trail + '.' + key);
      }
      walkJson(node[key], trail ? trail + '.' + key : key);
    });
    return;
  }
  if (typeof node === 'string' && /https?:\/\//i.test(node)) {
    errors.push('public/data/braai-index.json has a URL at ' + trail);
  }
}

if (data) {
  walkJson(data, '');
  if (typeof data.source !== 'string' || !data.source.trim()) {
    errors.push('public/data/braai-index.json needs a plain-text source note');
  } else if (/https?:\/\//i.test(data.source)) {
    errors.push('public/data/braai-index.json source note must not be a URL');
  } else if (!/shelf read/i.test(data.source)) {
    errors.push('public/data/braai-index.json source note must stay a shelf read, not a shop link');
  }
}

for (const page of INDEX_PAGES) {
  const file = path.join(root, page);
  if (!fs.existsSync(file)) {
    errors.push(page + ' is missing');
    continue;
  }
  const text = fs.readFileSync(file, 'utf8');
  const scripts = page.endsWith('.js') ? [text] : scriptBodies(text);
  const joined = scripts.join('\n');
  if (/\bit\.url\b|\bitem\.url\b|\bproduct_url\b/.test(joined)) {
    errors.push(page + ' renders a basket item from a url field');
  }
  if (page.indexOf('braai-index/index.html') !== -1 && /<a\b/i.test(joined)) {
    errors.push(page + ' basket script builds an anchor; basket lines must stay plain text');
  }
}

if (errors.length) {
  console.error('Retailer-link check failed:');
  errors.forEach(function (line) { console.error(' - ' + line); });
  process.exit(1);
}

console.log('Retailer-link check passed (' + files.length + ' public files, no product urls).');
