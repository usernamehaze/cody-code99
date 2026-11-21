import * as S from '../store.js';
import { ask } from '../ai.js';
import { mount } from '../draw.js';
import { pick } from './label.js';
import { esc, header, ICON, busy } from '../ui.js';
import { say } from '../mascot.js';

export function render(root, id) {
  if (!id) return pick(root, 'quiz', 'Quiz', 'Pick a reviewer. Cody explains every answer.');
  const rev = S.reviewer(id);
  if (!rev) { location.hash = '#/quiz'; return; }
  const qs = rev.quiz.slice(0, 10);
  let i = 0, score = 0, points = 0, answered = false;

  function view() {
    const q = qs[i];
    root.innerHTML = `
      ${header(`Quiz: ${rev.title}`, `Question ${i + 1} of ${qs.length} · from your reviewer`, `
        <span class="pill">Score <b class="teal">${score} / ${i + (answered ? 1 : 0)}</b></span><span class="pill">Points <b class="gold">+${points}</b></span>`)}
      <div class="progress wide"><i style="width:${((i + (answered ? 1 : 0)) / qs.length) * 100}%"></i></div>
      <section class="grid-2 grow">
        <div class="card"><h2 class="eyebrow">Question ${i + 1}</h2>
          <p class="question">${esc(q.q)}</p>
          <div class="choices" role="group" aria-label="Choices">${q.choices.map((c, k) => `<button class="choice" data-k="${k}"><span class="letter">${'ABCD'[k]}</span><span>${esc(c)}</span></button>`).join('')}</div>
        </div>
        <div class="card why" ${answered ? '' : 'hidden'}><h2 class="eyebrow">Why</h2><p class="why-text"></p>
          <div class="board sm" id="why-board"></div><p class="more muted" hidden></p>
          <div class="controls two end"><button class="btn explain">Explain more</button><button class="btn primary next">${i === qs.length - 1 ? 'See my score' : 'Next question'}</button></div>
        </div>
      </section>`;
    root.querySelectorAll('.choice').forEach((b) => b.addEventListener('click', () => choose(+b.dataset.k)));
  }
  function choose(k) {
    if (answered) return; answered = true;
    const q = qs[i], right = k === q.a;
    if (right) { score++; points += 10; say('cheer', ['Tama! +10', 'Galing! +10', 'You got it! +10'][score % 3], 2600); }
    else say('oops', 'Almost! Read the Why, then try the next one.', 3200);
    root.querySelectorAll('.choice').forEach((b) => {
      const n = +b.dataset.k; b.disabled = true;
      if (n === q.a) { b.classList.add('right'); b.insertAdjacentHTML('beforeend', `<span class="mark">${ICON.check}</span>`); }
      else if (n === k) b.classList.add('wrong');
    });
    root.querySelector('.pill b.teal').textContent = `${score} / ${i + 1}`;
    root.querySelector('.pill b.gold').textContent = `+${points}`;
    root.querySelector('.progress i').style.width = `${((i + 1) / qs.length) * 100}%`;
    const why = root.querySelector('.why'); why.hidden = false;
    why.querySelector('.why-text').textContent = (right ? 'Correct! ' : `Not quite. The answer is "${q.choices[q.a]}". `) + (q.why || '');
    const board = why.querySelector('#why-board');
    if (rev.drawing && q.part && rev.drawing.parts.some((p) => p.id === q.part)) { const c = mount(board, rev.drawing, {}); c.showAll(); c.highlight(q.part); } else board.remove();
    why.querySelector('.explain').addEventListener('click', (e) => {
      const btn = e.currentTarget, more = why.querySelector('.more');
      busy(btn, 'Asking Cody…', async () => {
        try { const { data } = await ask('explain', { question: q.q, answer: q.choices[q.a], why: q.why, topic: rev.title }); more.textContent = data.text; }
        catch (err) { const t = rev.terms.find((x) => x.part && x.part === q.part); more.textContent = t ? `${t.term}: ${t.meaning}` : err.message; }
        more.hidden = false;
      }).then(() => { btn.remove(); });
    });
    why.querySelector('.next').addEventListener('click', () => { if (i < qs.length - 1) { i++; answered = false; view(); } else done(); });
    why.querySelector('.next').focus();
  }
  function done() {
    const pct = Math.round((score / qs.length) * 100);
    say(pct >= 70 ? 'cheer' : 'happy', pct >= 70 ? `${pct}%! I’m proud of you.` : 'Good effort! Let’s review the tricky ones.');
    S.quizDone(rev.id, pct); S.award(points, qs.length); S.markPlan('quiz-' + rev.id);
    const msg = pct >= 90 ? 'Galing! You know this topic well.' : pct >= 70 ? 'Nice work. A quick review and you will ace it.' : 'Keep going. Cody will put this topic in your plan.';
    root.innerHTML = `${header(`Quiz: ${rev.title}`, 'Finished')}
      <section class="card result"><p class="big">${score} / ${qs.length}</p><p>${pct}% · +${points} points</p><p class="muted">${msg}</p>
        <div class="row center"><button class="btn again">Try again</button><a class="btn" href="#/flashcards/${esc(rev.id)}">Review flashcards</a><a class="btn primary" href="#/label/${esc(rev.id)}">Play Label it!</a></div></section>`;
    root.querySelector('.again').addEventListener('click', () => render(root, id));
  }
  view();
}
