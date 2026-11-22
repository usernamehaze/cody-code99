/* 3D models for Draw with Cody (adapted from Cassie's livedraw.js, v253 to v303).
   The AI first plans the real object (which part sits inside which, how big each is against the whole, what
   touches what), then builds it from simple solids. Here the server checks the model against that plan, for any
   subject: nothing floats, a part said to be inside another fits inside it, each part is about its planned size,
   wheels stand upright on an axle, and blades face along the airflow. The drawing is sent back once with the
   reasons; a model with only small problems is kept on the second try. */

// soft and living things, and processes: a model made of simple solids would look wrong, so these are drawn flat
export const SOFT = /\b(heart|lungs?|brain|kidneys?|liver|stomach|intestines?|eyes?|ears?|skin|muscles?|bones?|skeleton|tooth|teeth|tongue|nerves?|neurons?|veins?|arter(y|ies)|blood|organs?|body|digestive|respiratory|circulatory|nervous system|cells?|bacteri\w*|virus\w*|dna|plants?|lea(f|ves)|flowers?|roots?|seeds?|trees?|animals?|insects?|fish|birds?|frogs?|butterfl\w*|dragons?|dinosaurs?|puso|baga|utak|halaman|dahon|bulaklak|hayop|cycle|photosynthesis|respiration|digestion|mitosis|meiosis|evaporation|erosion|food (chain|web)|ecosystem)\b/i;
export const wants3d = (text) => /\b3d\b|\bthree[\s-]?d\b|\bturn\s+it\s+around\b|\brotate\s+it\b|\bfrom\s+all\s+sides\b/i.test(String(text || ''));

const num = (v, lo, hi, d = 0) => { const n = +v; return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
const n3 = (v, d) => (Number.isFinite(+v) ? +v : d);
const kind = (s) => String((s && (s.t || s.type)) || '').toLowerCase();
export const SHAPES3D = ['cylinder', 'tube', 'disc', 'cone', 'sphere', 'box', 'torus', 'ring', 'blades', 'capsule', 'pipe', 'arrow', 'lathe', 'plate'];
const pts3 = (list) => (Array.isArray(list) ? list : []).slice(0, 10).filter((q) => Array.isArray(q) && q.length === 3 && q.every((v) => Number.isFinite(+v))).map((q) => q.map((v) => num(v, -20, 20)));
const pts2 = (list) => (Array.isArray(list) ? list : []).slice(0, 24).filter((q) => Array.isArray(q) && q.length === 2 && q.every((v) => Number.isFinite(+v))).map((q) => q.map((v) => num(v, -20, 20)));

// each shape's box (roughly, from its size and axis): a part's box is all its shapes; the model's is all parts
function box3(s) {
  const t = kind(s), axis = ['x', 'y', 'z'].includes(s.axis) ? s.axis : 'x';
  const pos = Array.isArray(s.pos) ? [0, 1, 2].map((k) => n3(s.pos[k], 0)) : [0, 0, 0];
  const r = Math.abs(n3(s.r, 0.5)), len = Math.abs(n3(s.len ?? s.h, 1));
  let along = 0, across = 0, half = null;
  if (t === 'cylinder' || t === 'tube') { along = len / 2; across = Math.max(r, Math.abs(n3(s.r2, r))); }
  else if (t === 'disc') { along = Math.abs(n3(s.thick ?? s.len, 0.08)) / 2; across = r; }
  else if (t === 'cone') { along = len / 2; across = r; }
  else if (t === 'torus' || t === 'ring') { const tb = Math.abs(n3(s.tube, 0.12)); along = tb; across = r + tb; }
  else if (t === 'blades') { along = Math.abs(n3(s.width, 0.18)) / 2; across = Math.abs(n3(s.hub, 0.12)) + Math.abs(n3(s.len, r)); }
  else if (t === 'sphere') half = [r, r, r];
  else if (t === 'box') { const sz = Array.isArray(s.size) ? s.size : [1, 1, 1]; half = [0, 1, 2].map((k) => Math.abs(n3(sz[k], 1)) / 2); }
  else if (t === 'capsule') { along = len / 2 + r; across = r; }
  else if (t === 'pipe' || t === 'arrow') {
    const pts = pts3(s.pts), w = Math.abs(n3(s.r, 0.06));
    if (pts.length < 2) return null;
    return [0, 1, 2].map((k) => pos[k] + Math.min(...pts.map((q) => q[k])) - w).concat([0, 1, 2].map((k) => pos[k] + Math.max(...pts.map((q) => q[k])) + w));
  } else if (t === 'lathe' || t === 'plate') {
    const pr = pts2(t === 'lathe' ? s.profile : s.outline);
    if (pr.length < (t === 'lathe' ? 2 : 3)) return null;
    const lo = [Math.min(...pr.map((q) => q[0])), Math.min(...pr.map((q) => q[1]))], hi = [Math.max(...pr.map((q) => q[0])), Math.max(...pr.map((q) => q[1]))];
    const k = { x: 0, y: 1, z: 2 }[axis], b = [0, 0, 0, 0, 0, 0];
    if (t === 'lathe') { [0, 1, 2].forEach((j) => { b[j] = j === k ? lo[1] : -hi[0]; b[j + 3] = j === k ? hi[1] : hi[0]; }); }
    else { const th = Math.abs(n3(s.thick, 0.1)) / 2, u = axis === 'x' ? 2 : 0, v = axis === 'y' ? 2 : 1; b[k] = -th; b[k + 3] = th; b[u] = lo[0]; b[u + 3] = hi[0]; b[v] = lo[1]; b[v + 3] = hi[1]; }
    return b.map((x, j) => x + pos[j % 3]);
  } else return null;
  if (!half) half = ['x', 'y', 'z'].map((a) => (a === axis ? along : across));
  return [pos[0] - half[0], pos[1] - half[1], pos[2] - half[2], pos[0] + half[0], pos[1] + half[1], pos[2] + half[2]];
}
const join3 = (bs) => bs.reduce((a, b) => (a ? [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2]), Math.max(a[3], b[3]), Math.max(a[4], b[4]), Math.max(a[5], b[5])] : b.slice()), null);
const gap3 = (a, b) => Math.hypot(...[0, 1, 2].map((k) => Math.max(0, a[k] - b[k + 3], b[k] - a[k + 3])));
const long3 = (b) => Math.max(b[3] - b[0], b[4] - b[1], b[5] - b[2]);

