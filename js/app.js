/* Cody: the app shell. A sidebar (a bottom bar on phones), a hash router and the streak card. */
import * as S from './store.js';
import { ICON, LOGO, esc, hush } from './ui.js';
import * as home from './views/home.js';
import * as reviewers from './views/reviewers.js';
import * as draw from './views/draw.js';
import * as quiz from './views/quiz.js';
import * as cards from './views/cards.js';
import * as label from './views/label.js';
import * as plan from './views/plan.js';
import * as importer from './views/import.js';
import * as chat from './views/chat.js';
import * as Mascot from './mascot.js';
import * as Class from './classroom.js';

const NAV = [
  ['home', 'Home', '#/', ICON.home], ['chat', 'Ask Cody', '#/chat', ICON.chat], ['reviewers', 'My reviewers', '#/reviewers', ICON.file], ['draw', 'Draw with Cody', '#/draw', ICON.pencil],
  ['quiz', 'Quiz', '#/quiz', ICON.quiz], ['flashcards', 'Flashcards', '#/flashcards', ICON.cards], ['label', 'Label it! game', '#/label', ICON.game], ['plan', 'Study plan', '#/plan', ICON.plan],
];
const TABS = [['home', 'Home', '#/', ICON.home], ['reviewers', 'Reviewers', '#/reviewers', ICON.file], ['chat', 'Ask', '#/chat', ICON.chat], ['label', 'Games', '#/label', ICON.game], ['plan', 'Me', '#/plan', ICON.me]];
const SECTION = { reviewer: 'reviewers', import: 'reviewers' };

const main = document.getElementById('main');
let cleanup = null;

function shell() {
  document.getElementById('side').innerHTML = `
    <a class="brand" href="#/">${LOGO}<span>Cody</span></a>
    <nav aria-label="Main">${NAV.map(([k, t, h, ic]) => `<a href="${h}" data-k="${k}">${ic}<span>${t}</span></a>`).join('')}</nav>
    <div class="buddy"><span class="cm-bubble" role="status"></span><button class="cm-face" data-size="84" aria-label="Cody, your study buddy. Tap for a tip."></button></div>
    <div class="streak-card"><b>🔥 <span class="n"></span></b><span class="muted msg"></span></div>`;
  document.getElementById('top').innerHTML = `<a class="brand" href="#/">${LOGO}<span>Cody</span></a><div class="top-right"><button class="cm-face" data-size="40" aria-label="Cody, your study buddy. Tap for a tip."></button><a class="pill streak-pill" href="#/plan">🔥 <b class="n"></b></a></div><span class="cm-bubble top-bubble" role="status"></span>`;
  Mascot.mount([document.getElementById('side'), document.getElementById('top')]);
  // a floating pill (like Cassie's): icons only, and the open tab grows into a teal pill with its name
  document.getElementById('tabs').innerHTML = TABS.map(([k, t, h, ic]) => `<a href="${h}" data-k="${k}" aria-label="${t}">${ic}<span>${t}</span></a>`).join('');
}
function streakCard() {
  const n = S.streak();
  document.querySelectorAll('.streak-card .n').forEach((e) => { e.textContent = `${n} day${n === 1 ? '' : 's'}`; });
  document.querySelectorAll('.streak-pill .n').forEach((e) => { e.textContent = n; });
  const msg = document.querySelector('.streak-card .msg');
  if (msg) msg.textContent = S.studiedToday() ? 'Study streak. You studied today, nice!' : n ? 'Study streak. Review today to keep it going.' : 'Study today to start a streak.';
}

function route() {
  if (cleanup) { try { cleanup(); } catch (e) { /* the old screen is gone anyway */ } cleanup = null; }
  hush();
  const [path, query] = location.hash.replace(/^#\/?/, '').split('?');
  const [name = '', id] = path.split('/').map(decodeURIComponent);
  const params = new URLSearchParams(query || '');
  const k = SECTION[name] || name || 'home';
  document.querySelectorAll('[data-k]').forEach((a) => a.classList.toggle('on', a.dataset.k === k));
  main.className = 'main page-' + k;
  const views = {
    home: () => home.render(main), reviewers: () => reviewers.renderList(main, params), reviewer: () => reviewers.renderOne(main, id),
    draw: () => draw.render(main, id, params), quiz: () => quiz.render(main, id), flashcards: () => cards.render(main, id),
    label: () => label.render(main, id), chat: () => chat.render(main, id, params), plan: () => plan.render(main), import: () => importer.render(main, params),
  };
  cleanup = (views[name || 'home'] || views.home)() || null;
  streakCard();
  main.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

S.load();
shell();
S.onChange(streakCard);
Class.watch();
window.addEventListener('hashchange', route);
route();
if ('serviceWorker' in navigator && location.protocol === 'https:' && !window.CODY_NATIVE) navigator.serviceWorker.register('/sw.js').catch(() => {});
