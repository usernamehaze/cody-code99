/* The class room: classmates study together, each on their own phone or computer (like Cassie's study rooms).
   A shared board everyone draws on, a chat with voice messages, "Ask Cody for everyone", and reviewers
   shared with the class (a classmate saves a copy with its study guide, quiz and flashcards).
   Everything is a list of things that happened (api/class.js), polled every few seconds, so someone who
   joins late sees the latest of it. Words that sound like a student is at risk never go to the room:
   they open a private chat with Cody's care response instead. */
import * as S from '../store.js';
import * as Class from '../classroom.js';
import { ask } from '../ai.js';
import { md } from '../md.js';
import { mascot, emptyState, say } from '../mascot.js';
import { esc, header, ICON, toast, askSure, busy, plural } from '../ui.js';
import '../care.js';

const W = 1000, H = 625; // the board's own units (16:10), the same on every screen
const COLORS = ['#f1f5f9', '#2dd4bf', '#fbbf24', '#f7687f', '#60a5fa', '#a78bfa'];
const POLL_MS = 2500, MAX_REC = 60;
const time = (t) => (t ? new Date(t).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' }) : '');
const b64 = (blob) => new Promise((ok, fail) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = fail; r.readAsDataURL(blob); });

export function render(root) {
  const s = S.get();
  if (!s.class) {
    root.innerHTML = `${header('Class room', '')}<section class="card">${emptyState({ mood: 'wave', title: 'Study together in a class room', text: 'Draw on one board, chat, send voice messages, ask Cody for everyone and share reviewers. Make a class or join one with its code first.', actions: [{ label: 'Join or make a class', href: '#/plan/class' }] })}</section>`;
    return undefined;
  }
  const ops = new Map(); // idx -> op
  let since = -1, base = 0, tick = 0, timer = null, alive = true, color = COLORS[1], thick = false, tab = 'chat', online = [];
  const pending = new Map(); // a stroke I drew, by its points, until the room gives it a number

  root.innerHTML = `
    ${header(`Class room · ${s.class.name}`, `Code ${s.class.code} · share it so classmates can join`, `<div class="here" aria-live="polite"></div>`)}
    <p class="room-off" hidden></p>
    <section class="room grow">
      <div class="card room-board">
        <div class="board-tools" role="toolbar" aria-label="Board tools">
          <div class="swatches">${COLORS.map((c, i) => `<button class="sw ${i === 1 ? 'on' : ''}" data-c="${c}" style="--c:${c}" aria-label="Pen colour ${i + 1}" aria-pressed="${i === 1}"></button>`).join('')}</div>
          <button class="btn small thick" aria-pressed="false">Thick pen</button>
          <button class="btn small undo">${ICON.undo} Undo my line</button>
          <button class="btn small ghost clear">Clear board</button>
        </div>
        <div class="canvas-wrap"><canvas aria-label="Shared class board. Draw with your finger or mouse."></canvas><p class="board-hint">Draw here. Everyone in the class sees it.</p></div>
      </div>
      <div class="card room-side">
        <div class="tabs-row" role="tablist"><button class="tab on" data-t="chat" role="tab" aria-selected="true">Chat</button><button class="tab" data-t="shared" role="tab" aria-selected="false">Shared <b class="n-shared"></b></button></div>
        <div class="room-log" data-t="chat" aria-live="polite"></div>
        <div class="room-shared" data-t="shared" hidden>
          <div class="share-mine"></div>
          <h3 class="eyebrow">Shared with the class</h3>
          <div class="shared-list"></div>
        </div>
        <form class="room-compose" data-t="chat">
          <div class="rec" hidden><span class="dot"></span><span class="rec-t">0:00</span> Recording… tap stop to send</div>
          <div class="cbar">
            <textarea rows="1" maxlength="600" placeholder="Message the class…" aria-label="Message the class"></textarea>
            <button type="button" class="icon-btn mic" aria-label="Record a voice message" aria-pressed="false">${ICON.mic}</button>
            <button class="send btn primary" aria-label="Send">${ICON.send}</button>
          </div>
          <button type="button" class="btn small ask-cody">${mascot('happy', 22)} Ask Cody for everyone</button>
        </form>
      </div>
    </section>`;

  const $ = (q) => root.querySelector(q);
  const log = $('.room-log'), canvas = $('canvas'), ctx2 = canvas.getContext('2d'), box = $('.room-compose textarea'), off = $('.room-off');

  // ---------- the board ----------
  let scale = 1;
  function size() {
    const w = canvas.parentElement.clientWidth, dpr = window.devicePixelRatio || 1;
    canvas.style.height = `${(w * H) / W}px`; canvas.width = Math.round(w * dpr); canvas.height = Math.round(((w * H) / W) * dpr);
    scale = canvas.width / W; paint();
  }
  function line(p, c, w) {
    ctx2.strokeStyle = c; ctx2.lineWidth = w * scale; ctx2.lineCap = 'round'; ctx2.lineJoin = 'round'; ctx2.beginPath();
    for (let i = 0; i < p.length; i += 2) (i ? ctx2.lineTo : ctx2.moveTo).call(ctx2, p[i] * scale, p[i + 1] * scale);
    if (p.length === 2) ctx2.lineTo(p[0] * scale + 0.1, p[1] * scale);
    ctx2.stroke();
  }
  function strokes() {
    const all = [...ops.values()].sort((a, b) => a.idx - b.idx);
    const lastClear = all.reduce((m, o) => (o.k === 'clear' ? o.idx : m), -1);
    const undone = new Set(all.filter((o) => o.k === 'undo').map((o) => o.of));
    return all.filter((o) => o.k === 'stroke' && o.idx > lastClear && !undone.has(o.idx)).concat([...pending.values()]);
  }
  function paint() {
    ctx2.clearRect(0, 0, canvas.width, canvas.height);
    const list = strokes(); list.forEach((o) => line(o.p, o.c, o.w));
    $('.board-hint').hidden = list.length > 0;
  }
  let drawing = null;
  const at = (e) => { const r = canvas.getBoundingClientRect(); return [Math.round(((e.clientX - r.left) / r.width) * W), Math.round(((e.clientY - r.top) / r.height) * H)]; };
  canvas.addEventListener('pointerdown', (e) => { e.preventDefault(); canvas.setPointerCapture(e.pointerId); drawing = { c: color, w: thick ? 12 : 4, p: at(e) }; line(drawing.p, drawing.c, drawing.w); $('.board-hint').hidden = true; });
  canvas.addEventListener('pointermove', (e) => {
    if (!drawing) return; const [x, y] = at(e), p = drawing.p;
    if (Math.hypot(x - p[p.length - 2], y - p[p.length - 1]) < 3 || p.length > 2390) return;
    p.push(x, y); line(p.slice(-4), drawing.c, drawing.w);
  });
  const finish = () => {
    if (!drawing) return; const st = { k: 'stroke', ...drawing, mine: true }; drawing = null;
    const key = st.p.join(','); pending.set(key, st);
    Class.post({ k: 'stroke', c: st.c, w: st.w, p: st.p }).then(() => { S.award(1, 0); }).catch((e) => { pending.delete(key); paint(); toast(e.message); });
  };
  canvas.addEventListener('pointerup', finish); canvas.addEventListener('pointercancel', finish);
  root.querySelectorAll('.sw').forEach((b) => b.addEventListener('click', () => { color = b.dataset.c; root.querySelectorAll('.sw').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); }); }));
  $('.thick').addEventListener('click', (e) => { thick = !thick; e.currentTarget.setAttribute('aria-pressed', thick); e.currentTarget.classList.toggle('on', thick); });
  $('.undo').addEventListener('click', () => {
    const mine = strokes().filter((o) => o.mine && o.idx != null).pop();
    if (!mine) { toast('You have no lines on the board to undo.'); return; }
    ops.set(-mine.idx - 1, { k: 'undo', of: mine.idx, idx: Infinity }); paint(); // (shows at once; the room's own undo replaces it)
    Class.post({ k: 'undo', of: mine.idx }).catch((e) => toast(e.message));
  });
  $('.clear').addEventListener('click', async () => {
    if (!(await askSure({ title: 'Clear the board for everyone?', body: "Every line on the class board goes, for all your classmates. This can't be undone.", action: 'Clear the board' }))) return;
    Class.post({ k: 'clear' }).then(() => poll()).catch((e) => toast(e.message));
  });

  // ---------- the chat ----------
  function item(o) {
    const who = `<span class="who">${esc(o.mine ? 'You' : o.n)} · ${time(o.at)}</span>`;
    if (o.k === 'msg') return `<div class="rm ${o.mine ? 'me' : ''}">${who}<div class="bub">${esc(o.t)}</div></div>`;
    if (o.k === 'voice') return `<div class="rm ${o.mine ? 'me' : ''}">${who}<button type="button" class="bub voice-msg" data-vid="${esc(o.vid)}" aria-label="Play voice message from ${esc(o.mine ? 'you' : o.n)}, ${o.s} seconds">${ICON.play}<span class="wave"></span><span>0:${String(o.s).padStart(2, '0')}</span></button></div>`;
    if (o.k === 'cody') return `<div class="rm cody">${who.replace('</span>', ' asked Cody</span>')}<div class="bub q">${esc(o.q)}</div><div class="cody-ans"><span class="av">${mascot('happy', 30)}</span><div class="bub md">${md(o.a)}</div></div></div>`;
    if (o.k === 'share') return `<div class="rm sys">${esc(o.mine ? 'You' : o.n)} shared the reviewer <b>${esc(o.r.title)}</b>. <button type="button" class="link to-shared">See it</button></div>`;
    if (o.k === 'clear') return `<div class="rm sys">${esc(o.mine ? 'You' : o.n)} cleared the board.</div>`;
    return '';
  }
  function chat() {
    const list = [...ops.values()].filter((o) => ['msg', 'voice', 'cody', 'share', 'clear'].includes(o.k) && Number.isFinite(o.idx)).sort((a, b) => a.idx - b.idx);
    const nearEnd = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
    log.innerHTML = list.length ? list.map(item).join('') : emptyState({ mood: 'happy', size: 84, title: 'Say hi to your class', text: 'Messages, voice messages and Cody’s answers show here for everyone.' }).replace('class="empty-cm"', 'class="empty-cm sm"');
    if (nearEnd) log.scrollTop = log.scrollHeight;
    log.querySelectorAll('.to-shared').forEach((b) => b.addEventListener('click', () => show('shared')));
    log.querySelectorAll('.voice-msg').forEach((b) => b.addEventListener('click', () => play(b)));
  }
  const audios = new Map(); let playing = null;
  async function play(btn) {
    const vid = btn.dataset.vid;
    if (playing) { playing.pause(); playing.btn.classList.remove('on'); if (playing.btn === btn) { playing = null; return; } }
    try {
      if (!audios.has(vid)) { btn.classList.add('loading'); const a = await Class.getAudio(vid); audios.set(vid, `data:${a.type};base64,${a.audio}`); }
      const el = new Audio(audios.get(vid)); el.btn = btn; playing = el; btn.classList.add('on');
      el.onended = () => { btn.classList.remove('on'); playing = null; };
      await el.play();
    } catch (e) { toast(e.message || 'Could not play it on this device.'); btn.classList.remove('on'); }
    finally { btn.classList.remove('loading'); }
  }
  // words that say a student is at risk stay private: Cody's care response, not the class
  const risky = (t) => window.CodyCare && window.CodyCare.check(t);
  const privately = (t) => { toast('This stays between you and Cody.'); location.hash = '#/chat?new=1&mode=talk&q=' + encodeURIComponent(t); };
  $('.room-compose').addEventListener('submit', (e) => {
    e.preventDefault(); const t = box.value.trim(); if (!t) return;
    if (risky(t)) { box.value = ''; privately(t); return; }
    box.value = ''; Class.post({ k: 'msg', t }).then(() => poll()).catch((err) => { box.value = t; toast(err.message); });
  });
  box.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('.room-compose').requestSubmit(); } });
  $('.ask-cody').addEventListener('click', (e) => {
    const q = box.value.trim();
    if (!q) { box.focus(); toast('Type the question first, then tap Ask Cody.'); return; }
    if (risky(q)) { box.value = ''; privately(q); return; }
    busy(e.currentTarget, 'Cody is answering…', async () => {
      try {
        const { data } = await ask('chat', { mode: 'tutor', name: S.get().name, messages: [{ role: 'me', text: q }], context: `This is a class room: ${S.get().class.name}. Answer for the whole class.` });
        if (window.CodyCare && window.CodyCare.fromAI(data.reply)) { box.value = ''; privately(q); return; }
        await Class.post({ k: 'cody', q, a: data.reply }); box.value = ''; S.award(2, 1); poll();
      } catch (err) { toast(err.message); }
    });
  });

  // voice messages: tap to record (up to a minute), tap again to send
  const mic = $('.mic'), recBar = $('.rec');
  let rec = null;
  mic.addEventListener('click', async () => {
    if (rec) { rec.stop(); return; }
    if (!navigator.mediaDevices || !window.MediaRecorder) { toast('Voice messages need Chrome, Edge or Safari 14.5 or newer.'); return; }
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (e) { toast('Allow the microphone to send a voice message.'); return; }
    const type = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find((t) => MediaRecorder.isTypeSupported(t)) || '';
    const r = new MediaRecorder(stream, { mimeType: type || undefined, audioBitsPerSecond: 32000 }); const parts = [], t0 = Date.now();
    rec = r; mic.classList.add('on'); mic.setAttribute('aria-pressed', 'true'); mic.innerHTML = ICON.stop; recBar.hidden = false;
    const clock = setInterval(() => { const sec = Math.floor((Date.now() - t0) / 1000); recBar.querySelector('.rec-t').textContent = `0:${String(sec).padStart(2, '0')}`; if (sec >= MAX_REC) r.stop(); }, 250);
    r.ondataavailable = (e) => { if (e.data.size) parts.push(e.data); };
    r.onstop = async () => {
      clearInterval(clock); stream.getTracks().forEach((t) => t.stop()); rec = null;
      mic.classList.remove('on'); mic.setAttribute('aria-pressed', 'false'); mic.innerHTML = ICON.mic; recBar.hidden = true;
      const secs = (Date.now() - t0) / 1000; if (secs < 1 || !parts.length) return;
      const blob = new Blob(parts, { type: r.mimeType || type || 'audio/webm' });
      await busy($('.send'), 'Sending…', async () => {
        try { await Class.sendVoice(await b64(blob), blob.type.split(';')[0] === 'audio/mp4' ? 'audio/mp4' : blob.type, secs); S.award(2, 0); poll(); }
        catch (e) { toast(e.message); }
      });
    };
    r.start();
  });

  // ---------- shared reviewers ----------
  function shared() {
    const list = [...ops.values()].filter((o) => o.k === 'share' && Number.isFinite(o.idx)).sort((a, b) => b.idx - a.idx);
    $('.n-shared').textContent = list.length ? list.length : '';
    $('.shared-list').innerHTML = list.length ? list.map((o) => `<div class="shared-item"><b>${esc(o.r.title)}</b><span class="muted">From ${esc(o.mine ? 'you' : o.n)} · ${plural((o.r.terms || []).length, 'term')} · ${plural((o.r.quiz || []).length, 'question')}</span>${o.mine ? '' : `<button type="button" class="btn small save-copy" data-i="${o.idx}">Save a copy</button>`}</div>`).join('')
      : `<p class="muted">Nothing shared yet. Share one of your reviewers above, and classmates can save a copy with its quiz and flashcards.</p>`;
    $('.shared-list').querySelectorAll('.save-copy').forEach((b) => b.addEventListener('click', () => {
      const o = ops.get(+b.dataset.i); if (!o) return;
      const r = S.addReviewer({ ...o.r, id: undefined, source: { name: `Shared by ${o.n}`, pages: 1 } });
      S.award(3, 0); toast(`Saved “${r.title}” to your reviewers`); b.replaceWith(Object.assign(document.createElement('a'), { className: 'btn small', href: '#/reviewer/' + r.id, textContent: 'Open it' }));
    }));
  }
  function shareMine() {
    const mine = S.get().reviewers;
    $('.share-mine').innerHTML = mine.length
      ? `<h3 class="eyebrow">Share one of yours</h3><div class="share-pick">${mine.map((r) => `<button type="button" class="btn small" data-id="${esc(r.id)}">${ICON.share} ${esc(r.title)}</button>`).join('')}</div>`
      : `<p class="muted">Make a reviewer from your notes, then share it here. <a class="link" href="#/reviewers?upload=1">Upload my notes</a></p>`;
    $('.share-mine').querySelectorAll('[data-id]').forEach((b) => b.addEventListener('click', () => busy(b, 'Sharing…', async () => {
      const r = S.reviewer(b.dataset.id); if (!r) return;
      const pick = { title: r.title, subject: r.subject, summary: r.summary, terms: r.terms, questions: r.questions, quiz: r.quiz, cards: r.cards, drawing: r.drawing, game: r.game, guide: (r.guide || '').slice(0, 40000) };
      try { await Class.post({ k: 'share', r: pick }); S.award(5, 0); toast('Shared with the class'); say('cheer', 'Sharing is caring!'); poll(); }
      catch (e) { toast(e.message); }
    })));
  }
  function show(t) {
    tab = t;
    root.querySelectorAll('.room-side .tab').forEach((x) => { const on = x.dataset.t === t; x.classList.toggle('on', on); x.setAttribute('aria-selected', on); });
    root.querySelectorAll('.room-side [data-t]:not(.tab)').forEach((x) => { x.hidden = x.dataset.t !== t; });
  }
  root.querySelectorAll('.room-side .tab').forEach((x) => x.addEventListener('click', () => show(x.dataset.t)));

  // ---------- keeping up with the room ----------
  function here() {
    const others = online.filter((p) => !p.me);
    $('.here').innerHTML = `<span class="pill"><span class="live"></span>${others.length ? `${esc(others.slice(0, 3).map((p) => p.name).join(', '))}${others.length > 3 ? ` and ${others.length - 3} more` : ''} here` : 'Only you here now'}</span>`;
  }
  let fails = 0;
  async function poll() {
    clearTimeout(timer);
    if (!alive) return;
    if (document.hidden) { timer = setTimeout(poll, POLL_MS); return; }
    try {
      const want = tick++ % 4 === 0;
      const r = await Class.poll(since, base, want);
      if (!alive) return;
      fails = 0; off.hidden = true;
      base = r.base; since = r.next;
      let board = false, talk = false, share = false;
      for (const o of r.ops) {
        if (o.k === 'stroke' && o.mine) pending.delete(o.p.join(','));
        ops.set(o.idx, o);
        if (['stroke', 'undo', 'clear'].includes(o.k)) board = true;
        if (['msg', 'voice', 'cody', 'share', 'clear'].includes(o.k)) talk = true;
        if (o.k === 'share') share = true;
      }
      for (const k of [...ops.keys()]) if (k < 0) ops.delete(k); // (my undo shown early, now in the room's list)
      if (board) paint(); if (talk) chat(); if (share) shared();
      if (r.online) { online = r.online; here(); }
    } catch (e) {
      fails++;
      if (/not set up/i.test(e.message)) { off.hidden = false; off.textContent = 'Class rooms are not set up on this server yet. The team needs to connect Upstash Redis in Vercel.'; return; }
      if (fails > 1) { off.hidden = false; off.textContent = 'Reconnecting to the class room…'; }
    }
    timer = setTimeout(poll, fails ? Math.min(15000, POLL_MS * 2 ** fails) : POLL_MS);
  }

  window.addEventListener('resize', size);
  size(); chat(); shared(); shareMine(); here(); show('chat');
  poll();
  return () => { alive = false; clearTimeout(timer); window.removeEventListener('resize', size); if (rec) rec.stop(); if (playing) playing.pause(); };
}
