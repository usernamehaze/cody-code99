/* Cody the mascot: the logo come to life. A teal block with curly-brace arms (a coder's hug), big eyes,
   and an antenna with an idea spark. All SVG, no images, so it stays sharp and tiny.
     mascot(mood, size)  -> SVG markup. Moods: happy, think, cheer, oops, draw, sleepy, wave
     react(mood, say)    -> anywhere in the app: Cody in the sidebar (or the phone's top bar) changes mood
                            and says something in a bubble. Screens call it on a right answer, a finished game…
   Reduced motion: no bobbing or blinking. */
import { esc } from './ui.js';

const INK = '#0b2b33', LIMB = '#99f6e4', FOOT = '#14b8a6';
const eyes = {
  happy: `<g class="cm-eyes"><ellipse cx="47" cy="56" rx="9" ry="10.5" fill="#fff"/><ellipse cx="73" cy="56" rx="9" ry="10.5" fill="#fff"/><circle cx="48.5" cy="57.5" r="5" fill="${INK}"/><circle cx="74.5" cy="57.5" r="5" fill="${INK}"/><circle cx="50.3" cy="55.4" r="1.7" fill="#fff"/><circle cx="76.3" cy="55.4" r="1.7" fill="#fff"/></g>`,
  think: `<g class="cm-eyes"><ellipse cx="47" cy="56" rx="9" ry="10.5" fill="#fff"/><ellipse cx="73" cy="56" rx="9" ry="10.5" fill="#fff"/><circle cx="51" cy="52" r="4.6" fill="${INK}"/><circle cx="77" cy="52" r="4.6" fill="${INK}"/></g>`,
  draw: `<g class="cm-eyes"><ellipse cx="47" cy="56" rx="9" ry="10.5" fill="#fff"/><ellipse cx="73" cy="56" rx="9" ry="10.5" fill="#fff"/><circle cx="45" cy="60" r="4.6" fill="${INK}"/><circle cx="71" cy="60" r="4.6" fill="${INK}"/></g>`,
  cheer: `<path d="M39 58 Q47 47 55 58 M65 58 Q73 47 81 58" fill="none" stroke="${INK}" stroke-width="4.2" stroke-linecap="round"/>`,
  oops: `<g><ellipse cx="47" cy="57" rx="8" ry="9" fill="#fff"/><ellipse cx="73" cy="57" rx="8" ry="9" fill="#fff"/><circle cx="47" cy="58" r="4.2" fill="${INK}"/><circle cx="73" cy="58" r="4.2" fill="${INK}"/><path d="M38 47 L53 42 M82 47 L67 42" stroke="${INK}" stroke-width="3.4" stroke-linecap="round"/></g>`,
  sleepy: `<path d="M39 58 Q47 63 55 58 M65 58 Q73 63 81 58" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`,
};
eyes.wave = eyes.happy;
const mouth = {
  happy: `<path d="M51 72 Q60 81 69 72" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`,
  wave: `<path d="M50 71 Q60 84 70 71 Z" fill="${INK}"/><path d="M54 76 Q60 80 66 76" fill="#f7687f"/>`,
  think: `<path d="M53 75 L66 73" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`,
  draw: `<path d="M55 73 Q60 77 65 73" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/><path d="M64 76 q3 3 6 1" fill="none" stroke="#f7687f" stroke-width="3" stroke-linecap="round"/>`,
  cheer: `<path d="M48 69 Q60 88 72 69 Z" fill="${INK}"/><path d="M53 76 Q60 82 67 76" fill="#f7687f"/>`,
  oops: `<ellipse cx="60" cy="75" rx="4.5" ry="5" fill="${INK}"/>`,
  sleepy: `<path d="M55 74 Q60 77 65 74" fill="none" stroke="${INK}" stroke-width="3.4" stroke-linecap="round"/>`,
};
// the brace arms: resting at the sides, or thrown up to cheer, or one up to wave
const arms = {
  rest: `<path d="M22 38 q-9 0 -9 9 v8 q0 5 -6 7 q6 2 6 7 v8 q0 9 9 9" /><path d="M98 38 q9 0 9 9 v8 q0 5 6 7 q-6 2 -6 7 v8 q0 9 -9 9" />`,
  up: `<path d="M24 46 q-8 -2 -10 -10 l-2 -8 q-1 -5 -7 -6 q5 -3 4 -8 l-2 -8 q-2 -9 5 -12" /><path d="M96 46 q8 -2 10 -10 l2 -8 q1 -5 7 -6 q-5 -3 -4 -8 l2 -8 q2 -9 -5 -12" />`,
  wave: `<path d="M22 38 q-9 0 -9 9 v8 q0 5 -6 7 q6 2 6 7 v8 q0 9 9 9" /><g class="cm-wave"><path d="M96 46 q8 -2 10 -10 l2 -8 q1 -5 7 -6 q-5 -3 -4 -8 l2 -8 q2 -9 -5 -12" /></g>`,
};
const pencil = `<g transform="rotate(35 100 84)"><rect x="96" y="62" width="9" height="30" rx="2" fill="#fbbf24"/><path d="M96 92 L100.5 102 L105 92 Z" fill="#fde68a"/><path d="M99 98 L100.5 102 L102 98 Z" fill="${INK}"/><rect x="96" y="58" width="9" height="6" rx="2" fill="#f7687f"/></g>`;

