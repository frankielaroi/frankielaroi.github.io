/* Home hero in 3D: the battery-swap network as a living sphere.
   Stations sit on the shell, routes arc between them, charge pulses run
   along the routes. Drag to turn it (mouse and pen), hover a ringed station
   to see what it is, click it to open it, click open space to send a charge
   wave through the network. Falls back to the 2D map if WebGL is missing. */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { themeColors, onThemeChange, reduceMotion, finePointer, watchVisibility, afterFirstPaint } from './three-common.js';

const hero = document.querySelector('.grid-hero');
const flat = hero && hero.querySelector('.grid-hero__map');
const tip = hero && hero.querySelector('.map-tip');

const STATIONS = [
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

function fallback() {
  /* Put the flat canvas back if the 3D one was already swapped in. */
  const swapped = hero.querySelector('.grid-hero__map--3d');
  if (swapped && flat) swapped.replaceWith(flat);
  if (window.__flatMap) return;
  const s = document.createElement('script');
  s.src = '/assets/js/network.js';
  document.body.appendChild(s);
}

function webglOK() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) {
    return false;
  }
}

if (!hero) {
  /* not the home page */
} else if (!webglOK()) {
  fallback();
} else {
  afterFirstPaint(() => {
  try {
    start();
  } catch (err) {
    console.error('3D hero failed, using the flat map instead:', err);
    fallback();
  }
  });
}

