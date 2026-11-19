import * as S from '../store.js';
import { ask } from '../ai.js';
import { readNotes } from '../notes.js';
import { mount, clean } from '../draw.js';
import { esc, header, ICON, toast } from '../ui.js';
import { say } from '../mascot.js';
import { md } from '../md.js';
import { SAMPLES } from '../samples.js';
import { saveGuidePdf } from '../pdf.js';

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
export async function makeReviewer({ file, text, name }, onStatus) {
  const t0 = Date.now();
  onStatus('Reading your notes…');
  const got = file ? await readNotes(file) : { name: name || 'Pasted notes', pages: 1, notes: text };
  onStatus('Cody is writing your reviewer…');
  const { data } = await ask('reviewer', { notes: got.notes, file: got.file, fileName: got.name });
  const rev = { ...data, source: { name: got.name, pages: got.pages }, seconds: Math.max(1, Math.round((Date.now() - t0) / 1000)), drawing: null };
  rev.guideState = 'writing';
  S.addReviewer(rev);
  const refresh = () => { if (location.hash.startsWith('#/reviewer/' + rev.id)) window.dispatchEvent(new HashChangeEvent('hashchange')); };
  // the full study guide (like a printed reviewer) is longer, so it is written in the background too
  ask('guide', { notes: got.notes, file: got.file, fileName: got.name }).then(({ data: g }) => {
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
    <details class="paste"><summary>Paste notes instead</summary>
      <textarea rows="6" placeholder="Paste your notes here…"></textarea>
      <button class="btn primary small go-paste">Make my reviewer</button>
    </details>
    <p class="status muted" aria-live="polite"></p>`;
}
function wireUpload(root) {
  const zone = root.querySelector('.drop'), input = zone.querySelector('input'), status = root.querySelector('.status');
  let busy = false;
  const run = async (what) => {
    if (busy) return; busy = true; zone.classList.add('busy');
    try { const rev = await makeReviewer(what, (m) => { status.textContent = m; }); S.award(15, 2); toast('Your reviewer is ready!'); say('cheer', 'Your reviewer is ready! Try the quiz next.'); location.hash = '#/reviewer/' + rev.id; }
    catch (e) { status.textContent = e.message; }
    finally { busy = false; zone.classList.remove('busy'); }
  };
  input.addEventListener('change', () => input.files[0] && run({ file: input.files[0] }));
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
        <ul class="list">${s.reviewers.map((r) => `
          <li><a href="#/reviewer/${esc(r.id)}"><b>${esc(r.title)}</b><span class="muted">${esc(r.subject || '')} · ${r.terms.length} terms · ${r.quiz.length} questions</span></a></li>`).join('')}
        </ul></div>
      <div class="card"><h2 class="eyebrow">New reviewer</h2>${uploadZone()}</div>
    </section>`;
  wireUpload(root);
  if (params.get('upload')) root.querySelector('.drop').focus();
}

export function renderOne(root, id) {
  const r = S.reviewer(id);
  if (!r) { location.hash = '#/reviewers'; return; }
  if (!r.guide) { const sm = SAMPLES.find((x) => x.id === r.id); if (sm && sm.guide) r.guide = sm.guide; } // (samples saved before they had a guide)
  root.innerHTML = `
    ${header(`Reviewer: ${r.title}`, r.seconds ? `Made by Cody from your notes in ${r.seconds} seconds` : 'Made by Cody from your notes', `
      <a class="btn" href="#/chat?about=${esc(r.id)}">${ICON.chat} Ask Cody about this</a><a class="btn" href="#/flashcards/${esc(r.id)}">Make flashcards</a><a class="btn primary" href="#/quiz/${esc(r.id)}">Quiz me on this</a>`)}
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
        <div class="card"><h2 class="eyebrow">Your notes</h2>${uploadZone()}
          ${r.source ? `<div class="file"><span class="pdf">${/\.pdf$/i.test(r.source.name) ? 'PDF' : 'TXT'}</span><div><b>${esc(r.source.name)}</b><span class="muted">${r.source.pages} page${r.source.pages === 1 ? '' : 's'} · read</span></div></div>` : ''}
        </div>
        <div class="card"><h2 class="eyebrow">Practice questions</h2>
          <ol class="questions">${(r.questions || []).map((q, i) => `<li><a href="#/quiz/${esc(r.id)}">${i + 1}. ${esc(q)}</a></li>`).join('')}</ol>
          ${r.id.startsWith('sample-') ? '' : `<button class="btn ghost small del">${ICON.trash} Delete this reviewer</button>`}
        </div>
      </div>
    </section>`;
  wireUpload(root);
  if (r.drawing) { const c = mount(root.querySelector('#rev-draw'), r.drawing, {}); if (c) c.showAll(); }
  const del = root.querySelector('.del');
  if (del) del.addEventListener('click', () => { if (confirm(`Delete "${r.title}" and its flashcards?`)) { S.removeReviewer(r.id); location.hash = '#/reviewers'; } });
  root.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => {
    root.querySelectorAll('.tab').forEach((x) => { const on = x === t; x.classList.toggle('on', on); x.setAttribute('aria-selected', on); });
    root.querySelector('.guide-card').hidden = t.dataset.v !== 'guide';
    root.querySelector('.terms-card').hidden = t.dataset.v !== 'terms';
  }));
  const pdf = root.querySelector('.save-pdf');
  if (pdf) pdf.addEventListener('click', async () => {
    // a real PDF file, made on the device (iPhones block websites from opening the print dialog)
    const label = pdf.innerHTML; pdf.disabled = true; pdf.textContent = 'Making PDF…';
    const name = `${(r.title || 'Reviewer').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_') || 'Reviewer'}_Reviewer.pdf`;
    try { await saveGuidePdf(r.guide || guideFrom(r), name); toast('PDF saved'); }
    catch (e) { toast(e.message || 'Could not make the PDF.'); }
    finally { pdf.disabled = false; pdf.innerHTML = label; }
  });
  const copy = root.querySelector('.copy-guide');
  if (copy) copy.addEventListener('click', () => navigator.clipboard.writeText(r.guide || guideFrom(r)).then(() => toast('Study guide copied'), () => toast('Could not copy')));
  S.markPlan('read-' + r.id);
}
