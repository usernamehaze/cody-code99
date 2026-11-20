/* Everything Cody remembers, kept on this device (localStorage).
   reviewers: the reviewers Cody made from the student's notes (none at first)
   cards:     flashcards with a Leitner box and a due time (spaced repetition, from Cassie's cards.js)
   days:      points and minutes per day (the streak, the week chart)
   quiz:      best score per reviewer, to find the weak topic
   plan:      which of today's plan items are done */

const KEY = 'cody.v1';
const DAY = 864e5, MIN = 6e4;
const GAPS = [0, 1, 3, 7, 16, 35, 70]; // days until a card comes back, by box

export const dayKey = (t = Date.now()) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const uid = () => Math.random().toString(36).slice(2, 10);

function cardsFrom(rev, now = Date.now()) {
  return (rev.cards || []).map((c) => ({ id: uid(), deck: rev.id, front: c.front, back: c.back, part: c.part || null, box: 0, due: now }));
}

// first open: nothing at all. Every number Cody shows is the student's own (no made-up scores or streaks).
const VERSION = 2;
function fresh() {
  return { version: VERSION, name: '', exam: { subject: '', date: '' }, reviewers: [], cards: [], days: {}, quiz: {}, plan: {}, points: 0, created: Date.now() };
}
// devices that opened an older Cody have the old demo (Juan, a made-up week, sample reviewers, sample
// classmates): keep only what the student made (their reviewers, cards, chats, class), drop the rest
function upgrade(old) {
  if (old.version === VERSION) return old;
  const s = fresh();
  const mine = (id) => !String(id).startsWith('sample-');
  s.reviewers = (old.reviewers || []).filter((r) => mine(r.id));
  s.cards = (old.cards || []).filter((c) => mine(c.deck));
  for (const k of ['chats', 'class', 'studentId']) if (old[k]) s[k] = old[k];
  if (old.name && old.name !== 'Juan') s.name = old.name;
  if (s.class) { s.class.board = (s.class.board || []).map((p) => (p.me ? { ...p, points: 0 } : p)); s.class.synced = -1; }
  return s;
}

let state = null;
const listeners = new Set();
export function load() {
  try { state = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { state = null; }
  state = !state || !Array.isArray(state.reviewers) ? fresh() : upgrade(state);
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* blocked: in memory only */ }
  return state;
}
export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage full or blocked: keep going in memory */ }
  listeners.forEach((f) => f(state));
}
export const get = () => state || load();
export const onChange = (f) => listeners.add(f);
export function reset() { const keep = state && state.studentId; state = fresh(); if (keep) state.studentId = keep; save(); }

// ---------- points, streak, week ----------
export function award(pts, minutes = 0) {
  const s = get(), k = dayKey();
  const d = s.days[k] || (s.days[k] = { pts: 0, min: 0 });
  d.pts += pts; d.min += minutes; s.points += pts;
  save();
}
export function streak() {
  const s = get(); let n = 0, t = Date.now();
  if (!s.days[dayKey(t)]) t -= DAY; // today not studied yet: the streak still counts up to yesterday
  while (s.days[dayKey(t)] && s.days[dayKey(t)].pts > 0) { n++; t -= DAY; }
  return n;
}
export const studiedToday = () => !!(get().days[dayKey()] || {}).pts;
export function week() { // Monday to Sunday of this week
  const s = get(), now = new Date(), dow = (now.getDay() + 6) % 7, out = [];
  for (let k = 0; k < 7; k++) { const t = Date.now() + (k - dow) * DAY; const d = s.days[dayKey(t)]; out.push({ name: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][k], min: d ? d.min : 0, today: k === dow, future: k > dow }); }
  return out;
}

// ---------- reviewers ----------
export const reviewer = (id) => get().reviewers.find((r) => r.id === id);
export function addReviewer(r) {
  const s = get();
  r.id = r.id || 'r-' + uid(); r.made = Date.now();
  s.reviewers.unshift(r);
  s.cards.push(...cardsFrom(r));
  save();
  return r;
}
export function removeReviewer(id) { const s = get(); s.reviewers = s.reviewers.filter((r) => r.id !== id); s.cards = s.cards.filter((c) => c.deck !== id); save(); }

