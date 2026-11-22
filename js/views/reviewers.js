import * as S from '../store.js';
import { ask } from '../ai.js';
import { readNotes, shrinkImage } from '../notes.js';
import { mount, clean } from '../draw.js';
import { esc, header, ICON, toast, askSure, busy, plural } from '../ui.js';
import { say, emptyState } from '../mascot.js';
import { md } from '../md.js';
import { saveGuidePdf } from '../pdf.js';
import { premium } from '../account.js';

// match a term ("Atria") to a part of the drawing ("Right atrium"), so Draw it and the quiz can point at it
const stem = (w) => w.toLowerCase().replace(/[^a-z ]/g, '').replace(/(ia|ium|ae|es|s)$/, '');
export function linkParts(rev) {
  if (!rev.drawing) return rev;
  const parts = rev.drawing.parts;
  const find = (name) => { if (!name) return null; const n = stem(name); const p = parts.find((q) => stem(q.label) === n) || parts.find((q) => q.label && (stem(q.label).includes(n) || n.includes(stem(q.label)))) || parts.find((q) => q.label && q.label.toLowerCase().split(' ').some((w) => w.length > 3 && n.includes(stem(w)))); return p ? p.id : null; };
  rev.terms.forEach((t) => { t.part = t.part || find(t.term); });
  rev.quiz.forEach((q) => { q.part = q.part || find(q.term) || find(q.choices[q.a]); });
  (rev.cards || []).forEach((c) => { c.part = c.part || find(c.front); });
  rev.game = parts.filter((p) => p.label).slice(0, 6).map((p) => p.id);
  return rev;
}

// one upload: read the file, ask Cody for the reviewer, then (in the background) for its drawing
export async function makeReviewer({ file, text, name, pages }, onStatus) {
  const t0 = Date.now();
  onStatus('Reading your notes…');
  const got = pages ? { name: `Scanned notes (${pages.length} page${pages.length === 1 ? '' : 's'})`, pages: pages.length, files: pages }
    : file ? await readNotes(file) : { name: name || 'Pasted notes', pages: 1, notes: text };
  onStatus('Cody is writing your reviewer…');
  const { data } = await ask('reviewer', { notes: got.notes, file: got.file, files: got.files, fileName: got.name });
  const rev = { ...data, source: { name: got.name, pages: got.pages }, seconds: Math.max(1, Math.round((Date.now() - t0) / 1000)), drawing: null };
  rev.guideState = 'writing';
  S.addReviewer(rev);
  const refresh = () => { if (location.hash.startsWith('#/reviewer/' + rev.id)) window.dispatchEvent(new HashChangeEvent('hashchange')); };
  // the full study guide (like a printed reviewer) is longer, so it is written in the background too
  ask('guide', { notes: got.notes, file: got.file, files: got.files, fileName: got.name }).then(({ data: g }) => {
    const r = S.reviewer(rev.id); if (!r) return;
    r.guide = g.markdown; r.guideState = 'done'; S.save(); refresh();
  }).catch(() => { const r = S.reviewer(rev.id); if (r) { r.guideState = 'failed'; S.save(); refresh(); } });
  if (data.drawable) {
    ask('draw', { question: data.drawable, context: data.summary }).then(({ data: spec }) => {
      const r = S.reviewer(rev.id); if (!r) return;
      r.drawing = clean(spec); linkParts(r); S.save();
      refresh();
    }).catch(() => { /* no drawing: the reviewer still works */ });
  }
  return rev;
}

// a study guide made from the reviewer's own parts, for the samples and reviewers made before study guides existed
export function guideFrom(r) {
  const rows = r.terms.map((t) => `| **${t.term}** | ${t.meaning} |`).join('\n');
  const qs = [...(r.questions || []), ...r.quiz.slice(0, 5).map((q) => q.q)].filter((q, i, a) => a.indexOf(q) === i).slice(0, 8);
  return `# REVIEWER: ${r.title}\n*(Made by Cody from ${r.source ? r.source.name : 'your notes'})*\n\n---\n\n## 1. The big picture\n${r.summary || `This reviewer covers ${r.title.toLowerCase()}: ${r.terms.slice(0, 4).map((t) => t.term).join(', ')} and more.`}\n\n---\n\n## 2. Key ideas\n${r.terms.map((t) => `- **${t.term}**: ${t.meaning}`).join('\n')}\n\n---\n\n## 3. Key terms to remember\n| Term | Meaning |\n|---|---|\n${rows}\n\n---\n\n## 4. Review questions\n${qs.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n\n---\n\n*End of reviewer: ${r.title}*`;
}

