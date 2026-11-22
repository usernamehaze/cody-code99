/* Cody's drawing engine.
   A drawing is a small JSON spec (made by hand in samples.js, or written by the AI and checked by clean()):
     { title, parts: [{ id, label, say, color, anchor: [x, y], shapes: [...] }] }
   in a 400 x 300 picture. Shapes: path {d}, arrow {d}, line {x1,y1,x2,y2}, circle {cx,cy,r},
   ellipse {cx,cy,rx,ry}, rect {x,y,width,height,rx}, text {x,y,text}; optional sw (stroke width), dash, and fill
   (a soft shade of the part's colour inside a closed outline, so it reads as a real 2D drawing).
   Parts are drawn one at a time like a pen, in teaching order. Names sit in the margins, each with a line
   to its part's anchor. The same spec powers Draw with Cody, Label it!, the quiz's "Why" and card backs.
   (Adapted from Cassie's livedraw.js, made smaller: 2D only.) */

const NS = 'http://www.w3.org/2000/svg';
const PALETTE = ['#60a5fa', '#f7687f', '#2dd4bf', '#fbbf24', '#a78bfa', '#4ade80', '#fb923c', '#e2e8f0'];
const W = 400, H = 300;
const FILL = '.28'; // how strongly a filled outline is shaded
const PATH_OK = /^[MmLlHhVvCcSsQqTtAaZz0-9.,\s+-]{1,4000}$/;
const reduced = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const num = (v, lo, hi, d = 0) => { const n = +v; return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
const words = (t, max) => String(t == null ? '' : t).replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
const color = (c, i) => (typeof c === 'string' && /^#[0-9a-f]{3,8}$/i.test(c.trim()) ? c.trim() : PALETTE[i % PALETTE.length]);
const svgEl = (tag, attrs = {}) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); return n; };

// ---------- make what the AI wrote safe ----------
function cleanShape(s) {
  if (!s || typeof s !== 'object') return null;
  const t = String(s.t || s.type || '').toLowerCase();
  const base = { t, sw: num(s.sw, 0.8, 8, 3), dash: !!s.dash, fill: !!s.fill && t !== 'arrow' && t !== 'line' && t !== 'text' };
  if ((t === 'path' || t === 'arrow') && typeof s.d === 'string' && PATH_OK.test(s.d)) return { ...base, d: s.d };
  if (t === 'arrow' && ['x1', 'y1', 'x2', 'y2'].every((k) => Number.isFinite(+s[k]))) return { ...base, d: `M ${num(s.x1, -10, 410)} ${num(s.y1, -10, 310)} L ${num(s.x2, -10, 410)} ${num(s.y2, -10, 310)}` };
  if (t === 'line') return { ...base, x1: num(s.x1, -10, 410), y1: num(s.y1, -10, 310), x2: num(s.x2, -10, 410), y2: num(s.y2, -10, 310) };
  if (t === 'circle') return { ...base, cx: num(s.cx, 0, W), cy: num(s.cy, 0, H), r: num(s.r, 1, 200, 10) };
  if (t === 'ellipse') return { ...base, cx: num(s.cx, 0, W), cy: num(s.cy, 0, H), rx: num(s.rx, 1, 200, 10), ry: num(s.ry, 1, 150, 6) };
  if (t === 'rect') return { ...base, x: num(s.x, 0, W), y: num(s.y, 0, H), width: num(s.width ?? s.w, 2, W, 40), height: num(s.height ?? s.h, 2, H, 30), rx: num(s.rx, 0, 60, 6) };
  if (t === 'text' && s.text) return { ...base, x: num(s.x, 0, W), y: num(s.y, 0, H), text: words(s.text, 24) };
  return null;
}
export function clean(raw) {
  let s = raw;
  if (typeof s === 'string') { const a = s.indexOf('{'), b = s.lastIndexOf('}'); if (a < 0 || b <= a) return null; try { s = JSON.parse(s.slice(a, b + 1)); } catch (e) { return null; } }
  if (!s || typeof s !== 'object' || !Array.isArray(s.parts)) return null;
  const parts = s.parts.slice(0, 12).map((p, i) => {
    const shapes = (Array.isArray(p && p.shapes) ? p.shapes : []).slice(0, 28).map(cleanShape).filter(Boolean);
    const a = Array.isArray(p && p.anchor) && p.anchor.length === 2 ? [num(p.anchor[0], 0, W), num(p.anchor[1], 0, H)] : null;
    return { id: words(p && p.id, 40) || 'p' + i, label: words(p && p.label, 32), say: words(p && p.say, 320), color: color(p && p.color, i), anchor: a, shapes };
  }).filter((p) => p.shapes.length);
  if (!parts.length) return null;
  parts.forEach((p) => { if (!p.anchor) p.anchor = centreOf(p.shapes[0]); });
  return { title: words(s.title, 80) || 'Drawing', parts };
}
function centreOf(sh) {
  if (sh.cx != null) return [sh.cx, sh.cy];
  if (sh.x1 != null) return [(sh.x1 + sh.x2) / 2, (sh.y1 + sh.y2) / 2];
  if (sh.width != null) return [sh.x + sh.width / 2, sh.y + sh.height / 2];
  if (sh.x != null) return [sh.x, sh.y];
  const v = (sh.d.match(/-?\d*\.?\d+/g) || []).map(Number);
  return v.length >= 2 ? [num(v[0], 0, W), num(v[1], 0, H)] : [W / 2, H / 2];
}

