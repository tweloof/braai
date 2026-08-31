// braai.co.za service worker — v11
// Pages: network-first with cache fallback (so the braai is always fresh).
// Assets: cache-first (fonts, CSS, diagrams, icons rarely change).
// /api/  : never touched — vuur and tonight shared state must always be live.

var VERSION = 'braai-v13';
var PRECACHE = [
  '/offline',
  '/assets/style.css',
  '/assets/fonts/fraunces-var.woff2',
  '/assets/fonts/inter-var.woff2',
  '/assets/favicon.svg',
  '/assets/icons/icon-192.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(VERSION).then(function (c) { return c.addAll(PRECACHE); }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

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

  // Pages and everything else: network-first, cache fallback, offline page last
  e.respondWith(
    fetch(req).then(function (res) {
      if (res.ok && (req.mode === 'navigate' || url.pathname.slice(-1) === '/')) {
        var copy = res.clone();
        caches.open(VERSION).then(function (c) { c.put(req, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(req).then(function (hit) {
        if (hit) return hit;
        if (req.mode === 'navigate') return caches.match('/offline');
      });
    })
  );
});
