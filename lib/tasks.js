/* What Cody asks the AI for, and how each answer is checked before it reaches the app.
   The prompts live on the server, so the API keys can only ever be used for Cody's own jobs. */

const clip = (t, n) => String(t == null ? '' : t).replace(/\s+/g, ' ').trim().slice(0, n);

export const SYSTEM = `You are Cody, a friendly study buddy for Filipino students (high school and college).
You turn the student's own notes into study material. Use simple, clear English a 14 year old understands.
Stay true to the notes: do not add facts that are not in them unless they are basic, well known textbook facts
needed to make sense. If the notes are in Filipino or Taglish, you may keep key terms in the language used.
Always answer with ONE JSON object and nothing else: no markdown, no code fences.`;

// ---------- 1. a reviewer from notes ----------
export function reviewerPrompt({ notes, fileName }) {
  return `Make a reviewer from the student's notes${fileName ? ` (from the file "${clip(fileName, 80)}")` : ''}.

Return JSON in exactly this shape:
{
  "title": "short topic title, e.g. The human heart",
  "subject": "school subject, e.g. Biology",
  "summary": "2 to 3 sentences that explain the whole topic simply",
  "terms": [{ "term": "Atria", "meaning": "one or two short sentences" }],
  "questions": ["three short practice questions"],
  "quiz": [{ "q": "question", "choices": ["A", "B", "C", "D"], "a": 1, "why": "one or two sentences on why the answer is right", "term": "the key term it is about" }],
  "cards": [{ "front": "a term or short question", "back": "the answer in one or two sentences" }],
  "drawable": "if a labelled diagram would help (an organ, a cycle, a process, a structure, a machine), name it in a few words, e.g. 'the human heart'; otherwise an empty string"
}
Rules: 5 to 10 terms (the most important ones); exactly 10 quiz questions with 4 choices each, "a" is the index (0 to 3)
of the right choice, and spread the right answers across positions; 8 to 15 cards; wrong choices must be believable.

${notes ? `NOTES:\n"""\n${clip(notes, 24000)}\n"""` : 'The notes are in the attached file.'}`;
}
export function checkReviewer(j) {
  if (!j || typeof j !== 'object') return null;
  const terms = (Array.isArray(j.terms) ? j.terms : []).map((t) => ({ term: clip(t && t.term, 60), meaning: clip(t && t.meaning, 300) })).filter((t) => t.term && t.meaning).slice(0, 12);
  const quiz = (Array.isArray(j.quiz) ? j.quiz : []).map((q) => {
    const choices = (Array.isArray(q && q.choices) ? q.choices : []).map((c) => clip(c, 140)).filter(Boolean).slice(0, 4);
    const a = Number.isInteger(+q.a) ? +q.a : -1;
    return { q: clip(q && q.q, 240), choices, a, why: clip(q && q.why, 400), term: clip(q && q.term, 60) };
  }).filter((q) => q.q && q.choices.length === 4 && q.a >= 0 && q.a < 4).slice(0, 12);
  const cards = (Array.isArray(j.cards) ? j.cards : []).map((c) => ({ front: clip(c && c.front, 120), back: clip(c && c.back, 300) })).filter((c) => c.front && c.back).slice(0, 20);
  if (terms.length < 2 || quiz.length < 3) return null;
  return {
    title: clip(j.title, 80) || 'My reviewer', subject: clip(j.subject, 40), summary: clip(j.summary, 600),
    terms, quiz, cards: cards.length ? cards : terms.map((t) => ({ front: t.term, back: t.meaning })),
    questions: (Array.isArray(j.questions) ? j.questions : []).map((q) => clip(q, 200)).filter(Boolean).slice(0, 3),
    drawable: clip(j.drawable, 80),
  };
}

