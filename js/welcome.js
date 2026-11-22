/* The first thing a student sees: three short onboarding cards (once per device), then the sign-in screen.
   Signing in keeps everything they do in Cody saved to their own account. Nothing they make is shown to
   anyone else, except what they share in a study room. "Try without an account" keeps work on this device only. */
import * as S from './store.js';
import * as Acc from './account.js';
import { mascot } from './mascot.js';
import { esc, busy } from './ui.js';

const SEEN = 'cody.onboarded';
const SLIDES = [
  { mood: 'wave', title: 'Hi, I’m Cody!', text: 'Give me your notes, a PDF or a photo of your notebook. I’ll turn it into a reviewer, a quiz and flashcards in seconds.' },
  { mood: 'draw', title: 'I draw it, then you play it', text: 'Ask me how anything works and I’ll draw it step by step. Then name the parts of my drawing in the Label it! game.' },
  { mood: 'cheer', title: 'Study together', text: 'Join a study room with your class’s 6-letter code. Draw on one board, chat, send voice messages and share reviewers.' },
];
const GOOGLE = '<svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.2-.1-2.3-.4-3.5z"/></svg>';
const CHECK = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const seen = () => { try { return localStorage.getItem(SEEN) === '1'; } catch (e) { return true; } };
const markSeen = () => { try { localStorage.setItem(SEEN, '1'); } catch (e) { /* private mode */ } };
// who must see this screen: nobody signed in, and not trying Cody without an account
export const needed = () => !Acc.me() && !S.get().guest;

let box = null;
export function show({ message = '', onDone }) {
  document.body.classList.add('gated');
  box = box || document.body.appendChild(Object.assign(document.createElement('div'), { id: 'gate' }));
  box.setAttribute('role', 'main');
  const finish = () => { document.body.classList.remove('gated'); box.remove(); box = null; onDone(); };
  if (seen() || message) login(message, finish); else slide(0, finish);
}

function slide(i, finish) {
  const s = SLIDES[i], last = i === SLIDES.length - 1;
  box.innerHTML = `<div class="gate-in onboard">
      <div class="gate-top"><span class="gate-step">${i + 1} of ${SLIDES.length}</span><button type="button" class="btn ghost small ob-skip">Skip</button></div>
      <div class="ob-art">${mascot(s.mood, 150)}</div>
      <h1>${esc(s.title)}</h1>
      <p class="ob-text">${esc(s.text)}</p>
      <div class="dots" aria-hidden="true">${SLIDES.map((_, j) => `<i class="${j === i ? 'on' : ''}"></i>`).join('')}</div>
      <div class="gate-actions">${i ? '<button type="button" class="btn back">Back</button>' : ''}<button type="button" class="btn primary next">${last ? 'Get started' : 'Next'}</button></div>
    </div>`;
  const go = () => { if (last) { markSeen(); login('', finish); } else slide(i + 1, finish); };
  box.querySelector('.next').addEventListener('click', go);
  box.querySelector('.ob-skip').addEventListener('click', () => { markSeen(); login('', finish); });
  const back = box.querySelector('.back'); if (back) back.addEventListener('click', () => slide(i - 1, finish));
  box.querySelector('.next').focus();
}

function login(message, finish) {
  const held = S.get().owner; // this device still holds a signed-out account's things (its sign-in ran out)
  box.innerHTML = `<div class="gate-in login">
      <div class="ob-art sm">${mascot('happy', 112)}</div>
      <h1>Sign in to save your progress</h1>
      <ul class="perks">
        <li>${CHECK}<span>Your reviewers, quizzes, flashcards, chats and points are saved to your account.</span></li>
        <li>${CHECK}<span>Pick up where you left off on any phone or computer.</span></li>
        <li>${CHECK}<span><b>Private to you.</b> Nobody else can see your things. Classmates only see what you share in a study room.</span></li>
      </ul>
      ${message ? `<p class="gate-msg" role="alert">${esc(message)}</p>` : ''}
      <button type="button" class="btn google big">${GOOGLE} Continue with Google</button>
      <p class="muted small acct-msg" aria-live="polite"></p>
      <button type="button" class="btn ghost guest">${held ? 'Not you? Use Cody without an account' : 'Try without an account'}</button>
      <p class="muted small guest-note">${held ? 'The last account’s things are removed from this device first. They stay safe in that account.' : 'Without an account, your work stays only on this device and can’t be moved to another one. You can sign in later and keep it.'}</p>
      <p class="legal">By continuing you agree to Cody’s <a class="link" href="/terms.html">Terms</a> and <a class="link" href="/privacy.html">Privacy</a>.</p>
    </div>`;
  const g = box.querySelector('.google');
  Acc.config().then((c) => { if (!c.google && box) { g.disabled = true; box.querySelector('.acct-msg').textContent = 'Google sign-in isn’t switched on for this Cody site yet, so for now you can try Cody without an account.'; } });
  g.addEventListener('click', () => busy(g, 'Opening Google…', () => Acc.signIn().catch((e) => { box.querySelector('.acct-msg').textContent = e.message; })));
  box.querySelector('.guest').addEventListener('click', () => {
    if (held) S.wipe();
    S.get().guest = true; S.save(); finish();
  });
  g.focus();
}
