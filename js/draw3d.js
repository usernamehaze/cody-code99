/* Cody's 3D models (adapted from Cassie's livedraw.js: her draw3d and shape3d, v251 to v303).
   A model is a JSON spec the AI writes: { title, mode: '3d', axis, intro, summary, parts: [{ id, label, say, color,
   finish, shell, spin, glow, from, view, shapes: [...] }] }, built from simple solids in a box about 6 units long.
   Shapes: cylinder, tube, disc, cone, sphere, box, torus/ring, blades, capsule, pipe, arrow, lathe (a turned
   profile) and plate (a flat cut shape).
   It is built part by part in teaching order, with the same controller as a flat drawing (go, showAll, highlight,
   stop), so Draw with Cody, the chat and the reviewer page all use it the same way. The student can turn it with a
   finger, pinch to zoom, tap a part, open the case ("shell" parts) and pull it apart along its main axis; parts
   marked "spin" turn on their own axle. three.js (js/vendor/three) loads only when a model is shown. */

const NS = 'http://www.w3.org/2000/svg';
const PALETTE = ['#60a5fa', '#f7687f', '#2dd4bf', '#fbbf24', '#a78bfa', '#4ade80', '#fb923c', '#e2e8f0'];
const still = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const num = (v, lo, hi, d = 0) => { const n = +v; return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
const words = (t, max) => String(t == null ? '' : t).replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
const color = (c, i) => (typeof c === 'string' && /^#[0-9a-f]{3,8}$/i.test(c.trim()) ? c.trim() : PALETTE[i % PALETTE.length]);
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
const pts3 = (list) => (Array.isArray(list) ? list : []).slice(0, 10).filter((q) => Array.isArray(q) && q.length === 3 && q.every((v) => Number.isFinite(+v))).map((q) => q.map((v) => num(v, -20, 20)));
const pts2 = (list) => (Array.isArray(list) ? list : []).slice(0, 24).filter((q) => Array.isArray(q) && q.length === 2 && q.every((v) => Number.isFinite(+v))).map((q) => q.map((v) => num(v, -20, 20)));

// ---------- what the AI wrote, made safe ----------
export function clean3d(s) {
  if (!s || typeof s !== 'object' || !Array.isArray(s.parts)) return null;
  const parts = s.parts.slice(0, 10).map((p, i) => ({
    id: words(p && p.id, 40) || 'p' + i, label: words(p && p.label, 40), say: words(p && p.say, 360), color: color(p && p.color, i),
    finish: ['metal', 'plastic', 'rubber', 'wood'].includes(p && p.finish) ? p.finish : null,
    shell: !!(p && p.shell), spin: !!(p && p.spin), glow: !!(p && p.glow),
    from: Array.isArray(p && p.from) && p.from.length === 3 && p.from.every((v) => Number.isFinite(+v)) ? p.from.map((v) => num(v, -12, 12)) : null,
    view: ['front', 'back', 'left', 'right', 'side', 'top'].includes(p && p.view) ? p.view : null,
    shapes: (Array.isArray(p && p.shapes) ? p.shapes : []).slice(0, 8).filter((x) => x && typeof x === 'object'),
  })).filter((p) => p.shapes.length);
  if (!parts.length) return null;
  return { title: words(s.title, 90) || 'How it works', mode: '3d', axis: ['x', 'y', 'z'].includes(s.axis) ? s.axis : 'x', intro: words(s.intro, 300), summary: words(s.summary, 300), parts };
}

let three = null;
const loadThree = () => (three || (three = Promise.all([import('./vendor/three/three.module.min.js'), import('./vendor/three/OrbitControls.js')]).then(([T, oc]) => ({ T, OrbitControls: oc.OrbitControls })).catch((e) => { three = null; throw e; })));
const glOk = () => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } };

/* mount3d(el, spec, opts) → a controller like draw.js's mount(): go(i), showAll(), highlight(id), stop(), plus
   open() and explode() (null when the model has no case, or one part). It returns at once; the model builds when
   three.js has loaded (ctl.ready). opts: numbered, labels ('steps' | 'all' | 'none'), onStep(i), onPick(part) */
