/* Hand-drawn figures Cody always has, for things students often ask to see that are hard for an AI to
   draw accurately (an animal's anatomy). Same spec as every drawing (see draw.js): a 400 x 300 picture,
   parts in teaching order, each a shaded outline plus thin detail strokes. */

const C = { green: '#4ade80', teal: '#2dd4bf', bone: '#e2e8f0', yellow: '#fbbf24', orange: '#fb923c' };
const d = (s) => ({ t: 'path', d: s, sw: 1.4 }); // a thin detail line
const shape = (s) => ({ t: 'path', d: s, fill: true, sw: 2.4 }); // a shaded outline

// spines: small triangles along a list of [x, y, tilt] points on the back line
const spines = (pts, h) => pts.map(([x, y, a = 0]) => {
  const tx = x + Math.sin(a) * h, ty = y - Math.cos(a) * h;
  return `M ${x - 5} ${y + 1} L ${tx.toFixed(1)} ${ty.toFixed(1)} L ${x + 5} ${y + 1}`;
}).join(' ');

const dragon = {
  title: 'Dragon',
  solid: true,
  parts: [
    { id: 'head', label: 'Head', color: C.green, anchor: [66, 70], z: 6,
      say: 'A dragon is a creature from myths, so artists build it from real animals. Its head is long like a crocodile’s: a narrow snout with nostrils, a strong jaw, and an eye under a bony brow.',
      shapes: [
        shape('M 104 66 C 98 56 88 52 78 54 C 68 56 58 61 48 66 C 42 69 37 71 35 75 C 34 79 38 81 44 82 C 48 86 54 89 62 90 C 74 92 86 94 96 92 C 104 88 108 78 104 66 Z'),
        d('M 40 80 C 52 83 64 85 80 86'), // mouth line
        d('M 80 86 C 84 84 86 82 88 80'),
        d('M 72 64 C 76 61 82 61 86 64 C 82 67 76 67 72 64 Z'), // eye
        { t: 'circle', cx: 79, cy: 64, r: 1.6, fill: true, sw: 1 },
        d('M 68 59 C 74 55 84 55 90 59'), // brow ridge
        d('M 42 72 C 43 70 46 70 47 72'), // nostril
        d('M 46 82 l 2 3 M 54 84 l 2 3 M 62 85 l 1 3'), // teeth
        d('M 92 90 l 4 6 M 98 86 l 6 4'), // jaw frills
      ] },
    { id: 'horns', label: 'Horns', color: C.bone, anchor: [116, 40], z: 2,
      say: 'Two horns sweep back from the top of the skull, like a goat’s or an antelope’s.',
      shapes: [
        shape('M 92 62 C 100 50 112 40 130 32 C 122 42 114 52 106 66 Z'),
        shape('M 84 60 C 90 48 100 38 114 30 C 108 40 102 50 98 62 Z'),
        d('M 104 50 l 4 3 M 112 44 l 4 3'),
      ] },
    { id: 'neck', label: 'Neck', color: C.green, anchor: [124, 116], z: 3,
      say: 'A long, curved neck, like a snake’s, lets the head turn and reach. Wide scales run down the front of the throat.',
      shapes: [
        shape('M 94 62 C 112 74 126 90 140 108 C 150 120 162 128 178 134 L 168 180 C 148 172 134 158 124 144 C 114 128 102 110 88 90 Z'),
        d('M 100 98 l 8 -4 M 106 110 l 8 -5 M 112 122 l 9 -5 M 120 134 l 9 -6 M 128 146 l 10 -6 M 138 158 l 10 -6'), // throat scales
      ] },
    { id: 'body', label: 'Body', color: C.green, anchor: [204, 174], z: 4,
      say: 'The body is heavy and deep in the chest, like a big lizard’s. Wide belly scales protect its underside.',
      shapes: [
        shape('M 150 132 C 176 124 214 126 250 132 C 276 136 296 146 300 164 C 304 182 292 198 270 202 C 236 208 196 210 170 204 C 148 198 138 180 142 160 C 144 148 146 138 150 132 Z'),
        d('M 168 196 C 200 204 240 204 272 194'),
        d('M 180 186 l 2 12 M 196 188 l 1 13 M 212 189 l 0 13 M 228 189 l -1 13 M 244 187 l -2 12 M 258 184 l -3 11'), // belly scales
        d('M 184 152 q 4 -3 8 0 M 204 148 q 4 -3 8 0 M 224 148 q 4 -3 8 0 M 244 151 q 4 -3 8 0 M 194 166 q 4 -3 8 0 M 214 164 q 4 -3 8 0 M 234 165 q 4 -3 8 0'), // back scales
      ] },
    { id: 'wing', label: 'Wing', color: C.teal, anchor: [270, 76], z: 7,
      say: 'The wings are like a bat’s: an arm with very long finger bones, and thin skin stretched between them. They grow from the shoulders.',
      shapes: [
        shape('M 178 136 C 180 112 188 90 202 74 C 214 60 226 42 240 24 C 264 26 292 32 326 40 C 308 50 306 66 324 84 C 306 88 298 102 306 120 C 288 116 276 124 274 140 C 262 130 250 130 240 138 C 224 130 204 130 178 136 Z'),
        d('M 178 136 C 180 112 188 90 202 74 C 214 60 226 42 240 24'), // arm bone
        d('M 240 24 Q 284 28 326 40 M 240 24 Q 286 52 324 84 M 240 24 Q 276 70 306 120 M 240 24 Q 258 84 274 140'), // finger bones
        d('M 240 24 c -4 -4 -8 -6 -12 -6 c 4 2 6 4 7 8'), // thumb claw
        d('M 202 74 C 210 96 222 118 240 138'), // fold of skin
      ] },
    { id: 'legs', label: 'Legs', color: C.green, anchor: [290, 222], z: 5,
      say: 'Four strong legs. The back legs bend like a dog’s or a cat’s: thick thighs, then a high ankle, so it walks on its toes.',
      shapes: [
        // far legs first, behind the body
        shape('M 196 196 C 192 214 194 230 196 244 C 190 250 182 254 180 258 L 204 258 C 208 246 210 228 214 204 Z'),
        // near front leg
        shape('M 156 176 C 146 194 148 212 154 226 C 156 236 154 244 146 250 C 140 254 136 256 136 259 L 168 259 C 170 248 170 236 168 224 C 172 210 180 198 186 188 C 184 176 172 168 156 176 Z'),
        // near back leg: thigh, knee forward, ankle back, foot forward
        shape('M 250 164 C 238 182 242 202 258 210 C 266 218 274 228 284 236 C 286 244 280 250 270 254 C 264 256 260 258 260 260 L 298 260 C 302 250 302 240 300 228 C 298 216 298 204 302 192 C 304 176 296 160 280 156 C 268 154 256 156 250 164 Z'),
        d('M 136 259 l -4 4 M 146 259 l -3 5 M 156 259 l -1 5 M 260 260 l -4 4 M 272 260 l -3 5 M 284 260 l -1 5 M 180 258 l -4 4 M 190 258 l -3 4'), // claws
        d('M 262 186 C 268 196 276 200 286 198'), // thigh muscle
      ] },
    { id: 'tail', label: 'Tail', color: C.green, anchor: [350, 210], z: 1,
      say: 'A long tail, thick at the base and thin at the tip, helps it balance and steer. This one ends in a spade.',
      shapes: [
        shape('M 270 140 C 316 146 342 170 356 196 C 364 212 372 220 382 220 C 378 230 370 234 360 230 C 348 224 340 210 332 196 C 322 182 306 178 280 192 Z'),
        shape('M 376 222 C 384 214 392 206 398 196 C 398 210 396 224 388 236 C 382 236 376 234 370 230 C 374 228 376 226 376 222 Z'),
        d('M 316 162 l 2 10 M 332 172 l 0 10 M 344 186 l -2 9 M 354 202 l -3 8'),
      ] },
    { id: 'spines', label: 'Spines', color: C.yellow, anchor: [329, 157], z: 0,
      say: 'A row of spines runs from the back of the head, down the neck and back, to the tail, like an iguana’s crest.',
      shapes: [
        { t: 'path', fill: true, sw: 1.6, d: spines([[108, 72, 0.6], [118, 86, 0.6], [128, 98, 0.65], [138, 110, 0.7], [150, 122, 0.6], [166, 128, 0.2], [184, 127, 0], [252, 132, 0], [270, 137, 0.15], [288, 145, 0.3], [308, 153, 0.5], [324, 164, 0.7], [338, 177, 0.8], [350, 192, 0.8]], 10) },
      ] },
  ],
};

