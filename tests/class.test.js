// node --test: class leaderboards, using the in-memory store (no Redis needed)
import { test } from 'node:test';
import assert from 'node:assert/strict';

delete process.env.VERCEL; delete process.env.UPSTASH_REDIS_REST_URL; delete process.env.KV_REST_API_URL;
const { default: handler } = await import('../api/class.js');
let ip = 0;
const call = async (body, method = 'POST') => {
  const res = { code: 0, body: null, status(c) { this.code = c; return this; }, json(o) { this.body = o; return this; } };
  await handler({ method, headers: { 'x-forwarded-for': '10.0.0.' + (ip++ % 200) }, body }, res);
  return res;
};

test('make a class, two students join, the board ranks them and hides ids', async () => {
  assert.equal((await call(null, 'GET')).body.enabled, true);
  const made = await call({ action: 'create', className: 'Grade 9 Rizal' });
  assert.equal(made.code, 200); assert.match(made.body.code, /^[A-Z2-9]{6}$/);
  const code = made.body.code;
  await call({ action: 'join', code, id: 'aaaaaaaaaaaa', name: 'Maria', points: 1420 });
  const juan = await call({ action: 'join', code: code.toLowerCase(), id: 'bbbbbbbbbbbb', name: 'Juan <b>', points: 900 });
  assert.equal(juan.body.className, 'Grade 9 Rizal');
  assert.deepEqual(juan.body.board.map((p) => p.name), ['Maria', 'Juan b']);
  assert.equal(juan.body.board[1].me, true);
  assert.ok(!JSON.stringify(juan.body).includes('aaaaaaaaaaaa'), 'other students’ ids are never sent');
  const up = await call({ action: 'sync', code, id: 'bbbbbbbbbbbb', name: 'Juan', points: 1500 });
  assert.equal(up.body.board[0].name, 'Juan');
  await call({ action: 'leave', code, id: 'bbbbbbbbbbbb' });
  assert.equal((await call({ action: 'board', code })).body.board.length, 1);
});

test('bad codes are refused', async () => {
  assert.equal((await call({ action: 'join', code: 'ZZZZZZ', id: 'cccccccccccc', name: 'X' })).code, 404);
  assert.equal((await call({ action: 'join', code: 'abc', id: 'cccccccccccc' })).code, 400);
});

test('on Vercel with no store, it says so', async () => {
  process.env.VERCEL = '1';
  try { assert.equal((await call(null, 'GET')).body.enabled, false); assert.equal((await call({ action: 'create' })).code, 503); }
  finally { delete process.env.VERCEL; }
});