function shapeNode(s, p, headId) {
  const stroke = { fill: 'none', stroke: p.color, 'stroke-width': s.sw, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
  if (s.dash) stroke['stroke-dasharray'] = '7 6';
  if (s.fill) { stroke.fill = p.color; stroke['fill-opacity'] = '0'; stroke['data-fill'] = '1'; } // (shaded in once its outline is drawn)
  let n;
  if (s.t === 'path' || s.t === 'arrow') { n = svgEl('path', { d: s.d, ...stroke }); if (s.t === 'arrow') n.setAttribute('marker-end', `url(#${headId})`); }
  else if (s.t === 'line') n = svgEl('line', { x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2, ...stroke });
  else if (s.t === 'circle') n = svgEl('circle', { cx: s.cx, cy: s.cy, r: s.r, ...stroke });
  else if (s.t === 'ellipse') n = svgEl('ellipse', { cx: s.cx, cy: s.cy, rx: s.rx, ry: s.ry, ...stroke });
  else if (s.t === 'rect') n = svgEl('rect', { x: s.x, y: s.y, width: s.width, height: s.height, rx: s.rx, ...stroke });
  else if (s.t === 'text') { n = svgEl('text', { x: s.x, y: s.y, fill: p.color, class: 'dr-word' }); n.textContent = s.text; }
  return n;
}

// names in the two margins, each pulled towards its anchor's height, never on top of another
function layoutLabels(items, top = 14, bottom = H - 14) {
  const out = [];
  for (const side of ['left', 'right']) {
    const list = items.filter((it) => it.side === side).sort((a, b) => a.anchor[1] - b.anchor[1]);
    const GAP = 29;
    list.forEach((it, k) => { it.y = Math.max(it.anchor[1], k ? list[k - 1].y + GAP : top); });
    for (let k = list.length - 1; k >= 0; k--) { const max = k === list.length - 1 ? Math.max(bottom, top + GAP * (list.length - 1)) : list[k + 1].y - GAP; if (list[k].y > max) list[k].y = max; }
    out.push(...list);
  }
  return out;
}

/* mount(el, spec, opts) draws into el and returns a controller.
   opts: numbered (label "1 Sun"), labels ('steps' shows each name as its part is drawn, 'all', 'none'),
         targets (ids that get a dashed drop spot, for Label it!), onStep(i), speed (ms per stroke) */
export function mount(el, rawSpec, opts = {}) {
  const spec = rawSpec && rawSpec.parts && rawSpec.parts[0] && rawSpec.parts[0].anchor ? rawSpec : clean(rawSpec);
  el.innerHTML = '';
  if (!spec) { el.textContent = 'Cody could not draw this one.'; return null; }
  const id = 'dr' + Math.random().toString(36).slice(2, 8);
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'dr-svg', role: 'img', 'aria-label': spec.title });
  const defs = svgEl('defs');
  spec.parts.forEach((p, i) => { const m = svgEl('marker', { id: `${id}h${i}`, viewBox: '0 0 10 10', refX: 7, refY: 5, markerWidth: 4, markerHeight: 4, orient: 'auto-start-reverse' }); m.appendChild(svgEl('path', { d: 'M0 0 L10 5 L0 10 z', fill: p.color })); defs.appendChild(m); });
  svg.appendChild(defs);
  const groups = spec.parts.map((p, i) => {
    const g = svgEl('g', { class: 'dr-part', 'data-id': p.id });
    p.shapes.forEach((s) => { const n = shapeNode(s, p, `${id}h${i}`); if (n) g.appendChild(n); });
    svg.appendChild(g);
    return g;
  });
  const labelLayer = svgEl('g', { class: 'dr-labels' }); svg.appendChild(labelLayer);
  const targetLayer = svgEl('g', { class: 'dr-targets' }); svg.appendChild(targetLayer);
  el.appendChild(svg);

  // the picture's own box (so it fills the board), then a column of names on each side of it
  let bb = { x: 0, y: 0, width: W, height: H };
  try { const b = groups.reduce((u, g) => { const r = g.getBBox(); if (!r.width && !r.height) return u; return u ? { x0: Math.min(u.x0, r.x), y0: Math.min(u.y0, r.y), x1: Math.max(u.x1, r.x + r.width), y1: Math.max(u.y1, r.y + r.height) } : { x0: r.x, y0: r.y, x1: r.x + r.width, y1: r.y + r.height }; }, null); if (b) bb = { x: b.x0, y: b.y0, width: b.x1 - b.x0, height: b.y1 - b.y0 }; } catch (e) { /* not on screen yet: the whole board */ }
  const mid = bb.x + bb.width / 2, GAP = 16, PH = 24;
  const measure = (text) => { const t = svgEl('text', { class: 'dr-ltext' }); t.textContent = text; svg.appendChild(t); let w = 0; try { w = t.getComputedTextLength(); } catch (e) { /* */ } t.remove(); return (w || text.length * 7.4) + 24; };
  const items = layoutLabels(spec.parts.map((p, i) => ({ i, anchor: p.anchor, side: p.anchor[0] < mid ? 'left' : 'right' })).filter((it) => spec.parts[it.i].label), bb.y + PH / 2, bb.y + bb.height - PH / 2);
  items.forEach((it) => { const p = spec.parts[it.i]; it.text = (opts.numbered ? `${it.i + 1} ` : '') + p.label; it.w = measure(it.text); });
  const leftW = Math.max(0, ...items.filter((it) => it.side === 'left').map((it) => it.w));
  const rightW = Math.max(0, ...items.filter((it) => it.side === 'right').map((it) => it.w));
  const labelNodes = {};
  items.forEach((it) => {
    const p = spec.parts[it.i], w = it.w;
    const x = it.side === 'left' ? bb.x - GAP - w : bb.x + bb.width + GAP;
    const g = svgEl('g', { class: 'dr-label', 'data-id': p.id });
    const ex = it.side === 'left' ? x + w : x;
    g.appendChild(svgEl('path', { d: `M ${ex} ${it.y} L ${p.anchor[0]} ${p.anchor[1]}`, class: 'dr-leader', stroke: p.color }));
    g.appendChild(svgEl('circle', { cx: p.anchor[0], cy: p.anchor[1], r: 2.6, fill: p.color }));
    g.appendChild(svgEl('rect', { x, y: it.y - PH / 2, width: w, height: PH, rx: PH / 2, class: 'dr-pill' }));
    const t = svgEl('text', { x: x + w / 2, y: it.y + 4.5, 'text-anchor': 'middle', class: 'dr-ltext' }); t.textContent = it.text;
    g.appendChild(t);
    g.style.opacity = '0';
    labelLayer.appendChild(g);
    labelNodes[p.id] = g;
  });
  const ys = items.map((it) => it.y);
  const vx0 = bb.x - (leftW ? GAP + leftW + 4 : 14), vx1 = bb.x + bb.width + (rightW ? GAP + rightW + 4 : 14);
  const vy0 = Math.min(bb.y, ...ys.map((y) => y - PH / 2)) - 12, vy1 = Math.max(bb.y + bb.height, ...ys.map((y) => y + PH / 2)) + 12;
  svg.setAttribute('viewBox', `${vx0} ${vy0} ${vx1 - vx0} ${vy1 - vy0}`);

  const targetNodes = {};
  (opts.targets || []).forEach((tid) => {
    const p = spec.parts.find((q) => q.id === tid); if (!p) return;
    const c = svgEl('circle', { cx: p.anchor[0], cy: p.anchor[1], r: 11, class: 'dr-target', 'data-id': tid });
    targetLayer.appendChild(c); targetNodes[tid] = c;
  });

  let step = -1, timer = null, paused = false, runId = 0;
  const showLabel = (pid, on, extra) => { const g = labelNodes[pid]; if (!g) return; g.style.opacity = on ? '1' : '0'; g.classList.toggle('ok', extra === 'ok'); };
  const setGroup = (i, state) => { // 'hidden' | 'shown' | 'dim'
    const g = groups[i];
    g.style.visibility = state === 'hidden' ? 'hidden' : 'visible';
    g.style.opacity = state === 'dim' ? '.35' : '1';
    for (const n of g.children) { n.style.transition = ''; n.style.strokeDashoffset = ''; if (!n.getAttribute('stroke-dasharray')) n.style.strokeDasharray = ''; n.style.opacity = ''; if (n.dataset.fill) n.style.fillOpacity = state === 'hidden' ? '0' : FILL; }
  };
  async function drawGroup(i, my) {
    const g = groups[i];
    g.style.visibility = 'visible'; g.style.opacity = '1';
    const kids = [...g.children];
    kids.forEach((n) => { n.style.opacity = '0'; });
    for (const n of kids) {
      if (my !== runId) return;
      const dashed = n.getAttribute('stroke-dasharray') || n.tagName === 'text';
      if (n.dataset.fill) n.style.fillOpacity = '0';
      if (dashed || reduced() || !n.getTotalLength) { n.style.transition = 'opacity .35s'; n.style.opacity = '1'; if (n.dataset.fill) n.style.fillOpacity = FILL; await wait(250); continue; }
      let L = 200; try { L = Math.max(8, Math.ceil(n.getTotalLength())); } catch (e) { /* not drawable */ }
      const ms = Math.min(1100, Math.max(300, L * (opts.speed || 3.2)));
      n.style.strokeDasharray = L; n.style.strokeDashoffset = L; n.style.opacity = '1';
      n.getBoundingClientRect();
      n.style.transition = `stroke-dashoffset ${ms}ms ease-in-out`;
      n.style.strokeDashoffset = '0';
      await wait(ms);
      n.style.transition = ''; n.style.strokeDasharray = ''; n.style.strokeDashoffset = '';
      if (n.dataset.fill) { n.style.transition = 'fill-opacity .4s'; n.style.fillOpacity = FILL; }
    }
  }
  const wait = (ms) => new Promise((r) => { timer = setTimeout(r, ms); });

  const ctl = {
    spec, svg, count: spec.parts.length,
    get step() { return step; },
    // show everything at once (the reviewer's picture, a card back, the quiz "why")
    showAll(labels = opts.labels !== 'none') { runId++; step = spec.parts.length - 1; groups.forEach((_, i) => setGroup(i, 'shown')); spec.parts.forEach((p) => showLabel(p.id, labels)); },
    // draw up to step i: earlier parts stay, this one is drawn like a pen
    async go(i, animate = true) {
      i = Math.max(0, Math.min(spec.parts.length - 1, i));
      const my = ++runId; clearTimeout(timer);
      step = i;
      groups.forEach((_, k) => setGroup(k, k < i ? 'shown' : 'hidden'));
      spec.parts.forEach((p, k) => showLabel(p.id, opts.labels !== 'none' && k < i));
      if (opts.onStep) opts.onStep(i);
      if (animate) await drawGroup(i, my); else setGroup(i, 'shown');
      if (my === runId && opts.labels !== 'none') showLabel(spec.parts[i].id, true);
      return my === runId;
    },
    highlight(pid) { // one part bright, the rest faded (the quiz's "why")
      groups.forEach((g, i) => setGroup(i, !pid || spec.parts[i].id === pid ? 'shown' : 'dim'));
      spec.parts.forEach((p) => showLabel(p.id, !pid ? opts.labels !== 'none' : p.id === pid));
    },
    placeLabel(pid) { showLabel(pid, true, 'ok'); const t = targetNodes[pid]; if (t) t.classList.add('done'); },
    hint(pid, on) { const t = targetNodes[pid]; if (t) t.classList.toggle('hint', on); },
    // which drop spot is under this point of the screen (Label it!)
    targetAt(clientX, clientY) {
      const m = svg.getScreenCTM(); if (!m) return null;
      const pt = new DOMPoint(clientX, clientY).matrixTransform(m.inverse());
      let best = null, bd = 30;
      for (const tid in targetNodes) { if (targetNodes[tid].classList.contains('done')) continue; const p = spec.parts.find((q) => q.id === tid); const d = Math.hypot(pt.x - p.anchor[0], pt.y - p.anchor[1]); if (d < bd) { bd = d; best = tid; } }
      return best;
    },
    stop() { runId++; clearTimeout(timer); },
    set paused(v) { paused = v; }, get paused() { return paused; },
  };
  if (opts.labels === 'none') spec.parts.forEach((p) => showLabel(p.id, false));
  return ctl;
}
