/* The class leaderboard (api/class.js): make a class, join one with its 6-letter code, and keep this
   student's points on the board. The last board seen is saved, so Home shows it at once (and offline). */
import * as S from './store.js';
import { API } from './ai.js';

async function call(body) {
  let r; try { r = await fetch(API + '/api/class', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); }
  catch (e) { throw new Error('You seem to be offline.'); }
  const j = await r.json().catch(() => null);
  if (!r.ok || !j || !j.ok) throw new Error((j && j.error) || 'Could not reach the class leaderboard.');
  return j;
}
const myId = () => { const s = S.get(); if (!s.studentId) { s.studentId = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => (b % 36).toString(36)).join(''); S.save(); } return s.studentId; };
const me = () => ({ id: myId(), name: S.get().name || 'Student', points: S.get().points });

export async function enabled() { try { const r = await fetch(API + '/api/class'); const j = await r.json(); return !!j.enabled; } catch (e) { return false; } }

export async function join(code) {
  const j = await call({ action: 'join', code: String(code).trim().toUpperCase(), ...me() });
  const s = S.get(); s.class = { code: j.code, name: j.className, board: j.board, synced: s.points, at: Date.now() }; S.save();
  return s.class;
}
export async function create(className) { const j = await call({ action: 'create', className }); return join(j.code); }
export async function leave() {
  const s = S.get(); if (!s.class) return;
  try { await call({ action: 'leave', code: s.class.code, id: myId() }); } catch (e) { /* leave on this device anyway */ }
  s.class = null; S.save();
}
// send my points (when they changed) and get the latest board
let busy = null;
export function refresh() {
  const s = S.get(); if (!s.class) return Promise.resolve(null);
  if (busy) return busy;
  const action = s.points !== s.class.synced || s.class.nameSent !== s.name ? 'sync' : 'board';
  const sentPts = s.points, sentName = s.name;
  busy = call({ action, code: s.class.code, ...me() }).then((j) => {
    const c = S.get().class; if (!c) return null;
    c.board = j.board; c.at = Date.now();
    if (action === 'sync') { c.synced = sentPts; c.nameSent = sentName; }
    S.save(); return c.board;
  }).catch(() => null).finally(() => { busy = null; });
  return busy;
}
// points change often (each card, each answer): send them at most every few seconds
let timer = null;
export function watch() {
  S.onChange((s) => { if (s.class && s.points !== s.class.synced && !timer) timer = setTimeout(() => { timer = null; refresh(); }, 4000); });
}

// ---------- the class room (js/views/room.js) ----------
export const post = (op) => call({ action: 'post', code: S.get().class.code, id: myId(), op });
export const poll = (since, base, here) => call({ action: 'poll', code: S.get().class.code, id: myId(), since, base, here });
export const sendVoice = (audio, type, secs) => call({ action: 'voice', code: S.get().class.code, id: myId(), audio, type, secs });
export const getAudio = (vid) => call({ action: 'audio', code: S.get().class.code, vid });
