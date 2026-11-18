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
const drawing = { title: 'Heart', parts: [{ id: 'a', label: 'A', anchor: [50, 50], shapes: [{ t: 'circle', cx: 50, cy: 50, r: 10 }] }, { id: 'b', label: 'B', anchor: [300, 60], shapes: [{ t: 'circle', cx: 300, cy: 60, r: 10 }] }, { id: 'c', label: 'C', anchor: [200, 250], shapes: [{ t: 'path', d: 'M 180 250 L 220 250' }] }] };

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
    assert.equal(r.code, 200); assert.equal(r.body.by, 'gemini'); assert.deepEqual(seen, ['groq', 'gemini']);
    assert.equal(r.body.data.title, 'The heart');
  } finally { globalThis.fetch = realFetch; }
});

test('a bad drawing is sent back once with the reason', async () => {
  process.env.GROQ_API_KEY = 'test-groq'; delete process.env.GEMINI_API_KEY;
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
