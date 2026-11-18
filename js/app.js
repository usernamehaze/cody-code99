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

const NAV = [
  ['home', 'Home', '#/', ICON.home], ['reviewers', 'My reviewers', '#/reviewers', ICON.file], ['draw', 'Draw with Cody', '#/draw', ICON.pencil],
  ['quiz', 'Quiz', '#/quiz', ICON.quiz], ['flashcards', 'Flashcards', '#/flashcards', ICON.cards], ['label', 'Label it! game', '#/label', ICON.game], ['plan', 'Study plan', '#/plan', ICON.plan],
];
const TABS = [['home', 'Home', '#/'], ['reviewers', 'Reviewers', '#/reviewers'], ['draw', 'Draw', '#/draw'], ['label', 'Games', '#/label'], ['plan', 'Me', '#/plan']];
const SECTION = { reviewer: 'reviewers' };

const main = document.getElementById('main');
let cleanup = null;

function shell() {
  document.getElementById('side').innerHTML = `
    <a class="brand" href="#/">${LOGO}<span>Cody</span></a>
    <nav aria-label="Main">${NAV.map(([k, t, h, ic]) => `<a href="${h}" data-k="${k}">${ic}<span>${t}</span></a>`).join('')}</nav>
    <div class="streak-card"><b>🔥 <span class="n"></span></b><span class="muted msg"></span></div>`;
  document.getElementById('top').innerHTML = `<a class="brand" href="#/">${LOGO}<span>Cody</span></a><a class="pill streak-pill" href="#/plan">🔥 <b class="n"></b></a>`;
  document.getElementById('tabs').innerHTML = TABS.map(([k, t, h]) => `<a href="${h}" data-k="${k}">${t}</a>`).join('');
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
    label: () => label.render(main, id), plan: () => plan.render(main),
  };
  cleanup = (views[name || 'home'] || views.home)() || null;
  streakCard();
  main.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

S.load();
shell();
S.onChange(streakCard);
window.addEventListener('hashchange', route);
route();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('/sw.js').catch(() => {});
