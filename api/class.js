/* POST /api/class: real class leaderboards, with no accounts.
   A teacher or student makes a class and gets a 6-letter code; classmates join with the code.
   Each student's device keeps a private id. The leaderboard only ever shows names and points.
     { action: 'create', className }                       -> { code, className }
     { action: 'join', code, id, name, points }            -> { code, className, board }
     { action: 'sync', code, id, name, points }            -> { board }
     { action: 'board', code, id }                         -> { board }
     { action: 'leave', code, id }                         -> {}
     The class room (a shared board, chat, voice messages and shared reviewers, like Cassie's study rooms):
     { action: 'post', code, id, op }                      -> { idx }   one thing that happened in the room
     { action: 'poll', code, id, since, base, here }       -> { ops, next, base, online }
     { action: 'voice', code, id, audio, type, secs }      -> { idx }   a voice message (kept apart, fetched on play)
     { action: 'audio', code, vid }                        -> { audio, type }
   GET /api/class -> { enabled } (whether a store is set up; see lib/kv.js) */
import { kv, kvMode, kvPipe } from '../lib/kv.js';
import { limited } from '../lib/limit.js';
import { cors } from '../lib/cors.js';
import { unsafe, SAFE_MSG } from '../lib/safe.js';

const KEEP = 60 * 60 * 24 * 180; // a class is kept 180 days after its last change
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O or 1/I mix-ups
const clean = (t, n) => String(t == null ? '' : t).replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
const okCode = (c) => /^[A-Z2-9]{6}$/.test(String(c || ''));
const okId = (i) => /^[a-z0-9]{12,40}$/.test(String(i || ''));
const keys = (code) => ({ meta: `class:${code}`, pts: `class:${code}:pts`, names: `class:${code}:names`, ops: `class:${code}:ops`, base: `class:${code}:base`, here: `class:${code}:here` });

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