export function mount3d(host, rawSpec, opts = {}) {
  const spec = clean3d(rawSpec);
  host.innerHTML = '';
  if (!spec) { host.textContent = 'Cody could not build this one.'; return null; }
  const stage = el('div', 'm3'); stage.setAttribute('role', 'img');
  stage.setAttribute('aria-label', `${spec.title}, a 3D model: ${spec.parts.map((p) => p.label).filter(Boolean).join(', ')}`);
  const hint = el('p', 'm3-hint', 'Drag to turn it. Pinch or scroll to zoom. Tap a part.');
  host.appendChild(stage); host.appendChild(hint);
  let view = null, step = -1, want = null, dead = false;
  const ctl = {
    spec, count: spec.parts.length, mode: '3d',
    get step() { return step; },
    get canOpen() { return !!(view && view.open); }, get canExplode() { return !!(view && view.explode); },
    open: () => (view && view.open ? view.open() : false),
    explode: () => (view && view.explode ? view.explode() : false),
    async go(i, animate = true) {
      i = Math.max(0, Math.min(spec.parts.length - 1, i)); step = i;
      if (opts.onStep) opts.onStep(i);
      if (!view) { want = ['go', i]; await ctl.ready; if (step !== i || dead) return false; }
      if (!view) return true;
      return view.upTo(i, animate && !still());
    },
    showAll(labels = opts.labels !== 'none') { step = spec.parts.length - 1; if (view) view.upTo(step, false, labels); else want = ['all', labels]; },
    highlight(pid) { if (view) view.highlight(pid); else want = ['hl', pid]; },
    placeLabel() {}, hint() {}, targetAt: () => null, // (Label it! plays on flat drawings)
    stop() { dead = true; if (view) view.stop(); },
    set paused(v) {}, get paused() { return false; },
  };
  ctl.ready = (glOk() ? loadThree() : Promise.reject(new Error('no WebGL'))).then((lib) => {
    if (dead || !stage.isConnected) return;
    view = build(lib, stage, spec, opts);
    if (!view) throw new Error('nothing to build');
    if (want && want[0] === 'all') view.upTo(spec.parts.length - 1, false, want[1]);
    else if (want && want[0] === 'hl') { view.upTo(spec.parts.length - 1, false, opts.labels !== 'none'); view.highlight(want[1]); }
    else if (want && want[0] === 'go') view.upTo(want[1], false);
  }).catch(() => {
    // no 3D on this device: say what it would have shown
    stage.remove(); hint.remove();
    const list = el('ol', 'm3-fallback');
    spec.parts.forEach((p) => list.appendChild(el('li', '', `${p.label}: ${p.say}`)));
    host.appendChild(el('p', 'muted', 'This device cannot show 3D models, so here are the parts:')); host.appendChild(list);
  });
  return ctl;
}

