/* POST /api/class: real class leaderboards, with no accounts.
   A teacher or student makes a class and gets a 6-letter code; classmates join with the code.
   Each student's device keeps a private id. The leaderboard only ever shows names and points.
     { action: 'create', className }                       -> { code, className }
     { action: 'join', code, id, name, points }            -> { code, className, board }
     { action: 'sync', code, id, name, points }            -> { board }
     { action: 'board', code, id }                         -> { board }
     { action: 'leave', code, id }                         -> {}
   GET /api/class -> { enabled } (whether a store is set up; see lib/kv.js) */
import { kv, kvMode } from '../lib/kv.js';
import { limited } from '../lib/limit.js';

const KEEP = 60 * 60 * 24 * 180; // a class is kept 180 days after its last change
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O or 1/I mix-ups
const clean = (t, n) => String(t == null ? '' : t).replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
const okCode = (c) => /^[A-Z2-9]{6}$/.test(String(c || ''));
const okId = (i) => /^[a-z0-9]{12,40}$/.test(String(i || ''));
const keys = (code) => ({ meta: `class:${code}`, pts: `class:${code}:pts`, names: `class:${code}:names` });

async function board(code, me) {
  const k = keys(code);
  const flat = await kv('ZREVRANGE', k.pts, 0, 29, 'WITHSCORES');
  const ids = [], pts = [];
  for (let i = 0; i < flat.length; i += 2) { ids.push(flat[i]); pts.push(+flat[i + 1]); }
  const names = ids.length ? await kv('HMGET', k.names, ...ids) : [];
  return ids.map((id, i) => ({ name: names[i] || 'Student', points: pts[i], me: id === me }));
}
async function touch(code) { const k = keys(code); await Promise.all([kv('EXPIRE', k.meta, KEEP), kv('EXPIRE', k.pts, KEEP), kv('EXPIRE', k.names, KEEP)]); }
async function put(code, id, name, points) {
  const k = keys(code);
  await kv('HSET', k.names, id, clean(name, 30) || 'Student');
  await kv('ZADD', k.pts, Math.max(0, Math.min(1e7, Math.round(+points || 0))), id);
  await touch(code);
}

export default async function handler(req, res) {
  if (req.method === 'GET') return res.status(200).json({ ok: true, enabled: kvMode() !== 'off' });
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
  if (limited(req, 'class', 400)) return res.status(429).json({ ok: false, error: 'Too many tries. Wait a few minutes.' });
  const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const code = String(b.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  try {
    if (b.action === 'create') {
      if (limited(req, 'class-create', 20)) return res.status(429).json({ ok: false, error: 'You made a lot of classes. Try again later.' });
      const className = clean(b.className, 40) || 'My class';
      for (let tries = 0; tries < 6; tries++) {
        const c = Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
        if (await kv('EXISTS', keys(c).meta)) continue;
        await kv('HSET', keys(c).meta, 'name', className, 'created', Date.now());
        await touch(c);
        return res.status(200).json({ ok: true, code: c, className });
      }
      throw new Error('no free code');
    }
    if (!okCode(code)) return res.status(400).json({ ok: false, error: 'A class code has 6 letters and numbers.' });
    if (!(await kv('EXISTS', keys(code).meta))) return res.status(404).json({ ok: false, error: 'No class has that code. Check it with your teacher.' });
    if (b.action === 'board') return res.status(200).json({ ok: true, board: await board(code, b.id) });
    if (!okId(b.id)) return res.status(400).json({ ok: false, error: 'Bad student id' });
    if (b.action === 'join') {
      if ((await kv('ZCARD', keys(code).pts)) >= 200) return res.status(403).json({ ok: false, error: 'This class is full (200 students).' });
      await put(code, b.id, b.name, b.points);
      const meta = await kv('HMGET', keys(code).meta, 'name');
      return res.status(200).json({ ok: true, code, className: meta[0] || 'My class', board: await board(code, b.id) });
    }
    if (b.action === 'sync') { await put(code, b.id, b.name, b.points); return res.status(200).json({ ok: true, board: await board(code, b.id) }); }
    if (b.action === 'leave') { await kv('ZREM', keys(code).pts, b.id); await kv('HDEL', keys(code).names, b.id); return res.status(200).json({ ok: true }); }
    return res.status(400).json({ ok: false, error: 'Unknown action' });
  } catch (e) {
    console.error('class', b.action, e.message);
    return res.status(e.status || 500).json({ ok: false, error: e.status === 503 ? e.message : 'Could not reach the class leaderboard. Try again.' });
  }
}
