import * as S from '../store.js';
import { esc, fmt, header, ICON } from '../ui.js';

const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Magandang umaga' : h < 18 ? 'Magandang hapon' : 'Magandang gabi'; };

export function render(root) {
  const s = S.get();
  const d = S.daysToExam();
  const sub = d == null ? "Here is today's plan." : d === 0 ? `${s.exam.subject || 'Your'} exam is today. Here is a quick review.` : `${s.exam.subject || 'Your'} exam in ${d} day${d === 1 ? '' : 's'}. Here is today's plan.`;
  const plan = S.todaysPlan();
  const wk = S.week(); const max = Math.max(20, ...wk.map((x) => x.min));
  const board = [...s.classmates, { name: s.name || 'You', points: s.points, me: true }].sort((a, b) => b.points - a.points).slice(0, 4);
  root.innerHTML = `
    ${header(`${greeting()}${s.name ? ', ' + s.name : ''}!`, sub, `<a class="btn primary" href="#/reviewers?upload=1">+ Upload my notes</a>`)}
    <section class="stats">
      <div class="card stat"><span>Study streak</span><b>${S.streak()} day${S.streak() === 1 ? '' : 's'}</b></div>
      <div class="card stat"><span>Cards learned</span><b>${fmt(S.learnedCount())}</b></div>
      <div class="card stat"><span>Quiz score this week</span><b>${S.weekQuizScore()}%</b></div>
      <div class="card stat"><span>Points</span><b class="gold">${fmt(s.points)}</b></div>
    </section>
    <section class="grid-2 grow">
      <div class="card">
        <h2 class="eyebrow">Today's plan, made by Cody</h2>
        <ul class="plan">${plan.map((it) => `
          <li class="${it.done ? 'done' : ''}">
            <button class="tick" data-id="${esc(it.id)}" role="checkbox" aria-checked="${it.done}" aria-label="Mark done: ${esc(it.text)}">${it.done ? ICON.check : ''}</button>
            <a href="${esc(it.go)}">${esc(it.text)}</a><span class="muted">${it.min} min</span>
          </li>`).join('')}</ul>
      </div>
      <div class="card">
        <h2 class="eyebrow">This week</h2>
        <div class="bars" role="img" aria-label="Minutes studied each day this week">${wk.map((x) => `
          <div class="bar ${x.today ? 'today' : ''} ${x.future || !x.min ? 'low' : ''}"><i style="height:${Math.max(6, Math.round((x.min / max) * 100))}%" title="${x.min} min"></i><span>${x.name}</span></div>`).join('')}
        </div>
        <h2 class="eyebrow gap">Class leaderboard</h2>
        <ol class="leaders">${board.map((p, i) => `
          <li class="${p.me ? 'me' : ''}"><span class="rank">${i + 1}</span><span class="avatar">${esc((p.name || '?').slice(0, 2).toUpperCase())}</span><span class="who">${esc(p.name)}${p.me ? ' (you)' : ''}</span><b class="gold">${fmt(p.points)}</b></li>`).join('')}
        </ol>
      </div>
    </section>`;
  root.querySelectorAll('.tick').forEach((b) => b.addEventListener('click', () => {
    const it = plan.find((x) => x.id === b.dataset.id);
    S.markPlan(it.id, !it.done);
    render(root);
  }));
}