function uploadZone() {
  return `<label class="drop" tabindex="0">
      <input type="file" accept="application/pdf,image/*,.txt,.md" hidden>
      <span class="drop-icon">${ICON.upload}</span>
      <b>Drop a PDF, a photo or paste your notes</b>
      <span class="muted">Cody reads it and makes your reviewer</span>
    </label>
    <div class="scan">
      <label class="btn scan-btn">${ICON.image} Scan with camera<input type="file" accept="image/*" capture="environment" multiple hidden></label>
      <div class="scan-tray" hidden><div class="scan-pages"></div><div class="row"><label class="btn small">Add a page<input type="file" accept="image/*" capture="environment" multiple hidden class="scan-more"></label><button type="button" class="btn small primary scan-go">Make my reviewer</button><button type="button" class="btn small ghost scan-clear">Remove all</button></div></div>
    </div>
    <details class="paste"><summary>Paste notes instead</summary>
      <textarea rows="6" placeholder="Paste your notes here…"></textarea>
      <button class="btn primary small go-paste">Make my reviewer</button>
    </details>
    <p class="status muted" aria-live="polite"></p>`;
}
function wireUpload(root) {
  const zone = root.querySelector('.drop'), input = zone.querySelector('input'), status = root.querySelector('.status');
  let working = false;
  const show = (m) => { status.innerHTML = `<span class="spin" aria-hidden="true"></span> ${esc(m)}`; };
  const make = async (what) => {
    try { const rev = await makeReviewer(what, show); S.award(15, 2); toast('Your reviewer is ready!'); say('cheer', 'Your reviewer is ready! Try the quiz next.'); location.hash = '#/reviewer/' + rev.id; }
    catch (e) { status.textContent = e.message; }
  };
  // one upload at a time; pasted notes also spin the button that was pressed
  const run = async (what) => {
    if (working) return; working = true; zone.classList.add('busy');
    try { if (what.text) await busy(root.querySelector('.go-paste'), 'Making your reviewer…', () => make(what)); else await make(what); }
    finally { working = false; zone.classList.remove('busy'); }
  };
  input.addEventListener('change', () => input.files[0] && run({ file: input.files[0] }));
  // Pic scan: photos of notebook pages, up to 8, read together by Cody
  const pages = [], tray = root.querySelector('.scan-tray'), list = root.querySelector('.scan-pages');
  const showPages = () => {
    tray.hidden = !pages.length;
    list.innerHTML = pages.map((p, i) => `<figure><img src="data:image/jpeg;base64,${p.data}" alt="Page ${i + 1}"><figcaption>Page ${i + 1}</figcaption><button type="button" class="x" data-i="${i}" aria-label="Remove page ${i + 1}">×</button></figure>`).join('');
    list.querySelectorAll('.x').forEach((b) => b.addEventListener('click', () => { pages.splice(+b.dataset.i, 1); showPages(); }));
    root.querySelector('.scan-go').textContent = `Make my reviewer (${plural(pages.length, 'page')})`;
  };
  const addPages = async (files) => {
    for (const f of [...files]) {
      if (pages.length >= 8) { status.textContent = 'That’s the most for one reviewer: 8 pages.'; break; }
      try { pages.push({ type: 'image/jpeg', data: await shrinkImage(f, 1400) }); } catch (e) { status.textContent = 'Could not read one of those photos.'; }
    }
    showPages();
  };
  root.querySelectorAll('.scan-btn input, .scan-more').forEach((inp) => inp.addEventListener('change', () => { addPages(inp.files); inp.value = ''; }));
  root.querySelector('.scan-clear').addEventListener('click', () => { pages.length = 0; showPages(); });
  root.querySelector('.scan-go').addEventListener('click', () => { if (!pages.length || working) return; const go = root.querySelector('.scan-go'); busy(go, 'Reading your pages…', () => run({ pages: [...pages] })); });
  zone.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
  ['dragover', 'dragenter'].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((ev) => zone.addEventListener(ev, () => zone.classList.remove('over')));
  zone.addEventListener('drop', (e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) run({ file: f }); });
  root.querySelector('.go-paste').addEventListener('click', () => { const t = root.querySelector('.paste textarea').value.trim(); if (t.length < 40) { status.textContent = 'Paste a bit more, at least a few sentences.'; return; } run({ text: t }); });
}

