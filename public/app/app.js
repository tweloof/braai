/* braai.co.za phone shell. Same published index, /api/tonight and /api/vuur.
   No new backend. Nothing is invented when those calls fail. */
(function () {
  'use strict';

  var PANELS = ['tonight', 'index', 'read', 'vuur'];
  var BURN_PER_HOUR = 0.42;
  var MAX_FUEL = 100;
  var API_VUUR = '/api/vuur';
  var API_TONIGHT = '/api/tonight';

  var RECIPES = [
    ['boerewors-rolls', 'Boerewors rolls'],
    ['braaibroodjies', 'Braaibroodjies'],
    ['lamb-tjops', 'Lamb tjops'],
    ['butterflied-lamb', 'Butterflied lamb'],
    ['chicken-sosaties', 'Chicken sosaties'],
    ['pork-spare-ribs', 'Pork spare ribs'],
    ['lamb-ribbetjies', 'Lamb ribbetjies'],
    ['snoek', 'Snoek'],
    ['roosterkoek', 'Roosterkoek'],
    ['pap-en-sous', 'Pap en sous'],
    ['monkey-gland-sauce', 'Monkey gland sauce'],
    ['potato-bake', 'Potato bake'],
    ['potbrood', 'Potbrood'],
    ['mieliemeel-dumplings', 'Mieliemeel dumplings'],
    ['chocolate-bananas', 'Chocolate bananas']
  ];

  var TOWNS = [
    'Cape Town', 'Stellenbosch', 'Paarl', 'Somerset West', 'Bellville', 'Hermanus', 'George', 'Knysna', 'Mossel Bay', 'Oudtshoorn', 'Beaufort West', 'Saldanha',
    'Gqeberha', 'Kariega', 'Jeffreys Bay', 'Makhanda', 'East London', 'Mthatha', 'Qonce', 'Komani', 'Graaff-Reinet',
    'Durban', 'Pietermaritzburg', 'Umhlanga', 'Ballito', 'Richards Bay', 'Newcastle', 'Ladysmith', 'Vryheid', 'Port Shepstone', 'Howick',
    'Johannesburg', 'Soweto', 'Sandton', 'Pretoria', 'Centurion', 'Midrand', 'Krugersdorp', 'Roodepoort', 'Benoni', 'Boksburg', 'Germiston', 'Vereeniging', 'Vanderbijlpark',
    'Bloemfontein', 'Welkom', 'Bethlehem', 'Kroonstad', 'Harrismith',
    'Kimberley', 'Upington', 'Springbok', 'Kuruman',
    'Mahikeng', 'Rustenburg', 'Klerksdorp', 'Potchefstroom', 'Brits',
    'Polokwane', 'Tzaneen', 'Musina', 'Thohoyandou',
    'Mbombela', 'eMalahleni', 'Middelburg', 'Secunda'
  ];

  var PROV = {
    'Cape Town': 'WC', 'Stellenbosch': 'WC', 'Paarl': 'WC', 'Somerset West': 'WC', 'Bellville': 'WC', 'Hermanus': 'WC', 'George': 'WC', 'Knysna': 'WC', 'Mossel Bay': 'WC', 'Oudtshoorn': 'WC', 'Beaufort West': 'WC', 'Saldanha': 'WC',
    'Gqeberha': 'EC', 'Kariega': 'EC', 'Jeffreys Bay': 'EC', 'Makhanda': 'EC', 'East London': 'EC', 'Mthatha': 'EC', 'Qonce': 'EC', 'Komani': 'EC', 'Graaff-Reinet': 'EC',
    'Durban': 'KZN', 'Pietermaritzburg': 'KZN', 'Umhlanga': 'KZN', 'Ballito': 'KZN', 'Richards Bay': 'KZN', 'Newcastle': 'KZN', 'Ladysmith': 'KZN', 'Vryheid': 'KZN', 'Port Shepstone': 'KZN', 'Howick': 'KZN',
    'Johannesburg': 'GP', 'Soweto': 'GP', 'Sandton': 'GP', 'Pretoria': 'GP', 'Centurion': 'GP', 'Midrand': 'GP', 'Krugersdorp': 'GP', 'Roodepoort': 'GP', 'Benoni': 'GP', 'Boksburg': 'GP', 'Germiston': 'GP', 'Vereeniging': 'GP', 'Vanderbijlpark': 'GP',
    'Bloemfontein': 'FS', 'Welkom': 'FS', 'Bethlehem': 'FS', 'Kroonstad': 'FS', 'Harrismith': 'FS',
    'Kimberley': 'NC', 'Upington': 'NC', 'Springbok': 'NC', 'Kuruman': 'NC',
    'Mahikeng': 'NW', 'Rustenburg': 'NW', 'Klerksdorp': 'NW', 'Potchefstroom': 'NW', 'Brits': 'NW',
    'Polokwane': 'LP', 'Tzaneen': 'LP', 'Musina': 'LP', 'Thohoyandou': 'LP',
    'Mbombela': 'MP', 'eMalahleni': 'MP', 'Middelburg': 'MP', 'Secunda': 'MP'
  };
  var PNAMES = { WC: 'Western Cape', EC: 'Eastern Cape', NC: 'Northern Cape', FS: 'Free State', KZN: 'KwaZulu-Natal', GP: 'Gauteng', MP: 'Mpumalanga', LP: 'Limpopo', NW: 'North West' };

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function rand(n) {
    var x = Number(n);
    if (!isFinite(x)) return null;
    return 'R' + x.toFixed(2);
  }
  function compactAge(h) {
    if (h < 1) return Math.max(1, Math.round(h * 60)) + 'm';
    if (h < 48) return Math.round(h) + 'h';
    var d = h / 24;
    return (d < 10 ? d.toFixed(1).replace(/\.0$/, '') : Math.round(d)) + 'd';
  }

  /* ---------- panels ---------- */
  function panelFromHash() {
    var h = (location.hash || '').replace(/^#/, '').split('&')[0].split('?')[0];
    return PANELS.indexOf(h) === -1 ? 'tonight' : h;
  }
  function showPanel(name) {
    if (PANELS.indexOf(name) === -1) name = 'tonight';
    PANELS.forEach(function (p) {
      var el = document.getElementById('panel-' + p);
      if (el) el.hidden = p !== name;
      var btn = document.getElementById('tab-' + p);
      if (btn) {
        btn.setAttribute('aria-selected', p === name ? 'true' : 'false');
        btn.tabIndex = p === name ? 0 : -1;
      }
    });
    window.scrollTo(0, 0);
  }
  document.getElementById('appTabs').addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('button[data-panel]') : null;
    if (!btn) return;
    var name = btn.getAttribute('data-panel');
    if (location.hash.replace(/^#/, '') !== name) location.hash = name;
    else showPanel(name);
  });
  window.addEventListener('hashchange', function () { showPanel(panelFromHash()); });
  showPanel(panelFromHash());

  /* ---------- install ---------- */
  var deferredPrompt = null;
  var installBar = document.getElementById('installBar');
  var installBtn = document.getElementById('installBtn');
  var installText = document.getElementById('installText');
  function standalone() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  }
  function paintInstall() {
    if (standalone()) { installBar.hidden = true; return; }
    installBar.hidden = false;
    var ios = /iphone|ipad|ipod/i.test(navigator.userAgent || '');
    if (deferredPrompt) {
      installText.textContent = 'Add Die Braai to your home screen. It opens this page, works with the same site, and keeps recipes you have saved when the signal goes.';
      installBtn.hidden = false;
    } else if (ios) {
      installText.textContent = 'In Safari, tap Share, then Add to Home Screen. The icon opens this page.';
      installBtn.hidden = true;
    } else {
      installText.textContent = 'In Chrome, open the browser menu and choose Install app or Add to Home screen. In Safari: Share, then Add to Home Screen.';
      installBtn.hidden = true;
    }
  }
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    paintInstall();
  });
  installBtn.addEventListener('click', function () {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(function () {
      deferredPrompt = null;
      paintInstall();
    });
  });
  window.addEventListener('appinstalled', function () {
    deferredPrompt = null;
    installBar.hidden = true;
  });
  paintInstall();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('/sw.js'); });
  }

  /* ---------- National Braai Index (published file, never a guess) ---------- */
  function paintIndex(d, fromCache) {
    var fam = (d.variants && d.variants.family) || { total_zar: d.total_zar, complete: d.complete };
    var beer = d.variants && d.variants.with_beer;
    var complete = !!(fam && fam.complete && fam.total_zar != null);
    var el = document.getElementById('idxRand');
    el.textContent = complete ? rand(fam.total_zar) : 'R\u2014';
    var week = document.getElementById('idxWeek');
    week.textContent = (d.week_label || 'This week') + ' \u00b7 basket ' + (d.basket || 'v2') + (complete ? ', complete' : ', incomplete');
    var beerEl = document.getElementById('idxBeer');
    if (beer && beer.total_zar != null) beerEl.textContent = 'With a 6-pack of lager: ' + rand(beer.total_zar);
    else beerEl.textContent = '';
    var tiers = document.getElementById('idxTiers');
    if (d.tiers && d.tiers.budget && d.tiers.budget.total_zar != null && d.tiers.high_end && d.tiers.high_end.total_zar != null) {
      tiers.textContent = 'Budget ' + rand(d.tiers.budget.total_zar) + ' \u00b7 High-end ' + rand(d.tiers.high_end.total_zar);
    } else tiers.textContent = '';
    var live = document.getElementById('idxLive');
    if (!complete) {
      live.textContent = 'The shareable number waits until every basket line has a public price. We do not fill a gap.';
    } else if (fromCache) {
      live.textContent = 'Saved copy on this phone, from the published basket. It refreshes when you have signal. Not a shop.';
    } else {
      live.textContent = 'Published figure from the site basket. Not a shop.';
    }
  }
  fetch('/data/braai-index.json', { cache: 'no-store' })
    .then(function (r) {
      var fromCache = r.headers.get('X-Braai-From-Cache') === '1';
      return r.json().then(function (d) { paintIndex(d, fromCache); });
    })
    .catch(function () {
      document.getElementById('idxRand').textContent = '\u2026';
      document.getElementById('idxLive').textContent = 'The index needs a signal the first time. After that, the last published number stays on the phone.';
    });

  /* ---------- Tonight (same towns, same /api/tonight, same local day key) ---------- */
  var dl = document.getElementById('tnTowns');
  dl.innerHTML = TOWNS.map(function (t) { return '<option value="' + t.replace(/"/g, '&quot;') + '">'; }).join('');

  function sastDay() {
    return new Date(Date.now() + 2 * 3600 * 1000).toISOString().slice(0, 10);
  }
  function storageKey() { return 'tonight-' + sastDay(); }
  function already() {
    try { return localStorage.getItem(storageKey()) || ''; } catch (e) { return ''; }
  }
  function remember(town) {
    try { localStorage.setItem(storageKey(), town); } catch (e) {}
  }

  function paintTonight(d) {
    if (!d || !d.ok) return;
    var total = d.total || 0;
    var towns = d.towns || [];
    var head = document.getElementById('tnHead');
    var sub = document.getElementById('tnSub');
    if (total === 0) {
      head.textContent = 'Nobody has spoken yet';
      sub.textContent = 'SAST day ' + d.day + '. The slate is clean.';
    } else {
      head.textContent = total + (total === 1 ? ' fire' : ' fires') + ' tonight';
      sub.textContent = 'SAST day ' + d.day + ' \u00b7 ' + towns.length + (towns.length === 1 ? ' town' : ' towns') + '. Real taps only.';
    }
    var byP = { WC: 0, EC: 0, NC: 0, FS: 0, KZN: 0, GP: 0, MP: 0, LP: 0, NW: 0 };
    var maxT = 1;
    towns.forEach(function (t) {
      var p = PROV[t.town] || '';
      if (byP[p] != null) byP[p] += t.n;
      if (t.n > maxT) maxT = t.n;
    });
    var maxP = 1;
    Object.keys(byP).forEach(function (k) { if (byP[k] > maxP) maxP = byP[k]; });
    document.querySelectorAll('#panel-tonight .tn-prov').forEach(function (el) {
      var n = byP[el.getAttribute('data-p')] || 0;
      var t = n / maxP;
      el.style.fill = n === 0
        ? '#2e2620'
        : 'rgb(' + Math.round(80 + t * 128) + ',' + Math.round(40 + t * 30) + ',' + Math.round(20 + t * 10) + ')';
      el.style.stroke = n === 0 ? 'rgba(244,157,55,.22)' : 'rgba(244,157,55,.55)';
    });
    document.getElementById('tnLegend').innerHTML = Object.keys(PNAMES).map(function (k) {
      return '<li><b>' + k + '</b> ' + esc(PNAMES[k]) + ' <span>' + byP[k] + '</span></li>';
    }).join('');
    var list = document.getElementById('tnList');
    var empty = document.getElementById('tnEmpty');
    if (!towns.length) {
      list.innerHTML = '';
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    var mine = already();
    list.innerHTML = towns.map(function (t) {
      var w = Math.max(8, Math.round((t.n / maxT) * 100));
      var you = mine && mine.toLowerCase() === String(t.town).toLowerCase() ? ' tn-you' : '';
      return '<li class="' + you + '"><span class="tn-bar" style="width:' + w + '%"></span><span class="tn-name">' + esc(t.town) + '</span><span class="tn-n">' + t.n + '</span></li>';
    }).join('');
  }

  function syncTonight() {
    return fetch(API_TONIGHT, { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(paintTonight)
      .catch(function () {
        document.getElementById('tnSub').textContent = 'The heat is briefly unreachable. The fires, if any, are still lit.';
      });
  }

  var tnForm = document.getElementById('tnForm');
  var tnNote = document.getElementById('tnNote');
  var tnGo = document.getElementById('tnGo');
  var tnTown = document.getElementById('tnTown');
  function lockIfDone() {
    var t = already();
    if (!t) return;
    tnGo.disabled = true;
    tnGo.textContent = 'You\u2019re on the map';
    tnTown.value = t;
    tnNote.textContent = t + ' is counted for this SAST day. Midnight starts a new slate.';
  }
  lockIfDone();
  tnForm.addEventListener('submit', function (e) {
    e.preventDefault();
    if (already()) { lockIfDone(); return; }
    var town = tnTown.value.trim();
    if (town.length < 2) {
      tnNote.textContent = 'Which town? It matters more than you think.';
      return;
    }
    tnGo.disabled = true;
    fetch(API_TONIGHT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ town: town, hp: document.getElementById('tnHp').value || '' })
    }).then(function (r) { return r.json(); }).then(function (d) {
      if (d.ok && d.towns) {
        remember(d.you || town);
        paintTonight(d);
        lockIfDone();
        tnNote.textContent = 'Lekker. ' + (d.you || town) + ' is on tonight\u2019s slate.';
      } else if (d.ok) {
        tnNote.textContent = 'Lekker.';
      } else {
        tnNote.textContent = d.error || 'That did not land. Try again in a minute.';
        tnGo.disabled = false;
      }
    }).catch(function () {
      tnNote.textContent = 'Tonight is briefly unreachable. Try again in a minute.';
      tnGo.disabled = false;
    });
  });
  syncTonight();
  setInterval(syncTonight, 60000);

  /* ---------- offline reading ---------- */
  var readList = document.getElementById('readRecipes');
  readList.innerHTML = RECIPES.map(function (r) {
    return '<li><a href="/recipes/' + r[0] + '/"><span class="app-link-main">' + esc(r[1]) + '</span><span data-cache="/recipes/' + r[0] + '/"></span></a></li>';
  }).join('');

  function markCached() {
    if (!window.caches) return;
    document.querySelectorAll('[data-cache]').forEach(function (el) {
      caches.match(el.getAttribute('data-cache')).then(function (hit) {
        el.textContent = hit ? 'On this phone' : 'Opens the page';
      });
    });
  }
  markCached();

  var SAVE_URLS = ['/recipes/', '/cuts/', '/fire/', '/assets/photos/fire.webp', '/assets/photos/recipes.webp', '/assets/diagrams/fire-stages.svg']
    .concat(RECIPES.map(function (r) { return '/recipes/' + r[0] + '/'; }))
    .concat(RECIPES.filter(function (r) { return r[0] !== 'snoek'; }).map(function (r) { return '/assets/photos/' + r[0] + '.webp'; }));

  document.getElementById('saveBtn').addEventListener('click', function () {
    var btn = document.getElementById('saveBtn');
    var note = document.getElementById('saveNote');
    var i = 0;
    var ok = 0;
    btn.disabled = true;
    function next() {
      if (i >= SAVE_URLS.length) {
        btn.disabled = false;
        note.textContent = ok + ' of ' + SAVE_URLS.length + ' saved on this phone. Recipes, the cuts and the rules of the fire can be read offline.';
        markCached();
        return;
      }
      var u = SAVE_URLS[i++];
      note.textContent = 'Saving ' + i + ' of ' + SAVE_URLS.length + '\u2026';
      fetch(u).then(function (r) {
        if (r && r.ok) ok++;
        next();
      }).catch(function () { next(); });
    }
    next();
  });

  /* ---------- The Braai (same /api/vuur contract) ---------- */
  function getToken() {
    try {
      var t = localStorage.getItem('vuur-token');
      if (t && /^[A-Za-z0-9-]{8,64}$/.test(t)) return t;
      t = (window.crypto && crypto.randomUUID)
        ? crypto.randomUUID()
        : ('v' + Math.random().toString(36).slice(2) + Date.now().toString(36));
      localStorage.setItem('vuur-token', t);
      return t;
    } catch (e) {
      return 'v' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    }
  }
  var TOKEN = getToken();
  function getMe() { try { return JSON.parse(localStorage.getItem('vuur-me')) || null; } catch (e) { return null; } }
  function setMe(m) { try { localStorage.setItem('vuur-me', JSON.stringify(m)); } catch (e) {} }

  var vuurState = null;
  var vuurFetchedAt = 0;
  function elapsedH() { return vuurState ? (Date.now() - vuurFetchedAt) / 3600000 : 0; }
  function fuelNow() {
    if (!vuurState) return 0;
    if (vuurState.out) return 0;
    return Math.max(0, Math.min(MAX_FUEL, vuurState.fuel - elapsedH() * BURN_PER_HOUR));
  }

  function renderVuur() {
    var score = document.getElementById('vuurScore');
    var sub = document.getElementById('vuurSub');
    var fill = document.getElementById('vuurFill');
    var go = document.getElementById('vuurGo');
    if (!vuurState) return;
    var f = fuelNow();
    var out = vuurState.out || f <= 0;
    var logsWord = vuurState.count === 1 ? 'LOG' : 'LOGS';
    var end = out && vuurState.fire.outAt ? vuurState.fire.outAt : vuurState.now;
    var ageH = (end - vuurState.fire.litAt) / 3600 + (out ? 0 : elapsedH());
    if (out) {
      score.innerHTML = 'THE FIRE IS <em>OUT</em>';
      sub.textContent = 'FIRE NO. ' + vuurState.fire.no + ' \u00b7 burned ' + compactAge(ageH) + ' \u00b7 ' + vuurState.count + ' ' + logsWord;
      go.textContent = 'Light the next fire';
    } else {
      score.innerHTML = 'LIT <em>' + compactAge(ageH) + '</em> \u00b7 ' + vuurState.count + ' ' + logsWord + ' \u00b7 FIRE NO. ' + vuurState.fire.no;
      sub.textContent = Math.round(f) + '% fuel \u00b7 ~' + compactAge(f / BURN_PER_HOUR) + ' left. One fire for the whole country.';
      go.textContent = 'On the fire';
    }
    var pct = Math.max(0, Math.min(100, f));
    fill.style.width = pct + '%';
    var logs = document.getElementById('vuurLogs');
    var rows = (vuurState.logs || []).slice(-4).reverse();
    logs.innerHTML = rows.map(function (l) {
      return '<article class="app-log"><div class="meta"><b>' + esc(l.who) + '</b> \u00b7 ' + esc(l.town) + '</div><p>' + esc(l.text) + '</p></article>';
    }).join('');
    document.getElementById('vuurLogsH').hidden = rows.length === 0;
  }

  function syncVuur() {
    return fetch(API_VUUR, { headers: { 'X-Vuur-Token': TOKEN }, cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d.ok) {
          document.getElementById('vuurScore').textContent = 'The Braai';
          document.getElementById('vuurSub').textContent = d.error || 'The fire is briefly unreachable.';
          return;
        }
        if (d.mechanics) {
          if (d.mechanics.burnPerHour) BURN_PER_HOUR = d.mechanics.burnPerHour;
          if (d.mechanics.maxFuel) MAX_FUEL = d.mechanics.maxFuel;
        }
        vuurState = d;
        vuurFetchedAt = Date.now();
        document.getElementById('vuurErr').textContent = '';
        renderVuur();
      })
      .catch(function () {
        if (!vuurState) {
          document.getElementById('vuurSub').textContent = 'The fire is briefly unreachable. It is still burning \u2014 try again in a minute.';
        }
      });
  }

  var me = getMe();
  if (me) {
    if (me.who) document.getElementById('vuurWho').value = me.who;
    if (me.town) document.getElementById('vuurTown').value = me.town;
  }

  document.getElementById('vuurForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var err = document.getElementById('vuurErr');
    var text = document.getElementById('vuurText').value.trim();
    var who = document.getElementById('vuurWho').value.trim();
    var town = document.getElementById('vuurTown').value.trim();
    var kind = document.getElementById('vuurKind').value;
    if (text.length < 12) { err.textContent = 'Tell us a bit more \u2014 one good sentence is enough.'; return; }
    if (!who) { err.textContent = 'We need a name to put on it.'; return; }
    if (!town) { err.textContent = 'Which town? It matters more than you think.'; return; }
    err.textContent = '';
    var go = document.getElementById('vuurGo');
    var light = vuurState && (vuurState.out || fuelNow() <= 0);
    go.disabled = true;
    fetch(API_VUUR, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: light ? 'light' : 'feed',
        kind: kind,
        text: text,
        who: who,
        town: town,
        token: TOKEN,
        hp: document.getElementById('vuurHp').value || ''
      })
    }).then(function (r) { return r.json(); }).then(function (d) {
      go.disabled = false;
      if (!d.ok) { err.textContent = d.error || 'That did not work. Try again.'; return; }
      if (!d.fire) { err.textContent = 'Lekker.'; return; }
      setMe({ who: who, town: town });
      document.getElementById('vuurText').value = '';
      vuurState = d;
      vuurFetchedAt = Date.now();
      renderVuur();
    }).catch(function () {
      go.disabled = false;
      err.textContent = 'The fire is briefly unreachable. Try again in a minute.';
    });
  });

  setInterval(function () { if (vuurState && !vuurState.out) renderVuur(); }, 30000);
  syncVuur();
  setInterval(syncVuur, 90000);
})();