/* Hand-built 3D models for the examples on Draw with Cody, so they always work, even with no internet or AI.
   Same spec as an AI model (see lib/model3d.js): about 6 units long, centred on 0,0,0, parts in building order. */
const L = (x0, y0, z0, x1, y1, z1, r) => ({ t: 'pipe', pts: [[x0, y0, z0], [x1, y1, z1]], r });
const wheelAt = (x) => [
  { t: 'torus', r: 0.95, tube: 0.075, axis: 'z', pos: [x, 0, 0] }, // tyre
  { t: 'torus', r: 0.86, tube: 0.03, axis: 'z', pos: [x, 0, 0], color: '#cbd5e1' }, // rim
  { t: 'blades', n: 16, len: 0.78, width: 0.012, hub: 0.06, axis: 'z', pos: [x, 0, 0], color: '#e2e8f0' }, // spokes
  { t: 'cylinder', r: 0.07, len: 0.22, axis: 'z', pos: [x, 0, 0], color: '#94a3b8' }, // hub
];
const bicycle = {
  title: 'A bicycle', mode: '3d', axis: 'x',
  intro: 'Let us build a bicycle and see how the push of your legs turns its wheels.',
  summary: 'Your feet push the pedals, the cranks turn the chainring, the chain pulls the back wheel round, and the bike rolls forward.',
  parts: [
    { id: 'frame', label: 'Frame', color: '#ef4444', finish: 'metal', size: 0.55, inside: null, attached: ['fork', 'wheels', 'cranks', 'seat'],
      say: 'The frame is a diamond of strong metal tubes. Triangles do not bend easily, so the frame holds every other part firmly.',
      shapes: [L(-0.3, -0.15, 0, -0.75, 1.35, 0, 0.06), L(-0.75, 1.35, 0, 1.05, 1.3, 0, 0.055), L(-0.3, -0.15, 0, 1.2, 0.85, 0, 0.065), L(1.05, 1.3, 0, 1.2, 0.85, 0, 0.07),
        L(-0.3, -0.15, 0.1, -1.7, 0, 0.1, 0.035), L(-0.3, -0.15, -0.1, -1.7, 0, -0.1, 0.035), L(-0.72, 1.25, 0.06, -1.7, 0, 0.1, 0.03), L(-0.72, 1.25, -0.06, -1.7, 0, -0.1, 0.03)] },
    { id: 'wheels', label: 'Wheels', color: '#1f2937', finish: 'rubber', size: 1, inside: null, attached: ['frame', 'fork'], spin: true,
      say: 'Two wheels stand upright and turn on axles. Rubber tyres grip the road, and thin spokes keep each rim round and strong.',
      shapes: [...wheelAt(-1.7), ...wheelAt(1.7)] },
    { id: 'fork', label: 'Front fork', color: '#cbd5e1', finish: 'metal', size: 0.24, inside: null, attached: ['frame', 'wheels', 'handlebars'],
      say: 'The fork holds the front wheel on both sides. It turns inside the frame, so the front wheel can steer.',
      shapes: [{ t: 'pipe', pts: [[1.2, 0.85, 0.1], [1.45, 0.4, 0.11], [1.7, 0, 0.1]], r: 0.035 }, { t: 'pipe', pts: [[1.2, 0.85, -0.1], [1.45, 0.4, -0.11], [1.7, 0, -0.1]], r: 0.035 }, L(1.2, 0.85, -0.11, 1.2, 0.85, 0.11, 0.04), L(1.21, 0.82, 0, 1.04, 1.33, 0, 0.03)] },
    { id: 'handlebars', label: 'Handlebars', color: '#94a3b8', finish: 'metal', size: 0.2, inside: null, attached: ['fork'],
      say: 'Turn the handlebars and the fork turns the front wheel. That is how you steer.',
      shapes: [{ t: 'pipe', pts: [[1.05, 1.3, 0], [1.0, 1.55, 0], [1.15, 1.6, 0]], r: 0.04 }, L(1.15, 1.6, -0.45, 1.15, 1.6, 0.45, 0.035),
        { t: 'capsule', r: 0.05, len: 0.18, axis: 'z', pos: [1.15, 1.6, 0.45], color: '#111827' }, { t: 'capsule', r: 0.05, len: 0.18, axis: 'z', pos: [1.15, 1.6, -0.45], color: '#111827' }] },
    { id: 'seat', label: 'Seat', color: '#111827', finish: 'plastic', size: 0.1, inside: null, attached: ['frame'],
      say: 'The seat sits on a post that slides into the frame, so it can be raised or lowered to fit the rider.',
      shapes: [L(-0.75, 1.35, 0, -0.8, 1.6, 0, 0.035), { t: 'capsule', r: 0.08, len: 0.32, axis: 'x', pos: [-0.78, 1.66, 0], rot: [0, 0, 0.05] }] },
    { id: 'cranks', label: 'Pedals and cranks', color: '#64748b', finish: 'metal', size: 0.2, inside: null, attached: ['frame', 'chain'],
      say: 'Your feet push the pedals round in a circle. The cranks turn the big toothed chainring.',
      shapes: [{ t: 'disc', r: 0.32, thick: 0.03, axis: 'z', pos: [-0.3, -0.15, 0.17], color: '#cbd5e1' }, L(-0.3, -0.15, 0.22, -0.3, -0.62, 0.22, 0.03), L(-0.3, -0.15, -0.22, -0.3, 0.32, -0.22, 0.03),
        { t: 'box', size: [0.26, 0.05, 0.16], pos: [-0.3, -0.62, 0.32], color: '#111827' }, { t: 'box', size: [0.26, 0.05, 0.16], pos: [-0.3, 0.32, -0.32], color: '#111827' }] },
    { id: 'chain', label: 'Chain', color: '#475569', finish: 'metal', size: 0.36, inside: null, attached: ['cranks', 'wheels'],
      say: 'The chain wraps round the chainring and a small gear on the back wheel. When the pedals turn, the chain pulls the back wheel round.',
      shapes: [{ t: 'pipe', pts: [[-0.3, 0.17, 0.17], [-1.7, 0.13, 0.17], [-1.84, 0, 0.17], [-1.7, -0.13, 0.17], [-0.3, -0.47, 0.17], [0.03, -0.15, 0.17], [-0.3, 0.17, 0.17]], r: 0.02 },
        { t: 'disc', r: 0.13, thick: 0.03, axis: 'z', pos: [-1.7, 0, 0.17], color: '#cbd5e1' }] },
  ],
};

