/* The first run, the way Cassie does it, made Cody:
     1. a short splash (Cody, "Your study buddy.")
     2. an illustrated intro card with one big Get started
     3. four quick questions, one a screen (name, where you are in school, what brings you, your next exam),
        with Back, a progress bar and Skip for now on each
     4. "You're all set": what Cody now knows, ticked one row at a time
     5. the sign-in page: art on top, the form on a sheet below (on a computer, side by side)
   Signing in keeps everything the student does saved to their own account; nobody else can see it, except
   what they share in a study room. "Continue as a guest" keeps work on this device only. */
import * as S from './store.js';
import * as Acc from './account.js';
import { mascot } from './mascot.js';
import { esc, busy, LOGO } from './ui.js';

const SEEN = 'cody.onboarded';
const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const seen = () => { try { return localStorage.getItem(SEEN) === '1'; } catch (e) { return true; } };
const markSeen = () => { try { localStorage.setItem(SEEN, '1'); } catch (e) { /* private mode */ } };
// who must see this: nobody signed in, and not using Cody as a guest
export const needed = () => !Acc.me() && !S.get().guest;

const WHO = [['elem', 'Elementary'], ['jhs', 'Junior High'], ['shs', 'Senior High'], ['college', 'College / University'], ['board', 'Reviewing for a board exam'], ['teach', 'Teacher or parent']];
const GOALS = [['exam', 'Getting ready for an exam', 'Reviewers, quizzes and a study plan'], ['notes', 'Turning my notes into reviewers', 'PDFs, handouts, photos of my notebook'],
  ['draw', 'Understanding how things work', 'Cody draws it, step by step'], ['class', 'Studying with my class', 'A study room with my classmates']];
const TOTAL = 4;
const GOOGLE = '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';
const TICK = '<span class="fr-tick" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" pathLength="1"/></svg></span>';

let box = null, finish = null;
export function show({ message = '', onDone }) {
  document.body.classList.add('gated');
  box = box || document.body.appendChild(Object.assign(document.createElement('div'), { className: 'fr' }));
  box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', 'Welcome to Cody');
  finish = () => { document.body.classList.remove('gated'); box.remove(); box = null; onDone(); };
  if (seen() || message) signIn(message);
  else splash(() => intro());
}

// 1. splash
function splash(next) {
  box.dataset.step = 'welcome';
  box.innerHTML = `<section class="fr-welcome" aria-live="polite">${mascot('wave', 120)}<h1 class="fr-name">Cody</h1><p class="fr-line">Your study buddy.</p><span class="fr-load" role="progressbar" aria-label="Loading"><i></i><i></i><i></i></span></section>`;
  setTimeout(next, still() ? 700 : 1500);
}

// 2. intro: one illustrated card and a big Get started
function intro() {
  box.dataset.step = 'intro';
  box.innerHTML = `<section class="fr-intro">
    <div class="fr-art" aria-hidden="true">
      <svg class="fr-scene" viewBox="0 0 400 300" preserveAspectRatio="xMidYMax slice">
        <path d="M0 210 C70 160 140 170 210 196 C270 218 330 176 400 186 V300 H0Z" class="fr-hill1"/>
        <path d="M0 238 C90 206 170 236 240 230 C310 224 350 208 400 220 V300 H0Z" class="fr-hill2"/>
        <g class="fr-books"><rect x="64" y="236" width="92" height="16" rx="3"/><rect x="72" y="220" width="80" height="16" rx="3"/><rect x="60" y="204" width="88" height="16" rx="3"/></g>
        <path d="M282 250 l40 -40 l10 10 l-40 40 l-14 4z" class="fr-pencil"/>
      </svg>
      <div class="fr-bot">${mascot('wave', 168)}</div>
    </div>
    <div class="fr-copy">
      <h1>Study smarter with Cody</h1>
      <p>Turn your notes into reviewers, quizzes and flashcards. Cody draws how things work, and you can study with your class. Free.</p>
      <button type="button" class="fr-go fr-start">Get started</button>
    </div>
  </section>`;
  box.querySelector('.fr-start').addEventListener('click', () => ask(0));
  setTimeout(() => { const b = box && box.querySelector('.fr-start'); if (b) b.focus({ preventScroll: true }); }, 50);
}

