import '../js/care.js'; // the care check and its instruction (shared with the app)
import { SOFT, problems3d, drawPrompt3d, tidy3d } from './model3d.js';

/* What Cody asks the AI for, and how each answer is checked before it reaches the app.
   The prompts live on the server, so the API keys can only ever be used for Cody's own jobs. */

const clip = (t, n) => String(t == null ? '' : t).replace(/\s+/g, ' ').trim().slice(0, n);

export const SYSTEM = () => `You are Cody, a friendly study buddy for Filipino students (high school and college).
You turn the student's own notes into study material. Use simple, clear English a 14 year old understands.
Stay true to the notes: do not add facts that are not in them unless they are basic, well known textbook facts
needed to make sense. If the notes are in Filipino or Taglish, you may keep key terms in the language used.
Always answer with ONE JSON object and nothing else: no markdown, no code fences.
Write without emojis, and without en or em dashes: use a comma, a colon, brackets or "to" instead.
${SAFE}`;

// every answer, cleaned the same way in case the AI forgets: no emojis, and no en or em dashes
// ("1990–1995" becomes "1990-1995"; "the heart — a pump" becomes "the heart, a pump")
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2300}-\u{23FF}\u{FE0F}\u{200D}\u{20E3}]/gu;
const plainText = (t) => t.replace(new RegExp(`(^|\\s)${EMOJI.source}+[ \\t]+`, 'gmu'), '$1').replace(new RegExp(`[ \\t]*${EMOJI.source}+(?=[.,!?]|$)`, 'gmu'), '').replace(EMOJI, '')
  .replace(/(\d)\s*[\u2013\u2014]\s*(\d)/g, '$1-$2')
  .replace(/\s*[\u2013\u2014]+\s*/g, ', ')
  .replace(/,\s*([,.;:!?)])/g, '$1').replace(/^\s*,\s*/gm, '').replace(/(\S)[ \t]{2,}/g, '$1 ');
export const plain = (x) => (typeof x === 'string' ? plainText(x)
  : Array.isArray(x) ? x.map(plain)
  : x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, plain(v)])) : x);