/* → { hard: [...], soft: [...] }: hard problems always send the model back; soft ones only on the first try */
export function problems3d(spec) {
  const hard = [], soft = [];
  const parts = spec.parts.map((p) => ({ p, b: join3((p.shapes || []).map(box3).filter(Boolean)) }));
  parts.filter((x) => !x.b).forEach((x) => hard.push(`"${x.p.label || x.p.id}" has no 3d shape the model can show`));
  const ok = parts.filter((x) => x.b);
  if (ok.length < 3) { hard.push('a model needs at least 3 parts, each with 3d shapes'); return { hard, soft }; }
  const all = join3(ok.map((x) => x.b)), L = long3(all) || 1;
  const name = (x) => `"${x.p.label || x.p.id}"`, byId = (id) => ok.find((x) => x.p.id === id || x.p.label === id);
  if (L > 12 || L < 2) hard.push(`the whole model is ${L.toFixed(1)} units long; make it about 6 units, centred on 0,0,0`);
  if (ok.some((x) => x.p.size == null)) soft.push('plan every part first: give each part "size" (how big it really is, its longest side, against the whole object, 0 to 1) and "inside" (the id of the part it sits in, or null)');
  const main = ['x', 'y', 'z'].includes(spec.axis) ? spec.axis : 'x';
  for (const x of ok) {
    const others = ok.filter((y) => y !== x);
    if (Math.min(...others.map((y) => gap3(x.b, y.b))) > L * 0.08) hard.push(`${name(x)} floats apart from the rest; in the real object it touches or sits inside the part it connects to, so move it there`);
    const home = x.p.inside && byId(x.p.inside);
    if (home && home !== x) { const pad = L * 0.04, b = x.b, h = home.b; if (b[0] < h[0] - pad || b[1] < h[1] - pad || b[2] < h[2] - pad || b[3] > h[3] + pad || b[4] > h[4] + pad || b[5] > h[5] + pad) soft.push(`${name(x)} should sit inside ${name(home)} (your plan says so) but it sticks out of it; make it smaller or move it in`); }
    if (x.p.size != null) { const real = long3(x.b) / L, want = x.p.size; if (real > want * 1.8 + 0.06 || real < want / 1.8 - 0.06) soft.push(`${name(x)} is drawn at ${Math.round(real * 100)}% of the whole object's size, but your plan says ${Math.round(want * 100)}%; give it its real size`); }
    for (const id of x.p.attached || []) { const y = byId(id); if (y && y !== x && gap3(x.b, y.b) > L * 0.05) soft.push(`${name(x)} should touch ${name(y)} but there is a gap between them`); }
    // facing the right way: a wheel turns on an axle across the vehicle; a fan's blades face along the airflow
    const label = String(x.p.label || x.p.id || ''), round = (x.p.shapes || []).filter((s) => /^(torus|ring|disc|cylinder)$/.test(kind(s)) && ['x', 'y', 'z'].includes(s.axis));
    if (/\b(wheels?|tyres?|tires?|gulong)\b/i.test(label) && !/\b(fly|steering|pin|water|ferris|color|colour)\s*wheel/i.test(label) && main !== 'y' && round.length) {
      const across = main === 'x' ? 'z' : 'x', wrong = round.find((s) => s.axis !== across);
      if (wrong) hard.push(`${name(x)} ${wrong.axis === 'y' ? 'lies flat' : 'faces along the vehicle'}: a wheel stands upright and turns on an axle across the vehicle, so give its round shapes "axis":"${across}"`);
    }
    if (/\b(compressor|turbine|propeller|propellor|fan)\b/i.test(label)) {
      const blades = (x.p.shapes || []).find((s) => kind(s) === 'blades' && ['x', 'y', 'z'].includes(s.axis) && s.axis !== main);
      if (blades) hard.push(`${name(x)}'s blades face the wrong way: they turn around the main shaft, so give them "axis":"${main}"`);
    }
  }
  return { hard: [...new Set(hard)].slice(0, 8), soft: [...new Set(soft)].slice(0, 8) };
}

