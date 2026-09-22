// braai.co.za service worker — app shell v24
// Pages: network-first with cache fallback (so the braai is always fresh).
// Reading (recipes, cuts, rules of the fire) and /app/: same, and also
// stored when the phone app saves them with a plain fetch (not only navigations).
// Assets: cache-first (fonts, CSS, diagrams, icons rarely change).
// /api/  : never touched — vuur and tonight shared state must always be live.

var VERSION = 'braai-v24';
var CORE = [
  '/offline',
  '/assets/style.css',
  '/assets/fonts/fraunces-var.woff2',
  '/assets/fonts/fraunces-italic-var.woff2',
  '/assets/fonts/inter-var.woff2',
  '/assets/favicon.svg',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
  '/assets/icons/apple-touch-icon.png'
];
var SHELL = [
  '/app/',
  '/app/index.html',
  '/app/app.js',
  '/app/app.css',
  '/assets/diagrams/fire-stages.svg',
  '/data/braai-index.json'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(VERSION).then(function (c) {
      return c.addAll(CORE).then(function () {
        return Promise.all(SHELL.map(function (url) {
          return c.add(url).catch(function () { return null; });
        }));
      });
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

function isReading(pathname) {
  return pathname === '/recipes' || pathname.indexOf('/recipes/') === 0
    || pathname === '/cuts' || pathname.indexOf('/cuts/') === 0
    || pathname === '/fire' || pathname.indexOf('/fire/') === 0
    || pathname.indexOf('/af/fire') === 0
    || pathname.indexOf('/zu/fire') === 0
    || pathname === '/app' || pathname.indexOf('/app/') === 0;
}

function shouldStore(req, url) {
  if (url.pathname === '/data/braai-index.json') return true;
  if (isReading(url.pathname)) return true;
  if (req.mode === 'navigate') return true;
  if (url.pathname.slice(-1) === '/') return true;
  return false;
}

function offlinePage() {
  return caches.match('/offline').then(function (hit) {
    return hit || caches.match('/offline.html');
  });
}

function stampCache(res) {
  var headers = new Headers(res.headers);
  headers.set('X-Braai-From-Cache', '1');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: headers });
}

function matchStored(req) {
  var url = new URL(req.url);
  return caches.match(req).then(function (hit) {
    if (hit) return hit;
    if (req.mode !== 'navigate' && url.pathname !== '/data/braai-index.json') return null;
    return caches.match(url.pathname).then(function (byPath) {
      if (byPath) return byPath;
      if (url.pathname.slice(-1) === '/') return caches.match(url.pathname + 'index.html');
      return null;
    });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.indexOf('/api/') === 0) return; // live state, never cached

  // Assets: cache-first
  if (url.pathname.indexOf('/assets/') === 0) {
    e.respondWith(
      caches.match(req).then(function (hit) {
        return hit || fetch(req).then(function (res) {
          if (res.ok) {
            var copy = res.clone();
            caches.open(VERSION).then(function (c) { c.put(req, copy); });
          }
          return res;
        });
      })
    );
    return;
  }

  if (!shouldStore(req, url)) return;

  // Pages, the phone shell, the published index, and saved reading: network-first.
  e.respondWith(
    fetch(req).then(function (res) {
      if (res.ok) {
        var forReq = res.clone();
        var forPath = (req.mode === 'navigate' && url.search) ? res.clone() : null;
        var storeAs = new Request(req.url);
        caches.open(VERSION).then(function (c) {
          var jobs = [c.put(storeAs, forReq).catch(function () { return null; })];
          if (forPath) jobs.push(c.put(url.pathname, forPath).catch(function () { return null; }));
          return Promise.all(jobs);
        });
      }
      return res;
    }).catch(function () {
      return matchStored(req).then(function (hit) {
        if (hit) {
          if (url.pathname === '/data/braai-index.json') return stampCache(hit);
          return hit;
        }
        if (req.mode === 'navigate') return offlinePage();
      });
    })
  );
});
