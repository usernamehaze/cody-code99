import * as S from '../store.js';
import { ask } from '../ai.js';
import { readNotes, shrinkImage } from '../notes.js';
import { mount, clean } from '../draw.js';
import { esc, header, ICON, toast, askSure, busy, plural, choose } from '../ui.js';
import { say, emptyState, mascot } from '../mascot.js';
import { md } from '../md.js';
import { saveGuidePdf } from '../pdf.js';
import { saveGuideDocx } from '../docx.js';
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
  rev.guideState = 'writing'; rev.askHow = true; // (asked once, when the full reviewer is written)
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

// the file a student saves: the study guide, then the quiz with an answer key, then the flashcards
export function reviewerDoc(r) {
  const end = /\n+-*\s*\n*\*End of reviewer[^\n]*\*\s*$/i;
  let out = (r.guide || guideFrom(r)).replace(end, '');
  const one = (t) => String(t || '').replace(/\s*\n\s*/g, ' ').replace(/\|/g, '/');
  const L = 'ABCD';
  if (r.quiz && r.quiz.length) {
    out += `\n\n---\n\n## Practice quiz\n*(Answer first, then check the answer key below.)*\n\n`;
    out += r.quiz.map((q, i) => `**${i + 1}. ${one(q.q)}**\n\n${q.choices.map((c, j) => `- ${L[j]}. ${one(c)}`).join('\n')}`).join('\n\n');
    out += `\n\n---\n\n## Answer key\n${r.quiz.map((q, i) => `${i + 1}. **${L[q.a]}. ${one(q.choices[q.a])}**${q.why ? `: ${one(q.why)}` : ''}`).join('\n')}`;
  }
  if (r.cards && r.cards.length) out += `\n\n---\n\n## Flashcards\n| Front | Back |\n|---|---|\n${r.cards.map((c) => `| ${one(c.front)} | ${one(c.back)} |`).join('\n')}`;
  return `${out}\n\n---\n\n*End of reviewer: ${r.title}. Made with Cody.*`;
}
const fileName = (r, ext) => `${(r.title || 'Reviewer').replace(/[^\p{L}\p{N}\- ]+/gu, '').trim().replace(/\s+/g, '_') || 'Reviewer'}_Reviewer.${ext}`;

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
    try { const rev = await makeReviewer(what, show); S.award(15, 2); toast('Your quiz and flashcards are ready!'); say('draw', 'I’m still writing the full reviewer. I’ll ask you how you want it.'); location.hash = '#/reviewer/' + rev.id; }
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
        <ul class="list rev-list">${s.reviewers.map((r) => `
          <li><a href="#/reviewer/${esc(r.id)}"><span class="rl-ico">${DOC_ICON}</span><span class="rl-t"><b>${esc(r.title)}</b><span class="muted">${esc(r.subject || 'Reviewer')} · ${plural(r.quiz.length, 'question')} · ${plural((r.cards || []).length, 'card')}${premium() ? ` · ${S.mastery(r.id).pct}% mastered` : ''}${r.guideState === 'writing' && !r.guide ? ' · writing…' : ''}</span></span></a></li>`).join('')}
        </ul></div>
      <div class="card"><h2 class="eyebrow">New reviewer</h2>${uploadZone()}</div>
    </section>`;
  wireUpload(root);
  if (params.get('upload')) root.querySelector('.drop').focus();
}

// ---------- one reviewer: a short page, not a wall of text ----------
// The reviewer itself is a "file" card (read it, save it as PDF or Word); the long study guide opens on its own
// reading page (#/guide/…), in sections that fold, so this page stays short. When Cody finishes writing it, Cody
// asks once how the student wants it: read in Cody, a PDF, or a Word file.
const DOC_ICON = '<svg viewBox="0 0 40 48" width="40" height="48" aria-hidden="true"><path d="M6 2h20l12 12v30a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" fill="var(--teal)" opacity=".18"/><path d="M6 2h20l12 12v30a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" fill="none" stroke="var(--teal)" stroke-width="2.4"/><path d="M26 2v12h12" fill="none" stroke="var(--teal)" stroke-width="2.4"/><path d="M11 24h18M11 31h18M11 38h11" stroke="var(--teal)" stroke-width="2.6" stroke-linecap="round"/></svg>';
const ready = (r) => !!(r.guide || r.guideState !== 'writing');

async function savePdf(r) {
  // a real PDF file, made on the device (iPhones block websites from opening the print dialog)
  const text = reviewerDoc(r);
  // the PDF's fonts only know Western letters: a reviewer in Chinese, Japanese or Korean goes to Word instead
  if ((text.match(/[^\x00-ɏ -⟿\s]/g) || []).length > text.length * 0.05) { toast('This reviewer uses letters the PDF can’t show. Use Word instead.'); return; }
  try { await saveGuidePdf(text, fileName(r, 'pdf')); toast('PDF saved'); } catch (e) { toast(e.message || 'Could not make the PDF.'); }
}
function saveDocx(r) { try { saveGuideDocx(reviewerDoc(r), fileName(r, 'docx')); toast('Word file saved'); } catch (e) { toast(e.message || 'Could not make the Word file.'); } }
function wireSave(root, r) {
  const pdf = root.querySelector('.save-pdf'), docx = root.querySelector('.save-docx'), copy = root.querySelector('.copy-guide');
  if (pdf) pdf.addEventListener('click', () => busy(pdf, 'Making the PDF…', () => savePdf(r)));
  if (docx) docx.addEventListener('click', () => busy(docx, 'Making the Word file…', async () => saveDocx(r)));
  if (copy) copy.addEventListener('click', () => navigator.clipboard.writeText(reviewerDoc(r)).then(() => toast('Reviewer copied'), () => toast('Could not copy')));
}
// once, when the full reviewer is written: how does the student want it?
async function askHow(r) {
  r.askHow = false; S.save();
  const pick = await choose({
    title: 'Your reviewer is ready!', body: `How do you want “${r.title}”?`, art: mascot('cheer', 64),
    options: [
      { value: 'read', label: 'Read it here in Cody', sub: 'One section at a time', icon: ICON.file },
      { value: 'pdf', label: 'Save it as a PDF', sub: 'To print, or read offline', icon: ICON.file },
      { value: 'docx', label: 'Save it as a Word file', sub: 'To edit, or open in Google Docs', icon: ICON.file },
      { value: 'quiz', label: 'Skip it, quiz me now', sub: `${plural(r.quiz.length, 'question')} from your notes`, icon: ICON.quiz },
    ],
    later: 'Not now',
  });
  if (pick === 'read') location.hash = '#/guide/' + r.id;
  else if (pick === 'pdf') savePdf(r);
  else if (pick === 'docx') saveDocx(r);
  else if (pick === 'quiz') location.hash = '#/quiz/' + r.id;
}

export function renderOne(root, id) {
  const r = S.reviewer(id);
  if (!r) { location.hash = '#/reviewers'; return; }
  const nCards = (r.cards || []).length, TERMS = 4;
  const src = r.source ? `${r.source.name}${r.source.pages ? ` · ${plural(r.source.pages, 'page')}` : ''}` : 'your notes';
  root.innerHTML = `
    ${header(r.title, `${r.subject || 'Reviewer'} · made by Cody${r.seconds ? ` in ${plural(r.seconds, 'second')}` : ''}`)}
    <section class="rev-page">
      <div class="card rev-file">
        <div class="rf-top">${DOC_ICON}<div class="rf-name"><b>Reviewer: ${esc(r.title)}</b><span class="muted">${ready(r) ? `Study guide · ${plural(r.quiz.length, 'quiz question')} with answer key · ${plural(nCards, 'flashcard')}` : 'Cody is writing the full reviewer…'}</span></div></div>
        ${ready(r) ? `<div class="rf-acts"><a class="btn small" href="#/guide/${esc(r.id)}">Read</a><button class="btn small save-pdf" aria-label="Save as PDF">PDF</button><button class="btn small save-docx" aria-label="Save as a Word file">Word</button></div>`
          : `<p class="rf-wait"><span class="spin" aria-hidden="true"></span> Writing the full study guide. The quiz, flashcards and key terms below are ready now.</p>`}
        ${r.guideState === 'failed' ? '<p class="muted small">Cody couldn’t write the long study guide this time, so this one is made from your key terms.</p>' : ''}
        <p class="rf-src muted small">From ${esc(src)}</p>
      </div>
      <div class="tools-grid">
        <a class="tool primary" href="#/quiz/${esc(r.id)}">${ICON.quiz}<b>Quiz me</b><small>${plural(r.quiz.length, 'question')}</small></a>
        <a class="tool" href="#/flashcards/${esc(r.id)}">${ICON.cards}<b>Flashcards</b><small>${plural(nCards, 'card')}</small></a>
        ${r.drawing ? `<a class="tool" href="#/label/${esc(r.id)}">${ICON.game}<b>Label it!</b><small>Name the parts</small></a>` : `<a class="tool" href="#/draw/${esc(r.id)}">${ICON.pencil}<b>Draw it</b><small>Cody draws it</small></a>`}
        <a class="tool" href="#/chat?about=${esc(r.id)}">${ICON.chat}<b>Ask Cody</b><small>About this reviewer</small></a>
      </div>
      ${r.drawing ? `<div class="card"><div class="board sm" id="rev-draw"></div></div>` : ''}
      <div class="card"><h2 class="eyebrow">Key terms</h2>
        ${r.summary ? `<p class="summary">${esc(r.summary)}</p>` : ''}
        <dl class="terms">${r.terms.map((t, i) => `
          <div class="term"${i >= TERMS ? ' hidden' : ''}><dt>${esc(t.term)}</dt><dd>${esc(t.meaning)}</dd>
            <a class="btn outline small" href="#/draw/${esc(r.id)}?part=${encodeURIComponent(t.part || '')}&term=${i}">✎ Draw it</a></div>`).join('')}
        </dl>
        ${r.terms.length > TERMS ? `<button type="button" class="btn small more-terms">Show all ${r.terms.length} terms</button>` : ''}
      </div>
      <div class="card mastery-card"><h2 class="eyebrow">Reviewer mastery</h2>${masteryCard(r)}</div>
      <details class="card rev-more"><summary>More</summary>
        ${(r.questions || []).length ? `<h3 class="sub-h">Practice questions</h3><ol class="questions">${r.questions.map((q) => `<li><a href="#/quiz/${esc(r.id)}">${esc(q)}</a></li>`).join('')}</ol>` : ''}
        <div class="row"><button class="btn small copy-guide">${ICON.copy} Copy the reviewer</button><button class="btn ghost small del">${ICON.trash} Delete this reviewer</button></div>
      </details>
    </section>`;
  if (r.drawing) { const c = mount(root.querySelector('#rev-draw'), r.drawing, {}); if (c) c.showAll(); }
  const more = root.querySelector('.more-terms');
  if (more) more.addEventListener('click', () => { root.querySelectorAll('.term[hidden]').forEach((t) => { t.hidden = false; }); more.remove(); });
  root.querySelector('.del').addEventListener('click', async () => {
    const n = S.get().cards.filter((c) => c.deck === r.id).length;
    if (await askSure({ title: `Delete “${r.title}”?`, body: `Its study guide, key terms, quiz and ${plural(n, 'flashcard')} will be deleted. This can't be undone.`, action: 'Delete reviewer' })) { S.removeReviewer(r.id); location.hash = '#/reviewers'; }
  });
  wireSave(root, r);
  S.markPlan('read-' + r.id);
  if (r.askHow && ready(r)) setTimeout(() => { if (root.isConnected && location.hash.includes(r.id)) askHow(r); }, 400);
}