export function mascot(mood = 'happy', size = 72) {
  const m = eyes[mood] ? mood : 'happy';
  const arm = m === 'cheer' ? arms.up : m === 'wave' ? arms.wave : arms.rest;
  const extra = m === 'sleepy' ? `<text x="92" y="22" class="cm-z" fill="#94a3b8" font-size="16" font-weight="800">z</text><text x="102" y="10" class="cm-z cm-z2" fill="#94a3b8" font-size="11" font-weight="800">z</text>`
    : m === 'cheer' ? `<g class="cm-confetti"><rect x="6" y="18" width="5" height="5" fill="#fbbf24" transform="rotate(20 8 20)"/><rect x="108" y="22" width="5" height="5" fill="#f7687f" transform="rotate(-25 110 24)"/><circle cx="18" cy="6" r="2.6" fill="#60a5fa"/><circle cx="104" cy="6" r="2.6" fill="#a78bfa"/></g>`
    : m === 'think' ? `<g class="cm-dots" fill="#cbd5e1"><circle cx="96" cy="24" r="2.6"/><circle cx="104" cy="16" r="3.2"/><circle cx="113" cy="7" r="3.8"/></g>` : '';
  return `<svg class="cm cm-${m}" viewBox="0 0 120 120" width="${size}" height="${size}" aria-hidden="true" overflow="visible">
    <g class="cm-body">
      <path d="M60 24 V12" stroke="${LIMB}" stroke-width="3.4" stroke-linecap="round"/>
      <path class="cm-spark" d="M60 1 L62.6 6.4 L68.4 7 L64 10.8 L65.3 16.6 L60 13.6 L54.7 16.6 L56 10.8 L51.6 7 L57.4 6.4 Z" fill="#fbbf24"/>
      <g fill="none" stroke="${LIMB}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" class="cm-arms">${arm}</g>
      <rect x="24" y="24" width="72" height="72" rx="22" fill="#2dd4bf"/>
      <path d="M24 70 Q24 96 46 96 H74 Q96 96 96 70 Q60 84 24 70 Z" fill="#22b8a6"/>
      <ellipse cx="40" cy="70" rx="5" ry="3" fill="#f7687f" opacity=".45"/><ellipse cx="80" cy="70" rx="5" ry="3" fill="#f7687f" opacity=".45"/>
      ${eyes[m]}${mouth[m]}
      <ellipse cx="46" cy="99" rx="9" ry="5" fill="${FOOT}"/><ellipse cx="74" cy="99" rx="9" ry="5" fill="${FOOT}"/>
      ${m === 'draw' ? pencil : ''}
    </g>${extra}
  </svg>`;
}

// ---------- Cody in the sidebar / top bar: moods and speech bubbles ----------
const TIPS = [
  'Tip: tap ✎ Draw it on any term and I will draw it for you.',
  'Missed cards come back sooner. That is how memory sticks!',
  'Stuck? Ask me for a Hint instead of the answer.',
  'Five minutes of flashcards keeps your streak alive.',
  'Kaya mo yan! One topic at a time.',
  'Try teaching me what you learned. Explaining is the best review.',
];
let slot = null, timer = null, idle = null, sleeping = false;
function paint(mood, say, ms = 4200) {
  if (!slot) return;
  slot.querySelectorAll('.cm-face').forEach((f) => { f.innerHTML = mascot(mood, +f.dataset.size); });
  const bubbles = slot.querySelectorAll('.cm-bubble');
  bubbles.forEach((b) => { b.textContent = say || ''; b.classList.toggle('on', !!say); });
  clearTimeout(timer);
  if (ms) timer = setTimeout(() => { bubbles.forEach((b) => b.classList.remove('on')); if (!sleeping) slot.querySelectorAll('.cm-face').forEach((f) => { f.innerHTML = mascot('happy', +f.dataset.size); }); }, ms);
}
export function react(mood, say, ms) { sleeping = mood === 'sleepy'; paint(mood, say, ms); wake(); }
function wake() {
  clearTimeout(idle);
  idle = setTimeout(() => { sleeping = true; paint('sleepy', 'Zzz… tap me when you are back!', 0); }, 4 * 60 * 1000);
}
// el: elements that hold Cody (.cm-face with data-size, and an optional .cm-bubble)
export function mount(els) {
  slot = { querySelectorAll: (sel) => els.flatMap((e) => [...e.querySelectorAll(sel)]) };
  els.forEach((e) => e.querySelectorAll('.cm-face').forEach((f) => {
    f.innerHTML = mascot('wave', +f.dataset.size);
    f.addEventListener('click', () => react(sleeping ? 'wave' : 'happy', sleeping ? 'I am awake! Let us study.' : TIPS[Math.floor(Math.random() * TIPS.length)]));
  }));
  window.addEventListener('cody:react', (e) => react(e.detail.mood, e.detail.say, e.detail.ms));
  ['pointerdown', 'keydown'].forEach((ev) => window.addEventListener(ev, () => { if (sleeping) { sleeping = false; paint('wave', 'Welcome back!', 2500); } wake(); }, { passive: true }));
  setTimeout(() => paint('wave', 'Hi! I am Cody, your study buddy.', 3800), 600);
  wake();
}
// for screens: window-level, so they don't need to import this file
export const say = (mood, text, ms) => window.dispatchEvent(new CustomEvent('cody:react', { detail: { mood, say: text, ms } }));
export const bubbleHtml = (text) => `<span class="cm-bubble">${esc(text || '')}</span>`;
