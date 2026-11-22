// node --test: the server's checks and its provider order, with a fake AI (no real keys needed)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkReviewer, checkDrawing } from '../lib/tasks.js';

const call = async (handler, body, method = 'POST') => {
  const res = { code: 0, body: null, status(c) { this.code = c; return this; }, json(o) { this.body = o; return this; } };
  await handler({ method, headers: {}, body }, res);
  return res;
};
const reviewer = { title: 'The heart', subject: 'Biology', terms: [{ term: 'Atria', meaning: 'Top chambers.' }, { term: 'Valves', meaning: 'Keep blood flowing one way.' }],
  quiz: [0, 1, 2].map((i) => ({ q: `Q${i}?`, choices: ['a', 'b', 'c', 'd'], a: i, why: 'because' })), cards: [], questions: ['Why?'], drawable: 'the human heart' };
// a realistic drawing: each part a curved, shaded outline plus thin detail strokes
const part = (id, x, y) => ({ id, label: id.toUpperCase(), anchor: [x, y], shapes: [
  { t: 'path', fill: true, d: `M ${x - 20} ${y} C ${x - 20} ${y - 18} ${x + 20} ${y - 18} ${x + 20} ${y} C ${x + 22} ${y + 14} ${x - 8} ${y + 20} ${x - 20} ${y} Z` },
  { t: 'path', sw: 1.5, d: `M ${x - 10} ${y} Q ${x} ${y - 6} ${x + 10} ${y}` }] });
const drawing = { title: 'Heart', parts: [part('a', 50, 50), part('b', 300, 60), part('c', 200, 250)] };

test('checkReviewer keeps good answers and drops broken ones', () => {
  const r = checkReviewer(reviewer);
  assert.equal(r.terms.length, 2);
  assert.equal(r.quiz.length, 3);
  assert.equal(r.cards.length, 2, 'cards fall back to the terms');
  assert.equal(checkReviewer({ terms: [], quiz: [] }), null);
  assert.equal(checkReviewer({ ...reviewer, quiz: [{ q: 'x', choices: ['a'], a: 0 }] }), null, 'a quiz needs 4 choices');
});

test('checkDrawing wants 3+ parts spread over the board', () => {
  assert.equal(checkDrawing(drawing).ok, true);
  const piled = { parts: drawing.parts.map((p) => ({ ...p, anchor: [10, 10] })) };
  assert.equal(checkDrawing(piled).ok, false);
  assert.equal(checkDrawing({ parts: drawing.parts.slice(0, 2) }).ok, false);
});

test('checkDrawing sends back a drawing made of plain boxes and circles', () => {
  const boxes = { parts: drawing.parts.map((p) => ({ ...p, shapes: [{ t: 'rect', x: p.anchor[0] - 20, y: p.anchor[1] - 10, width: 40, height: 20 }, { t: 'circle', cx: p.anchor[0], cy: p.anchor[1], r: 6 }] })) };
  const r = checkDrawing(boxes);
  assert.equal(r.ok, false); assert.match(r.why, /curves|rectangles/);
  const sticks = { parts: drawing.parts.map((p) => ({ ...p, shapes: [{ t: 'path', d: `M ${p.anchor[0]} ${p.anchor[1]} L ${p.anchor[0] + 40} ${p.anchor[1]}` }] })) };
  assert.equal(checkDrawing(sticks).ok, false, 'straight stick lines are not a realistic drawing');
});

test('no keys: a clear 503, and GET lists no providers', async () => {
  for (const k of ['GROQ_API_KEY', 'GEMINI_API_KEY', 'ANTHROPIC_API_KEY']) delete process.env[k];
  const { default: handler } = await import('../api/ai.js');
  assert.deepEqual((await call(handler, null, 'GET')).body.providers, []);
  const r = await call(handler, { task: 'draw', question: 'the heart' });
  assert.equal(r.code, 503);
});

test('Groq first; when Groq fails, Gemini answers', async () => {
  process.env.GROQ_API_KEY = 'test-groq'; process.env.GEMINI_API_KEY = 'test-gemini';
  const realFetch = globalThis.fetch; const seen = [];
  globalThis.fetch = async (url) => {
    seen.push(String(url).includes('groq') ? 'groq' : 'gemini');
    if (String(url).includes('groq')) return new Response('busy', { status: 429 });
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(reviewer) }] } }] }), { status: 200 });
  };
  try {
    const { default: handler } = await import('../api/ai.js');
    const r = await call(handler, { task: 'reviewer', notes: 'The heart has four chambers. The atria are on top.' });
    assert.equal(r.code, 200); assert.equal(r.body.by, 'gemini'); assert.deepEqual(seen, ['groq', 'groq', 'groq', 'gemini'], 'every Groq model is tried, then Gemini');
    assert.equal(r.body.skipped.length, 1); assert.match(r.body.skipped[0], /gpt-oss-120b: Groq 429/);
    assert.equal(r.body.data.title, 'The heart');
  } finally { globalThis.fetch = realFetch; }
});