export function renderList(root, params) {
  const s = S.get();
  root.innerHTML = `
    ${header('My reviewers', 'Every reviewer has key terms, a drawing, a quiz and flashcards.')}
    <section class="grid-2">
      <div class="card"><h2 class="eyebrow">Your reviewers</h2>
        ${s.reviewers.length ? '' : emptyState({ mood: 'wave', size: 100, title: 'No reviewers yet', text: 'Drop your notes on the right. Cody turns them into a study guide, key terms, a quiz and flashcards.' })}
        <ul class="list">${s.reviewers.map((r) => `
          <li><a href="#/reviewer/${esc(r.id)}"><b>${esc(r.title)}</b><span class="muted">${esc(r.subject || '')} · ${plural(r.terms.length, 'term')} · ${plural(r.quiz.length, 'question')}${premium() ? ` · ${S.mastery(r.id).pct}% mastered` : ''}</span></a></li>`).join('')}
        </ul></div>
      <div class="card"><h2 class="eyebrow">New reviewer</h2>${uploadZone()}</div>
    </section>`;
  wireUpload(root);
  if (params.get('upload')) root.querySelector('.drop').focus();
}

export function renderOne(root, id) {
  const r = S.reviewer(id);
  if (!r) { location.hash = '#/reviewers'; return; }
  root.innerHTML = `
    ${header(`Reviewer: ${r.title}`, r.seconds ? `Made by Cody from your notes in ${r.seconds} seconds` : 'Made by Cody from your notes', `
      <a class="btn" href="#/chat?about=${esc(r.id)}">${ICON.chat} Ask Cody about this</a><a class="btn" href="#/flashcards/${esc(r.id)}">Study flashcards</a><a class="btn primary" href="#/quiz/${esc(r.id)}">Quiz me on this</a>`)}
    <section class="grid-2 grow">
      <div class="col">
        ${r.drawing ? `<div class="card mobile-first"><div class="board sm" id="rev-draw"></div></div>` : ''}
        <div class="tabs-row" role="tablist" aria-label="Reviewer view">
          <button class="tab on" role="tab" aria-selected="true" data-v="guide">Study guide</button><button class="tab" role="tab" aria-selected="false" data-v="terms">Key terms</button>
        </div>
        <div class="card guide-card" data-v="guide">
          <div class="guide-tools">${r.guide || r.guideState !== 'writing' ? `<button class="btn small save-pdf">${ICON.file} Save as PDF</button><button class="btn small copy-guide">${ICON.copy} Copy</button>` : ''}</div>
          ${r.guideState === 'writing' && !r.guide ? `<div class="guide-wait"><div class="thinking"><span></span><span></span><span></span></div><p>Cody is writing your full study guide. The key terms, quiz and flashcards are ready now.</p></div>` : ''}
          ${r.guide || r.guideState !== 'writing' ? `<article class="guide-doc">${md(r.guide || guideFrom(r), { headings: 'doc' })}</article>` : ''}
          ${r.guideState === 'failed' ? `<p class="muted small">Cody could not write the long study guide this time, so this one is made from your key terms.</p>` : ''}
        </div>
        <div class="card terms-card" data-v="terms" hidden>
          <h2 class="eyebrow">Key terms</h2>
          ${r.summary ? `<p class="summary">${esc(r.summary)}</p>` : ''}
          <dl class="terms">${r.terms.map((t, i) => `
            <div class="term"><dt>${esc(t.term)}</dt><dd>${esc(t.meaning)}</dd>
              <a class="btn outline small" href="#/draw/${esc(r.id)}?part=${encodeURIComponent(t.part || '')}&term=${i}">✎ Draw it</a></div>`).join('')}
          </dl>
        </div>
      </div>
      <div class="col">
        <div class="card mastery-card"><h2 class="eyebrow">Reviewer mastery</h2>${masteryCard(r)}</div>
        <div class="card"><h2 class="eyebrow">Your notes</h2>${uploadZone()}
          ${r.source ? `<div class="file"><span class="pdf">${/\.pdf$/i.test(r.source.name) ? 'PDF' : 'TXT'}</span><div><b>${esc(r.source.name)}</b><span class="muted">${r.source.pages} page${r.source.pages === 1 ? '' : 's'} · read</span></div></div>` : ''}
        </div>
        <div class="card"><h2 class="eyebrow">Practice questions</h2>
          <ol class="questions">${(r.questions || []).map((q, i) => `<li><a href="#/quiz/${esc(r.id)}">${i + 1}. ${esc(q)}</a></li>`).join('')}</ol>
          <button class="btn ghost small del">${ICON.trash} Delete this reviewer</button>
        </div>
      </div>
    </section>`;
  wireUpload(root);
  if (r.drawing) { const c = mount(root.querySelector('#rev-draw'), r.drawing, {}); if (c) c.showAll(); }
  const del = root.querySelector('.del');
  if (del) del.addEventListener('click', async () => {
    const n = S.get().cards.filter((c) => c.deck === r.id).length;
    if (await askSure({ title: `Delete “${r.title}”?`, body: `Its study guide, key terms, quiz and ${plural(n, 'flashcard')} will be gone from this device. This can't be undone.`, action: 'Delete reviewer' })) { S.removeReviewer(r.id); location.hash = '#/reviewers'; }
  });
  root.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => {
    root.querySelectorAll('.tab').forEach((x) => { const on = x === t; x.classList.toggle('on', on); x.setAttribute('aria-selected', on); });
    root.querySelector('.guide-card').hidden = t.dataset.v !== 'guide';
    root.querySelector('.terms-card').hidden = t.dataset.v !== 'terms';
  }));
  const pdf = root.querySelector('.save-pdf');
  if (pdf) pdf.addEventListener('click', () => busy(pdf, 'Making the PDF…', async () => {
    // a real PDF file, made on the device (iPhones block websites from opening the print dialog)
    const name = `${(r.title || 'Reviewer').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_') || 'Reviewer'}_Reviewer.pdf`;
    try { await saveGuidePdf(r.guide || guideFrom(r), name); toast('PDF saved'); }
    catch (e) { toast(e.message || 'Could not make the PDF.'); }
  }));
  const copy = root.querySelector('.copy-guide');
  if (copy) copy.addEventListener('click', () => navigator.clipboard.writeText(r.guide || guideFrom(r)).then(() => toast('Study guide copied'), () => toast('Could not copy')));
  S.markPlan('read-' + r.id);
}

