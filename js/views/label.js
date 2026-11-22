import * as S from '../store.js';
import { mount } from '../draw.js';
import { esc, header, toast } from '../ui.js';
import { say, emptyState } from '../mascot.js';

// "The aorta is the biggest artery" -> "This part is the biggest artery" (the tip must not give the name away)
const hideName = (say, label) => { const t = say.replace(new RegExp(`(the\\s+)?${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'ig'), 'this part'); return t.charAt(0).toUpperCase() + t.slice(1); };

export function pick(root, kind, title, sub) { // a chooser, when no reviewer is picked yet
  const list = S.get().reviewers.filter((r) => kind !== 'label' || (r.drawing && r.drawing.mode !== '3d' && r.game && r.game.length)); // (Label it! plays on flat drawings)
  root.innerHTML = `${header(title, list.length ? sub : '')}
    ${list.length ? `<section class="pick">${list.map((r) => `<a class="card pick-item" href="#/${kind}/${esc(r.id)}"><b>${esc(r.title)}</b><span class="muted">${esc(r.subject || '')}${S.get().quiz[r.id] ? ` · best ${S.get().quiz[r.id].best}%` : ''}</span></a>`).join('')}</section>`
      : `<section class="card">${kind === 'label'
        ? emptyState({ mood: 'draw', title: 'No drawings to label yet', text: S.get().reviewers.length ? 'Ask Cody to draw something, save it, and it becomes a Label it! game.' : 'Upload your notes or ask Cody to draw something. Every drawing becomes a Label it! game.', actions: [{ label: 'Draw with Cody', href: '#/draw' }, { label: 'Upload my notes', href: '#/reviewers?upload=1' }] })
        : emptyState({ mood: 'think', title: 'No quizzes yet', text: 'Cody writes a 10-question quiz from your notes. Upload them to start.', actions: [{ label: 'Upload my notes', href: '#/reviewers?upload=1' }, { label: 'Quiz me in chat', href: '#/chat?new=1&mode=quiz' }] })}</section>`}`;
}

export function render(root, id) {
  if (!id) return pick(root, 'label', 'Label it!', 'Pick a drawing. Drag each name to its part. Faster answers earn more points.');
  const rev = S.reviewer(id);
  if (!rev || !rev.drawing || rev.drawing.mode === '3d') { location.hash = '#/label'; return; } // (Label it! plays on flat drawings)
  const parts = rev.drawing.parts;
  const ids = (rev.game && rev.game.length ? rev.game : parts.map((p) => p.id)).filter((x) => parts.some((p) => p.id === x && p.label)).slice(0, 6);
  const names = ids.map((x) => parts.find((p) => p.id === x)).sort(() => Math.random() - 0.5);

  root.innerHTML = `
    ${header(`Label it! ${rev.title}`, 'Drag each name to its part. Faster answers earn more points.', `
      <span class="pill">⏱ <b class="clock">0:00</b></span><span class="pill">Points <b class="gold pts">+0</b></span><span class="pill">🔥 Combo <b class="combo">x1</b></span>`)}
    <section class="split grow">
      <div class="card"><div class="board" id="game-board"></div></div>
      <div class="card panel">
        <p class="goal"><b>What you’ll learn:</b> to name each part of ${esc(rev.title.toLowerCase())} and find it on the drawing from memory.</p>
        <h2 class="eyebrow">Names to place</h2>
        <div class="names">${names.map((p) => `<button class="name" data-id="${esc(p.id)}">${esc(p.label)}</button>`).join('')}</div>
        <p class="muted progress-text">0 of ${names.length} placed</p>
        <div class="progress"><i style="width:0%"></i></div>
        <div class="tip"><b>Tip from Cody</b><p></p></div>
      </div>
    </section>`;

  const ctl = mount(root.querySelector('#game-board'), rev.drawing, { labels: 'none', targets: ids });
  ctl.showAll(false);
  const $ = (s) => root.querySelector(s);
  let placed = 0, points = 0, combo = 1, lastAt = Date.now(), selected = null, finished = false;
  const t0 = Date.now();
  const clock = setInterval(() => { const s = Math.floor((Date.now() - t0) / 1000); $('.clock').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }, 500);
  const tip = () => {
    const left = names.filter((p) => !root.querySelector(`.name[data-id="${p.id}"]`).classList.contains('used'));
    const p = (selected && parts.find((q) => q.id === selected)) || left[0];
    $('.tip p').textContent = p ? hideName(p.say, p.label) : 'All done!';
  };
  tip();

  function attempt(chipId, targetId) {
    const chip = root.querySelector(`.name[data-id="${chipId}"]`);
    if (!chip || chip.classList.contains('used') || !targetId) return;
    if (chipId === targetId) {
      const secs = (Date.now() - lastAt) / 1000; lastAt = Date.now();
      const gain = Math.round(10 + Math.max(0, 5 - secs / 2) + 5 * (combo - 1)); // fast and in a row earn more
      points += gain; combo = Math.min(5, combo + 1); placed++;
      ctl.placeLabel(chipId); chip.classList.add('used'); chip.classList.remove('sel'); selected = null;
      $('.pts').textContent = '+' + points; $('.combo').textContent = 'x' + combo;
      $('.progress-text').textContent = `${placed} of ${names.length} placed`; $('.progress i').style.width = `${(placed / names.length) * 100}%`;
      tip();
      if (placed === names.length) finish();
    } else {
      combo = 1; $('.combo').textContent = 'x1';
      chip.classList.remove('shake'); void chip.offsetWidth; chip.classList.add('shake');
      ctl.hint(chipId, true); setTimeout(() => ctl.hint(chipId, false), 900);
    }
  }
  function finish() {
    finished = true; clearInterval(clock);
    S.award(points, 3); S.markPlan('label-' + rev.id); S.labelDone(rev.id);
    const s = Math.round((Date.now() - t0) / 1000);
    $('.tip').innerHTML = `<b>All ${names.length} placed in ${s} seconds!</b><p>You earned ${points} points. You can now name and place ${names.length} parts of ${esc(rev.title.toLowerCase())}.</p><div class="row"><a class="btn primary small" href="#/quiz/${esc(rev.id)}">Quiz me next</a><button class="btn small again">Play again</button></div>`;
    $('.again').addEventListener('click', () => render(root, id));
    toast(`+${points} points!`); say('cheer', `All placed! +${points} points`);
  }

  // drag a name with a finger or the mouse; or tap a name, then tap its spot
  root.querySelectorAll('.name').forEach((chip) => {
    chip.addEventListener('pointerdown', (e) => {
      if (chip.classList.contains('used') || finished) return;
      e.preventDefault();
      const ghost = chip.cloneNode(true); ghost.classList.add('ghost'); document.body.appendChild(ghost);
      const move = (ev) => { ghost.style.left = ev.clientX + 'px'; ghost.style.top = ev.clientY + 'px'; };
      move(e);
      let moved = false; const sx = e.clientX, sy = e.clientY;
      const onMove = (ev) => { if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > 6) moved = true; move(ev); };
      const up = (ev) => {
        window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', up);
        ghost.remove();
        if (moved) { const t = ctl.targetAt(ev.clientX, ev.clientY); if (t) attempt(chip.dataset.id, t); }
        else { root.querySelectorAll('.name').forEach((c) => c.classList.toggle('sel', c === chip && !c.classList.contains('sel'))); selected = chip.classList.contains('sel') ? chip.dataset.id : null; tip(); }
      };
      window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', up);
    });
  });
  root.querySelector('#game-board').addEventListener('click', (e) => { if (!selected) return; const t = ctl.targetAt(e.clientX, e.clientY); if (t) attempt(selected, t); });
  return () => clearInterval(clock);
}