// ---------- flashcards (Leitner boxes) ----------
export const dueCards = (deck) => get().cards.filter((c) => (!deck || c.deck === deck) && c.due <= Date.now());
export const learnedCount = () => get().cards.filter((c) => c.box >= 3).length;
export function decks() {
  const s = get(), now = Date.now();
  return s.reviewers.map((r) => { const cs = s.cards.filter((c) => c.deck === r.id); return { id: r.id, name: r.title, total: cs.length, due: cs.filter((c) => c.due <= now).length }; }).filter((d) => d.total);
}
// again: back in 1 minute, box 0 · almost: same box, back in 10 minutes (or a day) · got it: next box, its gap
export function grade(cardId, how) {
  const c = get().cards.find((x) => x.id === cardId); if (!c) return;
  const now = Date.now();
  if (how === 'again') { c.box = 0; c.due = now + MIN; }
  else if (how === 'almost') { c.due = now + (c.box ? DAY : 10 * MIN); }
  else { c.box = Math.min(GAPS.length - 1, c.box + 1); c.due = now + GAPS[c.box] * DAY; }
  award(how === 'got' ? 5 : how === 'almost' ? 2 : 1, 0.5);
}

// ---------- quiz ----------
export function quizDone(revId, pct) { const s = get(); const q = s.quiz[revId] || {}; s.quiz[revId] = { best: Math.max(q.best || 0, pct), last: pct }; save(); }
export function weakTopic() {
  const s = get();
  const scored = s.reviewers.filter((r) => s.quiz[r.id]).sort((a, b) => s.quiz[a.id].last - s.quiz[b.id].last);
  return scored.length && s.quiz[scored[0].id].last < 75 ? scored[0] : null;
}
export function weekQuizScore() { const s = get(); const v = Object.values(s.quiz).map((q) => q.last); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null; } // (null: no quiz taken yet)

// ---------- today's plan, made by Cody ----------
export function daysToExam() { const s = get(); if (!s.exam || !s.exam.date) return null; const d = Math.ceil((new Date(s.exam.date + 'T00:00') - new Date(dayKey() + 'T00:00')) / DAY); return d >= 0 ? d : null; }
export function todaysPlan() {
  const s = get(), k = dayKey(), done = s.plan[k] || {};
  const revs = s.reviewers;
  // spread the reviewers over the days: a different one each day, newest first
  const day = Math.floor(Date.now() / DAY);
  if (!revs.length) return []; // (nothing to plan until there are notes)
  const main = revs[day % revs.length];
  const weak = weakTopic();
  const game = revs.find((r) => r.game && r.id !== main.id) || main;
  const drawn = revs.find((r) => r.drawing && r.id !== main.id && r.id !== game.id) || main;
  const due = dueCards().length;
  const items = [];
  if (main) items.push({ id: 'read-' + main.id, text: `Read reviewer: ${main.title}`, min: 10, go: `#/reviewer/${main.id}` });
  if (due) items.push({ id: 'cards', text: `Flashcards: ${due} due`, min: Math.max(3, Math.round(due * 0.6)), go: '#/flashcards' });
  if (game) items.push({ id: 'label-' + game.id, text: `Label it! ${game.title}`, min: 5, go: `#/label/${game.id}` });
  if (weak) items.push({ id: 'quiz-' + weak.id, text: `Quiz: ${weak.title} (your weak topic)`, min: 10, go: `#/quiz/${weak.id}` });
  else if (main) items.push({ id: 'quiz-' + main.id, text: `Quiz: ${main.title}`, min: 10, go: `#/quiz/${main.id}` });
  if (drawn) items.push({ id: 'draw-' + drawn.id, text: `Draw with Cody: ${drawn.title}`, min: 6, go: `#/draw/${drawn.id}` });
  return items.map((it) => ({ ...it, done: !!done[it.id] }));
}
export function markPlan(itemId, on = true) {
  const s = get(), k = dayKey(); const d = s.plan[k] || (s.plan[k] = {});
  if (!!d[itemId] === on) return;
  d[itemId] = on;
  if (on) award(10, 0); else save();
}

// ---------- chats with Cody (kept on this device; photos are not kept) ----------
const MAX_CHATS = 30, MAX_MSGS = 80;
export const chats = () => { const s = get(); if (!Array.isArray(s.chats)) s.chats = []; return s.chats; };
export const chat = (id) => chats().find((c) => c.id === id);
export function newChat({ mode = 'tutor', about = null } = {}) {
  const c = { id: 'c-' + uid(), title: 'New chat', mode, about, msgs: [], at: Date.now() };
  const list = chats(); list.unshift(c); list.splice(MAX_CHATS); save();
  return c;
}
export function addMsg(c, m) {
  c.msgs.push({ ...m, at: Date.now() }); c.msgs.splice(0, Math.max(0, c.msgs.length - MAX_MSGS)); c.at = Date.now();
  const list = chats(); const i = list.indexOf(c); if (i > 0) { list.splice(i, 1); list.unshift(c); }
  save();
}
export function removeChat(id) { const s = get(); s.chats = chats().filter((c) => c.id !== id); save(); }