function start() {
  const R = 2.2;
  const COUNT = 150;

  /* Seeded random so the network has the same shape on every visit. */
  let seed = 11;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  const canvas = document.createElement('canvas');
  canvas.className = 'grid-hero__map grid-hero__map--3d';
  canvas.setAttribute('aria-hidden', 'true');
  flat.replaceWith(canvas);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 0.6, 10.6);

  const world = new THREE.Group();
  world.rotation.set(0.35, -0.6, 0.08);
  scene.add(world);

  let colors = themeColors();

  /* --- Stations on a Fibonacci sphere, nudged so it doesn't look machined. */
  const nodes = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < COUNT; i++) {
    const y = 1 - (i / (COUNT - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const t = golden * i;
    const v = new THREE.Vector3(Math.cos(t) * r, y, Math.sin(t) * r);
    v.x += (rand() - 0.5) * 0.12;
    v.y += (rand() - 0.5) * 0.12;
    v.z += (rand() - 0.5) * 0.12;
    v.normalize().multiplyScalar(R);
    nodes.push({ p: v, charge: rand() * 0.3, adj: [], named: null });
  }

  /* Spread the named stations evenly over the sphere. */
  STATIONS.forEach((s, k) => {
    nodes[Math.floor(((k + 0.5) / STATIONS.length) * COUNT)].named = s;
  });

  /* --- Routes: each station joins its three nearest neighbours by an arc. */
  const edges = [];
  const seen = new Set();
  nodes.forEach((n, i) => {
    nodes
      .map((m, j) => ({ j, d: m.p.distanceToSquared(n.p) }))
      .filter((o) => o.j !== i)
      .sort((a, b) => a.d - b.d)
      .slice(0, 3)
      .forEach((o) => {
        const key = i < o.j ? i + '-' + o.j : o.j + '-' + i;
        if (seen.has(key)) return;
        seen.add(key);
        const e = { a: i, b: o.j };
        edges.push(e);
        n.adj.push({ to: o.j, e });
        nodes[o.j].adj.push({ to: i, e });
      });
  });

  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();
  function arcPoint(a, b, t, out) {
    /* Slerp across the shell and lift the middle a little off the surface. */
    tmpA.copy(a).normalize();
    tmpB.copy(b).normalize();
    const omega = Math.acos(THREE.MathUtils.clamp(tmpA.dot(tmpB), -1, 1));
    const so = Math.sin(omega) || 1;
    const k1 = Math.sin((1 - t) * omega) / so;
    const k2 = Math.sin(t * omega) / so;
    out.set(tmpA.x * k1 + tmpB.x * k2, tmpA.y * k1 + tmpB.y * k2, tmpA.z * k1 + tmpB.z * k2);
    return out.normalize().multiplyScalar(R * (1 + Math.sin(Math.PI * t) * 0.07));
  }

  const SEG = 10;
  const routePos = new Float32Array(edges.length * SEG * 2 * 3);
  const p0 = new THREE.Vector3();
  const p1 = new THREE.Vector3();
  let w = 0;
  edges.forEach((e) => {
    for (let s = 0; s < SEG; s++) {
      arcPoint(nodes[e.a].p, nodes[e.b].p, s / SEG, p0);
      arcPoint(nodes[e.a].p, nodes[e.b].p, (s + 1) / SEG, p1);
      routePos.set([p0.x, p0.y, p0.z, p1.x, p1.y, p1.z], w);
      w += 6;
    }
  });
  const routeGeo = new THREE.BufferGeometry();
  routeGeo.setAttribute('position', new THREE.BufferAttribute(routePos, 3));
  const routeMat = new THREE.LineBasicMaterial({ color: colors.line, transparent: true, opacity: 0.55 });
  world.add(new THREE.LineSegments(routeGeo, routeMat));

  /* A faint inner shell gives the sphere a body without hiding the far side. */
  const shellMat = new THREE.MeshBasicMaterial({ color: colors.line, wireframe: true, transparent: true, opacity: 0.08 });
  world.add(new THREE.Mesh(new THREE.IcosahedronGeometry(R * 0.985, 3), shellMat));

  /* --- Plain stations as points whose colour shows their charge. */
  const plain = nodes.map((n, i) => i).filter((i) => !nodes[i].named);
  const ptPos = new Float32Array(plain.length * 3);
  const ptCol = new Float32Array(plain.length * 3);
  plain.forEach((i, k) => ptPos.set([nodes[i].p.x, nodes[i].p.y, nodes[i].p.z], k * 3));
  const ptGeo = new THREE.BufferGeometry();
  ptGeo.setAttribute('position', new THREE.BufferAttribute(ptPos, 3));
  ptGeo.setAttribute('color', new THREE.BufferAttribute(ptCol, 3));
  const dotTex = makeDotTexture();
  const ptMat = new THREE.PointsMaterial({ size: 0.075, map: dotTex, vertexColors: true, transparent: true, depthWrite: false, sizeAttenuation: true });
  world.add(new THREE.Points(ptGeo, ptMat));

  /* --- Named stations: a solid core and a ring that faces the camera. */
  const namedMeshes = [];
  const coreGeo = new THREE.SphereGeometry(0.07, 20, 14);
  const ringGeo = new THREE.RingGeometry(0.11, 0.14, 40);
  const hitGeo = new THREE.SphereGeometry(0.2, 8, 6);
  nodes.forEach((n, i) => {
    if (!n.named) return;
    const tone = n.named.live ? colors.full : colors.charge;
    const g = new THREE.Group();
    g.position.copy(n.p);
    const core = new THREE.Mesh(coreGeo, new THREE.MeshBasicMaterial({ color: tone }));
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: tone, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, color: tone, transparent: true, opacity: 0.25, depthWrite: false }));
    halo.scale.setScalar(0.5);
    const hit = new THREE.Mesh(hitGeo, new THREE.MeshBasicMaterial({ visible: false }));
    hit.userData.node = i;
    g.add(core, ring, halo, hit);
    world.add(g);
    namedMeshes.push(hit);
    n.view = { g, core, ring, halo };
  });

  /* --- Pulses: one instanced mesh, each instance riding a route. */
  const MAX_PULSES = 260;
  const pulseMesh = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.022, 8, 6),
    new THREE.MeshBasicMaterial({ color: colors.charge }),
    MAX_PULSES
  );
  pulseMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  world.add(pulseMesh);
  const pulses = [];

  function spawn(from, fast) {
    const start = from != null ? from : Math.floor(rand() * COUNT);
    const n = nodes[start];
    if (!n.adj.length || pulses.length >= MAX_PULSES) return;
    const hop = n.adj[Math.floor(Math.random() * n.adj.length)];
    pulses.push({
      from: start,
      to: hop.to,
      t: from != null ? 0 : Math.random(),
      speed: fast ? 2.4 : 0.35 + Math.random() * 0.35,
      wave: !!fast
    });
  }
  for (let i = 0; i < 48; i++) spawn();

  const waves = [];

  /* --- Controls: drag to turn with a mouse or pen, never on touch, so the
         page still scrolls under a thumb. No zoom, so the wheel scrolls. */
  const controls = new OrbitControls(camera, canvas);
  controls.enableZoom = false;
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.rotateSpeed = 0.55;
  controls.autoRotate = !reduceMotion.matches;
  controls.autoRotateSpeed = 0.45;
  controls.minPolarAngle = Math.PI * 0.22;
  controls.maxPolarAngle = Math.PI * 0.78;
  controls.enabled = finePointer.matches;
  controls.touches = { ONE: null, TWO: null };

  /* --- Layout: the sphere sits right of the copy on wide screens, above it
         on phones. Done with a view offset so dragging still orbits its centre. */
  function layout() {
    const r = hero.getBoundingClientRect();
    const Wd = Math.max(1, r.width);
    const Ht = Math.max(1, r.height);
    renderer.setSize(Wd, Ht, false);
    camera.aspect = Wd / Ht;
    const narrow = Wd < 720;
    if (narrow) {
      const copy = hero.querySelector('.boot');
      const top = copy ? copy.getBoundingClientRect().top - r.top : Ht * 0.35;
      /* Centre the sphere in the band above the copy. */
      const shiftY = Ht / 2 - top / 2;
      camera.setViewOffset(Wd, Ht, 0, shiftY, Wd, Ht);
      camera.position.setLength(Math.max(7.3 * Ht / Math.max(top, 1), 7.9 / camera.aspect));
    } else {
      camera.setViewOffset(Wd, Ht, -Wd * 0.24, 0, Wd, Ht);
      camera.position.setLength(Wd / Ht < 1.3 ? 12.5 : 10.6);
    }
    camera.updateProjectionMatrix();
  }

  /* --- Picking ---------------------------------------------------------- */
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const shellHit = new THREE.Sphere(new THREE.Vector3(), R);
  let hover = null;
  let pointerIn = false;
  const pointerWorld = new THREE.Vector3();
  let pointerOnShell = false;

  function setNDC(e) {
    const r = canvas.getBoundingClientRect();
    ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
  }

  function pickNamed() {
    const hits = raycaster.intersectObjects(namedMeshes, false);
    /* Only stations on the near side count. */
    for (const h of hits) {
      const n = nodes[h.object.userData.node];
      const wp = n.view.g.getWorldPosition(new THREE.Vector3());
      if (wp.clone().normalize().dot(camera.position.clone().normalize()) > 0.05) return h.object.userData.node;
    }
    return null;
  }

  function pickShell() {
    const local = raycaster.ray.clone();
    const inv = world.matrixWorld.clone().invert();
    local.applyMatrix4(inv);
    return local.intersectSphere(shellHit, new THREE.Vector3());
  }

  function showTip(i) {
    if (!tip) return;
    if (i == null) {
      tip.setAttribute('data-show', 'false');
      return;
    }
    tip.querySelector('b').textContent = nodes[i].named.name;
    tip.querySelector('span').textContent = nodes[i].named.meta;
    tip.setAttribute('data-show', 'true');
    placeTip();
  }

  const proj = new THREE.Vector3();
  function placeTip() {
    if (hover == null || !tip) return;
    nodes[hover].view.g.getWorldPosition(proj).project(camera);
    const r = canvas.getBoundingClientRect();
    const x = (proj.x * 0.5 + 0.5) * r.width;
    const y = (-proj.y * 0.5 + 0.5) * r.height;
    tip.style.left = Math.min(Math.max(x, 130), r.width - 130) + 'px';
    tip.style.top = Math.max(y, 110) + 'px';
  }

  canvas.addEventListener('pointermove', (e) => {
    setNDC(e);
    pointerIn = true;
    const h = pickNamed();
    if (h !== hover) {
      hover = h;
      showTip(h);
      canvas.style.cursor = h != null ? 'pointer' : 'grab';
      controls.autoRotate = h == null && !reduceMotion.matches;
    }
    const s = pickShell();
    pointerOnShell = !!s;
    if (s) pointerWorld.copy(s);
    if (!running) render();
  });

  canvas.addEventListener('pointerleave', () => {
    pointerIn = false;
    pointerOnShell = false;
    hover = null;
    showTip(null);
    controls.autoRotate = !reduceMotion.matches;
    if (!running) render();
  });

  /* Treat it as a click only if the pointer barely moved (so a drag to turn
     the sphere doesn't also fire a charge wave). */
  let downAt = null;
  canvas.addEventListener('pointerdown', (e) => {
    downAt = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener('pointerup', (e) => {
    if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 6) return;
    setNDC(e);
    const named = pickNamed();
    if (named != null) {
      window.location.href = nodes[named].named.href;
      return;
    }
    const s = pickShell();
    if (!s) return;
    let origin = 0;
    let best = Infinity;
    nodes.forEach((n, i) => {
      const d = n.p.distanceToSquared(s);
      if (d < best) { best = d; origin = i; }
    });
    sendWave(origin);
  });

  function sendWave(origin) {
    const dist = new Map([[origin, 0]]);
    const queue = [origin];
    const out = [];
    while (queue.length) {
      const i = queue.shift();
      out.push({ i, at: dist.get(i) * 0.08 });
      nodes[i].adj.forEach((a) => {
        if (!dist.has(a.to)) {
          dist.set(a.to, dist.get(i) + 1);
          queue.push(a.to);
          if (dist.get(i) < 3) pulses.push({ from: i, to: a.to, t: 0, speed: 2.4, wave: true });
        }
      });
    }
    if (reduceMotion.matches) {
      out.forEach((o) => { nodes[o.i].charge = 1; });
      render();
      return;
    }
    waves.push({ t: 0, queue: out });
  }

  /* --- Frame ------------------------------------------------------------ */
  const m4 = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const idle = new THREE.Color();
  const full = new THREE.Color();
  const mixed = new THREE.Color();

  function update(dt) {
    for (let i = pulses.length - 1; i >= 0; i--) {
      const p = pulses[i];
      p.t += p.speed * dt;
      if (p.t >= 1) {
        nodes[p.to].charge = Math.min(1, nodes[p.to].charge + 0.4);
        pulses.splice(i, 1);
        if (!p.wave) spawn(p.to);
      }
    }
    for (let k = waves.length - 1; k >= 0; k--) {
      const wv = waves[k];
      wv.t += dt;
      while (wv.queue.length && wv.queue[0].at <= wv.t) nodes[wv.queue.shift().i].charge = 1;
      if (!wv.queue.length) waves.splice(k, 1);
    }
    nodes.forEach((n) => {
      if (pointerIn && pointerOnShell) {
        const d = n.p.distanceTo(pointerWorld);
        if (d < 0.9) n.charge = Math.min(1, n.charge + (1 - d / 0.9) * dt * 2.4);
      }
      n.charge = Math.max(0, n.charge - dt * 0.3);
    });
  }

  function render() {
    idle.set(colors.node);
    full.set(colors.full);
    plain.forEach((i, k) => {
      mixed.copy(idle).lerp(full, nodes[i].charge);
      ptCol[k * 3] = mixed.r;
      ptCol[k * 3 + 1] = mixed.g;
      ptCol[k * 3 + 2] = mixed.b;
    });
    ptGeo.attributes.color.needsUpdate = true;

    pulses.forEach((p, k) => {
      arcPoint(nodes[p.from].p, nodes[p.to].p, Math.min(p.t, 1), pos);
      m4.makeTranslation(pos.x, pos.y, pos.z);
      pulseMesh.setMatrixAt(k, m4);
    });
    pulseMesh.count = pulses.length;
    pulseMesh.instanceMatrix.needsUpdate = true;

    nodes.forEach((n, i) => {
      if (!n.view) return;
      n.view.ring.lookAt(camera.position);
      const s = hover === i ? 1.6 : 1 + n.charge * 0.35;
      n.view.ring.scale.setScalar(s);
      n.view.halo.material.opacity = 0.15 + n.charge * 0.35 + (hover === i ? 0.3 : 0);
    });

    renderer.render(scene, camera);
    placeTip();
  }

  let running = false;
  let raf = 0;
  let last = 0;
  let onScreen = true;

  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    update(dt);
    controls.update();
    render();
    raf = requestAnimationFrame(frame);
  }

  function play() {
    if (running || !onScreen || document.hidden) return;
    if (reduceMotion.matches) {
      controls.update();
      render();
      return;
    }
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function pause() {
    running = false;
    cancelAnimationFrame(raf);
  }

  controls.addEventListener('change', () => { if (!running) render(); });

  layout();
  render();
  hero.classList.add('is-3d');
  const hint = hero.querySelector('.map-hint span');
  if (hint) {
    hint.textContent = finePointer.matches
      ? 'Drag to turn the network. Ringed stations are places I\'ve worked and things I\'ve built: hover to see one, click to open it, or click open space to send a charge.'
      : 'Ringed stations are places I\'ve worked and things I\'ve built. Tap one to open it.';
  }

  new ResizeObserver(() => { layout(); render(); }).observe(hero);
  watchVisibility(hero, (v) => { onScreen = v; if (v) play(); else pause(); });
  document.addEventListener('visibilitychange', () => (document.hidden ? pause() : play()));
  reduceMotion.addEventListener('change', () => {
    controls.autoRotate = !reduceMotion.matches;
    if (reduceMotion.matches) { pause(); render(); } else play();
  });
  finePointer.addEventListener('change', () => { controls.enabled = finePointer.matches; });

  onThemeChange(() => {
    colors = themeColors();
    routeMat.color.set(colors.line);
    shellMat.color.set(colors.line);
    pulseMesh.material.color.set(colors.charge);
    nodes.forEach((n) => {
      if (!n.view) return;
      const tone = n.named.live ? colors.full : colors.charge;
      n.view.core.material.color.set(tone);
      n.view.ring.material.color.set(tone);
      n.view.halo.material.color.set(tone);
    });
    render();
  });

  play();
}

function makeDotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.45, 'rgba(255,255,255,0.9)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
