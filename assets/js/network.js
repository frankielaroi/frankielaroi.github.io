/* Home hero: a live battery-swap network drawn on canvas.
   Stations are nodes, charge pulses travel the routes between them, the
   pointer charges nearby stations, and a click sends a charge wave out from
   the nearest one. Named stations are places Frank has worked or things he
   built; hovering shows what they are and clicking opens them.
   The same links exist as plain HTML in the hero, so nothing depends on this. */
(function () {
  'use strict';

  if (window.__flatMap) return;
  window.__flatMap = true;
  var canvas = document.querySelector('.grid-hero__map');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var hero = canvas.parentElement;
  var tip = hero.querySelector('.map-tip');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  var STATIONS = [
    { name: 'Kofa Technologies', meta: 'Full Stack Developer, 2026 to now', href: '/#kofa', live: true },
    { name: 'PharmaSysGH', meta: 'Pharmacy SaaS, in active use', href: '/projects/#pharmasysgh', live: true },
    { name: 'CyberDefend 360', meta: 'Security assessment SaaS, 2025', href: '/projects/#cyberdefend' },
    { name: 'FinWatch', meta: 'AML detection platform, 2024', href: '/projects/#finwatch' },
    { name: 'TokenLink Africa', meta: 'Tokenization API, in progress', href: '/projects/#tokenlink' },
    { name: 'Reuben Foundation Africa', meta: 'Full Stack Engineer, 2024 to 2026', href: '/about/#experience' },
    { name: 'Hepeps IT Solutions', meta: 'Frontend Developer, 2024 to 2025', href: '/about/#experience' },
    { name: 'Dumpong Community Bank', meta: 'IT Support Specialist, 2026', href: '/about/#experience' },
    { name: 'Toyota Ghana', meta: 'IT Support Technician, 2025', href: '/about/#experience' },
    { name: 'Regional Maritime University', meta: 'Engineering and IT, 2023 to 2024', href: '/about/#experience' },
    { name: 'AfRipul Group', meta: 'Full Stack Engineer, 2024', href: '/about/#experience' }
  ];

  var colors = {};
  function readColors() {
    var cs = getComputedStyle(document.documentElement);
    colors.line = cs.getPropertyValue('--line-strong').trim() || '#344a6e';
    colors.node = cs.getPropertyValue('--ink-faint').trim() || '#7d8ca4';
    colors.ink = cs.getPropertyValue('--ink').trim() || '#e8edf4';
    colors.charge = cs.getPropertyValue('--charge').trim() || '#f5a524';
    colors.full = cs.getPropertyValue('--full').trim() || '#3dd6b0';
    colors.ground = cs.getPropertyValue('--ground').trim() || '#0e1626';
  }

  /* Small seeded random so the map has the same shape on every visit. */
  var seed = 7;
  function rand() {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  }

  var W = 0, H = 0, dpr = 1;
  var nodes = [], edges = [], pulses = [], waves = [];
  var pointer = { x: -9999, y: -9999, inside: false };
  var hover = null;
  var running = false, visibleOnScreen = true, raf = 0, last = 0;

  function build() {
    seed = 7;
    nodes = [];
    edges = [];
    pulses = [];
    var narrow = W < 720;
    /* Keep stations off the copy on wide screens: the map lives to the right. */
    var x0 = narrow ? 0.06 : 0.55, x1 = 0.97, y0 = narrow ? 0.04 : 0.1, y1 = 0.9;
    if (narrow) {
      /* On phones the map gets the band above the copy. */
      var copy = hero.querySelector('.boot');
      var top = copy ? copy.getBoundingClientRect().top - hero.getBoundingClientRect().top : H * 0.4;
      y1 = Math.max(0.2, (top - 18) / H);
    }
    var band = (x1 - x0) * W * (y1 - y0) * H;
    var count = Math.round(Math.min(60, Math.max(16, band / 9000)));
    var minGap = Math.sqrt(((x1 - x0) * W * (y1 - y0) * H) / count) * 0.62;

    var tries = 0;
    while (nodes.length < count && tries < 4000) {
      tries++;
      var x = (x0 + rand() * (x1 - x0)) * W;
      var y = (y0 + rand() * (y1 - y0)) * H;
      var ok = true;
      for (var i = 0; i < nodes.length; i++) {
        var dx = nodes[i].x - x, dy = nodes[i].y - y;
        if (dx * dx + dy * dy < minGap * minGap) { ok = false; break; }
      }
      if (ok) nodes.push({ x: x, y: y, charge: rand() * 0.4, named: null, adj: [] });
    }

    /* Spread the named stations across the field, not clumped together. */
    var order = nodes.map(function (n, i) { return i; }).sort(function (a, b) {
      return (nodes[a].x + nodes[a].y * 0.37) % 97 - (nodes[b].x + nodes[b].y * 0.37) % 97;
    });
    var step = Math.max(1, Math.floor(order.length / STATIONS.length));
    STATIONS.forEach(function (s, k) {
      var n = nodes[order[(k * step) % order.length]];
      if (n && !n.named) n.named = s;
    });

    /* Each station links to its nearest neighbours. */
    var seen = {};
    nodes.forEach(function (n, i) {
      var near = nodes.map(function (m, j) {
        return { j: j, d: (m.x - n.x) * (m.x - n.x) + (m.y - n.y) * (m.y - n.y) };
      }).filter(function (o) { return o.j !== i; }).sort(function (a, b) { return a.d - b.d; }).slice(0, 3);
      near.forEach(function (o) {
        var key = i < o.j ? i + '-' + o.j : o.j + '-' + i;
        if (seen[key]) return;
        seen[key] = true;
        var e = { a: i, b: o.j, len: Math.sqrt(o.d) };
        edges.push(e);
        n.adj.push({ to: o.j, edge: e });
        nodes[o.j].adj.push({ to: i, edge: e });
      });
    });

    for (var p = 0; p < Math.round(edges.length * 0.35); p++) spawnPulse();
  }

  function spawnPulse(from) {
    if (!edges.length) return;
    var start = from != null ? from : Math.floor(rand() * nodes.length);
    var n = nodes[start];
    if (!n || !n.adj.length) return;
    var hop = n.adj[Math.floor(Math.random() * n.adj.length)];
    pulses.push({ from: start, to: hop.to, t: from != null ? 0 : Math.random(), speed: 70 + Math.random() * 60, len: hop.edge.len });
  }

  function resize() {
    var r = hero.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(1, Math.round(r.width));
    H = Math.max(1, Math.round(r.height));
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    build();
    draw();
  }

  function nearest(x, y, onlyNamed, maxD) {
    var best = null, bd = maxD * maxD;
    nodes.forEach(function (n, i) {
      if (onlyNamed && !n.named) return;
      var d = (n.x - x) * (n.x - x) + (n.y - y) * (n.y - y);
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  }

  function update(dt) {
    /* Pulses move along their route and charge the station they arrive at. */
    for (var i = pulses.length - 1; i >= 0; i--) {
      var p = pulses[i];
      p.t += (p.speed * dt) / Math.max(p.len, 1);
      if (p.t >= 1) {
        var n = nodes[p.to];
        n.charge = Math.min(1, n.charge + 0.35);
        pulses.splice(i, 1);
        if (!p.wave) spawnPulse(p.to);
      }
    }

    /* Waves from a click: each ring of neighbours lights a little later. */
    for (var w = waves.length - 1; w >= 0; w--) {
      var wave = waves[w];
      wave.t += dt;
      while (wave.queue.length && wave.queue[0].at <= wave.t) {
        var hit = wave.queue.shift();
        nodes[hit.i].charge = 1;
      }
      if (!wave.queue.length) waves.splice(w, 1);
    }

    nodes.forEach(function (n) {
      if (pointer.inside) {
        var d = Math.hypot(n.x - pointer.x, n.y - pointer.y);
        if (d < 150) n.charge = Math.min(1, n.charge + (1 - d / 150) * dt * 2.2);
      }
      n.charge = Math.max(0, n.charge - dt * 0.28);
    });
  }

  function mix(a, b, t) {
    /* Blend two hex colours; used for a station going from idle to full. */
    var pa = hex(a), pb = hex(b);
    if (!pa || !pb) return t > 0.5 ? b : a;
    return 'rgb(' + Math.round(pa[0] + (pb[0] - pa[0]) * t) + ',' + Math.round(pa[1] + (pb[1] - pa[1]) * t) + ',' + Math.round(pa[2] + (pb[2] - pa[2]) * t) + ')';
  }

  function hex(c) {
    var m = /^#?([0-9a-f]{6})$/i.exec(c);
    if (!m) return null;
    var v = parseInt(m[1], 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    ctx.lineWidth = 1;
    ctx.strokeStyle = colors.line;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    edges.forEach(function (e) {
      ctx.moveTo(nodes[e.a].x, nodes[e.a].y);
      ctx.lineTo(nodes[e.b].x, nodes[e.b].y);
    });
    ctx.stroke();
    ctx.globalAlpha = 1;

    /* Pulses: a short bright head with a fading tail. */
    pulses.forEach(function (p) {
      var a = nodes[p.from], b = nodes[p.to];
      var t = Math.min(p.t, 1);
      var x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
      var tt = Math.max(0, t - 18 / Math.max(p.len, 1));
      var tx = a.x + (b.x - a.x) * tt, ty = a.y + (b.y - a.y) * tt;
      var g = ctx.createLinearGradient(tx, ty, x, y);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, colors.charge);
      ctx.strokeStyle = g;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.fillStyle = colors.charge;
      ctx.beginPath();
      ctx.arc(x, y, 1.8, 0, Math.PI * 2);
      ctx.fill();
    });

    nodes.forEach(function (n, i) {
      var c = n.charge;
      if (n.named) {
        var isHover = hover === i;
        var r = isHover ? 8 : 5.5;
        if (c > 0.05 || isHover) {
          ctx.globalAlpha = 0.18 + c * 0.3;
          ctx.fillStyle = n.named.live ? colors.full : colors.charge;
          ctx.beginPath();
          ctx.arc(n.x, n.y, r + 8 + c * 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        ctx.fillStyle = colors.ground;
        ctx.strokeStyle = n.named.live ? colors.full : colors.charge;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = n.named.live ? colors.full : colors.charge;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r * (0.35 + c * 0.4), 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = mix(colors.node, colors.full, c);
        ctx.beginPath();
        ctx.arc(n.x, n.y, 2.2 + c * 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  function frame(now) {
    if (!running) return;
    var dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    update(dt);
    draw();
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (running || reduce.matches || !visibleOnScreen || document.hidden) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  /* --- Pointer -------------------------------------------------------- */
  function local(e) {
    var r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function showTip(i) {
    if (!tip) return;
    if (i == null) {
      tip.setAttribute('data-show', 'false');
      return;
    }
    var n = nodes[i];
    tip.querySelector('b').textContent = n.named.name;
    tip.querySelector('span').textContent = n.named.meta;
    var x = Math.min(Math.max(n.x, 120), W - 120);
    tip.style.left = x + 'px';
    tip.style.top = Math.max(n.y, 110) + 'px';
    tip.setAttribute('data-show', 'true');
  }

  hero.addEventListener('pointermove', function (e) {
    var p = local(e);
    pointer.x = p.x;
    pointer.y = p.y;
    pointer.inside = true;
    var h = nearest(p.x, p.y, true, 26);
    if (h !== hover) {
      hover = h;
      showTip(h);
      canvas.style.cursor = h != null ? 'pointer' : 'crosshair';
      if (!running) draw();
    }
  });

  hero.addEventListener('pointerleave', function () {
    pointer.inside = false;
    hover = null;
    showTip(null);
    if (!running) draw();
  });

  canvas.addEventListener('click', function (e) {
    var p = local(e);
    var named = nearest(p.x, p.y, true, 26);
    if (named != null) {
      window.location.href = nodes[named].named.href;
      return;
    }
    var origin = nearest(p.x, p.y, false, 9999);
    if (origin == null) return;
    /* Breadth-first from the clicked station, one hop every 90ms. */
    var dist = {};
    dist[origin] = 0;
    var queue = [origin], out = [];
    while (queue.length) {
      var i = queue.shift();
      out.push({ i: i, at: dist[i] * 0.09 });
      nodes[i].adj.forEach(function (a) {
        if (dist[a.to] == null) {
          dist[a.to] = dist[i] + 1;
          queue.push(a.to);
          if (dist[i] < 3) pulses.push({ from: i, to: a.to, t: 0, speed: 260, len: a.edge.len, wave: true });
        }
      });
    }
    if (reduce.matches) {
      out.forEach(function (o) { nodes[o.i].charge = 1; });
      draw();
      return;
    }
    waves.push({ t: 0, queue: out });
  });

  /* --- Lifecycle ------------------------------------------------------ */
  readColors();
  resize();

  if ('ResizeObserver' in window) {
    var pending = 0;
    new ResizeObserver(function () {
      cancelAnimationFrame(pending);
      pending = requestAnimationFrame(resize);
    }).observe(hero);
  } else {
    window.addEventListener('resize', resize);
  }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visibleOnScreen = entries[0].isIntersecting;
      if (visibleOnScreen) start(); else stop();
    }).observe(hero);
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop(); else start();
  });

  var onMotion = function () {
    if (reduce.matches) { stop(); draw(); } else start();
  };
  if (reduce.addEventListener) reduce.addEventListener('change', onMotion);

  document.addEventListener('themechange', function () { readColors(); draw(); });
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', function () { readColors(); draw(); });

  start();
})();
