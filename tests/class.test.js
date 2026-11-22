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

test('the class room: post, poll from the start and from a point, undo, voice, strangers refused', async () => {
  const made = await call({ action: 'create', className: 'Room test' }); const code = made.body.code;
  await call({ action: 'join', code, id: 'roomaaaaaaaa', name: 'Ana', points: 0 });
  await call({ action: 'join', code, id: 'roombbbbbbbb', name: 'Ben', points: 0 });
  const m = await call({ action: 'post', code, id: 'roomaaaaaaaa', op: { k: 'msg', t: 'Hi <b>class</b>' } });
  assert.equal(m.code, 200); assert.equal(m.body.idx, 0);
  await call({ action: 'post', code, id: 'roombbbbbbbb', op: { k: 'stroke', c: '#ff0000', w: 4, p: [10, 10, 50, 2000] } });
  assert.equal((await call({ action: 'post', code, id: 'roombbbbbbbb', op: { k: 'eval', x: 1 } })).code, 400, 'unknown kinds are refused');
  assert.equal((await call({ action: 'post', code, id: 'strangerxxxx', op: { k: 'msg', t: 'hi' } })).code, 403, 'only members post');
  const first = await call({ action: 'poll', code, id: 'roombbbbbbbb', since: -1, here: true });
  assert.deepEqual(first.body.ops.map((o) => [o.k, o.n, o.mine]), [['msg', 'Ana', false], ['stroke', 'Ben', true]]);
  assert.ok(!first.body.ops[0].t.includes('<'), 'markup is stripped');
  assert.deepEqual(first.body.ops[1].p, [10, 10, 50, 1000], 'points are clamped');
  assert.ok(!JSON.stringify(first.body).includes('roomaaaaaaaa'), 'ids are never sent');
  assert.deepEqual(first.body.online.map((x) => x.name), ['Ben']);
  await call({ action: 'post', code, id: 'roombbbbbbbb', op: { k: 'undo', of: 1 } });
  const v = await call({ action: 'voice', code, id: 'roomaaaaaaaa', audio: 'AAAA', type: 'audio/webm;codecs=opus', secs: 3 });
  const later = await call({ action: 'poll', code, id: 'roomaaaaaaaa', since: first.body.next, base: first.body.base });
  assert.deepEqual(later.body.ops.map((o) => o.k), ['undo', 'voice']); assert.equal(later.body.ops[1].idx, v.body.idx);
  const audio = await call({ action: 'audio', code, vid: later.body.ops[1].vid });
  assert.equal(audio.body.audio, 'AAAA');
});

test('finds the database keys even with a prefix Vercel added', async () => {
  const { kvMode } = await import('../lib/kv.js');
  process.env.VERCEL = '1'; process.env.STORAGE_KV_REST_API_URL = 'https://x.upstash.io'; process.env.STORAGE_KV_REST_API_TOKEN = 't';
  try { assert.equal(kvMode(), 'redis'); }
  finally { delete process.env.VERCEL; delete process.env.STORAGE_KV_REST_API_URL; delete process.env.STORAGE_KV_REST_API_TOKEN; }
});

test('the class room stays friendly: rude words are refused, schoolwork is not', async () => {
  const { unsafe } = await import('../lib/safe.js');
  for (const bad of ['you are so gago', 'F.U.C.K this', 'putang ina mo', 'b1tch', 'tangina naman']) assert.ok(unsafe(bad), bad);
  for (const ok of ['sexual reproduction in plants', 'Charles Dickens wrote it', 'the class is at 3', 'Tagalog: tanghalian', 'assessment tomorrow']) assert.ok(!unsafe(ok), ok);
  const made = await call({ action: 'create', className: 'Safe test' }); const code = made.body.code;
  await call({ action: 'join', code, id: 'safeaaaaaaaa', name: 'Ana', points: 0 });
  const r = await call({ action: 'post', code, id: 'safeaaaaaaaa', op: { k: 'msg', t: 'ang gago mo' } });
  assert.equal(r.code, 400); assert.match(r.body.error, /friendly/);
  assert.equal((await call({ action: 'join', code, id: 'safebbbbbbbb', name: 'tangina', points: 0 })).code, 400);
});