// ---------- 2. a drawing, part by part ----------
// what a textbook figure of a common topic must show (from Cassie's livedraw.js)
const MUST = [
  [/\bheart\b|\bpuso\b/i, ['right atrium', 'left atrium', 'right ventricle', 'left ventricle', 'aorta', 'septum', 'valves']],
  [/water cycle|hydrolog/i, ['sun', 'evaporation', 'condensation', 'precipitation', 'collection']],
  [/photosynth/i, ['sunlight', 'leaf', 'carbon dioxide', 'water', 'oxygen', 'glucose']],
  [/plant cell/i, ['cell wall', 'cell membrane', 'nucleus', 'vacuole', 'chloroplast', 'mitochondrion']],
  [/animal cell/i, ['cell membrane', 'nucleus', 'cytoplasm', 'mitochondrion', 'ribosome']],
  [/volcano|bulkan/i, ['magma chamber', 'vent', 'crater', 'lava', 'ash cloud']],
  [/flower|bulaklak/i, ['petal', 'sepal', 'stamen', 'pistil', 'ovary', 'stem']],
  [/lungs?|respiratory/i, ['trachea', 'bronchi', 'lungs', 'alveoli', 'diaphragm']],
  [/\beye\b/i, ['cornea', 'iris', 'pupil', 'lens', 'retina', 'optic nerve']],
  [/digestive/i, ['mouth', 'esophagus', 'stomach', 'liver', 'small intestine', 'large intestine']],
  [/circuit/i, ['battery', 'wire', 'switch', 'bulb', 'current']],
  [/\batom\b/i, ['nucleus', 'proton', 'neutron', 'electron', 'shell']],
  [/layers of the earth|earth.?s layers|inside the earth/i, ['crust', 'mantle', 'outer core', 'inner core']],
];
export function drawPrompt({ question, context }) {
  const must = MUST.find(([re]) => re.test(question));
  return `Draw and explain: "${clip(question, 200)}"${context ? `\nIt is from the student's reviewer: ${clip(context, 1200)}` : ''}

You draw on a dark board, 400 wide and 300 tall (x from 0 to 400 left to right, y from 0 to 300 top to bottom).
Draw it like a clear, simple textbook figure, part by part, in teaching order: each part is one step.
Return JSON in exactly this shape:
{
  "title": "short title",
  "parts": [
    {
      "id": "short-id",
      "label": "Name of the part (1 to 3 words)",
      "say": "one or two short sentences Cody says while drawing this part",
      "color": "#hex",
      "anchor": [x, y],
      "shapes": [ ... ]
    }
  ]
}
Shapes (strokes only, no fills):
  {"t":"path","d":"M 10 20 Q 40 0 70 20 L 90 60 Z"}   (SVG path letters M L Q C A Z with absolute numbers)
  {"t":"arrow","d":"M 140 240 L 140 140"}              (a path with an arrow head at its end)
  {"t":"circle","cx":80,"cy":70,"r":24}   {"t":"ellipse","cx":200,"cy":120,"rx":30,"ry":16}
  {"t":"rect","x":70,"y":30,"width":260,"height":240,"rx":16}   {"t":"text","x":40,"y":160,"text":"CO2"}
  add "dash": true for a dashed line, "sw": 4 for a thicker stroke.
Rules:
- 4 to 9 parts. Each part needs at least one shape; draw real outlines with paths, not just circles and boxes.
- Use the whole board; keep everything between x 10..390 and y 10..290. Parts must not pile up in one corner.
- "anchor" is a point ON the part's own main shape: the label line points there and students drop the name there.
  Anchors of different parts must be at least 30 apart.
- Do not write the part names as text shapes (labels are added for you); text shapes are only for short symbols like CO2.
- Arrows for things that rise point up (end y smaller); arrows for things that fall point down.
- Colours on a dark board: #60a5fa blue, #f7687f pink-red, #2dd4bf teal, #fbbf24 yellow, #a78bfa purple, #4ade80 green, #fb923c orange, #e2e8f0 white.
${must ? `- A textbook figure of this shows these parts, so include each as its own part: ${must[1].join(', ')}.` : ''}`;
}
export function checkDrawing(j) {
  if (!j || !Array.isArray(j.parts)) return { ok: false, why: 'no parts' };
  const parts = j.parts.filter((p) => p && Array.isArray(p.shapes) && p.shapes.length);
  if (parts.length < 3) return { ok: false, why: 'it needs at least 3 parts, each with shapes' };
  const anchors = parts.map((p) => (Array.isArray(p.anchor) ? p.anchor.map(Number) : null));
  if (anchors.some((a) => !a || a.some((v) => !Number.isFinite(v) || v < 0 || v > 400))) return { ok: false, why: 'every part needs an anchor [x, y] inside the board' };
  const xs = anchors.map((a) => a[0]), ys = anchors.map((a) => a[1]);
  if ((Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys)) < 400 * 300 * 0.08) return { ok: false, why: 'everything is piled into one small area; spread the drawing across the board' };
  return { ok: true, spec: { title: clip(j.title, 80), parts } };
}

// ---------- 3. explain more ----------
export function explainPrompt({ question, answer, why, topic }) {
  return `A student is studying "${clip(topic, 80)}". Quiz question: "${clip(question, 240)}". The right answer is "${clip(answer, 140)}".
The short reason was: "${clip(why, 400)}".
Explain it more, so it really clicks: an everyday example (a Filipino one if it fits), then a tip to remember it.
Return JSON: { "text": "3 to 5 short sentences" }`;
}
export const checkExplain = (j) => (j && j.text ? { text: clip(j.text, 1200) } : null);
