/* braai.co.za draft scroll story.
   Self-contained WebGL1. No three.js, GSAP or Lenis: one displaced plane,
   three self-hosted textures, and a short ember field. Native scroll stays
   in charge so the page stays keyboard-accessible. The story HTML reads
   without this file. */
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

  function rawScene() {
    var focus = window.scrollY + window.innerHeight * 0.5;
    var firstMid = beats[0].offsetTop + beats[0].offsetHeight * 0.5;
    var last = beats[beats.length - 1];
    var lastMid = last.offsetTop + last.offsetHeight * 0.5;
    var span = lastMid - firstMid;
    if (span <= 0) return 0;
    var t = (focus - firstMid) / span;
    if (t < 0) t = 0;
    if (t > 1) t = 1;
    return t * (beats.length - 1);
  }

  function markDot(scene) {
    var n = Math.round(scene);
    var i;
    for (i = 0; i < dots.length; i++) {
      if (i === n) dots[i].setAttribute('aria-current', 'true');
      else dots[i].removeAttribute('aria-current');
    }
  }

  markDot(rawScene());
  window.addEventListener('scroll', function () { markDot(rawScene()); }, { passive: true });

  if (reduce) return;

  var canvas = document.getElementById('gl');
  var gl = canvas.getContext('webgl', {
    alpha: false,
    antialias: false,
    depth: true,
    stencil: false,
    powerPreference: 'high-performance',
    failIfMajorPerformanceCaveat: false
  });
  if (!gl) return;

  gl.getExtension('OES_standard_derivatives');
  gl.getExtension('OES_element_index_uint');

  var VS = [
    'precision mediump float;',
    'attribute vec3 aPos;',
    'attribute vec2 aUv;',
    'uniform mat4 uMvp;',
    'uniform sampler2D uWood;',
    'uniform float uDisp;',
    'uniform float uTime;',
    'varying vec2 vUv;',
    'void main() {',
    '  vUv = aUv;',
    '  float h = texture2D(uWood, aUv).r;',
    '  vec3 p = aPos;',
    '  p.z += (h - 0.32) * uDisp;',
    '  p.z += sin(aUv.x * 9.0 + uTime * 0.35) * 0.012 * uDisp;',
    '  gl_Position = uMvp * vec4(p, 1.0);',
    '}'
  ].join('\n');

  var FS = [
    '#extension GL_OES_standard_derivatives : enable',
    'precision mediump float;',
    'varying vec2 vUv;',
    'uniform sampler2D uWood;',
    'uniform sampler2D uFire;',
    'uniform sampler2D uCoals;',
    'uniform float uScene;',
    'uniform float uTime;',
    'float tri(float x, float c) {',
    '  return smoothstep(c - 1.0, c, x) * (1.0 - smoothstep(c, c + 1.0, x));',
    '}',
    'void main() {',
    '  vec2 uv = vUv;',
    '  vec2 woodUv = vec2(uv.x * 0.92 + uv.y * 0.38, uv.y * 1.15 - uv.x * 0.22);',
    '  woodUv += vec2(uTime * 0.004, uScene * 0.015);',
    '  vec3 wood = texture2D(uWood, woodUv).rgb;',
    '  vec3 fire = texture2D(uFire, uv * 1.05 + vec2(0.0, uTime * 0.01)).rgb;',
    '  vec3 coals = texture2D(uCoals, uv).rgb;',
    '  vec3 woodL = pow(max(wood, vec3(0.0)), vec3(0.55));',
    '  float h = dot(woodL, vec3(0.3, 0.55, 0.15));',
    '  float edge = 0.0;',
    '  edge = length(vec2(dFdx(h), dFdy(h)));',
    '  float s0 = tri(uScene, 0.0);',
    '  float s1 = tri(uScene, 1.0);',
    '  float s2 = tri(uScene, 2.0);',
    '  float s3 = tri(uScene, 3.0);',
    '  vec3 dark = woodL * vec3(0.16, 0.09, 0.05);',
    '  dark += vec3(0.85, 0.32, 0.08) * smoothstep(0.25, 0.7, h) * 0.55;',
    '  dark += vec3(1.0, 0.42, 0.08) * smoothstep(0.02, 0.14, edge) * 0.45;',
    '  float strike = smoothstep(0.08, 0.42, uScene) * (1.0 - smoothstep(0.42, 0.95, uScene));',
    '  vec3 lit = max(fire, vec3(0.02)) * vec3(1.25, 0.7, 0.35);',
    '  lit = mix(dark, lit, strike);',
    '  vec3 glow = woodL * vec3(1.35, 0.62, 0.22) * (1.15 + h);',
    '  glow += vec3(1.0, 0.48, 0.1) * smoothstep(0.008, 0.11, edge) * 2.4;',
    '  vec3 coalsL = pow(max(coals, vec3(0.0)), vec3(0.72)) * 1.35;',
    '  float ash = smoothstep(0.35, 0.85, dot(coalsL, vec3(0.3, 0.5, 0.2)));',
    '  glow = mix(glow, coalsL * vec3(1.15, 0.95, 0.8), 0.5 + ash * 0.28);',
    '  float wedge = smoothstep(0.46, 0.92, uv.x * 0.78 + uv.y * 0.28);',
    '  glow = mix(glow, glow * vec3(0.22, 0.1, 0.05), wedge);',
    '  vec3 heat = mix(vec3(0.95, 0.4, 0.09), vec3(0.15, 0.05, 0.02), pow(clamp(uv.y, 0.0, 1.0), 0.55));',
    '  heat += vec3(1.0, 0.45, 0.1) * smoothstep(0.02, 0.2, edge) * 0.15;',
    '  heat = mix(heat, fire * vec3(1.1, 0.45, 0.15), 0.18);',
    '  vec3 night = mix(vec3(0.035, 0.02, 0.015), coalsL * 0.12, 0.4);',
    '  vec3 col = lit * s0 + glow * s1 + heat * s2 + night * s3;',
    '  float vig = smoothstep(1.2, 0.2, length(uv - vec2(0.5)));',
    '  col *= mix(0.82, 1.0, vig);',
    '  float grain = fract(sin(dot(gl_FragCoord.xy + uTime, vec2(12.9898, 78.233))) * 43758.5453);',
    '  col += (grain - 0.5) * 0.045;',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  var PVS = [
    'precision mediump float;',
    'attribute vec2 aSeed;',
    'uniform float uTime;',
    'uniform float uScene;',
    'uniform vec2 uRes;',
    'varying float vA;',
    'float tri(float x, float c) {',
    '  return clamp(1.0 - abs(x - c), 0.0, 1.0);',
    '}',
    'void main() {',
    '  float speed = 0.045 + aSeed.y * 0.07;',
    '  float life = fract(aSeed.x + uTime * speed);',
    '  float x = fract(aSeed.x * 3.7 + aSeed.y) * 2.0 - 1.0;',
    '  x += sin(uTime * 0.6 + aSeed.y * 6.28) * 0.04;',
    '  float y = mix(-1.05, 1.15, life);',
    '  gl_Position = vec4(x, y, 0.0, 1.0);',
    '  gl_PointSize = (1.4 + aSeed.y * 3.2) * (uRes.y / 900.0);',
    '  float spark = tri(uScene, 2.0) * 0.85 + tri(uScene, 0.0) * 0.22 + tri(uScene, 3.0) * 0.12;',
    '  vA = spark * smoothstep(0.0, 0.08, life) * (1.0 - smoothstep(0.8, 1.0, life));',
    '}'
  ].join('\n');

  var PFS = [
    'precision mediump float;',
    'varying float vA;',
    'void main() {',
    '  vec2 p = gl_PointCoord * 2.0 - 1.0;',
    '  float d = dot(p, p);',
    '  if (d > 1.0) discard;',
    '  float a = (1.0 - d) * vA;',
    '  gl_FragColor = vec4(1.0, 0.48, 0.12, a);',
    '}'
  ].join('\n');

  function compile(type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  function link(vsSrc, fsSrc) {
    var vs = compile(gl.VERTEX_SHADER, vsSrc);
    var fs = compile(gl.FRAGMENT_SHADER, fsSrc);
    if (!vs || !fs) return null;
    var p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return null;
    return p;
  }

  var prog = link(VS, FS);
  if (!prog) {
    FS = FS.replace('#extension GL_OES_standard_derivatives : enable\n', '').replace('edge = length(vec2(dFdx(h), dFdy(h)));', 'edge = 0.0;');
    prog = link(VS, FS);
  }
  var pprog = link(PVS, PFS);
  if (!prog) return;

  var cols = 40;
  var rows = 24;
  var positions = [];
  var uvs = [];
  var indices = [];
  var y, x, u, v;
  for (y = 0; y <= rows; y++) {
    for (x = 0; x <= cols; x++) {
      u = x / cols;
      v = y / rows;
      positions.push((u - 0.5) * 4.4, (v - 0.5) * 2.8, 0);
      uvs.push(u, v);
    }
  }
  for (y = 0; y < rows; y++) {
    for (x = 0; x < cols; x++) {
      var i = y * (cols + 1) + x;
      indices.push(i, i + 1, i + cols + 1, i + 1, i + cols + 2, i + cols + 1);
    }
  }

  function buffer(target, arr, usage) {
    var b = gl.createBuffer();
    gl.bindBuffer(target, b);
    gl.bufferData(target, arr, usage || gl.STATIC_DRAW);
    return b;
  }

  var posBuf = buffer(gl.ARRAY_BUFFER, new Float32Array(positions));
  var uvBuf = buffer(gl.ARRAY_BUFFER, new Float32Array(uvs));
  var idxBuf = buffer(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices));
  var indexCount = indices.length;

  var SPARKS = 140;
  var seeds = new Float32Array(SPARKS * 2);
  for (x = 0; x < SPARKS; x++) {
    seeds[x * 2] = Math.random();
    seeds[x * 2 + 1] = Math.random();
  }
  var seedBuf = buffer(gl.ARRAY_BUFFER, seeds);

  function makeTex() {
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([12, 8, 6, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  }

  var texWood = makeTex();
  var texFire = makeTex();
  var texCoals = makeTex();
  var loaded = 0;

  function loadTex(tex, url) {
    var img = new Image();
    img.decoding = 'async';
    img.onload = function () {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      loaded++;
      if (loaded === 1) document.documentElement.classList.add('gl-on');
    };
    img.src = url;
  }

  loadTex(texWood, '/assets/scroll/wood.webp');
  loadTex(texFire, '/assets/scroll/fire.webp');
  loadTex(texCoals, '/assets/scroll/coals.webp');

  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function norm(v) {
    var l = Math.sqrt(dot(v, v)) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
  }
  function cross(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  }
  function lookAt(eye, center, up) {
    var f = norm([center[0] - eye[0], center[1] - eye[1], center[2] - eye[2]]);
    var s = norm(cross(f, up));
    var u = cross(s, f);
    return new Float32Array([
      s[0], u[0], -f[0], 0,
      s[1], u[1], -f[1], 0,
      s[2], u[2], -f[2], 0,
      -dot(s, eye), -dot(u, eye), dot(f, eye), 1
    ]);
  }
  function perspective(fovy, aspect, near, far) {
    var f = 1 / Math.tan(fovy / 2);
    var nf = 1 / (near - far);
    return new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) * nf, -1,
      0, 0, 2 * far * near * nf, 0
    ]);
  }
  function multiply(a, b) {
    var o = new Float32Array(16);
    var c, r;
    for (c = 0; c < 4; c++) {
      for (r = 0; r < 4; r++) {
        o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
      }
    }
    return o;
  }

  var loc = {
    pos: gl.getAttribLocation(prog, 'aPos'),
    uv: gl.getAttribLocation(prog, 'aUv'),
    mvp: gl.getUniformLocation(prog, 'uMvp'),
    wood: gl.getUniformLocation(prog, 'uWood'),
    fire: gl.getUniformLocation(prog, 'uFire'),
    coals: gl.getUniformLocation(prog, 'uCoals'),
    scene: gl.getUniformLocation(prog, 'uScene'),
    time: gl.getUniformLocation(prog, 'uTime'),
    disp: gl.getUniformLocation(prog, 'uDisp')
  };
  var ploc = pprog ? {
    seed: gl.getAttribLocation(pprog, 'aSeed'),
    time: gl.getUniformLocation(pprog, 'uTime'),
    scene: gl.getUniformLocation(pprog, 'uScene'),
    res: gl.getUniformLocation(pprog, 'uRes')
  } : null;

  var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  if (window.innerWidth < 800) dpr = Math.min(dpr, 1.25);
  if (navigator.deviceMemory && navigator.deviceMemory <= 3) dpr = 1;
  if (navigator.connection && navigator.connection.saveData) dpr = 1;

  function resize() {
    var w = Math.max(1, Math.floor(window.innerWidth * dpr));
    var h = Math.max(1, Math.floor(window.innerHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  resize();
  window.addEventListener('resize', resize);

  var shown = rawScene();
  var start = performance.now();
  var raf = 0;
  var running = true;
  var slow = 0;
  var last = performance.now();
  var dropped = false;

  function frame(now) {
    if (!running) return;
    var dt = now - last;
    last = now;
    if (!dropped && dt > 34) slow++;
    else slow = Math.max(0, slow - 1);
    if (!dropped && slow > 18 && dpr > 1) {
      dpr = 1;
      dropped = true;
      resize();
    }
    var target = rawScene();
    shown += (target - shown) * 0.09;
    if (Math.abs(target - shown) < 0.0008) shown = target;
    markDot(shown);
    var t = (now - start) / 1000;
    var aspect = canvas.width / Math.max(1, canvas.height);
    var eye = [Math.sin(shown * 0.55) * 0.16, 0.06 + Math.sin(shown) * 0.03, 1.72];
    var mvp = multiply(perspective(0.82, aspect, 0.1, 20), lookAt(eye, [0, 0, 0], [0, 1, 0]));
    var disp = 0.22 * (1.0 - Math.min(1, Math.max(0, (shown - 1.2) / 1.4)));

    gl.disable(gl.BLEND);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.clearColor(0.03, 0.02, 0.015, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.enableVertexAttribArray(loc.pos);
    gl.vertexAttribPointer(loc.pos, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
    gl.enableVertexAttribArray(loc.uv);
    gl.vertexAttribPointer(loc.uv, 2, gl.FLOAT, false, 0, 0);
    gl.uniformMatrix4fv(loc.mvp, false, mvp);
    gl.uniform1f(loc.scene, shown);
    gl.uniform1f(loc.time, t);
    gl.uniform1f(loc.disp, disp);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texWood);
    gl.uniform1i(loc.wood, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, texFire);
    gl.uniform1i(loc.fire, 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, texCoals);
    gl.uniform1i(loc.coals, 2);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
    gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_SHORT, 0);

    if (ploc) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      gl.disable(gl.DEPTH_TEST);
      gl.useProgram(pprog);
      gl.bindBuffer(gl.ARRAY_BUFFER, seedBuf);
      gl.enableVertexAttribArray(ploc.seed);
      gl.vertexAttribPointer(ploc.seed, 2, gl.FLOAT, false, 0, 0);
      gl.uniform1f(ploc.time, t);
      gl.uniform1f(ploc.scene, shown);
      gl.uniform2f(ploc.res, canvas.width, canvas.height);
      gl.drawArrays(gl.POINTS, 0, SPARKS);
    }
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    document.documentElement.classList.remove('gl-on');
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      running = false;
      if (raf) cancelAnimationFrame(raf);
    } else if (!reduce) {
      running = true;
      last = performance.now();
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
