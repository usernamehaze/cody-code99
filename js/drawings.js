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

const FIGURES = [
  [/\bdragons?\b|\bdragon'?s\b|\bdrag[oó]n\b/i, dragon],
];

// a hand-drawn figure for this question, or null
export function figureFor(text) {
  const t = String(text || '');
  const hit = FIGURES.find(([re]) => re.test(t));
  return hit ? hit[1] : null;
}