// Code 99's rules: safe and appropriate for a general audience (students), no NSFW content, no excessive
// violence, and no controversial political or religious themes. Studying such a topic stays allowed, neutrally.
export const SAFE = `Keep everything safe and appropriate for students of any age:
- No sexual or explicit content, and no graphic or gory violence. If asked for it, kindly decline in one sentence and offer to help with schoolwork.
- On political or religious topics, teach only what is in the student's notes or the textbook, neutrally and respectfully: explain what each side or tradition holds, never which one is right, never campaign, never mock a belief or a group.
- No hate, bullying, insults, or instructions for anything dangerous or illegal.`;

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
Accuracy: every right answer must match the notes exactly; never add a fact, link or list item the notes don't have, and keep names, dates and numbers exactly as written.

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
// "3d" for a real object the student wants to turn and open; soft and living things and processes stay flat
export const drawMode = (question, asked) => (asked === '3d' && !SOFT.test(String(question || '')) ? '3d' : '2d');
export function drawPrompt({ question, context, mode }) {
  const must = MUST.find(([re]) => re.test(question));
  if (mode === '3d') return drawPrompt3d({ question, context }, { clip, must: must && must[1] });
  return `Draw and explain: "${clip(question, 200)}"${context ? `\nIt is from the student's reviewer: ${clip(context, 1200)}` : ''}

You draw on a dark board, 400 wide and 300 tall (x from 0 to 400 left to right, y from 0 to 300 top to bottom).
Draw it like a realistic 2D illustration from a good textbook or encyclopedia: the real shape and proportions of the thing,
as an artist would draw it, not a diagram of boxes, circles and stick lines. Draw it part by part, in teaching order: each part is one step.
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
Shapes:
  {"t":"path","d":"M 120 80 C 140 60 180 58 200 74 C 214 86 210 110 192 118 Z","fill":true}   (SVG path letters M L C Q S A Z, absolute numbers)
  {"t":"arrow","d":"M 140 240 L 140 140"}              (a path with an arrow head at its end)
  {"t":"circle","cx":80,"cy":70,"r":24}   {"t":"ellipse","cx":200,"cy":120,"rx":30,"ry":16}
  {"t":"rect","x":70,"y":30,"width":260,"height":240,"rx":16}   {"t":"text","x":40,"y":160,"text":"CO2"}
  "fill": true shades the inside of a closed shape softly in the part's colour. "sw": stroke width (1 to 6, default 3).
  "dash": true for a dashed line.
How to make it look real:
- Each part's first shape is its OUTLINE: one closed path ("Z" at the end) with "fill": true that follows the true silhouette,
  built from smooth curves (C or Q), with enough points to show its real form: an animal's head has a snout, jaw, brow and ears or horns;
  a leaf has a pointed tip, a stalk and a slightly wavy edge; an organ has its real lumpy shape, not an oval.
- Then add 2 to 8 DETAIL strokes with "sw": 1.5 inside or along the outline: folds, muscles, scales, veins, claws, eyes, nostrils,
  wing bones, membranes, texture, a shading line along the underside. Details make it look drawn by hand.
- Parts join the way they do in real life: a neck flows out of the body, legs attach under the body with a thigh, knee and foot,
  a wing grows from the shoulder. Shapes overlap a little at joints; there are no gaps and nothing floats.
- Use a clear side view or three-quarter view. Real proportions: big things big, small things small.
- An animal or a creature follows real anatomy: a skull with a snout and jaw, a neck that joins the chest, a ribcage-deep chest,
  shoulders and hips where the legs attach, legs that bend at the right joints (a cat's or a dog's back leg bends forward at the knee
  and back at the high ankle), toes or claws, and a tail that tapers. A myth creature is built from real animals (a dragon: a crocodile's
  head, a lizard's body, a bat's wings with long finger bones and skin between them, an iguana's spines).
- Add "z" to a part to stack it (bigger is in front): legs and head in front of the body, tail and spines behind it.
- Use rect, circle and ellipse only for things that really have that shape (a battery, a pupil, the sun). Never draw a body, a head,
  an organ or a leaf as a rectangle, circle or ellipse.
- A cycle or a process is drawn as a real scene (real clouds, mountains, sea, a real leaf or plant) with arrows for the flow.
Rules:
- 4 to 9 parts, in teaching order. Every part needs an outline shape.
- Use the whole board; keep everything between x 10..390 and y 10..290. The picture is big and centred, not piled in a corner.
- "anchor" is a point ON the part's own main shape: the label line points there and students drop the name there.
  Anchors of different parts must be at least 30 apart.
- Do not write the part names as text shapes (labels are added for you); text shapes are only for short symbols like CO2.
- Arrows for things that rise point up (end y smaller); arrows for things that fall point down.
- Colours on a dark board, a natural one for each part where it fits: #60a5fa blue, #f7687f pink-red, #2dd4bf teal, #fbbf24 yellow,
  #a78bfa purple, #4ade80 green, #fb923c orange, #e2e8f0 white, #c08457 brown, #94a3b8 grey.
${must ? `- A textbook figure of this shows these parts, so include each as its own part: ${must[1].join(', ')}.` : ''}`;
}
// (from Cassie) an arrow that says "falls" must point down, and one that says "rises" must point up
const FALLS = /\b(falls?|falling|rain|precipitat|sinks?|sinking|drops? down|downward|flows? down|gravity|weight)\b/i;
const RISES = /\b(rises?|rising|evaporat|transpir|goes up|upward|lifts?|lift|floats? up|buoyan)\b/i;
const ends = (d) => { const v = (String(d).match(/-?\d*\.?\d+/g) || []).map(Number); return v.length >= 4 ? [v[1], v[v.length - 1]] : null; };
function wrongWay(p) {
  const dys = (p.shapes || []).filter((sh) => sh && sh.t === 'arrow' && typeof sh.d === 'string').map((sh) => ends(sh.d)).filter(Boolean).map(([a, b]) => b - a).filter((dy) => Math.abs(dy) > 6);
  if (!dys.length) return '';
  const name = `${p.label || ''} ${p.id || ''}`, all = `${name} ${p.say || ''}`;
  const down = FALLS.test(name) || (FALLS.test(all) && !RISES.test(all)), up = RISES.test(name) || (RISES.test(all) && !FALLS.test(all));
  if (down && !up && dys.every((dy) => dy < 0)) return `"${p.label || p.id}" says it goes down, but its arrows point up; turn them round so the head is lower than the tail`;
  if (up && !down && dys.every((dy) => dy > 0)) return `"${p.label || p.id}" says it goes up, but its arrows point down; turn them round so the head is higher than the tail`;
  return '';
}
// (from Cassie) the box a shape covers, to check that a part's anchor is on the part
function shapeBox(sh) {
  if (!sh) return null;
  if (typeof sh.d === 'string') { const v = (sh.d.match(/-?\d*\.?\d+/g) || []).map(Number); const xs = v.filter((_, k) => k % 2 === 0), ys = v.filter((_, k) => k % 2 === 1); return xs.length && ys.length ? [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] : null; }
  if (sh.cx != null) { const rx = +(sh.rx ?? sh.r), ry = +(sh.ry ?? sh.r); return [sh.cx - rx, sh.cy - ry, +sh.cx + rx, +sh.cy + ry]; }
  if (sh.width != null) return [+sh.x, +sh.y, +sh.x + +sh.width, +sh.y + +sh.height];
  return null;
}
// (from Cassie) a real heart is a rounded cone with its point down and to the left, never the valentine symbol
function valentine(sh) {
  if (!sh || typeof sh.d !== 'string') return false;
  const v = (sh.d.match(/-?\d*\.?\d+/g) || []).map(Number), pts = []; for (let k = 0; k + 1 < v.length; k += 2) pts.push([v[k], v[k + 1]]);
  if (pts.length < 6) return false;
  const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), w = x1 - x0, h = y1 - y0, cx = (x0 + x1) / 2;
  if (w < 40 || h < 40) return false;
  const low = pts.find((q) => q[1] === y1);
  if (Math.abs(low[0] - cx) > w * 0.12) return false;
  return pts.some(([x, y]) => Math.abs(x - cx) < w * 0.08 && y - y0 > h * 0.06 && y - y0 < h * 0.4 && pts.some((q) => q[0] < x - w * 0.15 && q[1] < y - h * 0.04) && pts.some((q) => q[0] > x + w * 0.15 && q[1] < y - h * 0.04));
}
/* checkDrawing(j, attempt, question): a flat drawing or a 3D model. Big problems always send it back; the smaller ones
   Cassie checks for (a missing textbook part, an arrow the wrong way, a label pointing off its part) only on the first try. */
export function checkDrawing(j, attempt = 0, question = '') {
  if (j && j.mode === '3d') {
    const spec = tidy3d(j), { hard, soft } = problems3d(spec);
    const why = [...hard, ...(attempt ? [] : soft)];
    return why.length ? { ok: false, why: why.join('; ') } : { ok: true, spec };
  }
  if (!j || !Array.isArray(j.parts)) return { ok: false, why: 'no parts' };
  const parts = j.parts.filter((p) => p && Array.isArray(p.shapes) && p.shapes.length);
  if (parts.length < 3) return { ok: false, why: 'it needs at least 3 parts, each with shapes' };
  const anchors = parts.map((p) => (Array.isArray(p.anchor) ? p.anchor.map(Number) : null));
  if (anchors.some((a) => !a || a.some((v) => !Number.isFinite(v) || v < 0 || v > 400))) return { ok: false, why: 'every part needs an anchor [x, y] inside the board' };
  const xs = anchors.map((a) => a[0]), ys = anchors.map((a) => a[1]);
  if ((Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys)) < 400 * 300 * 0.08) return { ok: false, why: 'everything is piled into one small area; spread the drawing across the board' };
  // a drawing made of boxes and plain circles is not what a student asked for: it needs curved outlines and details
  const shapes = parts.flatMap((p) => p.shapes.filter((x) => x && typeof x === 'object'));
  const paths = shapes.filter((x) => /^(path|arrow)$/.test(String(x.t || x.type)) && typeof x.d === 'string');
  const curves = paths.reduce((n, x) => n + (x.d.match(/[CcQqSsAa]/g) || []).length, 0);
  const plain = shapes.filter((x) => /^(rect|circle|ellipse)$/.test(String(x.t || x.type))).length;
  if (curves < parts.length * 3) return { ok: false, why: 'the shapes are too plain; draw each part as a realistic outline made of smooth C or Q curves, with detail strokes' };
  if (plain > shapes.length * 0.5) return { ok: false, why: 'too many rectangles, circles and ellipses; draw the real outline of each part with curved paths' };
  if (shapes.length < parts.length * 2) return { ok: false, why: 'add detail strokes (sw 1.5) to each part so it looks real' };
  if (!attempt) {
    const why = [];
    const must = MUST.find(([re]) => re.test(`${question} ${j.title || ''}`));
    if (must) {
      const said = parts.map((p) => `${p.label || ''} ${p.id || ''} ${p.say || ''}`).join(' ').toLowerCase();
      const gone = must[1].filter((n) => !said.includes(n.slice(0, Math.max(5, n.length - 2))));
      if (gone.length) why.push(`a textbook figure of this shows ${gone.join(', ')}, and your drawing leaves ${gone.length > 1 ? 'them' : 'it'} out; draw each in its real place and name it`);
    }
    parts.forEach((p) => { const w = wrongWay(p); if (w) why.push(w); });
    parts.forEach((p) => { const a = p.anchor.map(Number), bs = p.shapes.map(shapeBox).filter(Boolean); if (bs.length && !bs.some((b) => a[0] >= b[0] - 8 && a[0] <= b[2] + 8 && a[1] >= b[1] - 8 && a[1] <= b[3] + 8)) why.push(`the anchor of "${p.label || p.id}" is not on its own part`); });
    if (/\b(heart|puso)\b/i.test(`${question} ${j.title || ''}`) && parts.some((p) => p.shapes.some(valentine))) why.push('the heart is drawn as a valentine symbol, not a real heart: draw the real organ, a rounded cone with its point (the apex) down and to the left, the aorta arching over the top');
    if (why.length) return { ok: false, why: why.slice(0, 6).join('; ') };
  }
  return { ok: true, spec: { title: clip(j.title, 80), parts, ...(j.solid === true ? { solid: true } : {}) } };
}

// ---------- 3. explain more ----------
export function explainPrompt({ question, answer, why, topic }) {
  return `A student is studying "${clip(topic, 80)}". Quiz question: "${clip(question, 240)}". The right answer is "${clip(answer, 140)}".
The short reason was: "${clip(why, 400)}".
Explain it more, so it really clicks: an everyday example (a Filipino one if it fits), then a tip to remember it.
Return JSON: { "text": "3 to 5 short sentences" }`;
}
export const checkExplain = (j) => (j && j.text ? { text: clip(j.text, 1200) } : null);

// ---------- 4. chat with Cody (from Cassie's tutor modes) ----------
const CARE = globalThis.CodyCare;
const MODES = {
  tutor: `You are tutoring. Teach step by step in short paragraphs or numbered steps, check understanding, and end with one short question that makes the student think (unless they only said hi or thanks).
Use simple markdown: **bold** for key words, numbered or bulleted lists, short headings only for long answers. No tables, no LaTeX, no code unless asked.`,
  hint: `For THIS reply give a HINT only: nudge the student toward the answer with a leading question or the first step. Do NOT reveal the final answer or the full solution. Keep it short and encouraging.`,
  quiz: `You are running a practice quiz on the topic. Ask ONE multiple choice question at a time, then stop and wait. Lay it out as: the question, a blank line, then A. B. C. D. each on its own line.
When the student answers, say if it is right, explain why in one or two sentences, then ask the next question. Never answer your own question. Vary the difficulty.`,
  talk: `RIGHT NOW the student wants to talk, vent or get advice, not a lesson. Be a warm, honest friend: listen first, name the feeling, be kind but real (not a people-pleaser), and offer one practical next step only if they want it.
Match their length. You are a caring companion, not a therapist; if things sound serious, gently encourage them to talk to a trusted adult or their guidance counselor.`,
};
export function chatPrompt({ messages, mode, context, name }) {
  const turns = (Array.isArray(messages) ? messages : []).slice(-14).map((m) => `${m && m.role === 'cody' ? 'CODY' : 'STUDENT'}: ${clip(m && m.text, 3000)}`).join('\n\n');
  return `${CARE.INSTRUCTION}

${SAFE}

You are Cody, a cheerful study buddy for Filipino students (high school and college)${name ? `, talking with ${clip(name, 30)}` : ''}. You may mix in a little Taglish when the student uses it. Be accurate; if you are not sure, say so.
${MODES[mode] || MODES.tutor}
${context ? `\nThe student is studying this reviewer, so connect your answers to it when it helps:\n"""\n${clip(context, 4000)}\n"""\n` : ''}
Cody can also DRAW. When a labelled diagram would really help (an organ, a cycle, a process, a structure, a machine, a map of parts), set "draw" to what to draw in a few words, e.g. "the human heart" or "how a volcano erupts", and say in your reply that you are drawing it. Otherwise set "draw" to "". Never draw maths graphs or charts this way, and never in talk mode. If the student asks to see a real object in 3D (a machine, a vehicle, a tool), end "draw" with " in 3D", e.g. "a bicycle in 3D".
${turns ? `\nTHE CONVERSATION SO FAR:\n${turns}\n` : ''}${'' /* the newest student message is the last STUDENT line (and any attached photo) */}
Answer the student's last message. Return JSON: { "reply": "your answer (simple markdown)", "draw": "what to draw, or empty", "title": "a 2 to 5 word title for this chat" }`;
}
export function checkChat(j) {
  if (!j || typeof j !== 'object' || !String(j.reply || '').trim()) return null;
  return { reply: String(j.reply).slice(0, 6000), draw: clip(j.draw, 80), title: clip(j.title, 50) };
}

// ---------- 5. a full study guide, written like a real reviewer (Cassie's REVIEWER_GUIDE) ----------
export function guidePrompt({ notes, fileName }) {
  return `Write a complete reviewer (study guide) from the student's notes${fileName ? ` (the file "${clip(fileName, 80)}")` : ''}, the way the best student in class would.
Cover EVERY part of the notes in their order; don't stop early or skip the middle. Keep every key term, name, date, number, quote, formula and process.

Shape it like this, in Markdown:
# REVIEWER: <the subject and topic, never the file name>
*(One line on what it is based on, e.g. the chapter or lesson)*
---
## 1. Learning outcomes  (only if the notes list objectives; otherwise start with "The big picture")
A numbered list.
## 2. The big picture
2 to 4 sentences on what this topic is about and why it matters.
## 3, 4, 5… one section per topic, each named after the topic itself
Explain the idea in plain words first, then the details as bullets. Put each key term in **bold** where it first appears.
Use a small table when things are compared or classified (| Concept | Meaning |).
Every table: the header row, then |---|---|, then one row per line. Never break a row across lines, keep each cell under 25 words, and never put | inside a cell.
Put an important quote or definition on its own line starting with "> ".
Add a "**Watch out:**" line where students often get confused.
For history or literature: a table of people (| Person | Why they matter |) and a timeline (| Date | What happened |).
For science: processes as numbered steps. For math: each formula, then one worked example step by step.
## Key terms to remember
A bulleted list: **Term**: one-line meaning.
## Review questions
5 to 8 questions. Use the questions in the notes if it has them; otherwise write your own that make the student think.
---
*End of reviewer: <topic>*

Rules for accuracy (students will study from this, so a wrong fact costs them points):
- Use only what the notes say, plus well-known textbook facts needed to make sense. Never invent.
- Keep every list and classification exactly as the notes give it: the same items, the same number of items, the same names.
  Never split one item into two, rename an item, or add an item the notes don't have. A description of an item is not a new item.
- Never add a link, cause, influence or comparison the notes don't make (for example, don't say A influenced B if the notes say B is an alternative to A).
- Quote only words that are really in the notes; a paraphrase is not a quote. Don't add words to a quote.
- Copy names, dates, numbers and citations exactly.
Use "---" between big sections, with a blank line before and after each heading. No emojis.
Return JSON: { "markdown": "the whole reviewer" }

${notes ? `NOTES:\n"""\n${clip(notes, 24000)}\n"""` : 'The notes are in the attached file.'}`;
}
export function checkGuide(j) {
  const m = j && String(j.markdown || '').trim();
  if (!m || m.length < 300 || !/^#|\n#/.test(m)) return { ok: false, why: 'the markdown reviewer is missing or too short; it needs # and ## headings' };
  return { markdown: m.slice(0, 40000) };
}