// ---------- the study guide, on its own page: a contents row and one folding section per heading ----------
export function renderGuide(root, id) {
  const r = S.reviewer(id);
  if (!r) { location.hash = '#/reviewers'; return; }
  if (!ready(r)) { location.hash = '#/reviewer/' + r.id; return; }
  const text = r.guide || guideFrom(r);
  const at = text.search(/^##\s/m), intro = at < 0 ? text : text.slice(0, at);
  const parts = at < 0 ? [] : text.slice(at).split(/^(?=##\s)/m).map((sec) => { const nl = sec.indexOf('\n'); return { h: sec.slice(3, nl < 0 ? undefined : nl).trim(), body: nl < 0 ? '' : sec.slice(nl + 1).replace(/\n-{3,}\s*$/,'').trim() }; }).filter((p) => p.h);
  const lead = intro.replace(/^#\s.*$/m, '').replace(/^-{3,}\s*$/gm, '').trim();
  const name = (h) => h.replace(/[*_`]/g, '');
  root.innerHTML = `
    <a class="back-link" href="#/reviewer/${esc(r.id)}">‹ Back to the reviewer</a>
    ${header(r.title, 'Study guide · tap a section to open it')}
    <div class="guide-bar"><button class="btn small save-pdf" aria-label="Save as PDF">${ICON.file} PDF</button><button class="btn small save-docx" aria-label="Save as a Word file">${ICON.file} Word</button><button class="btn small copy-guide" aria-label="Copy the reviewer">${ICON.copy} Copy</button></div>
    ${parts.length > 2 ? `<nav class="toc" aria-label="Sections">${parts.map((p, i) => `<button type="button" class="chip" data-i="${i}">${esc(name(p.h).replace(/^\d+\.\s*/, ''))}</button>`).join('')}</nav>` : ''}
    <article class="guide-doc guide-read">
      ${lead ? `<div class="g-lead">${md(lead)}</div>` : ''}
      ${parts.length ? parts.map((p, i) => `<details class="g-sec" data-i="${i}"${i === 0 ? ' open' : ''}><summary><span>${esc(name(p.h))}</span></summary><div class="g-body">${md(p.body, { headings: 'doc' })}</div></details>`).join('') : md(text, { headings: 'doc' })}
    </article>
    <div class="guide-end"><a class="btn primary" href="#/quiz/${esc(r.id)}">Done reading? Quiz me</a></div>`;
  wireSave(root, r);
  root.querySelectorAll('.toc .chip').forEach((c) => c.addEventListener('click', () => {
    const d = root.querySelector(`.g-sec[data-i="${c.dataset.i}"]`); if (!d) return;
    d.open = true; d.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
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
