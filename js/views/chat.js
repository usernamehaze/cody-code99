/* Ask Cody: chat with your study buddy (Cassie's chat, brought to Cody).
   Modes: Tutor (step by step), Hint (a nudge, not the answer), Quiz me (one question at a time) and
   Heart-to-heart (when you need to talk). Cody can draw inside an answer, read a photo of your problem,
   listen (voice typing where the browser has it) and read answers aloud. One-tap follow-ups sit under
   an answer that teaches. Any answer can become a full reviewer with a quiz and flashcards.
   Safety first (js/care.js): when a student says they want to hurt themselves, Cody answers with care
   and the verified crisis lines before anything else. */
import * as S from '../store.js';
import { ask } from '../ai.js';
import { md } from '../md.js';
import { mount, clean } from '../draw.js';
import { sampleFor } from '../samples.js';
import { shrinkImage } from '../notes.js';
import { mascot, say } from '../mascot.js';
import { openDrawing } from './draw.js';
import { makeReviewer } from './reviewers.js';
import { esc, ICON, speak, hush, toast, askSure, busy, plural } from '../ui.js';
import '../care.js';

const Care = window.CodyCare;
const MODES = [
  ['tutor', 'Tutor', 'Explains step by step'],
  ['hint', 'Hint', 'A nudge, not the answer'],
  ['quiz', 'Quiz me', 'One question at a time'],
  ['talk', 'Heart-to-heart', 'When you need to talk'],
];
const FOLLOWUPS = [
  ['Explain simpler', 'Can you explain that more simply?'],
  ['Step-by-step', 'Show me the step-by-step.'],
  ['Give an example', 'Give me a concrete example, a Filipino one if it fits.'],
  ['Double-check', 'Double-check your last answer carefully and fix it if there is any mistake.'],
];
const STARTERS = {
  tutor: ['Explain osmosis like I am 12', 'How do I solve 2x + 5 = 17?', 'What caused World War 1?', 'Draw and explain the human eye'],
  hint: ['Give me a hint: what is 15% of 240?', 'Hint for balancing H2 + O2 → H2O', 'Hint: why is the sky blue?'],
  quiz: ['Quiz me on the human heart', 'Quiz me on Philippine history', 'Quiz me on fractions'],
  talk: ['I feel stressed about my exams', 'I can’t focus when I study', 'I’m nervous about Demo Day'],
};
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

