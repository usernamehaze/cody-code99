import * as S from '../store.js';
import { ask } from '../ai.js';
import { mount, clean } from '../draw.js';
import { sampleFor } from '../samples.js';
import { figureFor } from '../drawings.js';
import { linkParts } from './reviewers.js';
import { esc, header, LOGO, ICON, speak, hush, toast } from '../ui.js';
import { say } from '../mascot.js';

const WANTS_3D = /\b3d\b|\bthree[\s-]?d\b/i;
let last = null; // the latest drawing asked for here, so Save to reviewer and Label it! can use it
export const openDrawing = (spec, question) => { last = { spec, question }; location.hash = '#/draw'; }; // (from a chat answer)

// a reviewer made from a drawing alone: each part is a term, a card and a quiz question
export function reviewerFromDrawing(spec, question) {
  const parts = spec.parts.filter((p) => p.label);
  const labels = parts.map((p) => p.label);
  const quiz = parts.filter((p) => p.say).map((p, i) => {
    const others = labels.filter((l) => l !== p.label).sort(() => Math.random() - 0.5).slice(0, 3);
    const choices = [...others, p.label].sort(() => Math.random() - 0.5);
    const hide = new RegExp(p.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig');
    return { q: `Which part is this? "${p.say.replace(hide, '___')}"`, choices, a: choices.indexOf(p.label), why: p.say, part: p.id };
  }).filter((q) => q.choices.length === 4);
  return {
    title: spec.title, subject: '', source: { name: `Asked: ${question}`.slice(0, 60), pages: 1 },
    terms: parts.map((p) => ({ term: p.label, meaning: p.say, part: p.id })),
    questions: parts.slice(0, 3).map((p) => `What does the ${p.label.toLowerCase()} do?`),
    quiz, cards: parts.map((p) => ({ front: p.label, back: p.say, part: p.id })), drawing: spec, game: spec.mode === '3d' ? [] : parts.slice(0, 6).map((p) => p.id),
  };
}

export function render(root, id, params) {
  const rev = id ? S.reviewer(id) : null;
  const q = params.get('q') || '';
  let spec = rev && rev.drawing ? rev.drawing : null;
  let asked = rev ? `Explain ${rev.title.toLowerCase()}` : q;
  // flat (2D) or a 3D model the student can turn, open and pull apart (from Cassie): the switch, or "in 3D" in the question
  const mode = params.get('m') === '3d' || WANTS_3D.test(q) ? '3d' : '2d';
  if (!spec && q && mode === '2d') { const sm = sampleFor(q); spec = sm ? sm.drawing : figureFor(q); }
  if (!spec && !q && last) { spec = last.spec; asked = last.question; }

  root.innerHTML = `
    ${header('Draw with Cody', asked ? `You asked: ${asked}` : 'Ask anything. Cody draws it and explains it step by step.', `<span class="pill status-pill" hidden><span class="mini-logo">${LOGO}</span><span class="st"></span></span>`)}
    <form class="ask">
      <input name="q" placeholder="Ask Cody to draw something, e.g. how does the water cycle work?" value="${esc(rev ? '' : q)}" aria-label="What should Cody draw?">
      <div class="mode-seg" role="radiogroup" aria-label="How Cody shows it">
        <button type="button" role="radio" data-m="2d" aria-checked="${mode === '2d'}">Flat</button>
        <button type="button" role="radio" data-m="3d" aria-checked="${mode === '3d'}">3D</button>
      </div>
      <button class="btn">Draw it</button>
    </form>
    <div class="chips">${['How does the water cycle work?', 'Parts of the human heart', 'How photosynthesis works', 'The plant cell', 'A bicycle in 3D', 'A jet engine in 3D'].map((c) => `<button class="chip" type="button">${c}</button>`).join('')}</div>
    <section class="split grow">
      <div class="card"><h2 class="board-title">${esc(spec ? spec.title : 'Your drawing')}</h2><div class="board" id="board">${spec ? '' : '<p class="muted center">Ask a question above, or pick one of the examples.</p>'}</div></div>
      <div class="card explain">
        <h2 class="eyebrow">Cody explains</h2>
        <ol class="steps"></ol>
        <div class="controls">
          <button class="btn back">Back a step</button><button class="btn primary play">Pause</button><button class="btn next">Next step</button>
          <button class="btn voice" aria-pressed="false">${ICON.sound}<span>Voice</span></button>
        </div>
        <div class="controls two m3-acts" hidden><button class="btn m3-open" aria-pressed="false">Open it up</button><button class="btn m3-apart" aria-pressed="false">Pull apart</button></div>
        <div class="controls two"><button class="btn to-game">Play Label it!</button><button class="btn save">Save to reviewer</button></div>
      </div>
    </section>`;

  const form = root.querySelector('.ask');
  let pickMode = mode;
  const go = (text) => { location.hash = '#/draw?q=' + encodeURIComponent(text) + (pickMode === '3d' && !WANTS_3D.test(text) ? '&m=3d' : ''); };
  root.querySelectorAll('.mode-seg button').forEach((b) => b.addEventListener('click', () => {
    pickMode = b.dataset.m; root.querySelectorAll('.mode-seg button').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    const t = form.q.value.trim(); if (t && t !== q) go(t); else if (t) go(t.replace(/\s+in 3d$/i, ''));
  }));
  form.addEventListener('submit', (e) => { e.preventDefault(); const t = form.q.value.trim(); if (t) go(t); });
  root.querySelectorAll('.chip').forEach((c) => c.addEventListener('click', () => go(c.textContent)));

  const stepsEl = root.querySelector('.steps'), pill = root.querySelector('.status-pill'), st = pill.querySelector('.st');
  const playBtn = root.querySelector('.play'), voiceBtn = root.querySelector('.voice');
  let ctl = null, playing = true, voice = false, gen = 0;

  const status = (text) => { pill.hidden = !text; st.textContent = text; };
  async function run(from) {
    const my = ++gen;
    for (let i = from; i < ctl.count; i++) {
      if (my !== gen) return;
      const done = await ctl.go(i);
      if (!done || my !== gen) return;
      await new Promise((r) => { if (voice) speak(ctl.spec.parts[i].say, r); else setTimeout(r, 1400 + ctl.spec.parts[i].say.length * 22); });
      if (my !== gen || !playing) return;
    }
    if (my === gen && ctl.mode === '3d') { say('cheer', 'Done building! Turn it, open it up, or pull it apart.'); status('Done! Drag to turn it. Tap a part.'); playing = false; playBtn.textContent = 'Replay'; S.award(8, 2); if (rev) S.markPlan('draw-' + rev.id); return; }
    if (my === gen) { say('cheer', 'Done drawing! Want to play Label it!?'); status('Done! Try Label it! next.'); playing = false; playBtn.textContent = 'Replay'; S.award(8, 2); if (rev) S.markPlan('draw-' + rev.id); }
  }
  function show(sp, question) {
    ctl = mount(root.querySelector('#board'), sp, { numbered: true, labels: 'steps', onStep: (i) => {
      [...stepsEl.children].forEach((li, k) => li.classList.toggle('now', k === i));
      status(`Cody is ${sp.mode === '3d' ? 'building' : 'drawing'}… step ${i + 1} of ${sp.parts.length}`);
    } });
    if (!ctl) return;
    // a 3D model: open the case and pull it apart (Label it! plays on flat drawings)
    const acts = root.querySelector('.m3-acts'), openB = root.querySelector('.m3-open'), apartB = root.querySelector('.m3-apart');
    root.querySelector('.to-game').hidden = ctl.mode === '3d';
    acts.hidden = true;
    if (ctl.mode === '3d') ctl.ready.then(() => {
      openB.hidden = !ctl.canOpen; apartB.hidden = !ctl.canExplode; acts.hidden = !ctl.canOpen && !ctl.canExplode;
      openB.onclick = () => { const on = ctl.open(); openB.textContent = on ? 'Close the case' : 'Open it up'; openB.setAttribute('aria-pressed', String(on)); };
      apartB.onclick = () => { const on = ctl.explode(); apartB.textContent = on ? 'Put it back' : 'Pull apart'; apartB.setAttribute('aria-pressed', String(on)); };
    });
    root.querySelector('.board-title').textContent = ctl.spec.title;
    stepsEl.innerHTML = ctl.spec.parts.map((p, i) => `<li><button data-i="${i}">${i + 1}. ${esc(p.label && !p.say.toLowerCase().startsWith(p.label.toLowerCase()) ? p.label + ': ' : '')}${esc(p.say)}</button></li>`).join('');
    stepsEl.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { playing = false; playBtn.textContent = 'Play'; hush(); gen++; ctl.go(+b.dataset.i); }));
    last = { spec: ctl.spec, question };
    const start = Math.max(0, ctl.spec.parts.findIndex((p) => p.id === params.get('part')));
    playing = true; playBtn.textContent = 'Pause';
    say('draw', `Let me ${ctl.mode === '3d' ? 'build' : 'draw'} ${ctl.spec.title.toLowerCase()} for you…`, 3500);
    run(start);
  }

  playBtn.addEventListener('click', () => {
    if (!ctl) return;
    if (playing) { playing = false; gen++; hush(); playBtn.textContent = 'Play'; return; }
    playing = true; playBtn.textContent = 'Pause';
    const at = ctl.step >= ctl.count - 1 ? 0 : ctl.step + 1; run(at);
  });
  root.querySelector('.next').addEventListener('click', () => { if (!ctl) return; gen++; hush(); playing = false; playBtn.textContent = 'Play'; ctl.go(ctl.step + 1); });
  root.querySelector('.back').addEventListener('click', () => { if (!ctl) return; gen++; hush(); playing = false; playBtn.textContent = 'Play'; ctl.go(ctl.step - 1, false); });
  voiceBtn.addEventListener('click', () => { voice = !voice; voiceBtn.setAttribute('aria-pressed', voice); voiceBtn.classList.toggle('on', voice); if (voice && ctl && ctl.step >= 0) speak(ctl.spec.parts[ctl.step].say); else hush(); });

  function saved() { // the reviewer this drawing belongs to (making one the first time)
    if (rev) return rev;
    const found = S.get().reviewers.find((r) => r.drawing && r.drawing.title === ctl.spec.title);
    if (found) return found;
    const r = S.addReviewer(linkParts(reviewerFromDrawing(ctl.spec, asked)));
    return r;
  }
  root.querySelector('.save').addEventListener('click', () => { if (!ctl) return; const r = saved(); toast(`Saved to "${r.title}"`); location.hash = '#/reviewer/' + r.id; });
  root.querySelector('.to-game').addEventListener('click', () => { if (!ctl) return; const r = saved(); location.hash = '#/label/' + r.id; });

  if (spec) show(spec, asked);
  else if (q) {
    status(mode === '3d' ? 'Cody is planning the 3D model…' : 'Cody is thinking about how to draw it…');
    root.querySelector('#board').innerHTML = '<div class="thinking"><span></span><span></span><span></span></div>';
    const my = gen;
    ask('draw', { question: q.replace(/\s+in 3d$/i, ''), mode }).then(({ data, flat }) => {
      if (my !== gen || !root.isConnected) return;
      const sp = clean(data); if (!sp) throw new Error('Cody could not draw that one. Try asking another way.');
      show(sp, q);
      if (flat) toast('3D is for machines and objects. Living things and processes are clearer as a flat drawing, so Cody drew it flat.');
    })
      .catch((e) => { status(''); root.querySelector('#board').innerHTML = `<p class="muted center">${esc(e.message)}</p>`; });
  }
  return () => { gen++; hush(); if (ctl) ctl.stop(); };
}