// 3. the questions, one a screen
const answers = { name: '', who: '', goals: [], subject: '', date: '' };
function ask(at) {
  const s = S.get();
  if (!answers.name && s.name) answers.name = s.name;
  box.dataset.step = 'q' + (at + 1);
  const pills = WHO.map(([v, l]) => `<button type="button" class="fr-pick" role="radio" data-who="${v}">${l}</button>`).join('');
  const cards = GOALS.map(([v, l, d]) => `<button type="button" class="fr-card" aria-pressed="false" data-goal="${v}"><span class="fr-card-t"><b>${l}</b><small>${d}</small></span><span class="fr-card-dot" aria-hidden="true"></span></button>`).join('');
  const Q = [
    { h: 'What should Cody call you?', sub: 'I’ll use it so our chats feel personal.', body: `<input class="fr-big" name="name" maxlength="30" autocomplete="given-name" placeholder="Your first name" aria-label="Your first name">
      <button type="button" class="fr-skipall">Want to dive straight in? Skip setup</button>` },
    { h: 'Where are you in your learning?', body: `<div class="fr-picks" role="radiogroup" aria-label="Where you are in your learning">${pills}</div>` },
    { h: 'What brings you to Cody?', sub: 'Choose as many as you like.', body: `<div class="fr-cards">${cards}</div>` },
    { h: 'When is your next exam?', sub: 'Optional. Cody plans each day until then.', body: `<label class="fr-q2"><span>Subject</span><input class="fr-age fr-wide" name="subject" maxlength="40" placeholder="e.g. Biology"></label>
      <label class="fr-q2"><span>Date</span><input class="fr-age fr-wide" name="date" type="date"></label>` },
  ][at];
  box.innerHTML = `<form class="fr-ob" novalidate>
    <div class="fr-top">
      <button type="button" class="fr-back"${at === 0 ? ' hidden' : ''}>‹ Back</button>
      <div class="fr-progress"><span class="fr-seg-bar" aria-hidden="true">${Array.from({ length: TOTAL }, (_, i) => `<i${i <= at ? ' class="on"' : ''}></i>`).join('')}</span><span class="fr-count">${at + 1} of ${TOTAL}</span></div>
      <button type="button" class="fr-skip">Skip for now</button>
    </div>
    <div class="fr-mid">
      <h1 class="fr-h">${Q.h}</h1>
      ${Q.sub ? `<p class="fr-sub">${Q.sub}</p>` : ''}
      ${Q.body}
      <p class="fr-err" role="alert" hidden></p>
    </div>
    <button type="submit" class="fr-go">${at === TOTAL - 1 ? 'See my setup' : 'Continue'}</button>
  </form>`;
  const f = box.querySelector('form'), err = box.querySelector('.fr-err');
  const say = (m) => { err.textContent = m; err.hidden = !m; };
  if (f.name) f.name.value = answers.name;
  if (f.subject) { f.subject.value = answers.subject || s.exam.subject || ''; f.date.value = answers.date || s.exam.date || ''; }
  const mark = () => {
    f.querySelectorAll('[data-who]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.who === answers.who)));
    f.querySelectorAll('[data-goal]').forEach((b) => b.setAttribute('aria-pressed', String(answers.goals.includes(b.dataset.goal))));
  };
  mark();
  const typed = () => { if (f.name) answers.name = f.name.value.trim(); if (f.subject) { answers.subject = f.subject.value.trim(); answers.date = f.date.value; } };
  f.addEventListener('input', () => { typed(); say(''); });
  f.addEventListener('click', (e) => {
    const w = e.target.closest('[data-who]'), g = e.target.closest('[data-goal]');
    if (w) answers.who = w.dataset.who;
    if (g) answers.goals = answers.goals.includes(g.dataset.goal) ? answers.goals.filter((x) => x !== g.dataset.goal) : [...answers.goals, g.dataset.goal];
    if (w || g) { say(''); mark(); }
  });
  box.querySelector('.fr-back').addEventListener('click', () => { typed(); ask(Math.max(0, at - 1)); });
  box.querySelector('.fr-skip').addEventListener('click', () => { typed(); keep(); markSeen(); signIn(''); }); // (what's answered so far is kept)
  const all = box.querySelector('.fr-skipall');
  if (all) all.addEventListener('click', () => { typed(); keep(); markSeen(); signIn(''); });
  f.addEventListener('submit', (e) => {
    e.preventDefault(); typed();
    if (at === 0 && !answers.name) { say('Type your first name, or tap Skip for now.'); f.name.focus(); return; }
    if (at === 3 && answers.subject && !answers.date) { say('Add the date too, or clear the subject.'); return; }
    if (at < TOTAL - 1) ask(at + 1); else summary();
  });
  const first = f.querySelector('input, .fr-pick, .fr-card'); if (first) setTimeout(() => first.focus({ preventScroll: true }), 60);
}
// the answers go where Cody already keeps them (so they're backed up with everything else)
function keep() {
  const s = S.get();
  if (answers.name) s.name = answers.name;
  if (answers.who) s.level = answers.who;
  if (answers.goals.length) s.goals = answers.goals;
  if (answers.subject && answers.date) s.exam = { subject: answers.subject, date: answers.date };
  S.save();
}

// 4. You're all set
function summary() {
  keep(); markSeen();
  box.dataset.step = 'summary';
  const who = (WHO.find((x) => x[0] === answers.who) || ['', ''])[1];
  const goals = answers.goals.map((g) => (GOALS.find((x) => x[0] === g) || ['', ''])[1]).filter(Boolean);
  const nice = (d) => new Date(d + 'T00:00').toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
  const rows = [
    ['Getting to know you', [answers.name, who].filter(Boolean).join(' · ') || 'Your study buddy'],
    ['What you came for', goals.length ? goals.slice(0, 2).join(', ') : 'Everything study'],
    ['Your next exam', answers.subject && answers.date ? `${answers.subject} · ${nice(answers.date)}` : 'Add it any time in Me'],
    ['Ready', 'Cody is set up for you'],
  ];
  box.innerHTML = `<section class="fr-summary" aria-live="polite">
    <div class="fr-sum-bot">${mascot('cheer', 96)}</div>
    <h1 class="fr-h"></h1>
    <p class="fr-sub">Your study buddy is ready.</p>
    <ul class="fr-set">${rows.map(() => `<li>${TICK}<span class="fr-set-t"><b></b><small></small></span></li>`).join('')}</ul>
    <button type="button" class="fr-go fr-set-go">Continue</button>
  </section>`;
  box.querySelector('.fr-h').textContent = `You’re all set${answers.name ? `, ${answers.name}` : ''}!`;
  const lis = box.querySelectorAll('.fr-set li');
  rows.forEach(([t, s], i) => { lis[i].querySelector('b').textContent = t; lis[i].querySelector('small').textContent = s; if (!still()) { lis[i].style.setProperty('--d', `${i * 0.5 + 0.2}s`); lis[i].classList.add('fr-set-rise'); } });
  box.querySelector('.fr-set-go').addEventListener('click', () => signIn(''));
  setTimeout(() => { const b = box && box.querySelector('.fr-set-go'); if (b) b.focus({ preventScroll: true }); }, 60);
}

// 5. the sign-in page (Cassie's: art on top, the form on a sheet; on a computer, side by side)
function deskArt() {
  const stars = [[40, 30], [96, 18], [150, 40], [204, 14], [118, 70], [60, 86], [232, 54]].map(([x, y], i) => `<circle class="aa-star" cx="${x}" cy="${y}" r="${i % 3 ? 1.4 : 2}" style="--i:${i}"/>`).join('');
  return `<svg class="auth-artsvg" viewBox="0 0 400 240" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
    <rect width="400" height="240" class="aa-sky"/>${stars}
    <rect class="aa-win" x="262" y="26" width="104" height="112" rx="14"/><circle class="aa-moonglow" cx="334" cy="60" r="22"/><circle class="aa-moon" cx="334" cy="60" r="14"/><circle class="aa-bite" cx="342" cy="54" r="12"/>
    <path class="aa-frame" d="M314 26 V138 M262 82 H366"/>
    <defs><linearGradient id="aa-glow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fde68a" stop-opacity=".38"/><stop offset="1" stop-color="#fde68a" stop-opacity="0"/></linearGradient></defs><path d="M92 104 L32 198 H184 Z" fill="url(#aa-glow)"/>
    <rect class="aa-desk" x="0" y="196" width="400" height="44"/><path class="aa-edge" d="M0 196.5 H400"/>
    <path class="aa-lamp" d="M66 196 L56 146 L92 104"/><ellipse class="aa-lampbase" cx="66" cy="196" rx="22" ry="5"/><path class="aa-shade" d="M78 92 L110 106 L102 122 L72 108 Z"/><circle class="aa-bulb" cx="94" cy="116" r="4"/>
    <g class="aa-books"><rect class="aa-b1" x="120" y="176" width="68" height="20" rx="3"/><rect class="aa-b2" x="126" y="158" width="58" height="18" rx="3"/><rect class="aa-b3" x="122" y="142" width="64" height="16" rx="3"/></g>
    <path class="aa-page" d="M300 198 L346 193 L346 168 L304 172 Z"/><path class="aa-page" d="M346 193 L392 198 L388 172 L346 168 Z"/><path class="aa-line" d="M310 180 L340 177 M310 186 L336 183 M352 177 L380 179 M352 183 L376 185"/>
  </svg>
  <div class="auth-bot">${mascot('happy', 112)}</div>`;
}
function signIn(message) {
  box.dataset.step = 'auth';
  box.classList.add('fr-auth');
  const held = S.get().owner; // this device still holds a signed-out account's things (its sign-in ran out)
  box.innerHTML = `<div class="auth-page">
    <div class="auth-brand">${LOGO}<span>Cody</span></div>
    <div class="auth-right">
      <div class="auth-art">${deskArt()}</div>
      <div class="auth-copy" aria-hidden="true"><p class="auth-kicker">Your study buddy</p><h2>Your notes.<br>On every device.</h2><p>Sign in once: your reviewers, quizzes, flashcards and points follow you from your phone to your laptop.</p></div>
    </div>
    <div class="auth-left">
      <div class="auth-form">
        <h1 class="auth-title">${held ? 'Welcome back' : 'Save your progress'}</h1>
        <p class="auth-sub">${held ? 'Your sign-in ran out. Sign in again to keep going.' : 'Sign in so everything you do in Cody is saved, on every device.'}</p>
        ${message ? `<p class="auth-err" role="alert">${esc(message)}</p>` : ''}
        <button type="button" class="auth-google">${GOOGLE}<span>Continue with Google</span></button>
        <p class="auth-note muted" aria-live="polite" hidden></p>
        <div class="auth-or"><span>or</span></div>
        <button type="button" class="auth-skip">${held ? 'Not you? Continue as a guest' : 'Continue as a guest'}</button>
        <p class="auth-guestnote">${held ? 'The last account’s things are removed from this device first. They stay safe in that account.' : 'As a guest, your work stays only on this device. You can sign in later and keep it.'}</p>
        <p class="auth-legal"><b>Your data is private.</b> Cody saves it only to sync it back to you, never sells it, and never shows it to other students. Classmates only see what you share in a study room. Delete your account and it’s gone. <a href="/terms.html">Terms</a> · <a href="/privacy.html">Privacy</a></p>
      </div>
    </div>
  </div>`;
  const g = box.querySelector('.auth-google'), note = box.querySelector('.auth-note');
  const say = (m) => { note.textContent = m; note.hidden = !m; };
  Acc.config().then((c) => { if (!c.google && box) { g.disabled = true; say('Google sign-in isn’t switched on for this Cody site yet. For now, continue as a guest.'); } });
  g.addEventListener('click', () => busy(g, 'Opening Google…', () => Acc.signIn().catch((e) => say(e.message))));
  box.querySelector('.auth-skip').addEventListener('click', () => {
    if (held) { S.wipe(); keep(); }
    S.get().guest = true; S.save(); finish();
  });
  setTimeout(() => { if (box && !g.disabled) g.focus({ preventScroll: true }); }, 60);
}
