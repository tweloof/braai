/* braai.co.za draft scroll story.
   Self-contained WebGL. No three.js, GSAP or Lenis. Photos are sampled in
   sRGB, lit in linear, and written back as sRGB — no full-frame veil.
   The canvas backing store is device pixels. Native scroll stays in charge
   so the page stays keyboard-accessible. The story HTML reads without this file. */
(function () {
  'use strict';

  var reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  var reduce = reduceQuery.matches;

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function money(n, currency) {
    var x = Number(n);
    if (!isFinite(x)) return null;
    var body = x.toFixed(2);
    if (!currency || currency === 'ZAR') return 'R' + body;
    return currency + ' ' + body;
  }

  function sastISO(date) {
    try {
      var parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Africa/Johannesburg',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).formatToParts(date);
      var y, m, d, i;
      for (i = 0; i < parts.length; i++) {
        if (parts[i].type === 'year') y = parts[i].value;
        if (parts[i].type === 'month') m = parts[i].value;
        if (parts[i].type === 'day') d = parts[i].value;
      }
      if (y && m && d) return y + '-' + m + '-' + d;
    } catch (e) {}
    return '';
  }

  function addDaysISO(iso, days) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
    var p = iso.split('-');
    var t = new Date(Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2]) + days));
    return t.getUTCFullYear() + '-' + pad(t.getUTCMonth() + 1) + '-' + pad(t.getUTCDate());
  }

  /* The published week is current only when today's SAST date falls inside
     week_start inclusive through six days later (the span of week_label). */
  function weekIsCurrent(data) {
    var start = data && data.week_start;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start || '')) return false;
    var today = sastISO(new Date());
    var end = addDaysISO(start, 6);
    if (!today || !end) return false;
    return today >= start && today <= end;
  }

  function renderIndex(data) {
    var lead = document.getElementById('idxLead');
    var weekEl = document.getElementById('idxWeek');
    var metaEl = document.getElementById('idxMeta');
    var tiersEl = document.getElementById('idxTiers');
    var extraEl = document.getElementById('idxExtra');
    var miss = document.getElementById('idxMiss');
    var week = data.week_label || '';
    var current = weekIsCurrent(data);
    var currency = data.currency || 'ZAR';
    var tiers = data.tiers || {};
    var keys = ['budget', 'classic', 'high_end'];
    var kickers = { budget: 'Budget', classic: 'Classic', high_end: 'High-end' };
    var figures = [];
    var i, t, amount, fam, beer, html, basketBits;

    keys.forEach(function (k) {
      t = tiers[k];
      if (!t || typeof t !== 'object') return;
      amount = t.total_zar;
      if (amount == null && k === 'classic') {
        fam = data.variants && data.variants.family;
        amount = fam && fam.total_zar != null ? fam.total_zar : data.total_zar;
      }
      figures.push({ key: k, kicker: kickers[k], name: t.label || k, amount: amount });
    });

    if (!figures.length) {
      fam = data.variants && data.variants.family;
      amount = fam && fam.total_zar != null ? fam.total_zar : data.total_zar;
      if (amount != null || (data.label || data.id)) {
        figures.push({
          key: 'published',
          kicker: 'Published',
          name: (fam && fam.label) || data.label || 'Family braai',
          amount: amount
        });
      }
    }

    if (current && week) {
      lead.textContent = 'What a family braai costs this week (' + week + ') — meat, fire, sides and drinks. Not a shop.';
      weekEl.textContent = 'This week · ' + week;
    } else {
      lead.textContent = 'Latest published basket' + (week ? ', ' + week : '') + '. What a family braai costs — meat, fire, sides and drinks. Not a shop.';
      weekEl.textContent = week ? ('Latest published · ' + week) : 'Latest published basket';
    }

    basketBits = [];
    if (data.basket) basketBits.push('Basket ' + data.basket);
    if (data.id) basketBits.push(String(data.id));
    if (data.complete === true) basketBits.push('complete');
    if (data.complete === false) basketBits.push('incomplete');
    metaEl.textContent = basketBits.join(' · ');

    html = '';
    for (i = 0; i < figures.length; i++) {
      amount = money(figures[i].amount, currency);
      html += '<article class="tier' + (figures[i].key === 'classic' ? ' is-classic' : '') + '">';
      html += '<p class="tier-k">' + esc(figures[i].kicker) + '</p>';
      html += '<h3>' + esc(figures[i].name) + '</h3>';
      html += '<p class="rand">' + (amount ? esc(amount) : '—') + '</p>';
      html += '</article>';
    }
    tiersEl.innerHTML = html;

    beer = data.variants && data.variants.with_beer;
    if (beer && beer.total_zar != null) {
      extraEl.textContent = (beer.label || 'With beer') + ': ' + (money(beer.total_zar, currency) || '—') + '.';
    } else {
      extraEl.textContent = '';
    }
    miss.hidden = true;
  }

  function showIndexMiss() {
    var weekEl = document.getElementById('idxWeek');
    var miss = document.getElementById('idxMiss');
    weekEl.textContent = 'The published basket isn’t available right now.';
    miss.hidden = false;
  }

  fetch('/data/braai-index.json', { cache: 'no-store' })
    .then(function (r) {
      if (!r.ok) throw new Error('bad status');
      return r.json();
    })
    .then(function (data) {
      if (!data || typeof data !== 'object') throw new Error('bad json');
      renderIndex(data);
    })
    .catch(showIndexMiss);

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js');
    });
  }

  var menuBtn = document.getElementById('menuBtn');
  var menu = document.getElementById('siteMenu');
  function setMenu(open) {
    if (open) menu.removeAttribute('hidden');
    else menu.setAttribute('hidden', '');
    menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  menuBtn.addEventListener('click', function () {
    setMenu(menu.hasAttribute('hidden'));
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') setMenu(false);
  });

  var beats = document.querySelectorAll('.beat');
  var dots = document.querySelectorAll('.dots a');

  /* Integer at each scroll-snap stop (the section's top). The index block
     is taller than the screen, so a midpoint blend would still be mixing
     the sear in when the basket is what you're reading. */
  function rawScene() {
    var y = window.scrollY;
    var i, best, nextTop, band, dist, scene;
    best = 0;
    for (i = 0; i < beats.length; i++) {
      if (y + 1 >= beats[i].offsetTop) best = i;
    }
    scene = best;
    if (best < beats.length - 1) {
      nextTop = beats[best + 1].offsetTop;
      band = Math.min(window.innerHeight * 0.42, (nextTop - beats[best].offsetTop) * 0.42);
      dist = nextTop - y;
      if (band > 1 && dist < band) scene = best + (1 - dist / band);
    }
    if (scene < 0) scene = 0;
    if (scene > beats.length - 1) scene = beats.length - 1;
    return scene;
  }

  function markDot(scene) {
    var n = Math.round(scene);
    var i;
    for (i = 0; i < dots.length; i++) {
      if (i === n) dots[i].setAttribute('aria-current', 'true');
      else dots[i].removeAttribute('aria-current');
    }
    document.documentElement.dataset.scene = String(n);
  }

  /* The fixed header sits on top of the scroll. Fade a block out before its
     top edge reaches the header, so a line never slides under the wordmark.
     The lead is short on purpose: a resting title only a little below the
     pills must stay fully opaque. Geometry is read live — never cached from
     the viewport the page happened to load in. */
  var copyNodes = '.plate, .tier, .idx-extra, .idx-miss, #index .more';

  function showCopy() {
    var nodes = document.querySelectorAll(copyNodes);
    var i;
    for (i = 0; i < nodes.length; i++) nodes[i].style.opacity = '';
  }

  /* The beat whose top is sitting on the snap. Its own copy stays fully
     visible — a short landscape screen must not fade the headline away. */
  function snappedBeat() {
    var y = window.scrollY;
    var i, best = 0, bestDist = 1e9, d;
    for (i = 0; i < beats.length; i++) {
      d = Math.abs(y - beats[i].offsetTop);
      if (d < bestDist) { bestDist = d; best = i; }
    }
    if (bestDist > 16) return null;
    return beats[best];
  }

  function clearCopy() {
    var head = document.querySelector('.scroll-head');
    if (!head) { showCopy(); return; }
    var limit = head.getBoundingClientRect().bottom;
    var lead = 40;
    var home = snappedBeat();
    var nodes = document.querySelectorAll(copyNodes);
    var i, r, t, node;
    for (i = 0; i < nodes.length; i++) {
      node = nodes[i];
      r = node.getBoundingClientRect();
      if (home && home.contains(node)) {
        node.style.opacity = '1';
        continue;
      }
      if (r.bottom < 0 || r.top > window.innerHeight) {
        node.style.opacity = '';
        continue;
      }
      if (r.top >= limit + lead) t = 1;
      else if (r.top <= limit) t = 0;
      else t = (r.top - limit) / lead;
      node.style.opacity = t.toFixed(3);
    }
  }

  function measureHead() {
    var head = document.querySelector('.scroll-head');
    if (!head) return;
    var h = Math.ceil(head.getBoundingClientRect().height);
    if (!(h > 0)) return;
    var next = h + 'px';
    if (document.documentElement.style.getPropertyValue('--head-h') !== next) {
      document.documentElement.style.setProperty('--head-h', next);
    }
  }

  /* Debounced so a device-mode toggle, URL-bar resize, or orientation change
     is measured after layout, not on the stale viewport. */
  var onViewport = function () {
    measureHead();
    clearCopy();
  };
  var layoutTimer = 0;
  function scheduleLayout() {
    if (layoutTimer) clearTimeout(layoutTimer);
    layoutTimer = setTimeout(function () {
      layoutTimer = 0;
      requestAnimationFrame(function () { onViewport(); });
    }, 50);
  }
  function bindViewport() {
    window.addEventListener('resize', scheduleLayout);
    window.addEventListener('orientationchange', scheduleLayout);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', scheduleLayout);
      window.visualViewport.addEventListener('scroll', scheduleLayout);
    }
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(function () { scheduleLayout(); });
      ro.observe(document.documentElement);
    }
    window.addEventListener('pageshow', scheduleLayout);
    setTimeout(scheduleLayout, 320);
  }

  markDot(rawScene());
  showCopy();
  measureHead();
  clearCopy();
  bindViewport();
  window.addEventListener('scroll', function () {
    markDot(rawScene());
    clearCopy();
  }, { passive: true });

  if (reduce) {
    document.documentElement.classList.add('static-photos');
    showCopy();
    clearCopy();
    return;
  }

  var canvas = document.getElementById('gl');
  var ctxAttribs = {
    alpha: false,
    antialias: true,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    powerPreference: 'high-performance',
    failIfMajorPerformanceCaveat: false
  };
  var gl = canvas.getContext('webgl2', ctxAttribs) || canvas.getContext('webgl', ctxAttribs);
  if (!gl) {
    ctxAttribs.antialias = false;
    gl = canvas.getContext('webgl2', ctxAttribs) || canvas.getContext('webgl', ctxAttribs);
  }
  if (!gl) {
    document.documentElement.classList.add('static-photos');
    showCopy();
    clearCopy();
    return;
  }
  var isGL2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;

  if ('drawingBufferColorSpace' in gl) {
    try { gl.drawingBufferColorSpace = 'srgb'; } catch (e) {}
  }
  if ('unpackColorSpace' in gl) {
    try { gl.unpackColorSpace = 'srgb'; } catch (e) {}
  }
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.disable(gl.DITHER);

  /* Photos stay true-colour. Sampled bytes are sRGB. Lighting is a multiply
     around 1 in linear light, then encoded back. No vignette, no grain, no
     pow() that lifts the blacks. */
  var FS_BODY = [
    'uniform sampler2D uFire;',
    'uniform sampler2D uCoals;',
    'uniform sampler2D uSear;',
    'uniform vec2 uRes;',
    'uniform vec2 uFireSize;',
    'uniform vec2 uCoalsSize;',
    'uniform vec2 uSearSize;',
    'uniform float uScene;',
    'vec3 toLin(vec3 c){ return pow(max(c, vec3(0.0)), vec3(2.2)); }',
    'vec3 toSrgb(vec3 c){ return pow(clamp(c, 0.0, 1.0), vec3(1.0/2.2)); }',
    'float wgt(float x, float c){ return 1.0 - smoothstep(0.0, 0.55, abs(x - c)); }',
    /* object-fit: cover. Scale by the larger ratio, crop the rest. UVs stay inside the photo. */
    'vec2 coverUv(vec2 frag, vec2 res, vec2 tex){',
    '  float s = max(res.x / max(tex.x, 1.0), res.y / max(tex.y, 1.0));',
    '  vec2 texel = tex * 0.5 + (frag - res * 0.5) / max(s, 0.0001);',
    '  vec2 uv = texel / tex;',
    '  vec2 inset = vec2(0.5) / tex;',
    '  return clamp(uv, inset, vec2(1.0) - inset);',
    '}',
    'void main(){',
    '  vec2 frag = gl_FragCoord.xy;',
    '  float s0 = wgt(uScene, 0.0);',
    '  float s1 = wgt(uScene, 1.0);',
    '  float s2 = wgt(uScene, 2.0);',
    '  float s3 = wgt(uScene, 3.0);',
    '  vec3 fire = TEX(uFire, coverUv(frag, uRes, uFireSize)).rgb;',
    '  vec3 sear = TEX(uSear, coverUv(frag, uRes, uSearSize)).rgb;',
    '  vec3 coals = TEX(uCoals, coverUv(frag, uRes, uCoalsSize)).rgb;',
    '  float w = max(s0 + s1 + s2 + s3, 0.0001);',
    '  vec3 albedo = (fire * s0 + coals * s1 + sear * s2 + coals * s3) / w;',
    '  float luma = dot(albedo, vec3(0.2126, 0.7152, 0.0722));',
    '  float shade = clamp(1.0 + (dFdx(luma) - dFdy(luma)) * 1.15, 0.95, 1.05);',
    '  OUT = vec4(toSrgb(toLin(albedo) * shade), 1.0);',
    '}'
  ].join('\n');

  var VS_GL2 = [
    '#version 300 es',
    'precision highp float;',
    'layout(location = 0) in vec2 aPos;',
    'void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }'
  ].join('\n');

  var FS_GL2 = [
    '#version 300 es',
    'precision highp float;',
    'out vec4 outColor;',
    FS_BODY.replace(/TEX/g, 'texture').replace('OUT', 'outColor')
  ].join('\n');

  var VS_GL1 = [
    'precision highp float;',
    'attribute vec2 aPos;',
    'void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }'
  ].join('\n');

  var FS_GL1 = [
    '#extension GL_OES_standard_derivatives : enable',
    'precision highp float;',
    FS_BODY.replace(/TEX/g, 'texture2D').replace('OUT', 'gl_FragColor')
  ].join('\n');

  var FS_GL1_SAFE = [
    'precision highp float;',
    FS_BODY.replace(/TEX/g, 'texture2D').replace('OUT', 'gl_FragColor').replace(
      'float shade = clamp(1.0 + (dFdx(luma) - dFdy(luma)) * 1.15, 0.95, 1.05);',
      'float shade = 1.0;'
    )
  ].join('\n');

  var PVS_GL2 = [
    '#version 300 es',
    'precision highp float;',
    'layout(location = 0) in vec2 aSeed;',
    'uniform float uTime;',
    'uniform float uScene;',
    'uniform vec2 uRes;',
    'out float vA;',
    'float tri(float x, float c){ return clamp(1.0 - abs(x - c), 0.0, 1.0); }',
    'void main(){',
    '  float speed = 0.045 + aSeed.y * 0.07;',
    '  float life = fract(aSeed.x + uTime * speed);',
    '  float x = fract(aSeed.x * 3.7 + aSeed.y) * 2.0 - 1.0;',
    '  x += sin(uTime * 0.6 + aSeed.y * 6.28) * 0.04;',
    '  float y = mix(-1.05, 1.15, life);',
    '  gl_Position = vec4(x, y, 0.0, 1.0);',
    '  gl_PointSize = (1.8 + aSeed.y * 2.8) * (uRes.y / 900.0);',
    '  float spark = tri(uScene, 2.0) * 0.9 + tri(uScene, 0.0) * 0.28 + tri(uScene, 1.0) * 0.04 + tri(uScene, 3.0) * 0.08;',
    '  vA = spark * smoothstep(0.0, 0.08, life) * (1.0 - smoothstep(0.8, 1.0, life));',
    '}'
  ].join('\n');

  var PFS_GL2 = [
    '#version 300 es',
    'precision highp float;',
    'in float vA;',
    'out vec4 outColor;',
    'void main(){',
    '  vec2 p = gl_PointCoord * 2.0 - 1.0;',
    '  float d = dot(p, p);',
    '  if (d > 1.0) discard;',
    '  float a = (1.0 - d) * vA;',
    '  outColor = vec4(1.0, 0.42, 0.08, a);',
    '}'
  ].join('\n');

  var PVS_GL1 = [
    'precision highp float;',
    'attribute vec2 aSeed;',
    'uniform float uTime;',
    'uniform float uScene;',
    'uniform vec2 uRes;',
    'varying float vA;',
    'float tri(float x, float c){ return clamp(1.0 - abs(x - c), 0.0, 1.0); }',
    'void main(){',
    '  float speed = 0.045 + aSeed.y * 0.07;',
    '  float life = fract(aSeed.x + uTime * speed);',
    '  float x = fract(aSeed.x * 3.7 + aSeed.y) * 2.0 - 1.0;',
    '  x += sin(uTime * 0.6 + aSeed.y * 6.28) * 0.04;',
    '  float y = mix(-1.05, 1.15, life);',
    '  gl_Position = vec4(x, y, 0.0, 1.0);',
    '  gl_PointSize = (1.8 + aSeed.y * 2.8) * (uRes.y / 900.0);',
    '  float spark = tri(uScene, 2.0) * 0.9 + tri(uScene, 0.0) * 0.28 + tri(uScene, 1.0) * 0.04 + tri(uScene, 3.0) * 0.08;',
    '  vA = spark * smoothstep(0.0, 0.08, life) * (1.0 - smoothstep(0.8, 1.0, life));',
    '}'
  ].join('\n');

  var PFS_GL1 = [
    'precision highp float;',
    'varying float vA;',
    'void main(){',
    '  vec2 p = gl_PointCoord * 2.0 - 1.0;',
    '  float d = dot(p, p);',
    '  if (d > 1.0) discard;',
    '  float a = (1.0 - d) * vA;',
    '  gl_FragColor = vec4(1.0, 0.42, 0.08, a);',
    '}'
  ].join('\n');

  function compile(type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      document.documentElement.dataset.glerr = (gl.getShaderInfoLog(sh) || 'shader').slice(0, 240);
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  function link(vsSrc, fsSrc, attribs) {
    var vs = compile(gl.VERTEX_SHADER, vsSrc);
    var fs = compile(gl.FRAGMENT_SHADER, fsSrc);
    if (!vs || !fs) return null;
    var p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    if (attribs) {
      var i;
      for (i = 0; i < attribs.length; i++) gl.bindAttribLocation(p, i, attribs[i]);
    }
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      document.documentElement.dataset.glerr = (gl.getProgramInfoLog(p) || 'link').slice(0, 240);
      return null;
    }
    return p;
  }

  var prog = isGL2 ? link(VS_GL2, FS_GL2, ['aPos']) : link(VS_GL1, FS_GL1, ['aPos']);
  if (!prog && !isGL2) prog = link(VS_GL1, FS_GL1_SAFE, ['aPos']);
  if (!prog) {
    document.documentElement.classList.add('static-photos');
    showCopy();
    clearCopy();
    return;
  }
  var pprog = isGL2 ? link(PVS_GL2, PFS_GL2, ['aSeed']) : link(PVS_GL1, PFS_GL1, ['aSeed']);

  var tri = new Float32Array([-1, -1, 3, -1, -1, 3]);
  var triBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, triBuf);
  gl.bufferData(gl.ARRAY_BUFFER, tri, gl.STATIC_DRAW);

  var SPARKS = 140;
  var seeds = new Float32Array(SPARKS * 2);
  var si;
  for (si = 0; si < SPARKS; si++) {
    seeds[si * 2] = Math.random();
    seeds[si * 2 + 1] = Math.random();
  }
  var seedBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, seedBuf);
  gl.bufferData(gl.ARRAY_BUFFER, seeds, gl.STATIC_DRAW);

  function makeTex() {
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([7, 5, 4, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  }

  var texFire = makeTex();
  var texCoals = makeTex();
  var texSear = makeTex();
  var texOf = { fire: texFire, coals: texCoals, sear: texSear };
  var anisoExt = gl.getExtension('EXT_texture_filter_anisotropic') || gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic');
  var anisoMax = anisoExt ? gl.getParameter(anisoExt.MAX_TEXTURE_MAX_ANISOTROPY_EXT) : 0;
  /* Pick the file whose cover scale is closest to 1:1 and never above ~1.21.
     Portrait buffers take the tall campfire; wide buffers keep the Julia frame. */
  var catalog = {
    fire: [
      { url: '/assets/scroll/fire-hi.webp', w: 3840, h: 2560 },
      { url: '/assets/scroll/fire-sm.webp', w: 1920, h: 1280 },
      { url: '/assets/scroll/fire-port.webp', w: 1440, h: 3200, phone: 1 }
    ],
    coals: [
      { url: '/assets/scroll/coals-hi.webp', w: 3978, h: 2652 },
      { url: '/assets/scroll/coals-sm.webp', w: 1920, h: 1280 },
      { url: '/assets/scroll/coals-port.webp', w: 1600, h: 3200, phone: 1 }
    ],
    sear: [
      { url: '/assets/scroll/sear.webp', w: 3840, h: 5760 },
      { url: '/assets/scroll/sear-port.webp', w: 1714, h: 3200, phone: 1 }
    ]
  };
  var sizes = { fire: [1, 1], coals: [1, 1], sear: [1, 1] };
  var chosen = { fire: '', coals: '', sear: '' };
  var loadGen = 0;

  function upload(tex, img) {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    if (isGL2) {
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      if (anisoExt && anisoMax > 1) {
        gl.texParameterf(gl.TEXTURE_2D, anisoExt.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, anisoMax));
      }
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
  }

  function coverMag(item, bw, bh) {
    return Math.max(bw / item.w, bh / item.h);
  }

  function pickTex(list, bw, bh) {
    var i, best = null, bestScore = 1e9, fallback = null, fallbackMag = 1e9, m, score, pool, tall, portrait;
    /* Phone files are a tighter frame. A landscape buffer never sees them,
       so the desktop crop stays the one it already had. A portrait buffer
       uses a portrait file when one exists. */
    portrait = bh > bw * 1.05;
    pool = [];
    for (i = 0; i < list.length; i++) {
      if (!portrait && list[i].phone) continue;
      pool.push(list[i]);
    }
    if (!pool.length) pool = list;
    if (portrait) {
      tall = [];
      for (i = 0; i < pool.length; i++) {
        if (pool[i].h >= pool[i].w) tall.push(pool[i]);
      }
      if (tall.length) pool = tall;
    }
    for (i = 0; i < pool.length; i++) {
      m = coverMag(pool[i], bw, bh);
      if (m < fallbackMag) { fallbackMag = m; fallback = pool[i]; }
      if (m > 1.21) continue;
      score = Math.abs(Math.log(m));
      if (score < bestScore) { bestScore = score; best = pool[i]; }
    }
    return best || fallback;
  }

  function loadSet() {
    var gen = ++loadGen;
    var keys = ['fire', 'coals', 'sear'];
    var pending = keys.length;
    function one(which) {
      var item = pickTex(catalog[which], canvas.width, canvas.height);
      chosen[which] = item.url;
      var img = new Image();
      img.decoding = 'async';
      img.onload = function () {
        if (gen !== loadGen) return;
        upload(texOf[which], img);
        sizes[which][0] = img.naturalWidth || img.width;
        sizes[which][1] = img.naturalHeight || img.height;
        pending--;
        if (pending === 0) {
          document.documentElement.classList.add('gl-on');
          document.documentElement.dataset.tex = sizes.fire[0] + 'x' + sizes.fire[1] + '+' + sizes.sear[0] + 'x' + sizes.sear[1];
        }
      };
      img.onerror = function () {
        if (gen !== loadGen) return;
        pending--;
        if (pending === 0 && !document.documentElement.classList.contains('gl-on')) {
          document.documentElement.classList.add('static-photos');
        }
      };
      img.src = item.url;
    }
    var k;
    for (k = 0; k < keys.length; k++) one(keys[k]);
  }

  function cssSize() {
    var r = canvas.getBoundingClientRect();
    var w = Math.round(r.width);
    var h = Math.round(r.height);
    if (w < 2 || h < 2) {
      w = Math.round(window.innerWidth);
      h = Math.round(window.innerHeight);
    }
    return { w: Math.max(1, w), h: Math.max(1, h) };
  }

  /* Full device pixel ratio. Cap at 3 only when the buffer would exceed 9 megapixels
     and the ratio is already above 3. Never force 1. */
  function pickDpr(cssW, cssH) {
    var d = window.devicePixelRatio || 1;
    if (!(d > 0)) d = 1;
    if (d > 3 && cssW * cssH * d * d > 9000000) d = 3;
    return d;
  }

  var dpr = 1;
  function resize() {
    if (!gl || (gl.isContextLost && gl.isContextLost())) return;
    var css = cssSize();
    dpr = pickDpr(css.w, css.h);
    var w = Math.max(1, Math.round(css.w * dpr));
    var h = Math.max(1, Math.round(css.h * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
    var need = false;
    var key, item;
    for (key in catalog) {
      if (!Object.prototype.hasOwnProperty.call(catalog, key)) continue;
      item = pickTex(catalog[key], canvas.width, canvas.height);
      if (item.url !== chosen[key]) need = true;
    }
    if (need) loadSet();
    var root = document.documentElement;
    root.dataset.dpr = String(Math.round(dpr * 100) / 100);
    root.dataset.buf = canvas.width + 'x' + canvas.height;
    root.dataset.variant = (chosen.fire.split('/').pop() || '') + ' ' + (chosen.coals.split('/').pop() || '') + ' ' + (chosen.sear.split('/').pop() || '');
    var firePick = pickTex(catalog.fire, canvas.width, canvas.height);
    root.dataset.mag = coverMag(firePick, canvas.width, canvas.height).toFixed(3);
    root.dataset.aa = gl.getContextAttributes().antialias ? '1' : '0';
    root.dataset.gl = isGL2 ? '2' : '1';
    root.dataset.aniso = anisoMax > 1 ? '1' : '0';
  }

  onViewport = function () {
    measureHead();
    resize();
    clearCopy();
  };
  resize();

  var loc = {
    pos: gl.getAttribLocation(prog, 'aPos'),
    fire: gl.getUniformLocation(prog, 'uFire'),
    coals: gl.getUniformLocation(prog, 'uCoals'),
    sear: gl.getUniformLocation(prog, 'uSear'),
    res: gl.getUniformLocation(prog, 'uRes'),
    fireSize: gl.getUniformLocation(prog, 'uFireSize'),
    coalsSize: gl.getUniformLocation(prog, 'uCoalsSize'),
    searSize: gl.getUniformLocation(prog, 'uSearSize'),
    scene: gl.getUniformLocation(prog, 'uScene')
  };
  var ploc = pprog ? {
    seed: gl.getAttribLocation(pprog, 'aSeed'),
    time: gl.getUniformLocation(pprog, 'uTime'),
    scene: gl.getUniformLocation(pprog, 'uScene'),
    res: gl.getUniformLocation(pprog, 'uRes')
  } : null;

  var shown = rawScene();
  var start = performance.now();
  var raf = 0;
  var running = true;

  function frame(now) {
    if (!running) return;
    var target = rawScene();
    shown += (target - shown) * 0.12;
    if (Math.abs(target - shown) < 0.0008) shown = target;
    markDot(shown);
    clearCopy();
    document.documentElement.dataset.t = shown.toFixed(3);
    var t = (now - start) / 1000;

    try {
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    gl.clearColor(0.027, 0.02, 0.016, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, triBuf);
    gl.enableVertexAttribArray(loc.pos);
    gl.vertexAttribPointer(loc.pos, 2, gl.FLOAT, false, 0, 0);
    gl.uniform1f(loc.scene, shown);
    gl.uniform2f(loc.res, canvas.width, canvas.height);
    gl.uniform2f(loc.fireSize, sizes.fire[0], sizes.fire[1]);
    gl.uniform2f(loc.coalsSize, sizes.coals[0], sizes.coals[1]);
    gl.uniform2f(loc.searSize, sizes.sear[0], sizes.sear[1]);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texFire);
    gl.uniform1i(loc.fire, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, texCoals);
    gl.uniform1i(loc.coals, 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, texSear);
    gl.uniform1i(loc.sear, 2);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    if (ploc && document.documentElement.classList.contains('gl-on')) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      gl.useProgram(pprog);
      gl.bindBuffer(gl.ARRAY_BUFFER, seedBuf);
      gl.enableVertexAttribArray(ploc.seed);
      gl.vertexAttribPointer(ploc.seed, 2, gl.FLOAT, false, 0, 0);
      gl.uniform1f(ploc.time, t);
      gl.uniform1f(ploc.scene, shown);
      gl.uniform2f(ploc.res, canvas.width, canvas.height);
      gl.drawArrays(gl.POINTS, 0, SPARKS);
    }
    } catch (err) {
      document.documentElement.dataset.glerr = String((err && err.message) || err).slice(0, 180);
      stop();
      showCopy();
      clearCopy();
      return;
    }
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    document.documentElement.classList.remove('gl-on');
    document.documentElement.classList.add('static-photos');
    showCopy();
    clearCopy();
  }

  canvas.addEventListener('webglcontextlost', function (ev) {
    ev.preventDefault();
    onViewport = function () {
      measureHead();
      clearCopy();
    };
    stop();
    clearCopy();
  });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      running = false;
      if (raf) cancelAnimationFrame(raf);
    } else if (!reduce) {
      running = true;
      raf = requestAnimationFrame(frame);
    }
  });

  if (reduceQuery.addEventListener) {
    reduceQuery.addEventListener('change', function () {
      reduce = reduceQuery.matches;
      if (reduce) stop();
    });
  }

  raf = requestAnimationFrame(frame);

})();