function build({ T, OrbitControls }, stage, spec, opts) {
  const W = () => stage.clientWidth || 340, H = () => stage.clientHeight || 260;
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.setSize(W(), H()); renderer.outputColorSpace = T.SRGBColorSpace;
  const canvas = renderer.domElement; canvas.className = 'm3-canvas'; canvas.style.touchAction = 'none'; stage.prepend(canvas);
  const lines = document.createElementNS(NS, 'svg'); lines.setAttribute('class', 'm3-lines'); lines.setAttribute('aria-hidden', 'true'); stage.appendChild(lines);
  const tags = el('div', 'm3-tags'); stage.appendChild(tags);
  const caption = el('p', 'm3-caption'); caption.hidden = true; stage.appendChild(caption);

  // a studio: soft light from above and the sides, metal and plastic catch it, and the model throws a soft shadow
  const scene = new T.Scene(), cam = new T.PerspectiveCamera(34, W() / H(), 0.05, 200);
  scene.add(new T.HemisphereLight(0xe4ecff, 0x1a1a22, 1.15));
  const sun = new T.DirectionalLight(0xffffff, 1.7); sun.position.set(4, 6, 5); scene.add(sun);
  const rim = new T.DirectionalLight(0x8fb4ff, 0.6); rim.position.set(-5, -2, -4); scene.add(rim);
  try {
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
    sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.radius = 6; sun.shadow.bias = -0.0005;
    const room = new T.Scene(), glowBox = (c, x, y, z, w, h, d) => { const m = new T.Mesh(new T.BoxGeometry(w, h, d), new T.MeshBasicMaterial({ color: c })); m.position.set(x, y, z); room.add(m); };
    room.add(new T.Mesh(new T.BoxGeometry(40, 40, 40), new T.MeshBasicMaterial({ color: 0x8a8f99, side: T.BackSide })));
    glowBox(0xffffff, 0, 18, 0, 26, 1, 26); glowBox(0xfff2dd, 18, 4, 6, 1, 14, 14); glowBox(0xcfe0ff, -18, 2, -6, 1, 10, 16); glowBox(0x30333a, 0, -18, 0, 40, 1, 40);
    const pm = new T.PMREMGenerator(renderer); scene.environment = pm.fromScene(room, 0.04).texture; pm.dispose();
  } catch (e) { /* plain lights */ }

  const controls = new OrbitControls(cam, canvas); controls.enableDamping = true; controls.enablePan = false; controls.minDistance = 2; controls.maxDistance = 40;
  const model = new T.Group(); scene.add(model);
  const v3 = (a, d = [0, 0, 0]) => (Array.isArray(a) ? new T.Vector3(num(a[0], -20, 20, d[0]), num(a[1], -20, 20, d[1]), num(a[2], -20, 20, d[2])) : new T.Vector3(...d));
  const along = (obj, axis) => { if (axis === 'x') obj.rotation.z = -Math.PI / 2; else if (axis === 'z') obj.rotation.x = Math.PI / 2; return obj; };
  const groups = spec.parts.map((p, i) => {
    const g = new T.Group(); g.userData = { i, part: p };
    const fin = ({ metal: [0.9, 0.32], plastic: [0.02, 0.42], rubber: [0, 0.92], wood: [0, 0.75] })[p.finish] || [0.25, 0.5];
    const mat = new T.MeshStandardMaterial({ color: new T.Color(p.color), metalness: fin[0], roughness: fin[1], side: T.DoubleSide, transparent: true, opacity: 1, emissive: p.glow ? new T.Color(p.color) : new T.Color(0x000000), emissiveIntensity: p.glow ? 0.55 : 0 });
    const made = [];
    for (const s of p.shapes) { const m = shape3d(T, s, mat, along, v3); if (m) { g.add(m); made.push([s, m]); } }
    if (!p.shell) g.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    // a part that spins: each round piece turns in place about its own axle, through its own middle
    if (p.spin) {
      const spinners = [];
      made.forEach(([sh, m]) => {
        if (!/^(torus|ring|disc|cylinder|blades|cone|lathe)$/.test(String(sh.t || sh.type || '').toLowerCase())) return;
        const pivot = new T.Group(); pivot.position.copy(m.position); m.position.set(0, 0, 0);
        g.add(pivot); pivot.add(m); pivot.userData.axle = ['x', 'y', 'z'].includes(sh.axis) ? sh.axis : spec.axis; spinners.push(pivot);
      });
      g.userData.spinners = spinners;
    }
    g.visible = false;
    model.add(g);
    return g;
  });
  const built = groups.filter((g) => g.children.length);
  if (!built.length) { renderer.dispose(); canvas.remove(); return null; }

  // fit the camera to the whole model, from a three-quarter view, with room for the names on each side
  groups.forEach((g) => { g.visible = true; });
  const box = new T.Box3().setFromObject(model), size = box.getSize(new T.Vector3()), mid = box.getCenter(new T.Vector3());
  model.position.sub(mid); model.updateMatrixWorld(true);
  const R = Math.max(size.x, size.y, size.z, 1);
  const VIEW = new T.Vector3(0.55, 0.38, 1.02).normalize();
  const fitBox = (bx, dir) => {
    const cs = []; for (const x of [bx.min.x, bx.max.x]) for (const y of [bx.min.y, bx.max.y]) for (const z of [bx.min.z, bx.max.z]) cs.push(new T.Vector3(x, y, z));
    const probe = cam.clone(), fits = (d) => { probe.position.copy(dir).multiplyScalar(d); probe.lookAt(0, 0, 0); probe.updateMatrixWorld(); probe.updateProjectionMatrix(); return cs.every((c) => { if (c.clone().applyMatrix4(probe.matrixWorldInverse).z > -probe.near * 4) return false; const q = c.clone().project(probe); return Math.abs(q.x) <= (labelsOn() ? (W() < 560 ? 0.62 : 0.5) : 0.78) && Math.abs(q.y) <= 0.8; }); };
    let lo = 0.5, hi = 400; for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (fits(m)) hi = m; else lo = m; }
    return hi;
  };
  const labelsOn = () => opts.labels !== 'none';
  const fullBox = new T.Box3().setFromObject(model);
  const floor = new T.Mesh(new T.PlaneGeometry(R * 6, R * 6), new T.ShadowMaterial({ opacity: 0.22 })); floor.rotation.x = -Math.PI / 2; floor.position.y = fullBox.min.y - R * 0.04; floor.receiveShadow = true; scene.add(floor);
  const sc = sun.shadow.camera; sc.left = sc.bottom = -R * 1.4; sc.right = sc.top = R * 1.4; sc.near = 0.1; sc.far = R * 8; sun.position.set(R * 0.7, R * 1.6, R * 0.9); sc.updateProjectionMatrix();
  let camTo = null;
  const home = VIEW.clone().multiplyScalar(fitBox(fullBox, VIEW));
  cam.position.copy(home); controls.target.set(0, 0, 0); controls.maxDistance = Math.max(40, home.length() * 3); controls.update();

  // where each part sits: its name points at the middle of its piece nearest its own middle
  const AX = { x: new T.Vector3(1, 0, 0), y: new T.Vector3(0, 1, 0), z: new T.Vector3(0, 0, 1) }, ax = AX[spec.axis];
  groups.forEach((g) => {
    const b = new T.Box3().setFromObject(g), c = b.getCenter(new T.Vector3());
    let at = c, best = Infinity;
    g.traverse((m) => { if (!m.isMesh) return; const mc = new T.Box3().setFromObject(m).getCenter(new T.Vector3()), d = mc.distanceTo(c); if (d < best) { best = d; at = mc; } });
    g.userData.center = at; g.userData.home = g.position.clone(); g.visible = false;
  });
  const order = groups.filter((g) => g.children.length && !g.userData.part.shell).sort((a, b) => a.userData.center.dot(ax) - b.userData.center.dot(ax));
  const shells = groups.filter((g) => g.userData.part.shell);
  let exploded = false, opened = false, picked = null, raf = 0, last = performance.now(), visible = true, sideAz = null, sideApart = false, showNames = labelsOn();
  const tagEls = groups.map((g) => {
    const p = g.userData.part; if (!p.label) return null;
    const t = el('button', 'm3-tag', `${opts.numbered ? spec.parts.indexOf(p) + 1 + ' ' : ''}${p.label}`); t.type = 'button'; t.hidden = true;
    t.addEventListener('click', (e) => { e.stopPropagation(); pick(g); }); tags.appendChild(t); return t;
  });
  const named = new Set();
  const dimOf = (g) => (g.userData.part.shell && (opened || exploded) ? 0.14 : 1);
  const fade = (g, o) => g.traverse((m) => { if (m.material) { m.material.opacity = o; m.material.depthWrite = o > 0.6; } });
  const pick = (g) => {
    picked = picked === g ? null : g;
    groups.forEach((x) => fade(x, picked && x !== picked ? 0.16 : dimOf(x)));
    const p = picked && picked.userData.part;
    caption.hidden = !p; if (p) caption.textContent = `${p.label}: ${p.say}`;
    if (opts.onPick) opts.onPick(p || null);
  };
  // a tap (not a drag) picks the part under the finger; a tap on empty space shows it all again
  const ray = new T.Raycaster(), pt = new T.Vector2(); let down = null;
  canvas.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
  canvas.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
    const r = canvas.getBoundingClientRect(); pt.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(pt, cam);
    const hits = ray.intersectObjects(groups.filter((g) => g.visible && !(g.userData.part.shell && (opened || exploded))), true);
    let g = hits.length ? hits[0].object : null; while (g && !groups.includes(g)) g = g.parent;
    if (g) pick(g); else if (picked) pick(picked);
  });

  const tmp = new T.Vector3();
  const tick = (now) => {
    raf = requestAnimationFrame(tick);
    if (!visible) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!still()) groups.forEach((g) => { if (g.visible && g.userData.spinners) g.userData.spinners.forEach((sp) => { sp.rotation[sp.userData.axle] += dt * 3; }); });
    groups.forEach((g) => { const to = g.userData.to; if (to) { g.position.lerp(to, Math.min(1, dt * 6)); if (g.position.distanceTo(to) < 0.002) { g.position.copy(to); g.userData.to = null; } } });
    groups.forEach((g) => { const sl = g.userData.slide; if (sl) { const k = Math.min(1, Math.max(0, (now - sl.t0 - 300) / 1000)), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; g.position.lerpVectors(sl.from, g.userData.home, e); if (k >= 1) g.userData.slide = null; } });
    if (camTo) { cam.position.lerp(camTo, Math.min(1, dt * 5)); if (cam.position.distanceTo(camTo) < 0.01) camTo = null; }
    controls.update();
    renderer.render(scene, cam);
    // the names stand in a column on each side of the model, never on it, each with a thin line to its part
    const segs = [], w = W(), h = H(), shown = [];
    groups.forEach((g, i) => {
      const t = tagEls[i]; if (!t) return;
      if (!showNames || !g.visible || !named.has(i) || (g.userData.part.shell && (opened || exploded))) { t.hidden = true; return; }
      t.hidden = false; tmp.copy(g.userData.center).add(g.position).sub(g.userData.home); tmp.project(cam);
      shown.push({ t, px: (tmp.x + 1) / 2 * w, py: (1 - tmp.y) / 2 * h, tw: t.offsetWidth || 80, th: t.offsetHeight || 24 });
    });
    let x0 = Infinity, x1 = -Infinity;
    if (!exploded) for (const x of [fullBox.min.x, fullBox.max.x]) for (const y of [fullBox.min.y, fullBox.max.y]) for (const z of [fullBox.min.z, fullBox.max.z]) { tmp.set(x, y, z).project(cam); const sx = (tmp.x + 1) / 2 * w; x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); }
    else shown.forEach((s) => { x0 = Math.min(x0, s.px - 48); x1 = Math.max(x1, s.px + 48); });
    const az = Math.atan2(cam.position.x, cam.position.z);
    if (sideAz == null || Math.abs(Math.atan2(Math.sin(az - sideAz), Math.cos(az - sideAz))) > 1 || sideApart !== exploded) { sideAz = az; sideApart = exploded; tagEls.forEach((t) => { if (t) t._side = 0; }); }
    const fresh = shown.filter((s) => !s.t._side).sort((a, b) => a.px - b.px), had = { L: shown.filter((s) => s.t._side === -1).length, R: shown.filter((s) => s.t._side === 1).length };
    fresh.forEach((s) => { const left = s.px < (x0 + x1) / 2 ? had.L <= had.R + 1 : had.L + 1 < had.R; s.t._side = left ? -1 : 1; if (left) had.L++; else had.R++; });
    for (const side of [-1, 1]) {
      const col = shown.filter((s) => s.t._side === side).sort((a, b) => a.py - b.py);
      let y = -Infinity;
      col.forEach((s) => { s.y = Math.max(s.py, y + s.th + 8, s.th / 2 + 4); y = s.y; });
      let cap = h - 4;
      for (let k = col.length - 1; k >= 0; k--) { const s = col[k]; s.y = Math.min(s.y, cap - s.th / 2); cap = s.y - s.th / 2 - 8; }
      col.forEach((s) => {
        const x = side < 0 ? Math.max(s.tw / 2 + 4, x0 - 20 - s.tw / 2) : Math.min(w - s.tw / 2 - 4, x1 + 20 + s.tw / 2);
        s.t.style.left = x + 'px'; s.t.style.top = s.y + 'px';
        const ex = side < 0 ? x + s.tw / 2 : x - s.tw / 2;
        segs.push(`<line x1="${ex.toFixed(1)}" y1="${s.y.toFixed(1)}" x2="${s.px.toFixed(1)}" y2="${s.py.toFixed(1)}"/><circle cx="${s.px.toFixed(1)}" cy="${s.py.toFixed(1)}" r="2.5"/>`);
      });
    }
    lines.setAttribute('viewBox', `0 0 ${w} ${h}`); lines.innerHTML = segs.join('');
  };
  raf = requestAnimationFrame(tick);
  const io = 'IntersectionObserver' in window ? new IntersectionObserver((en) => { visible = en.some((x) => x.isIntersecting); }) : null; if (io) io.observe(stage);
  const ro = 'ResizeObserver' in window ? new ResizeObserver(() => { renderer.setSize(W(), H()); cam.aspect = W() / H(); cam.updateProjectionMatrix(); if (!exploded) { home.copy(VIEW).multiplyScalar(fitBox(fullBox, VIEW)); camTo = cam.position.clone().normalize().multiplyScalar(home.length()); } }) : null; if (ro) ro.observe(stage);
  const stop = () => { cancelAnimationFrame(raf); renderer.dispose(); if (io) io.disconnect(); if (ro) ro.disconnect(); gone.disconnect(); };
  const gone = new MutationObserver(() => { if (!stage.isConnected) stop(); });
  gone.observe(document.body, { childList: true, subtree: true });
  const SIDES = { front: [0, 0.14, 1], back: [0, 0.14, -1], left: [-1, 0.14, 0.001], right: [1, 0.14, 0.001], side: [1, 0.14, 0.001], top: [0.001, 1, 0.04] };
  let run = 0, shownTo = -1;

  return {
    stop,
    // parts 0..i are there; part i pops in (and slides in from "from", and the camera turns to its "view")
    upTo(i, animate, names = showNames) {
      const my = ++run; showNames = names; shownTo = i;
      groups.forEach((g, k) => {
        g.userData.slide = null;
        if (k > i) { g.visible = false; named.delete(k); return; }
        g.visible = true;
        if (k < i || !animate) { g.scale.setScalar(1); fade(g, picked && g !== picked ? 0.16 : dimOf(g)); if (!exploded) g.position.copy(g.userData.home); named.add(k); }
      });
      if (!animate) return Promise.resolve(true);
      const g = groups[i], p = g.userData.part, dim = dimOf(g);
      named.delete(i);
      if (p.view && SIDES[p.view]) camTo = new T.Vector3(...SIDES[p.view]).normalize().multiplyScalar(cam.position.length());
      if (p.from && !exploded) { g.position.copy(g.userData.home).add(new T.Vector3(...p.from)); g.userData.slide = { from: g.position.clone(), t0: performance.now() }; }
      const t0 = performance.now();
      return new Promise((res) => {
        const stepIt = () => {
          if (my !== run) { res(false); return; }
          const k = Math.min(1, (performance.now() - t0) / 550), e = 1 - Math.pow(1 - k, 3);
          g.scale.setScalar(0.6 + 0.4 * e); fade(g, Math.min(e, dim));
          if (k < 1) requestAnimationFrame(stepIt); else { named.add(i); res(true); }
        };
        requestAnimationFrame(stepIt);
      });
    },
    highlight(pid) { const g = groups.find((x) => x.userData.part.id === pid); if (g) { picked = null; pick(g); } else if (picked) pick(picked); },
    open: shells.length ? () => { opened = !opened; if (picked) pick(picked); shells.forEach((g) => fade(g, opened ? 0.14 : 1)); return opened; } : null,
    explode: order.length > 1 ? () => {
      exploded = !exploded; if (picked) pick(picked);
      const gap = R * 0.22, n = order.length;
      order.forEach((g, k) => { g.userData.to = exploded ? g.userData.home.clone().addScaledVector(ax, (k - (n - 1) / 2) * gap) : g.userData.home.clone(); });
      shells.forEach((g) => { g.visible = !exploded && groups.indexOf(g) <= shownTo; fade(g, dimOf(g)); });
      const spread = new T.Box3(); groups.forEach((g) => { if (!g.visible) return; const s0 = g.scale.x; g.scale.setScalar(1); g.updateMatrixWorld(true); const b = new T.Box3().setFromObject(g); g.scale.setScalar(s0); g.updateMatrixWorld(true); if (g.userData.to) b.translate(g.userData.to.clone().sub(g.position)); spread.union(b); });
      const dir = cam.position.clone().normalize();
      camTo = dir.multiplyScalar(exploded && !spread.isEmpty() ? fitBox(spread, dir) : home.length());
      return exploded;
    } : null,
  };
}