test('a bad drawing is sent back once with the reason', async () => {
  process.env.GROQ_API_KEY = 'test-groq'; delete process.env.GEMINI_API_KEY; delete process.env.ANTHROPIC_API_KEY;
  const realFetch = globalThis.fetch; const prompts = [];
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body); prompts.push(body.messages[1].content);
    const out = prompts.length === 1 ? { parts: [] } : drawing;
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(out) } }] }), { status: 200 });
  };
  try {
    const { default: handler } = await import('../api/ai.js');
    const r = await call(handler, { task: 'draw', question: 'the human heart' });
    assert.equal(r.code, 200); assert.equal(prompts.length, 2);
    assert.match(prompts[1], /could not be used/);
    assert.match(prompts[0], /right atrium/, 'the heart prompt lists the parts a textbook figure shows');
    assert.match(prompts[0], /realistic 2D illustration/);
  } finally { globalThis.fetch = realFetch; }
});

test('the Android app (https://localhost) may call the API; other sites get no CORS header', async () => {
  const { default: handler } = await import('../api/ai.js');
  const mk = (origin) => { const h = {}; const res = { statusCode: 0, setHeader: (k, v) => { h[k] = v; }, end() {}, status(c) { this.statusCode = c; return this; }, json() { return this; } }; return { res, h, req: { method: 'OPTIONS', headers: { origin } } }; };
  const a = mk('https://localhost'); await handler(a.req, a.res);
  assert.equal(a.res.statusCode, 204); assert.equal(a.h['access-control-allow-origin'], 'https://localhost');
  const b = mk('https://evil.example'); await handler(b.req, b.res);
  assert.equal(b.h['access-control-allow-origin'], undefined);
});

test('a retired Groq model is skipped and the next one answers', async () => {
  process.env.GROQ_API_KEY = 'test-groq'; delete process.env.GEMINI_API_KEY; delete process.env.GROQ_MODEL;
  const realFetch = globalThis.fetch; const models = [];
  globalThis.fetch = async (url, init) => {
    const m = JSON.parse(init.body).model; models.push(m);
    if (m === 'openai/gpt-oss-120b') return new Response(JSON.stringify({ error: { message: 'The model `openai/gpt-oss-120b` has been decommissioned' } }), { status: 400 });
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ text: 'More.' }) } }] }), { status: 200 });
  };
  try {
    const { default: handler } = await import('../api/ai.js');
    const a = await call(handler, { task: 'explain', question: 'q', answer: 'a', why: 'w', topic: 't' });
    assert.equal(a.code, 200); assert.equal(a.body.by, 'groq'); assert.deepEqual(models, ['openai/gpt-oss-120b', 'llama-3.3-70b-versatile']);
    models.length = 0;
    await call(handler, { task: 'explain', question: 'q', answer: 'a', why: 'w', topic: 't' });
    assert.deepEqual(models, ['llama-3.3-70b-versatile'], 'the retired name is not tried again');
  } finally { globalThis.fetch = realFetch; }
});

test('checkGuide wants a real reviewer with headings', async () => {
  const { checkGuide } = await import('../lib/tasks.js');
  assert.equal(checkGuide({ markdown: 'too short' }).ok, false);
  const good = '# REVIEWER: Topic\n\n## 1. The big picture\n' + 'Text. '.repeat(80);
  assert.ok(checkGuide({ markdown: good }).markdown.startsWith('# REVIEWER'));
});

test('study guides ask Gemini first; chat asks Groq first', async () => {
  process.env.GROQ_API_KEY = 'test-groq'; process.env.GEMINI_API_KEY = 'test-gemini';
  const realFetch = globalThis.fetch; const seen = [];
  const guide = '# REVIEWER: T\n\n## 1. The big picture\n' + 'Words. '.repeat(80);
  globalThis.fetch = async (url) => {
    const g = String(url).includes('googleapis'); seen.push(g ? 'gemini' : 'groq');
    const data = JSON.stringify({ markdown: guide, reply: 'Hi!', draw: '', title: 'Hi' });
    return new Response(JSON.stringify(g ? { candidates: [{ content: { parts: [{ text: data }] } }] } : { choices: [{ message: { content: data } }] }), { status: 200 });
  };
  try {
    const { default: handler } = await import('../api/ai.js');
    const g = await call(handler, { task: 'guide', notes: 'Some notes about a topic.' });
    assert.equal(g.body.by, 'gemini');
    const c = await call(handler, { task: 'chat', messages: [{ role: 'me', text: 'hi' }] });
    assert.equal(c.body.by, 'groq');
    assert.deepEqual(seen, ['gemini', 'groq']);
  } finally { globalThis.fetch = realFetch; }
});

test('a dragon is the hand-drawn figure, and it passes the same check as an AI drawing', async () => {
  const { figureFor } = await import('../js/drawings.js');
  const { clean } = await import('../js/draw.js');
  for (const q of ['dragon', 'Draw a dragon', 'parts of a dragon']) assert.equal(figureFor(q).title, 'Dragon', q);
  assert.equal(figureFor('the human heart'), null);
  const dragon = figureFor('dragon');
  assert.equal(checkDrawing(dragon).ok, true, checkDrawing(dragon).why);
  const kept = clean(JSON.stringify(dragon));
  assert.equal(kept.solid, true); assert.equal(kept.parts.find((p) => p.id === 'legs').z, 5, 'stacking order survives clean()');
  assert.equal(kept.parts.reduce((n, p) => n + p.shapes.length, 0), dragon.parts.reduce((n, p) => n + p.shapes.length, 0), 'no shape is dropped');
});
