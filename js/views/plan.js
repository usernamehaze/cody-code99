import * as S from '../store.js';
import { esc, header, toast } from '../ui.js';

const DAY = 864e5;
const nice = (t) => new Date(t).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' });

// a day-by-day plan up to the exam: new reviewers first, a different topic each day, the weak topic twice,
// and a last-day review of everything
function schedule() {
  const s = S.get(), d = S.daysToExam();
  const revs = [...s.reviewers].sort((a, b) => (s.quiz[a.id] ? s.quiz[a.id].last : 0) - (s.quiz[b.id] ? s.quiz[b.id].last : 0));
  if (d == null || !revs.length) return [];
  const days = Math.min(d, 21), out = [];
  for (let k = 0; k <= days; k++) {
    const t = Date.now() + k * DAY;
    if (k === days && days > 0) { out.push({ t, items: ['Light review: flashcards due', 'One quiz on each topic', 'Sleep early. You are ready!'] }); continue; }
    const r = revs[k % revs.length];
    out.push({ t, today: k === 0, items: [`Read: ${r.title}`, `Flashcards due`, k % 2 ? `Label it! ${r.title}` : `Draw with Cody: ${r.title}`, `Quiz: ${r.title}`] });
  }
  return out;
}

export function render(root) {
  const s = S.get();
  const plan = schedule();
  root.innerHTML = `
    ${header('Study plan', S.daysToExam() == null ? 'Set your exam date and Cody plans every day until then.' : `${S.daysToExam()} day${S.daysToExam() === 1 ? '' : 's'} to your ${s.exam.subject || ''} exam`)}
    <section class="grid-2 grow">
      <div class="card"><h2 class="eyebrow">Day by day</h2>
        ${plan.length ? `<ol class="days">${plan.map((p) => `<li class="${p.today ? 'today' : ''}"><b>${p.today ? 'Today' : nice(p.t)}</b><ul>${p.items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></li>`).join('')}</ol>` : '<p class="muted">Add your exam date on the right.</p>'}
      </div>
      <div class="col">
        <form class="card settings"><h2 class="eyebrow">You and your exam</h2>
          <label>Your name<input name="name" value="${esc(s.name)}" maxlength="30" autocomplete="given-name"></label>
          <label>Exam subject<input name="subject" value="${esc(s.exam.subject || '')}" maxlength="40"></label>
          <label>Exam date<input type="date" name="date" value="${esc(s.exam.date || '')}"></label>
          <button class="btn primary">Save</button>
        </form>
        <div class="card"><h2 class="eyebrow">Your data</h2>
          <p class="muted">Everything Cody keeps stays on this device. Nothing is shared.</p>
          <div class="row"><button class="btn small fresh">Start fresh</button><button class="btn small demo">Load the demo again</button></div>
        </div>
      </div>
    </section>`;
  const f = root.querySelector('.settings');
  f.addEventListener('submit', (e) => { e.preventDefault(); s.name = f.name.value.trim(); s.exam = { subject: f.subject.value.trim(), date: f.date.value }; S.save(); toast('Saved. Cody updated your plan.'); render(root); });
  root.querySelector('.fresh').addEventListener('click', () => { if (confirm('Start fresh? Your points, streak and your own reviewers will be cleared.')) { S.reset(false); location.hash = '#/plan'; render(root); } });
  root.querySelector('.demo').addEventListener('click', () => { if (confirm('Load the demo? This replaces what is here now.')) { S.reset(true); location.hash = '#/'; } });
}
