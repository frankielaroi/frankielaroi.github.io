/* Kofa story in 3D: a battery swap station that reacts to the scroll steps.
   Step 0: the beacon flashes and the faulty slot glows red, with an ops alert.
   Step 1: the faulty slot's door swings open and its battery slides out.
   Step 2: the slot activity log appears beside the cabinet.
   Step 3: the fleet map appears with bikes moving, parked and stopped.
   Drag with a mouse to turn the station. The SVG drawing stays as the
   fallback when WebGL isn't available. */
import * as THREE from 'three';
import { themeColors, onThemeChange, reduceMotion, finePointer, watchVisibility, afterFirstPaint } from './three-common.js';

const figure = document.querySelector('.story__figure');

function webglOK() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) {
    return false;
  }
}

if (figure && webglOK()) {
  afterFirstPaint(() => {
  try {
    start();
  } catch (err) {
    console.error('3D station failed, keeping the drawing:', err);
  }
  });
}

function start() {
  const FAULT = 2;
  const SLOT_Y = [0.62, 0.26, -0.1, -0.46, -0.82];
  const LEVEL = [0.82, 0.96, 0.34, 1, 0.7];

  const canvas = document.createElement('canvas');
  canvas.className = 'story__canvas';
  canvas.setAttribute('aria-hidden', 'true');
  figure.prepend(canvas);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  camera.position.set(0, 0.4, 7.4);

  let colors = themeColors();

  scene.add(new THREE.HemisphereLight(0xffffff, 0x223044, 1.4));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(3, 4, 5);
  scene.add(key);
  const beaconLight = new THREE.PointLight(colors.charge, 0, 4);
  beaconLight.position.set(0, 1.75, 0.4);
  scene.add(beaconLight);

  const station = new THREE.Group();
  scene.add(station);

  const mat = (color, extra) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.55, metalness: 0.15 }, extra || {}));

  /* --- Cabinet ----------------------------------------------------------- */
  const bodyMat = mat(colors.panel2);
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.7, 2.9, 0.95), bodyMat);
  body.position.y = -0.05;
  station.add(body);

  const trimMat = mat(colors.line, { roughness: 0.4, metalness: 0.4 });
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.14, 1.1), trimMat);
  plinth.position.y = -1.57;
  station.add(plinth);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(1.84, 0.1, 1.06), trimMat);
  cap.position.y = 1.45;
  station.add(cap);

  /* Beacon on the roof. */
  const beaconMat = mat(colors.charge, { emissive: new THREE.Color(colors.charge), emissiveIntensity: 0.2 });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.2, 24), beaconMat);
  beacon.position.set(0, 1.6, 0);
  station.add(beacon);
  const beaconRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.22, 0.012, 8, 40),
    new THREE.MeshBasicMaterial({ color: colors.charge, transparent: true, opacity: 0 })
  );
  beaconRing.rotation.x = Math.PI / 2;
  beaconRing.position.copy(beacon.position);
  station.add(beaconRing);

  /* Screen with live text. */
  const screenTex = textTexture(512, 112);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.28), new THREE.MeshBasicMaterial({ map: screenTex.texture }));
  screen.position.set(0, 1.08, 0.481);
  station.add(screen);

  /* --- Slots ------------------------------------------------------------- */
  const slots = SLOT_Y.map((y, i) => {
    const g = new THREE.Group();
    g.position.set(0, y, 0);
    station.add(g);

    const recess = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.3, 0.05), mat(colors.ground, { roughness: 0.9 }));
    recess.position.z = 0.46;
    g.add(recess);

    const edgeMat = new THREE.MeshBasicMaterial({ color: colors.line });
    const edge = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.34), edgeMat);
    edge.position.z = 0.455;
    g.add(edge);

    /* Battery: a body and a charge bar on its face. */
    const battery = new THREE.Group();
    battery.position.z = 0.28;
    const shell = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.2, 0.5), mat('#2a3550', { roughness: 0.35, metalness: 0.5 }));
    battery.add(shell);
    const barMat = mat(colors.full, { emissive: new THREE.Color(colors.full), emissiveIntensity: 0.65 });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1, 0.08, 0.02), barMat);
    bar.scale.x = LEVEL[i];
    bar.position.set(-0.5 + (LEVEL[i] * 1) / 2, 0, 0.26);
    battery.add(bar);
    g.add(battery);

    /* Door hinged on its left edge: smoked glass over the battery. */
    const hinge = new THREE.Group();
    hinge.position.set(-0.68, 0, 0.5);
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(1.36, 0.29, 0.025),
      new THREE.MeshStandardMaterial({ color: colors.ground, transparent: true, opacity: 0.55, roughness: 0.1, metalness: 0.2 })
    );
    door.position.x = 0.68;
    hinge.add(door);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, 0.04), trimMat);
    handle.position.set(1.28, 0, 0.03);
    hinge.add(handle);
    g.add(hinge);

    return { g, battery, bar, barMat, hinge, edgeMat, level: LEVEL[i] };
  });

  /* --- Floating panels, one per step ------------------------------------ */
  function panel(w, h, texW, texH) {
    const t = textTexture(texW, texH);
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: t.texture, transparent: true, opacity: 0, depthWrite: false })
    );
    scene.add(m);
    return { mesh: m, tex: t, home: new THREE.Vector3(), away: new THREE.Vector3() };
  }

  const alert = panel(1.75, 0.57, 600, 196);
  alert.home.set(-0.9, 2.15, 0.7);
  alert.away.set(-0.9, 2.6, 0.2);

  const log = panel(1.55, 1.7, 420, 460);
  log.home.set(1.95, -0.05, 0.3);
  log.away.set(2.4, -0.05, -0.2);

  const map = panel(1.7, 1.25, 460, 340);
  map.home.set(-1.95, -0.55, 0.5);
  map.away.set(-2.4, -0.55, 0);
  const bikes = [
    { c: 'full', path: [[-0.55, -0.25], [0.1, 0.15]] },
    { c: 'full', path: [[0.35, -0.3], [-0.2, 0.25]] },
    { c: 'full', path: [[-0.1, 0.35], [0.55, -0.05]] },
    { c: 'charge', path: [[-0.45, 0.3], [-0.45, 0.3]] },
    { c: 'charge', path: [[0.5, 0.32], [0.5, 0.32]] },
    { c: 'danger', path: [[0.3, -0.05], [0.3, -0.05]] }
  ].map((b) => {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 14, 10),
      new THREE.MeshBasicMaterial({ color: colors[b.c], transparent: true, opacity: 0 })
    );
    map.mesh.add(m);
    return Object.assign(b, { mesh: m });
  });

  function paint() {
    colors = themeColors();
    bodyMat.color.set(colors.panel2);
    trimMat.color.set(colors.line);
    slots.forEach((s) => s.edgeMat.color.set(colors.line));

    drawCard(screenTex, (g, W, H) => {
      g.fillStyle = '#0a1120';
      g.fillRect(0, 0, W, H);
      g.fillStyle = '#e8edf4';
      g.font = '600 46px "Bricolage Grotesque", system-ui, sans-serif';
      g.textBaseline = 'middle';
      g.fillText('Station 14', 26, H / 2);
      g.fillStyle = colors.full;
      g.textAlign = 'right';
      g.font = '500 38px "Bricolage Grotesque", system-ui, sans-serif';
      g.fillText('4 of 5 ready', W - 26, H / 2);
    });

    drawCard(alert.tex, (g, W, H) => {
      card(g, W, H);
      g.fillStyle = colors.charge;
      g.fillRect(0, 0, 12, H);
      g.fillStyle = colors.ink;
      g.font = '600 46px "Bricolage Grotesque", system-ui, sans-serif';
      g.fillText('Station 14 at risk', 40, 76);
      g.fillStyle = colors.muted;
      g.font = '400 34px "Bricolage Grotesque", system-ui, sans-serif';
      g.fillText('Slot 3 fault. Push sent to ops.', 40, 140);
    });

    drawCard(log.tex, (g, W, H) => {
      card(g, W, H);
      g.fillStyle = colors.ink;
      g.font = '600 38px "Bricolage Grotesque", system-ui, sans-serif';
      g.fillText('Slot 3 activity', 32, 62);
      const rows = [
        ['10:42', 'Fault reported', colors.danger],
        ['10:43', 'Manual unlock', colors.full],
        ['10:44', 'Battery out, 34%', colors.charge],
        ['10:51', 'Battery in, 100%', colors.full],
        ['10:52', 'Slot back online', colors.full]
      ];
      rows.forEach((r, i) => {
        const y = 136 + i * 66;
        g.fillStyle = r[2];
        g.beginPath();
        g.arc(42, y - 10, 8, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = colors.muted;
        g.font = '400 28px "JetBrains Mono", ui-monospace, monospace';
        g.fillText(r[0], 66, y);
        g.fillStyle = colors.ink;
        g.font = '500 30px "Bricolage Grotesque", system-ui, sans-serif';
        g.fillText(r[1], 170, y);
      });
    });

    drawCard(map.tex, (g, W, H) => {
      card(g, W, H);
      g.strokeStyle = colors.line;
      g.lineWidth = 6;
      g.beginPath();
      g.moveTo(30, H - 40);
      g.bezierCurveTo(140, 120, 260, 300, W - 30, 50);
      g.moveTo(60, 60);
      g.bezierCurveTo(200, 140, 260, 200, W - 60, H - 30);
      g.stroke();
      g.fillStyle = colors.ink;
      g.font = '600 30px "Bricolage Grotesque", system-ui, sans-serif';
      g.fillText('3 moving, 2 parked, 1 stopped', 24, 44);
    });

    bikes.forEach((b) => b.mesh.material.color.set(colors[b.c]));
    beaconMat.color.set(colors.charge);
    beaconMat.emissive.set(colors.charge);
    beaconRing.material.color.set(colors.charge);
    beaconLight.color.set(colors.charge);
  }

  paint();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { paint(); kick(); });

  /* --- Step targets ------------------------------------------------------ */
  const CAMS = [
    { pos: [-0.9, 1.1, 7.6], look: [-0.3, 0.45, 0] },
    { pos: [1.7, 0.2, 5.6], look: [0.1, -0.15, 0.3] },
    { pos: [2.6, 0.3, 6.6], look: [0.75, 0, 0] },
    { pos: [-2.6, -0.1, 6.8], look: [-0.6, -0.3, 0] }
  ];
  let step = 0;
  const camPos = new THREE.Vector3(...CAMS[0].pos);
  const camLook = new THREE.Vector3(...CAMS[0].look);
  const wantPos = new THREE.Vector3();
  const wantLook = new THREE.Vector3();

  /* Animated values, eased toward their targets each frame. */
  const v = { door: 0, slide: 0, alert: 0, log: 0, map: 0, fault: 1 };
  const red = new THREE.Color();
  const teal = new THREE.Color();
  const amber = new THREE.Color();

  function targets() {
    return {
      door: step === 1 ? 1 : 0,
      slide: step === 1 ? 1 : 0,
      alert: step === 0 ? 1 : 0,
      log: step === 2 ? 1 : 0,
      map: step === 3 ? 1 : 0,
      fault: step === 0 ? 1 : step === 1 ? 0 : 0.5
    };
  }

  /* Drag to turn the station (mouse or pen only, so touch still scrolls). */
  let yaw = -0.25;
  let yawVel = 0;
  let dragging = false;
  let lastX = 0;
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') return;
    dragging = true;
    lastX = e.clientX;
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = 'grabbing';
    kick();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    lastX = e.clientX;
    yaw += dx * 0.008;
    yawVel = dx * 0.008;
    if (!running) render(0);
  });
  const endDrag = () => {
    dragging = false;
    canvas.style.cursor = 'grab';
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  if (finePointer.matches) canvas.style.cursor = 'grab';

  let t = 0;
  function render(dt) {
    const k = reduceMotion.matches ? 1 : 1 - Math.pow(0.002, dt);
    const tg = targets();
    Object.keys(v).forEach((name) => { v[name] += (tg[name] - v[name]) * k; });

    if (!dragging) {
      yaw += yawVel;
      yawVel *= 0.92;
      if (!reduceMotion.matches) yaw += Math.sin(t * 0.4) * 0.0008;
    }
    station.rotation.y = yaw;

    const c = CAMS[step];
    wantPos.set(...c.pos);
    wantLook.set(...c.look);
    camPos.lerp(wantPos, Math.min(1, k * 0.8));
    camLook.lerp(wantLook, Math.min(1, k * 0.8));
    camera.position.copy(camPos);
    camera.lookAt(camLook);

    /* Faulty slot: door swings out, battery slides toward the viewer. */
    const f = slots[FAULT];
    f.hinge.rotation.y = -v.door * 1.75;
    f.battery.position.z = 0.28 + v.slide * 0.75;
    red.set(colors.danger);
    teal.set(colors.full);
    amber.set(colors.charge);
    const faultColor = v.fault >= 0.5 ? amber.clone().lerp(red, (v.fault - 0.5) * 2) : teal.clone().lerp(amber, v.fault * 2);
    f.barMat.color.copy(faultColor);
    f.barMat.emissive.copy(faultColor);
    f.edgeMat.color.copy(new THREE.Color(colors.line).lerp(faultColor, 0.9));

    /* Beacon flashes while the alert is up. */
    const flash = reduceMotion.matches ? v.alert : v.alert * (0.55 + 0.45 * Math.sin(t * 6));
    beaconMat.emissiveIntensity = 0.2 + flash * 1.4;
    beaconLight.intensity = flash * 3;
    const ringT = (t * 0.8) % 1;
    beaconRing.scale.setScalar(1 + ringT * 2.2);
    beaconRing.material.opacity = reduceMotion.matches ? 0 : v.alert * (1 - ringT) * 0.8;

    [[alert, v.alert], [log, v.log], [map, v.map]].forEach(([p, amt]) => {
      p.mesh.material.opacity = amt;
      p.mesh.visible = amt > 0.01;
      p.mesh.position.lerpVectors(p.away, p.home, amt);
      p.mesh.quaternion.copy(camera.quaternion);
    });

    bikes.forEach((b, i) => {
      const s = reduceMotion.matches ? 0.5 : (Math.sin(t * 0.7 + i * 1.7) + 1) / 2;
      const [a, z] = b.path;
      b.mesh.position.set(a[0] + (z[0] - a[0]) * s, a[1] + (z[1] - a[1]) * s - 0.06, 0.02);
      b.mesh.material.opacity = v.map;
    });

    renderer.render(scene, camera);
  }

  /* --- Sizing and loop --------------------------------------------------- */
  function size() {
    const r = figure.getBoundingClientRect();
    renderer.setSize(Math.max(1, r.width), Math.max(1, r.height), false);
    camera.aspect = Math.max(1, r.width) / Math.max(1, r.height);
    /* Narrow frames pull back so the side panels still fit. */
    camera.fov = camera.aspect < 0.9 ? 44 : camera.aspect < 1.2 ? 38 : 32;
    camera.updateProjectionMatrix();
  }

  let running = false;
  let raf = 0;
  let last = 0;
  let onScreen = false;
  let settleUntil = 0;

  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    t += dt;
    render(dt);
    /* With reduced motion, stop once everything has settled. */
    if (reduceMotion.matches && now > settleUntil && !dragging) {
      running = false;
      return;
    }
    raf = requestAnimationFrame(frame);
  }

  function kick() {
    settleUntil = performance.now() + 600;
    if (running || !onScreen || document.hidden) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function pause() {
    running = false;
    cancelAnimationFrame(raf);
  }

  new MutationObserver(() => {
    const s = parseInt(figure.getAttribute('data-step') || '0', 10);
    if (s !== step && s >= 0 && s < CAMS.length) {
      step = s;
      kick();
    }
  }).observe(figure, { attributes: true, attributeFilter: ['data-step'] });

  size();
  camPos.set(...CAMS[0].pos);
  render(1);
  figure.classList.add('is-3d');

  new ResizeObserver(() => { size(); render(0); }).observe(figure);
  watchVisibility(figure, (vis) => { onScreen = vis; if (vis) kick(); else pause(); });
  document.addEventListener('visibilitychange', () => (document.hidden ? pause() : kick()));
  onThemeChange(() => { paint(); render(0); });
}

/* --- Canvas textures for text on panels ---------------------------------- */
function textTexture(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return { canvas: c, ctx: c.getContext('2d'), texture };
}

function drawCard(t, fn) {
  const g = t.ctx;
  g.save();
  g.clearRect(0, 0, t.canvas.width, t.canvas.height);
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
  fn(g, t.canvas.width, t.canvas.height);
  g.restore();
  t.texture.needsUpdate = true;
}

function card(g, W, H) {
  const cs = getComputedStyle(document.documentElement);
  const r = 28;
  g.fillStyle = cs.getPropertyValue('--panel').trim() || '#142036';
  g.strokeStyle = cs.getPropertyValue('--line-strong').trim() || '#344a6e';
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(r, 2);
  g.arcTo(W - 2, 2, W - 2, H - 2, r);
  g.arcTo(W - 2, H - 2, 2, H - 2, r);
  g.arcTo(2, H - 2, 2, 2, r);
  g.arcTo(2, 2, W - 2, 2, r);
  g.closePath();
  g.fill();
  g.stroke();
}
