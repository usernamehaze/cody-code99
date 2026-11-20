import * as S from '../store.js';
import { mount } from '../draw.js';
import { esc, header } from '../ui.js';
import { emptyState } from '../mascot.js';

export function render(root, deckId) {
  const decks = S.decks();
  if (!decks.length) {
    root.innerHTML = `${header('Flashcards', 'Cards you miss come back sooner, so they stick.')}<section class="card">${emptyState({ mood: 'happy', title: 'No flashcards yet', text: 'Every reviewer Cody makes from your notes comes with its own deck of cards.', actions: [{ label: 'Upload my notes', href: '#/reviewers?upload=1' }] })}</section>`;
    return undefined;
  }
  if (!deckId) deckId = (decks.find((d) => d.due) || decks[0] || {}).id;
  const rev = deckId && S.reviewer(deckId);
  let queue = deckId ? S.dueCards(deckId) : [];
  const total = queue.length;
  let n = 0, flipped = false;

  function deckList() {
    return `<div class="card panel"><h2 class="eyebrow">Your decks</h2>
      <ul class="decks">${S.decks().map((d) => `<li class="${d.id === deckId ? 'on' : ''}"><a href="#/flashcards/${esc(d.id)}"><span class="box" aria-hidden="true"></span>${esc(d.name)}<span class="muted">${d.due ? `${d.due} due` : 'done'}</span></a></li>`).join('')}</ul>
      <p class="muted">Every reviewer becomes a deck with one tap, with Cody's drawing on the back of each card.</p></div>`;
  }
  function view() {
    const c = queue[0];
    root.innerHTML = `
      ${header(`Flashcards: ${rev ? rev.title : ''}`, `${total} due today · cards you miss come back sooner`, total ? `<span class="pill"><b>${Math.min(n + 1, total)} of ${total}</b></span>` : '')}
      <section class="split grow">
        <div class="col">${c ? `
          <button class="flash ${flipped ? 'flipped' : ''}" aria-live="polite">
            ${flipped ? `<span class="eyebrow">Answer</span><b class="front small">${esc(c.front)}</b><span class="back">${esc(c.back)}</span><span class="board xs" id="card-board"></span>`
              : `<span class="eyebrow">Tap to flip</span><b class="front">${esc(c.front)}</b><span class="muted">What is it, and what does it do?</span>`}
          </button>
          <div class="grades">
            <button class="btn grade again" data-g="again" ${flipped ? '' : 'disabled'}>Again</button>
            <button class="btn grade almost" data-g="almost" ${flipped ? '' : 'disabled'}>Almost</button>
            <button class="btn primary grade got" data-g="got" ${flipped ? '' : 'disabled'}>Got it</button>
          </div>
          <p class="muted keys">Keys: space to flip · 1 Again · 2 Almost · 3 Got it</p>`
          : `<div class="card result"><p class="big">🎉</p><p>No cards due in this deck.</p><p class="muted">Cody will bring them back when it is time to review.</p>${rev ? `<a class="btn primary" href="#/quiz/${esc(rev.id)}">Quiz me instead</a>` : ''}</div>`}
        </div>
        ${deckList()}
      </section>`;
    if (!c) { S.markPlan('cards'); return; }
    root.querySelector('.flash').addEventListener('click', flip);
    root.querySelectorAll('.grade').forEach((b) => b.addEventListener('click', () => grade(b.dataset.g)));
    if (flipped && c.part && rev && rev.drawing) { const ctl = mount(root.querySelector('#card-board'), rev.drawing, { labels: 'none' }); if (ctl) { ctl.showAll(false); ctl.highlight(c.part); } }
  }
  function flip() { flipped = !flipped; view(); }
  function grade(g) {
    const c = queue.shift(); if (!c) return;
    S.grade(c.id, g);
    if (g === 'again') queue.push(c); else n++;
    flipped = false; view();
  }
  const keys = (e) => {
    if (!root.isConnected || e.target.closest('input,textarea')) return;
    if (e.key === ' ') { e.preventDefault(); if (queue.length) flip(); }
    else if (flipped && ['1', '2', '3'].includes(e.key)) grade(['again', 'almost', 'got'][+e.key - 1]);
  };
  document.addEventListener('keydown', keys);
  view();
  return () => document.removeEventListener('keydown', keys);
}