export function render(root, id, params) {
  let c = id && S.chat(id);
  const about = params.get('about') && S.reviewer(params.get('about'));
  if (!c && (params.get('new') || about || !S.chats().length)) {
    c = S.newChat({ about: about ? about.id : null, mode: params.get('mode') || 'tutor' });
    history.replaceState(null, '', '#/chat/' + c.id);
  }
  if (!c) c = S.chats()[0];
  const rev = c.about && S.reviewer(c.about);
  let photo = null, waiting = false, listening = null, ctrl = null;

  root.innerHTML = `
    <section class="chat-wrap grow">
      <div class="card chat">
        <header class="chat-head">
          <div class="chat-title"><span class="chat-face">${mascot('happy', 44)}</span><div><h1>${esc(c.title === 'New chat' ? 'Ask Cody' : c.title)}</h1>
            <p class="sub">${rev ? `About your reviewer: <a class="link" href="#/reviewer/${esc(rev.id)}">${esc(rev.title)}</a>` : 'Your study buddy. Ask anything, any subject.'}</p></div></div>
          <button type="button" class="btn small ghost clear-chat">${ICON.trash} Clear chat</button>
          <div class="modes" role="radiogroup" aria-label="How Cody answers">${MODES.map(([k, t, d]) => `<button class="mode ${c.mode === k ? 'on' : ''}" role="radio" aria-checked="${c.mode === k}" data-m="${k}" title="${d}">${t}</button>`).join('')}</div>
        </header>
        <div class="log" aria-live="polite"></div>
        <form class="composer">
          <div class="attached" hidden></div>
          <div class="cbar">
            <label class="icon-btn" title="Add a photo of your problem">${ICON.image}<input type="file" accept="image/*" hidden><span class="sr">Add a photo</span></label>
            <textarea rows="1" placeholder="Ask Cody anything…" aria-label="Message to Cody" maxlength="3000"></textarea>
            ${SR ? `<button type="button" class="icon-btn mic" title="Talk instead of typing" aria-pressed="false">${ICON.mic}<span class="sr">Voice typing</span></button>` : ''}
            <button class="send btn primary" aria-label="Send">${ICON.send}</button>
          </div>
        </form>
      </div>
      <aside class="card panel chats">
        <a class="btn" href="#/chat?new=1">${ICON.plus} New chat</a>
        <h2 class="eyebrow">Your chats</h2>
        <ul class="chat-list">${S.chats().map((x) => `<li class="${x.id === c.id ? 'on' : ''}"><a href="#/chat/${esc(x.id)}"><b>${esc(x.title)}</b><span class="muted">${x.msgs.length} message${x.msgs.length === 1 ? '' : 's'}</span></a><button class="del" data-id="${esc(x.id)}" aria-label="Delete chat ${esc(x.title)}">${ICON.trash}</button></li>`).join('')}</ul>
        <p class="muted small">Chats stay on this device.</p>
      </aside>
    </section>`;

  const log = root.querySelector('.log'), form = root.querySelector('.composer'), box = form.querySelector('textarea');
  const attached = form.querySelector('.attached'), face = root.querySelector('.chat-face');
  const setFace = (m) => { face.innerHTML = mascot(m, 44); };
  const bottom = () => { log.scrollTop = log.scrollHeight; };

  // ---------- messages ----------
  function bubble(m, i) {
    const el = document.createElement('div');
    el.className = 'msg ' + (m.role === 'cody' ? 'cody' : 'me');
    if (m.role !== 'cody') { el.innerHTML = `<div class="text">${m.photo ? '<span class="tag">📷 Photo</span> ' : ''}${esc(m.text)}</div>`; return el; }
    el.innerHTML = `<span class="avatar-cm">${mascot(m.care ? 'happy' : 'happy', 34)}</span><div class="body"><div class="text"></div><div class="tools"></div></div>`;
    const text = el.querySelector('.text');
    if (m.care) { text.appendChild(Care.card(m.care, m.aiWords)); return el; }
    text.innerHTML = md(m.text);
    if (m.draw) text.appendChild(drawingBlock(m));
    const tools = el.querySelector('.tools');
    tools.innerHTML = `<button class="tool read">${ICON.sound}<span>Read aloud</span></button><button class="tool copy">${ICON.copy}<span>Copy</span></button>${m.text.length > 280 && c.mode !== 'talk' ? `<button class="tool make">${ICON.file}<span>Make a reviewer</span></button>` : ''}`;
    tools.querySelector('.read').addEventListener('click', () => speak(m.text.replace(/[*#`>_-]/g, ' ')));
    tools.querySelector('.copy').addEventListener('click', () => navigator.clipboard.writeText(m.text).then(() => toast('Copied'), () => {}));
    const make = tools.querySelector('.make');
    if (make) make.addEventListener('click', () => busy(make, 'Making the reviewer…', async () => {
      say('think', 'Turning this into a reviewer…', 0);
      try { const r = await makeReviewer({ text: m.text, name: `Chat: ${c.title}` }, () => {}); S.award(15, 2); say('cheer', 'Your reviewer is ready!'); location.hash = '#/reviewer/' + r.id; }
      catch (e) { toast(e.message); }
    }));
    return el;
  }
  // a drawing inside an answer: the samples are instant; anything else Cody draws with the AI (kept once drawn)
  function drawingBlock(m) {
    const wrap = document.createElement('div'); wrap.className = 'chat-draw';
    wrap.innerHTML = `<div class="board sm"><div class="thinking"><span></span><span></span><span></span></div></div><div class="row"><button class="btn small open" hidden>Open in Draw with Cody</button><span class="muted small cap">Cody is drawing ${esc(m.draw)}…</span></div>`;
    const show = (spec) => {
      const ctl = mount(wrap.querySelector('.board'), spec, { numbered: true, labels: 'steps', speed: 2.2 });
      if (!ctl) return;
      (async () => { for (let i = 0; i < ctl.count; i++) { if (!wrap.isConnected || !(await ctl.go(i))) return; } })();
      wrap.querySelector('.cap').textContent = spec.title;
      const open = wrap.querySelector('.open'); open.hidden = false;
      open.addEventListener('click', () => openDrawing(spec, m.draw));
    };
    const sample = sampleFor(m.draw);
    if (m.spec) show(m.spec);
    else if (sample) show(sample.drawing);
    else ask('draw', { question: m.draw, context: m.text.slice(0, 600) })
      .then(({ data }) => { const sp = clean(data); if (!sp) throw new Error(); m.spec = sp; S.save(); if (wrap.isConnected) show(sp); })
      .catch(() => { wrap.querySelector('.board').innerHTML = '<p class="muted center">Cody could not draw this one. Try Draw with Cody.</p>'; });
    return wrap;
  }
  function chips() {
    log.querySelectorAll('.followups').forEach((x) => x.remove());
    const last = c.msgs[c.msgs.length - 1];
    if (!last || last.role !== 'cody' || last.care || waiting) return;
    const row = document.createElement('div'); row.className = 'followups';
    let items = [];
    const choices = last.text.match(/^\s*([A-D])[.)]\s+\S/gm);
    if (c.mode === 'quiz' && choices && choices.length >= 3) items = choices.map((x) => x.trim()[0]).map((l) => [l, l]);
    else if (c.mode !== 'talk' && c.mode !== 'quiz' && last.text.length > 160) items = FOLLOWUPS;
    items.forEach(([label, text]) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'fu'; b.textContent = label; b.addEventListener('click', () => send(text)); row.appendChild(b); });
    if (items.length) { log.appendChild(row); bottom(); }
  }
  function empty() {
    const k = c.mode;
    log.innerHTML = `<div class="hello"><div class="hello-cm">${mascot(k === 'talk' ? 'happy' : 'wave', 128)}</div>
      <h2>${k === 'talk' ? 'I’m here. What’s on your mind?' : k === 'quiz' ? 'Ready? Pick a topic and I’ll quiz you.' : k === 'hint' ? 'Stuck? I’ll nudge you, not spoil it.' : 'Hi! What are we studying today?'}</h2>
      <div class="starters">${(rev ? [`Explain ${rev.title.toLowerCase()} simply`, `Quiz me on ${rev.title.toLowerCase()}`, `What should I focus on in ${rev.title.toLowerCase()}?`] : STARTERS[k]).map((s) => `<button type="button" class="chip">${esc(s)}</button>`).join('')}</div></div>`;
    log.querySelectorAll('.chip').forEach((b) => b.addEventListener('click', () => send(b.textContent)));
  }
  function paintAll() { if (!c.msgs.length) return empty(); log.innerHTML = ''; c.msgs.forEach((m, i) => log.appendChild(bubble(m, i))); chips(); bottom(); }

  // ---------- sending ----------
  async function send(text) {
    text = String(text || '').trim();
    if ((!text && !photo) || waiting) return;
    if (!text) text = 'Help me with this.';
    if (!c.msgs.length) log.innerHTML = '';
    const sentPhoto = photo; photo = null; attached.hidden = true; attached.innerHTML = '';
    box.value = ''; grow();
    S.addMsg(c, { role: 'me', text, photo: !!sentPhoto });
    log.appendChild(bubble(c.msgs[c.msgs.length - 1])); log.querySelectorAll('.followups').forEach((x) => x.remove());
    // safety first: the words say the student may be at risk → care and the crisis lines, at once
    const risk = Care.check(text);
    if (risk) {
      S.addMsg(c, { role: 'cody', care: risk.lang, text: Care.reply(risk.lang) });
      if (c.mode !== 'talk') setMode('talk', false);
      log.appendChild(bubble(c.msgs[c.msgs.length - 1])); bottom(); return;
    }
    waiting = true; setFace('think');
    ctrl = new AbortController(); stopMode(true);
    const typing = document.createElement('div'); typing.className = 'msg cody typing';
    typing.innerHTML = `<span class="avatar-cm">${mascot('think', 34)}</span><div class="body"><div class="text"><div class="thinking"><span></span><span></span><span></span></div></div></div>`;
    log.appendChild(typing); bottom();
    try {
      const context = rev ? `${rev.title}. ${rev.summary || ''} Key terms: ${rev.terms.map((t) => `${t.term}: ${t.meaning}`).join(' | ')}` : '';
      const { data } = await ask('chat', { mode: c.mode, context, name: S.get().name, messages: c.msgs.map((m) => ({ role: m.role, text: m.text })), file: sentPhoto }, { signal: ctrl.signal });
      const care = Care.fromAI(data.reply);
      if (care) S.addMsg(c, { role: 'cody', care: Care.langOf(text), aiWords: care.aiWords, text: Care.reply(Care.langOf(text), care.aiWords) });
      else S.addMsg(c, { role: 'cody', text: data.reply, draw: c.mode === 'talk' ? '' : data.draw });
      if (c.title === 'New chat' && data.title) { c.title = data.title; S.save(); root.querySelector('.chat-title h1').textContent = c.title; const li = root.querySelector('.chat-list li.on b'); if (li) li.textContent = c.title; }
      S.award(2, 1);
      const count = root.querySelector('.chat-list li.on .muted'); if (count) count.textContent = plural(c.msgs.length, 'message');
      setFace(data.draw ? 'draw' : 'happy');
    } catch (e) {
      if (e.name === 'AbortError') { S.addMsg(c, { role: 'cody', text: '*You stopped this answer.* Ask again, or ask it another way.' }); setFace('happy'); }
      else { S.addMsg(c, { role: 'cody', text: `Sorry, I could not answer that one. ${e.message}` }); setFace('oops'); }
    } finally {
      waiting = false; ctrl = null; stopMode(false); typing.remove();
      log.appendChild(bubble(c.msgs[c.msgs.length - 1])); chips(); bottom();
      setTimeout(() => setFace('happy'), 4000);
    }
  }
  const grow = () => { box.style.height = 'auto'; box.style.height = Math.min(160, box.scrollHeight) + 'px'; };
  box.addEventListener('input', grow);
  box.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(box.value); } });
  form.addEventListener('submit', (e) => { e.preventDefault(); if (ctrl) { ctrl.abort(); return; } send(box.value); });
  // while Cody thinks, Send becomes Stop
  function stopMode(on) {
    const b = form.querySelector('.send'); b.innerHTML = on ? ICON.stop : ICON.send; b.setAttribute('aria-label', on ? 'Stop Cody' : 'Send'); b.classList.toggle('stop', on);
  }
  // Clear chat: empties this chat (the red confirm)
  root.querySelector('.clear-chat').addEventListener('click', async () => {
    if (!c.msgs.length) return;
    if (!(await askSure({ title: `Clear “${c.title === 'New chat' ? 'this chat' : c.title}”?`, body: `Its ${plural(c.msgs.length, 'message')} will be gone from this device. This can't be undone.`, action: 'Clear chat' }))) return;
    if (ctrl) ctrl.abort();
    c.msgs = []; c.title = 'New chat'; S.save(); render(root, c.id, new URLSearchParams());
  });

  // photo of the problem (Gemini or Claude reads it)
  form.querySelector('input[type=file]').addEventListener('change', async (e) => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try {
      photo = { type: 'image/jpeg', data: await shrinkImage(f) };
      attached.hidden = false;
      attached.innerHTML = `<img alt="Your photo" src="data:image/jpeg;base64,${photo.data}"><span>Photo added. Ask about it, or just send.</span><button type="button" class="x" aria-label="Remove photo">×</button>`;
      attached.querySelector('.x').addEventListener('click', () => { photo = null; attached.hidden = true; attached.innerHTML = ''; });
      box.focus();
    } catch (err) { toast('Could not read that photo.'); }
  });
  // voice typing (Chrome, Edge, Android): words appear as you speak
  const mic = form.querySelector('.mic');
  if (mic) mic.addEventListener('click', () => {
    if (listening) { listening.stop(); return; }
    const r = new SR(); r.lang = 'en-PH'; r.interimResults = true; r.continuous = false;
    const before = box.value ? box.value + ' ' : '';
    r.onresult = (ev) => { box.value = before + [...ev.results].map((x) => x[0].transcript).join(''); grow(); };
    r.onend = () => { listening = null; mic.classList.remove('on'); mic.setAttribute('aria-pressed', 'false'); };
    r.onerror = () => toast('Voice typing stopped. Check the microphone permission.');
    listening = r; mic.classList.add('on'); mic.setAttribute('aria-pressed', 'true'); hush(); r.start();
  });

  // modes and the chat list
  function setMode(k, repaint = true) {
    c.mode = k; S.save();
    root.querySelectorAll('.mode').forEach((b) => { const on = b.dataset.m === k; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
    if (repaint) { if (!c.msgs.length) empty(); else chips(); }
    box.placeholder = k === 'talk' ? 'Tell me what’s going on…' : k === 'quiz' ? 'Name a topic, or answer A, B, C or D…' : k === 'hint' ? 'What are you stuck on?' : 'Ask Cody anything…';
  }
  root.querySelectorAll('.mode').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.m)));
  root.querySelectorAll('.chat-list .del').forEach((b) => b.addEventListener('click', async () => {
    const x = S.chat(b.dataset.id); if (!x) return;
    if (!(await askSure({ title: `Delete “${x.title}”?`, body: `Its ${plural(x.msgs.length, 'message')} will be gone from this device. This can't be undone.`, action: 'Delete chat' }))) return;
    S.removeChat(b.dataset.id);
    location.hash = b.dataset.id === c.id ? '#/chat' : location.hash;
    if (b.dataset.id !== c.id) b.closest('li').remove();
  }));

  setMode(c.mode, false);
  paintAll();
  if (params.get('q')) { history.replaceState(null, '', '#/chat/' + c.id); send(params.get('q')); }
  box.focus({ preventScroll: true });
  return () => { hush(); if (listening) listening.stop(); };
}