const jetEngine = {
  title: 'A jet engine', mode: '3d', axis: 'x',
  intro: 'Let us build a jet engine and follow the air as it goes through, from the front to the back.',
  summary: 'The fan and compressor suck in and squeeze air, fuel burns in it, the hot gas spins the turbine, and it rushes out of the nozzle, pushing the plane forward.',
  parts: [
    { id: 'cowling', label: 'Cowling', color: '#e2e8f0', finish: 'metal', size: 0.62, inside: null, attached: ['fan', 'nozzle'], shell: true,
      say: 'The cowling is the smooth outer case. It guides the air in and protects the parts inside. Open it up to see them.',
      shapes: [{ t: 'lathe', profile: [[1.18, -3.0], [1.3, -2.75], [1.32, -2.0], [1.25, -0.6], [1.08, 0.6], [0.98, 1.1]], axis: 'x', pos: [0, 0, 0] }] },
    { id: 'fan', label: 'Fan', color: '#94a3b8', finish: 'metal', size: 0.42, inside: 'cowling', attached: ['shaft', 'compressor'], spin: true,
      say: 'The big fan at the front sucks in huge amounts of air. Most of it flows around the engine core and gives much of the push.',
      shapes: [{ t: 'blades', n: 20, len: 0.86, width: 0.32, hub: 0.3, axis: 'x', pos: [-2.35, 0, 0] }, { t: 'cone', r: 0.32, len: 0.55, axis: 'x', dir: -1, pos: [-2.75, 0, 0], color: '#cbd5e1' }] },
    { id: 'compressor', label: 'Compressor', color: '#a3b1c2', finish: 'metal', size: 0.32, inside: 'cowling', attached: ['fan', 'combustor', 'shaft'], spin: true,
      say: 'Rows of smaller blades squeeze the air tighter and tighter. Squeezed air holds more oxygen for burning.',
      shapes: [{ t: 'cylinder', r: 0.34, r2: 0.3, len: 1.3, axis: 'x', pos: [-1.35, 0, 0] }, ...[[-1.9, 0.58], [-1.55, 0.52], [-1.2, 0.46], [-0.85, 0.4]].map(([x, l]) => ({ t: 'blades', n: 26, len: l, width: 0.14, hub: 0.3, axis: 'x', pos: [x, 0, 0] }))] },
    { id: 'shaft', label: 'Shaft', color: '#475569', finish: 'metal', size: 0.6, inside: 'cowling', attached: ['fan', 'compressor', 'turbine'], spin: true,
      say: 'One long shaft joins the turbine at the back to the compressor and fan at the front, so they all turn together.',
      shapes: [{ t: 'cylinder', r: 0.09, len: 4.0, axis: 'x', pos: [-0.75, 0, 0] }] },
    { id: 'combustor', label: 'Combustion chamber', color: '#fb923c', finish: 'metal', size: 0.24, inside: 'cowling', attached: ['compressor', 'turbine'], glow: true,
      say: 'Here fuel is sprayed into the squeezed air and burns. The gas gets very hot and expands with great force.',
      shapes: [{ t: 'torus', r: 0.5, tube: 0.16, axis: 'x', pos: [-0.3, 0, 0] }, { t: 'torus', r: 0.5, tube: 0.16, axis: 'x', pos: [0.05, 0, 0] }, { t: 'cylinder', r: 0.42, len: 0.7, axis: 'x', pos: [-0.12, 0, 0], open: true }] },
    { id: 'turbine', label: 'Turbine', color: '#64748b', finish: 'metal', size: 0.28, inside: 'cowling', attached: ['combustor', 'shaft', 'nozzle'], spin: true,
      say: 'The hot gas rushes past the turbine blades and spins them, like wind spins a pinwheel. The turbine turns the shaft.',
      shapes: [{ t: 'disc', r: 0.3, thick: 0.5, axis: 'x', pos: [0.6, 0, 0] }, { t: 'blades', n: 30, len: 0.44, width: 0.13, hub: 0.28, axis: 'x', pos: [0.45, 0, 0] }, { t: 'blades', n: 30, len: 0.5, width: 0.13, hub: 0.28, axis: 'x', pos: [0.75, 0, 0] }] },
    { id: 'nozzle', label: 'Nozzle', color: '#334155', finish: 'metal', size: 0.26, inside: null, attached: ['cowling', 'turbine'],
      say: 'The nozzle narrows at the back, so the hot gas shoots out very fast. Pushing gas backward pushes the plane forward.',
      shapes: [{ t: 'lathe', profile: [[0.98, 1.05], [0.88, 1.7], [0.62, 2.5]], axis: 'x', pos: [0, 0, 0] }, { t: 'cone', r: 0.28, len: 0.9, axis: 'x', dir: 1, pos: [1.4, 0, 0], color: '#64748b' }] },
  ],
};

const FIGURES = [
  [/\bdragons?\b|\bdragon'?s\b|\bdrag[oó]n\b/i, dragon],
];
const FIGURES3D = [
  [/\b(bicycles?|bikes?|bisikleta)\b/i, bicycle],
  [/\bjet\s*engines?\b|\bturbofans?\b|\bjet\s*turbines?\b/i, jetEngine],
];

// a hand-made figure for this question (a flat drawing, or a 3D model when mode is '3d'), or null
export function figureFor(text, mode = '2d') {
  const t = String(text || '');
  const hit = (mode === '3d' ? FIGURES3D : FIGURES).find(([re]) => re.test(t));
  return hit ? hit[1] : null;
}