function shape3d(T, s, mat, along, v3) {
  const t = String(s.t || s.type || '').toLowerCase();
  const axis = ['x', 'y', 'z'].includes(s.axis) ? s.axis : 'x';
  const r = num(s.r, 0.02, 8, 0.5), len = num(s.len ?? s.h, 0.02, 20, 1);
  let m = null;
  const own = s.color && /^#[0-9a-f]{3,8}$/i.test(s.color) ? Object.assign(mat.clone(), { color: new T.Color(s.color) }) : mat;
  if (t === 'cylinder' || t === 'tube' || t === 'disc') {
    const r2 = num(s.r2, 0.02, 8, r), h = t === 'disc' ? num(s.thick ?? s.len, 0.01, 2, 0.08) : len;
    m = along(new T.Mesh(new T.CylinderGeometry(r2, r, h, 48, 1, !!s.open, s.cut ? Math.PI * 0.2 : 0, s.cut ? Math.PI * 1.4 : Math.PI * 2), own), axis);
  } else if (t === 'cone') {
    m = new T.Mesh(new T.ConeGeometry(r, len, 40), own);
    if (axis === 'x') m.rotation.z = (s.dir === -1 ? 1 : -1) * Math.PI / 2; else if (axis === 'z') m.rotation.x = (s.dir === -1 ? -1 : 1) * Math.PI / 2; else if (s.dir === -1) m.rotation.z = Math.PI;
  } else if (t === 'sphere') m = new T.Mesh(new T.SphereGeometry(r, 40, 28, 0, s.cut ? Math.PI * 1.5 : Math.PI * 2), own);
  else if (t === 'box') { const sz = Array.isArray(s.size) ? s.size : [1, 1, 1]; m = new T.Mesh(new T.BoxGeometry(num(sz[0], 0.02, 20, 1), num(sz[1], 0.02, 20, 1), num(sz[2], 0.02, 20, 1)), own); }
  else if (t === 'torus' || t === 'ring') { m = new T.Mesh(new T.TorusGeometry(r, num(s.tube, 0.01, 4, 0.12), 18, 56), own); if (axis === 'x') m.rotation.y = Math.PI / 2; else if (axis === 'y') m.rotation.x = Math.PI / 2; }
  else if (t === 'blades') {
    m = new T.Group(); const n = Math.round(num(s.n, 2, 40, 12)), bl = num(s.len, 0.05, 8, r), wd = num(s.width, 0.02, 2, 0.18);
    for (let i = 0; i < n; i++) { const b = new T.Mesh(new T.BoxGeometry(0.04, bl, wd), own); b.position.y = bl / 2 + num(s.hub, 0, 4, 0.12); b.rotation.y = 0.5; const p = new T.Group(); p.add(b); p.rotation.x = i / n * Math.PI * 2; m.add(p); }
    if (axis === 'y') m.rotation.z = Math.PI / 2; else if (axis === 'z') m.rotation.y = Math.PI / 2;
  } else if (t === 'capsule') m = along(new T.Mesh(new T.CapsuleGeometry(r, len, 8, 24), own), axis);
  else if (t === 'pipe' || t === 'arrow') { // a tube through the points; an arrow ends in a head, the way it points
    const pts = pts3(s.pts).map((q) => new T.Vector3(q[0], q[1], q[2])), w = num(s.r, 0.01, 2, 0.06);
    if (pts.length < 2) return null;
    const tube = new T.Mesh(new T.TubeGeometry(pts.length > 2 ? new T.CatmullRomCurve3(pts) : new T.LineCurve3(pts[0], pts[1]), Math.max(8, pts.length * 12), w, 10, false), own);
    if (t === 'pipe') m = tube;
    else {
      const tip = pts[pts.length - 1], dir = tip.clone().sub(pts[pts.length - 2]).normalize(), hl = w * 7;
      const head = new T.Mesh(new T.ConeGeometry(w * 2.8, hl, 18), own);
      head.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir); head.position.copy(tip).addScaledVector(dir, hl / 2);
      m = new T.Group(); m.add(tube, head);
    }
  } else if (t === 'lathe') { // a profile [radius, along] turned round the axis
    const pr = pts2(s.profile).map((q) => new T.Vector2(Math.abs(q[0]), q[1]));
    if (pr.length < 2) return null;
    m = along(new T.Mesh(new T.LatheGeometry(pr, 48), own), axis);
  } else if (t === 'plate') { // a flat plate: its outline across the axis, "thick" along it
    const pr = pts2(s.outline), th = num(s.thick, 0.01, 4, 0.1);
    if (pr.length < 3) return null;
    const g = new T.ExtrudeGeometry(new T.Shape(pr.map((q) => new T.Vector2(q[0], q[1]))), { depth: th, bevelEnabled: false });
    g.translate(0, 0, -th / 2);
    m = new T.Mesh(g, own);
    if (axis === 'y') m.rotation.x = Math.PI / 2; else if (axis === 'x') m.rotation.y = -Math.PI / 2;
  }
  if (!m) return null;
  m.position.copy(v3(s.pos));
  if (Array.isArray(s.rot)) m.rotation.set(m.rotation.x + num(s.rot[0], -7, 7), m.rotation.y + num(s.rot[1], -7, 7), m.rotation.z + num(s.rot[2], -7, 7));
  return m;
}
