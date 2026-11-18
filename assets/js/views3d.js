/* Small 3D objects placed in the page: a project emblem beside each project,
   a battery cell in each closing section, and the skills battery pack.
   One WebGL canvas, fixed over the viewport with pointer-events off, draws
   every visible object into its element's box (scissor rendering), so the
   page needs a single GL context however many objects it has.

   Markup: <span class="emblem" data-3d="pill|shield|ledger|token|battery|pack">.
   Hover state comes from the closest [data-3d-hover] ancestor, or the element.
   Mouse or pen drag on the element turns the object. */
import * as THREE from 'three';
import { themeColors, onThemeChange, reduceMotion, afterFirstPaint } from './three-common.js';

const els = Array.from(document.querySelectorAll('[data-3d]'));

function webglOK() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) {
    return false;
  }
}

if (!webglOK()) {
  document.documentElement.classList.remove('has-3d');
} else if (els.length) {
  afterFirstPaint(() => {
    try {
      start();
    } catch (err) {
      console.error('3D objects failed, leaving the page flat:', err);
      document.documentElement.classList.remove('has-3d');
    }
  });
}

function start() {
  window.__views3d = true;
  const canvas = document.createElement('canvas');
  canvas.className = 'views3d';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setScissorTest(true);
  renderer.setClearColor(0x000000, 0);

  let colors = themeColors();
  const BUILDERS = { pill, shield, ledger, token, battery, pack };

  const views = els.map((el) => {
    const kind = el.getAttribute('data-3d');
    const build = BUILDERS[kind];
    if (!build) return null;
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x1b2740, 1.5));
    const key = new THREE.DirectionalLight(0xffffff, 1.7);
    key.position.set(2.5, 3, 4);
    scene.add(key);
    const camera = new THREE.PerspectiveCamera(kind === 'pack' ? 30 : 34, 1, 0.1, 30);
    camera.position.set(0, 0, kind === 'pack' ? 4.8 : 3.4);
    if (kind === 'pack') camera.lookAt(0, -0.15, 0);
    const root = new THREE.Group();
    scene.add(root);
    const view = {
      el, kind, scene, camera, root,
      hover: 0, hoverTarget: 0,
      yaw: 0, yawVel: 0, dragging: false,
      seed: Math.random() * 10,
      visible: false,
      data: {}
    };
    view.api = build(view);
    wire(view);
    return view;
  }).filter(Boolean);

  document.documentElement.classList.add('has-3d');

  /* --- Interaction ------------------------------------------------------ */
  function wire(view) {
    const host = view.el.closest('[data-3d-hover]') || view.el;
    const on = () => { view.hoverTarget = 1; kick(); };
    const off = () => { view.hoverTarget = 0; kick(); };
    host.addEventListener('pointerenter', on);
    host.addEventListener('pointerleave', off);
    host.addEventListener('focusin', on);
    host.addEventListener('focusout', off);

    let lastX = 0;
    view.el.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') return;
      e.preventDefault();
      view.dragging = true;
      lastX = e.clientX;
      view.el.setPointerCapture(e.pointerId);
      kick();
    });
    view.el.addEventListener('pointermove', (e) => {
      if (!view.dragging) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      view.yaw += dx * 0.012;
      view.yawVel = dx * 0.012;
    });
    const end = () => { view.dragging = false; };
    view.el.addEventListener('pointerup', end);
    view.el.addEventListener('pointercancel', end);
    /* Stop a drag on an emblem inside a link from opening the link. */
    view.el.addEventListener('click', (e) => {
      if (Math.abs(view.yawVel) > 0.001) e.preventDefault();
    });
  }

  /* Skill cards light up their cell in the pack. */
  document.querySelectorAll('[data-cell]').forEach((card) => {
    const i = parseInt(card.getAttribute('data-cell'), 10);
    const set = (v) => () => {
      views.forEach((vw) => { if (vw.kind === 'pack') vw.data.active = v ? i : -1; });
      kick();
    };
    card.addEventListener('pointerenter', set(true));
    card.addEventListener('pointerleave', set(false));
    card.addEventListener('focusin', set(true));
    card.addEventListener('focusout', set(false));
  });

  /* --- Loop --------------------------------------------------------------- */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      const v = views.find((x) => x.el === en.target);
      if (v) v.visible = en.isIntersecting;
    });
    kick();
  }, { rootMargin: '120px 0px' });
  views.forEach((v) => io.observe(v.el));

  let running = false;
  let raf = 0;
  let last = 0;
  let t = 0;
  let idleUntil = 0;

  function sizeCanvas() {
    const w = document.documentElement.clientWidth;
    const h = window.innerHeight;
    if (canvas.width !== Math.floor(w * renderer.getPixelRatio()) || canvas.height !== Math.floor(h * renderer.getPixelRatio())) {
      renderer.setSize(w, h, false);
    }
  }

  function scrollProgress() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    return max > 0 ? Math.min(1, window.scrollY / max) : 1;
  }

  function draw(dt) {
    sizeCanvas();
    const H = window.innerHeight;
    const W = document.documentElement.clientWidth;
    renderer.setScissor(0, 0, W, H);
    renderer.setViewport(0, 0, W, H);
    renderer.clear();

    const still = reduceMotion.matches;
    const k = still ? 1 : 1 - Math.pow(0.004, dt);
    const prog = scrollProgress();
    let anyActive = false;

    views.forEach((v) => {
      if (!v.visible) return;
      const r = v.el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > H || r.right < 0 || r.left > W || r.width < 2) return;

      v.hover += (v.hoverTarget - v.hover) * k;
      if (!v.dragging) {
        v.yaw += v.yawVel;
        v.yawVel *= 0.92;
      }
      if (Math.abs(v.yawVel) > 0.0005 || Math.abs(v.hover - v.hoverTarget) > 0.002 || v.dragging) anyActive = true;

      v.root.rotation.y = v.yaw;
      v.api.update(still ? 0 : t + v.seed, v.hover, dt, prog, still);

      v.camera.aspect = r.width / r.height;
      v.camera.updateProjectionMatrix();
      const y = H - r.bottom;
      renderer.setViewport(r.left, y, r.width, r.height);
      renderer.setScissor(r.left, y, r.width, r.height);
      renderer.render(v.scene, v.camera);
    });
    return anyActive;
  }

  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    t += dt;
    const active = draw(dt);
    const anyVisible = views.some((v) => v.visible);
    /* Keep animating while something is on screen; with reduced motion,
       only until hover or drag settles (scroll redraws come from kick). */
    if (!anyVisible || (reduceMotion.matches && !active && now > idleUntil) || document.hidden) {
      running = false;
      return;
    }
    raf = requestAnimationFrame(frame);
  }

  function kick() {
    idleUntil = performance.now() + 400;
    if (running) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  window.addEventListener('scroll', kick, { passive: true });
  window.addEventListener('resize', kick);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });
  reduceMotion.addEventListener('change', kick);
  onThemeChange(() => {
    colors = themeColors();
    views.forEach((v) => v.api.recolor && v.api.recolor(colors));
    kick();
  });
  kick();

  /* --- Shared materials -------------------------------------------------- */
  function std(color, extra) {
    return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.45, metalness: 0.2 }, extra || {}));
  }

  function glow(color, intensity) {
    return std(color, { emissive: new THREE.Color(color), emissiveIntensity: intensity == null ? 0.5 : intensity });
  }

  /* --- Models ------------------------------------------------------------ */

  /* PharmaSysGH: a capsule that splits open on hover, granules spilling out. */
  function pill(v) {
    const g = new THREE.Group();
    g.rotation.z = -0.7;
    v.root.add(g);
    const r = 0.32;
    const capA = std(colors.charge, { roughness: 0.3 });
    const capB = std(colors.ink, { roughness: 0.3 });
    const halfA = new THREE.Group();
    const halfB = new THREE.Group();
    halfA.add(mesh(new THREE.CylinderGeometry(r, r, 0.45, 32, 1, true), capA, 0, 0.225));
    halfA.add(mesh(new THREE.SphereGeometry(r, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), capA, 0, 0.45));
    halfB.add(mesh(new THREE.CylinderGeometry(r * 0.98, r * 0.98, 0.45, 32, 1, true), capB, 0, -0.225));
    halfB.add(mesh(new THREE.SphereGeometry(r * 0.98, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), capB, 0, -0.45));
    g.add(halfA, halfB);
    const grains = [];
    const grainMat = glow(colors.full, 0.4);
    for (let i = 0; i < 9; i++) {
      const s = mesh(new THREE.SphereGeometry(0.05, 10, 8), grainMat);
      s.userData.a = (i / 9) * Math.PI * 2;
      grains.push(s);
      g.add(s);
    }
    return {
      update(t, h) {
        g.rotation.y = t * 0.6;
        halfA.position.y = h * 0.3;
        halfB.position.y = -h * 0.3;
        grains.forEach((s, i) => {
          const a = s.userData.a + t * 1.2;
          const rad = 0.18 + h * 0.32;
          s.position.set(Math.cos(a) * rad, Math.sin(t * 2 + i) * 0.06 * h, Math.sin(a) * rad);
          s.scale.setScalar(Math.max(0.001, h));
        });
      },
      recolor(c) { capA.color.set(c.charge); capB.color.set(c.ink); grainMat.color.set(c.full); grainMat.emissive.set(c.full); }
    };
  }

  /* CyberDefend 360: a shield with a check; a scan ring sweeps it on hover. */
  function shield(v) {
    const s = new THREE.Shape();
    s.moveTo(0, 0.78);
    s.bezierCurveTo(0.3, 0.62, 0.52, 0.6, 0.62, 0.58);
    s.bezierCurveTo(0.62, 0.05, 0.42, -0.45, 0, -0.78);
    s.bezierCurveTo(-0.42, -0.45, -0.62, 0.05, -0.62, 0.58);
    s.bezierCurveTo(-0.52, 0.6, -0.3, 0.62, 0, 0.78);
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: 4, curveSegments: 24 });
    geo.center();
    const bodyMat = std(colors.panel2, { metalness: 0.5, roughness: 0.3 });
    const body = mesh(geo, bodyMat);
    const rimMat = glow(colors.charge, 0.3);
    const rim = mesh(new THREE.TorusGeometry(0.98, 0.012, 8, 64), rimMat);
    const check = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.26, 0.02, 0.15),
      new THREE.Vector3(-0.06, -0.2, 0.15),
      new THREE.Vector3(0.3, 0.26, 0.15)
    ], false, 'catmullrom', 0.01);
    const checkMat = glow(colors.full, 0.4);
    const tick = mesh(new THREE.TubeGeometry(check, 24, 0.05, 10, false), checkMat);
    const scanMat = new THREE.MeshBasicMaterial({ color: colors.full, transparent: true, opacity: 0, side: THREE.DoubleSide });
    const scan = mesh(new THREE.RingGeometry(0.0, 0.8, 48, 1), scanMat);
    scan.rotation.x = Math.PI / 2;
    v.root.add(body, tick, rim, scan);
    return {
      update(t, h) {
        body.rotation.y = tick.rotation.y = Math.sin(t * 0.7) * 0.5;
        rim.rotation.x = t * 0.5;
        rim.rotation.y = t * 0.3;
        const y = Math.sin(t * 2.4) * 0.7;
        scan.position.y = y;
        scan.scale.setScalar(0.4 + (1 - Math.abs(y) / 0.8) * 0.6);
        scanMat.opacity = h * 0.28;
        checkMat.emissiveIntensity = 0.3 + h * 0.9;
      },
      recolor(c) { bodyMat.color.set(c.panel2); rimMat.color.set(c.charge); rimMat.emissive.set(c.charge); checkMat.color.set(c.full); checkMat.emissive.set(c.full); scanMat.color.set(c.full); }
    };
  }

  /* FinWatch: transactions as bars; one is flagged and lifts out under a lens. */
  function ledger(v) {
    const g = new THREE.Group();
    g.rotation.x = 0.45;
    g.scale.setScalar(1.25);
    v.root.add(g);
    const heights = [0.35, 0.55, 0.42, 0.95, 0.5, 0.62, 0.38];
    const FLAG = 3;
    const barMat = std(colors.line, { metalness: 0.4 });
    const flagMat = glow(colors.danger, 0.3);
    const bars = heights.map((hgt, i) => {
      const b = mesh(new THREE.BoxGeometry(0.16, hgt, 0.16), i === FLAG ? flagMat : barMat);
      b.position.set((i - 3) * 0.22, hgt / 2 - 0.45, 0);
      g.add(b);
      return b;
    });
    const lens = new THREE.Group();
    const lensMat = glow(colors.charge, 0.4);
    lens.add(mesh(new THREE.TorusGeometry(0.2, 0.03, 10, 40), lensMat));
    const handle = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.26, 10), lensMat);
    handle.position.set(0.19, -0.19, 0);
    handle.rotation.z = Math.PI / 4;
    lens.add(handle);
    g.add(lens);
    return {
      update(t, h) {
        g.rotation.y = Math.sin(t * 0.5) * 0.6;
        bars.forEach((b, i) => {
          const base = heights[i] / 2 - 0.45;
          b.position.y = base + (i === FLAG ? h * 0.25 : Math.sin(t * 1.6 + i) * 0.015);
        });
        const target = bars[FLAG];
        const lx = THREE.MathUtils.lerp(Math.sin(t * 0.9) * 0.5, target.position.x, h);
        lens.position.set(lx, 0.55 + h * 0.15, 0.25);
        flagMat.emissiveIntensity = 0.2 + h * 0.9;
      },
      recolor(c) { barMat.color.set(c.line); flagMat.color.set(c.danger); flagMat.emissive.set(c.danger); lensMat.color.set(c.charge); lensMat.emissive.set(c.charge); }
    };
  }

  /* TokenLink Africa: two linked rings, a token passing through the link. */
  function token(v) {
    const aMat = std(colors.charge, { metalness: 0.6, roughness: 0.25 });
    const bMat = std(colors.full, { metalness: 0.6, roughness: 0.25 });
    const a = mesh(new THREE.TorusGeometry(0.42, 0.085, 16, 60), aMat);
    const b = mesh(new THREE.TorusGeometry(0.42, 0.085, 16, 60), bMat);
    a.position.x = -0.22;
    b.position.x = 0.22;
    b.rotation.x = Math.PI / 2;
    const coinMat = std(colors.ink, { metalness: 0.7, roughness: 0.2 });
    const coin = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.035, 28), coinMat);
    const g = new THREE.Group();
    g.add(a, b, coin);
    g.rotation.set(0.3, 0, 0.2);
    v.root.add(g);
    return {
      update(t, h) {
        g.rotation.y = t * (0.5 + h * 1.2);
        const u = (t * (0.6 + h)) % 1;
        const ang = u * Math.PI * 2;
        coin.position.set(-0.22 + Math.cos(ang) * 0.42, Math.sin(ang) * 0.42, 0);
        coin.rotation.z = ang;
        coin.scale.setScalar(0.6 + h * 0.6);
      },
      recolor(c) { aMat.color.set(c.charge); bMat.color.set(c.full); coinMat.color.set(c.ink); }
    };
  }

  /* Closing sections: a battery cell. Its charge follows how far down the
     page you are; hovering the call to action tops it up. */
  function battery(v) {
    const g = new THREE.Group();
    g.rotation.set(0.18, 0, -0.12);
    v.root.add(g);
    const shellMat = new THREE.MeshStandardMaterial({ color: colors.ink, transparent: true, opacity: 0.16, roughness: 0.1, metalness: 0.1, depthWrite: false });
    const shell = mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.3, 40, 1, true), shellMat);
    const capMat = std(colors.line, { metalness: 0.7, roughness: 0.3 });
    const top = mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.06, 40), capMat, 0, 0.68);
    const bottom = mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.06, 40), capMat, 0, -0.68);
    const nub = mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.1, 24), capMat, 0, 0.76);
    const fillMat = glow(colors.charge, 0.45);
    const fill = mesh(new THREE.CylinderGeometry(0.34, 0.34, 1.2, 40), fillMat);
    const ringMat = new THREE.MeshBasicMaterial({ color: colors.full, transparent: true, opacity: 0 });
    const ring = mesh(new THREE.TorusGeometry(0.56, 0.012, 8, 60), ringMat);
    ring.rotation.x = Math.PI / 2;
    g.add(fill, shell, top, bottom, nub, ring);
    const amber = new THREE.Color();
    const teal = new THREE.Color();
    let level = 0.3;
    return {
      update(t, h, dt, prog, still) {
        g.rotation.y = t * 0.4;
        const want = Math.max(0.12, Math.min(1, 0.25 + prog * 0.6 + h * 0.6));
        level += (want - level) * (still ? 1 : Math.min(1, dt * 4));
        fill.scale.y = level;
        fill.position.y = -0.6 + (1.2 * level) / 2;
        amber.set(colors.charge);
        teal.set(colors.full);
        const c = amber.lerp(teal, Math.max(0, (level - 0.8) / 0.2));
        fillMat.color.copy(c);
        fillMat.emissive.copy(c);
        fillMat.emissiveIntensity = 0.35 + h * 0.6 + (still ? 0 : Math.sin(t * 5) * 0.08 * h);
        const rt = (t * 0.9) % 1;
        ring.position.y = -0.65 + rt * 1.3;
        ringMat.opacity = h * (1 - Math.abs(rt - 0.5) * 2) * 0.9;
      },
      recolor(c) { shellMat.color.set(c.ink); capMat.color.set(c.line); ringMat.color.set(c.full); }
    };
  }

  /* About: the skills as a battery pack, one cell per group. */
  function pack(v) {
    const g = new THREE.Group();
    g.rotation.set(0.62, -0.5, 0);
    v.root.add(g);
    const caseMat = std(colors.panel2, { metalness: 0.4, roughness: 0.5 });
    const tray = mesh(new THREE.BoxGeometry(3.1, 0.14, 1.6), caseMat, 0, -0.55);
    g.add(tray);
    const railMat = std(colors.line, { metalness: 0.7, roughness: 0.3 });
    [-0.78, 0.78].forEach((z) => g.add(mesh(new THREE.BoxGeometry(3.1, 0.06, 0.06), railMat, 0, 0.62, z)));
    const cells = [];
    for (let i = 0; i < 8; i++) {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const cg = new THREE.Group();
      cg.position.set((col - 1.5) * 0.74, 0, (row - 0.5) * 0.74);
      const sMat = std('#2a3550', { metalness: 0.5, roughness: 0.35 });
      const body = mesh(new THREE.CylinderGeometry(0.28, 0.28, 1.0, 32), sMat);
      const bandMat = glow(colors.charge, 0.35);
      const band = mesh(new THREE.CylinderGeometry(0.285, 0.285, 0.12, 32), bandMat, 0, 0.18);
      const capT = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 18), railMat, 0, 0.53);
      cg.add(body, band, capT);
      g.add(cg);
      cells.push({ cg, bandMat });
    }
    v.data.active = -1;
    const amber = new THREE.Color();
    const teal = new THREE.Color();
    return {
      update(t, h) {
        g.rotation.y = -0.5 + Math.sin(t * 0.25) * 0.25;
        amber.set(colors.charge);
        teal.set(colors.full);
        cells.forEach((c, i) => {
          const on = v.data.active === i ? 1 : 0;
          c.on = (c.on || 0) + (on - (c.on || 0)) * 0.15;
          /* A charge wave runs along the pack while idle. */
          const wave = Math.max(0, Math.sin(t * 1.6 - i * 0.7));
          c.cg.position.y = c.on * 0.35;
          const col = amber.clone().lerp(teal, c.on);
          c.bandMat.color.copy(col);
          c.bandMat.emissive.copy(col);
          c.bandMat.emissiveIntensity = 0.25 + wave * 0.5 + c.on * 1.2;
        });
      },
      recolor(c) { caseMat.color.set(c.panel2); railMat.color.set(c.line); }
    };
  }

  function mesh(geo, mat, x, y, z) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x || 0, y || 0, z || 0);
    return m;
  }
}