export function drawPrompt3d({ question, context }, { clip, must }) {
  return `Build a 3D model to explain: "${clip(question, 200)}"${context ? `\nIt is from the student's reviewer: ${clip(context, 1200)}` : ''}

You are Cody, a careful tutor who explains by building a 3D model the student can turn, zoom, open and pull apart.
Students learn from this: every fact, label, direction and count MUST be correct. Show every main part a textbook figure of it shows, each in its real place.${must ? ` For this subject that means: ${must.join(', ')}.` : ''}
First think how the real object is built: its real parts, which part holds or contains which, how big each one is against the whole, and how they line up and connect. Then build the model to match that plan:
- every part touches or sits inside the part it connects to; nothing floats in the air
- parts that are inside a case are placed inside it, and the case is "shell": true so the student can open it
- real proportions: a part that is small in the real object is small here; a part inside another is smaller than it
- parts that turn get "spin": true; hot or glowing parts get "glow": true
- for something put together, a part may have "from":[x,y,z], an offset it slides in from as it is built, and "view":"front"|"back"|"left"|"right"|"top", the side to look at it from
Make it look like the real thing, not toy blocks: give every part its real colour and "finish":"metal"|"plastic"|"rubber"|"wood" (what it is really made of), and its real profile: a lathe for anything turned or rounded (a nozzle, a bottle, a nose cone, a wheel), a plate for a flat cut shape, a pipe for a hose, wire or tube, a capsule for a rounded body. A plain cylinder or box only where the real part is one.
Return JSON in exactly this shape:
{"title","mode":"3d","axis":the model's main length "x"|"y"|"z","intro":one sentence,"summary":one sentence,"parts":[{"id","label":1 to 3 words,"say":1 or 2 short sentences Cody says while building it,"color":"#hex","finish","inside":the id of the part it sits in, or null,"attached":[ids of the parts it touches],"size":how big it really is (its longest side) against the whole object, 0 to 1,"shell","spin","glow","shapes":[...]}]}
3 to 8 parts in building order, 1 to 8 shapes each. The whole model about 6 units long, centred on 0,0,0. Every shape has "pos":[x,y,z] and, when it has a length, "axis":"x"|"y"|"z".
Shapes ("t" is the kind): cylinder {r,r2,len,axis,pos,open,cut}, disc {r,thick,axis,pos}, cone {r,len,axis,pos,dir}, sphere {r,pos,cut}, box {size:[w,h,d],pos}, torus {r,tube,axis,pos}, blades {n,len,width,hub,axis,pos}, capsule {r,len,axis,pos}, pipe {pts:[[x,y,z],...],r} (a tube, hose or cable through 2 to 8 points), arrow {pts:[[x,y,z],...],r} (a flow or a push; its head is at the last point), lathe {profile:[[radius,along],...],axis,pos} (a profile turned round the axis), plate {outline:[[a,b],...],thick,axis,pos} (a flat shape cut from a sheet). Any shape may have "rot":[x,y,z] in radians and its own "color".
No dashes in the words. No emojis.`;
}

// what the AI wrote, made tidy for the app (the browser cleans it again before drawing)
export function tidy3d(j) {
  const words = (t, max) => String(t == null ? '' : t).replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
  const parts = (Array.isArray(j.parts) ? j.parts : []).slice(0, 10).filter((p) => p && Array.isArray(p.shapes)).map((p, i) => ({
    id: words(p.id, 40) || 'p' + i, label: words(p.label, 40), say: words(p.say, 360),
    color: typeof p.color === 'string' && /^#[0-9a-f]{3,8}$/i.test(p.color.trim()) ? p.color.trim() : '#60a5fa',
    finish: ['metal', 'plastic', 'rubber', 'wood'].includes(p.finish) ? p.finish : null,
    inside: words(p.inside, 40) || null,
    size: Number.isFinite(+p.size) && +p.size > 0 ? Math.min(1, +p.size) : null,
    attached: Array.isArray(p.attached) ? p.attached.slice(0, 6).map((x) => words(x, 40)).filter(Boolean) : [],
    shell: !!p.shell, spin: !!p.spin, glow: !!p.glow,
    from: Array.isArray(p.from) && p.from.length === 3 && p.from.every((v) => Number.isFinite(+v)) ? p.from.map((v) => num(v, -12, 12)) : null,
    view: ['front', 'back', 'left', 'right', 'side', 'top'].includes(p.view) ? p.view : null,
    shapes: p.shapes.slice(0, 8).filter((s) => s && typeof s === 'object' && SHAPES3D.includes(kind(s))),
  })).filter((p) => p.shapes.length);
  return { title: words(j.title, 90) || 'How it works', mode: '3d', axis: ['x', 'y', 'z'].includes(j.axis) ? j.axis : 'x', intro: words(j.intro, 300), summary: words(j.summary, 300), parts };
}