// Reviewer mastery (Premium): a ring with the score, what it's made of, and the next step
function masteryCard(r) {
  if (!premium()) return `<p class="muted">See how well you know this reviewer, from your quiz, flashcards and Label it! results, and what to study next.</p><a class="btn small" href="#/plan">Unlock with Premium (free during Code 99)</a>`;
  const m = S.mastery(r.id), C = 2 * Math.PI * 34;
  return `<div class="mastery"><svg viewBox="0 0 80 80" width="96" height="96" role="img" aria-label="${m.pct}% mastered"><circle cx="40" cy="40" r="34" fill="none" stroke="var(--line-2)" stroke-width="8"/><circle cx="40" cy="40" r="34" fill="none" stroke="var(--teal)" stroke-width="8" stroke-linecap="round" stroke-dasharray="${(C * m.pct) / 100} ${C}" transform="rotate(-90 40 40)"/><text x="40" y="45" text-anchor="middle" class="m-pct">${m.pct}%</text></svg>
    <div><b class="m-level">${m.level}</b><ul class="m-parts"><li>Quiz best: <b>${r.quiz.length ? m.quiz + '%' : '–'}</b></li><li>Cards learned: <b>${m.cards ? m.learned + '%' : '–'}</b></li>${m.label == null ? '' : `<li>Label it!: <b>${m.label >= 1 ? 'done' : m.label > 0 ? 'played once' : 'not yet'}</b></li>`}</ul></div></div>
    ${m.next ? `<a class="btn small" href="${m.next.go}">Next: ${m.next.text}</a>` : '<p class="muted">You know this one well. Review the flashcards when they come due.</p>'}`;
}