// ---------- the class room ----------
const MAX_OPS = 1500, TRIM = 500, FIRST = 400;
const num = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.round(+v || 0)));
const COLOR = /^#[0-9a-f]{6}$/i;
// what may be posted, made safe: anything else is refused
function cleanOp(o) {
  if (!o || typeof o !== 'object') return null;
  if (o.k === 'msg') { const t = clean(o.t, 600); return t ? { k: 'msg', t } : null; }
  if (o.k === 'stroke') {
    const p = (Array.isArray(o.p) ? o.p : []).slice(0, 1200).map((v) => num(v, 0, 1000));
    return p.length >= 2 ? { k: 'stroke', c: COLOR.test(o.c) ? o.c : '#2dd4bf', w: num(o.w, 1, 30), p } : null;
  }
  if (o.k === 'undo') return Number.isInteger(+o.of) ? { k: 'undo', of: +o.of } : null;
  if (o.k === 'clear') return { k: 'clear' };
  if (o.k === 'cody') { const q = clean(o.q, 600), a = String(o.a || '').slice(0, 6000); return q && a ? { k: 'cody', q, a } : null; }
  if (o.k === 'share') {
    const r = o.r || {}; const json = JSON.stringify(r);
    if (json.length > 90000 || !clean(r.title, 80)) return null;
    return { k: 'share', r: JSON.parse(json) }; // (it is only ever shown as text and saved as data, never run)
  }
  return null;
}
async function push(code, op) {
  const k = keys(code);
  const len = await kv('RPUSH', k.ops, JSON.stringify(op));
  const base = +(await kv('GET', k.base)) || 0;
  if (len > MAX_OPS) { await kv('LTRIM', k.ops, TRIM, -1); await kv('INCRBY', k.base, TRIM); }
  if (len % 25 === 1) await Promise.all([kv('EXPIRE', k.ops, KEEP), kv('EXPIRE', k.base, KEEP)]);
  return base + len - 1;
}
// everything after `since` (an absolute count); the first visit gets the latest FIRST things
async function poll(code, b) {
  const k = keys(code), me = String(b.id || ''), now = Date.now();
  const since = Number.isInteger(+b.since) ? +b.since : -1, knownBase = +b.base || 0;
  const cmds = [['GET', k.base], since < 0 ? ['LRANGE', k.ops, -FIRST, -1] : ['LRANGE', k.ops, Math.max(0, since - knownBase), -1]];
  if (since < 0) cmds.push(['LLEN', k.ops]);
  if (b.here && /^[a-z0-9]{12,40}$/.test(me)) cmds.push(['HSET', k.here, me, now], ['HGETALL', k.here]);
  const out = await kvPipe(cmds);
  let base = +out[0] || 0, list = out[1] || [], start;
  if (since < 0) start = base + (+out[2] || 0) - list.length;
  else if (base !== knownBase) { list = (await kv('LRANGE', k.ops, Math.max(0, since - base), -1)) || []; start = Math.max(since, base); }
  else start = since;
  const ops = list.map((x, i) => { try { const o = JSON.parse(x); o.idx = start + i; o.mine = o.u === me; delete o.u; return o; } catch (e) { return null; } }).filter(Boolean);
  let online;
  if (b.here) {
    const flat = out[out.length - 1] || [], live = [];
    for (let i = 0; i < flat.length; i += 2) if (now - +flat[i + 1] < 20000) live.push(flat[i]);
    const names = live.length ? await kv('HMGET', k.names, ...live) : [];
    online = live.map((u, i) => ({ name: names[i] || 'Student', me: u === me }));
  }
  return { ops, next: start + list.length, base, online };
}

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method === 'GET') return res.status(200).json({ ok: true, enabled: kvMode() !== 'off' });
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
  const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  // (a room polls every few seconds per student, so it has its own allowance per student)
  if (b.action === 'poll' ? limited(req, 'room-poll:' + String(b.id || '').slice(0, 40), 3000) : !['post', 'voice', 'audio'].includes(b.action) && limited(req, 'class', 400)) return res.status(429).json({ ok: false, error: 'Too many tries. Wait a few minutes.' });
  const code = String(b.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  try {
    if (b.action === 'create') {
      if (limited(req, 'class-create', 20)) return res.status(429).json({ ok: false, error: 'You made a lot of classes. Try again later.' });
      const className = clean(b.className, 40) || 'My class';
      if (unsafe(className)) return res.status(400).json({ ok: false, error: 'Pick a friendlier class name.' });
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
    if (b.action === 'poll') return res.status(200).json({ ok: true, ...(await poll(code, b)) });
    if (b.action === 'audio') {
      const v = /^[a-z0-9]{6,20}$/.test(String(b.vid || '')) ? await kv('GET', `class:${code}:v:${b.vid}`) : null;
      if (!v) return res.status(404).json({ ok: false, error: 'That voice message has expired.' });
      return res.status(200).json({ ok: true, ...JSON.parse(v) });
    }
    if (!okId(b.id)) return res.status(400).json({ ok: false, error: 'Bad student id' });
    if ((b.action === 'join' || b.action === 'sync') && unsafe(b.name)) return res.status(400).json({ ok: false, error: 'Pick a friendlier name in Study plan, then try again.' });
    if (b.action === 'join') {
      if ((await kv('ZCARD', keys(code).pts)) >= 200) return res.status(403).json({ ok: false, error: 'This class is full (200 students).' });
      await put(code, b.id, b.name, b.points);
      const meta = await kv('HMGET', keys(code).meta, 'name');
      return res.status(200).json({ ok: true, code, className: meta[0] || 'My class', board: await board(code, b.id) });
    }
    if (b.action === 'sync') { await put(code, b.id, b.name, b.points); return res.status(200).json({ ok: true, board: await board(code, b.id) }); }
    if (b.action === 'post' || b.action === 'voice') {
      if (limited(req, 'room-post:' + b.id, 900)) return res.status(429).json({ ok: false, error: 'Slow down a little, then try again.' });
      const [name] = await kv('HMGET', keys(code).names, b.id);
      if (!name) return res.status(403).json({ ok: false, error: 'Join the class first.' });
      let op;
      if (b.action === 'voice') {
        const type = String(b.type || '');
        if (!/^audio\/(webm|mp4|ogg|mpeg|aac)/.test(type) || typeof b.audio !== 'string' || b.audio.length > 900000) return res.status(400).json({ ok: false, error: 'That recording is too long. Keep it under a minute.' });
        const vid = Math.random().toString(36).slice(2, 12);
        await kv('SET', `class:${code}:v:${vid}`, JSON.stringify({ audio: b.audio, type }));
        await kv('EXPIRE', `class:${code}:v:${vid}`, KEEP);
        op = { k: 'voice', vid, s: Math.max(1, Math.min(60, Math.round(+b.secs || 1))) };
      } else op = cleanOp(b.op);
      if (op && unsafe(op.t, op.q, op.r && op.r.title)) return res.status(400).json({ ok: false, error: SAFE_MSG });
      if (!op) return res.status(400).json({ ok: false, error: 'That could not be shared.' });
      return res.status(200).json({ ok: true, idx: await push(code, { ...op, n: name, u: b.id, at: Date.now() }) });
    }
    if (b.action === 'leave') { await kv('ZREM', keys(code).pts, b.id); await kv('HDEL', keys(code).names, b.id); return res.status(200).json({ ok: true }); }
    return res.status(400).json({ ok: false, error: 'Unknown action' });
  } catch (e) {
    console.error('class', b.action, e.message);
    return res.status(e.status || 500).json({ ok: false, error: e.status === 503 ? e.message : 'Could not reach the class leaderboard. Try again.' });
  }
}
