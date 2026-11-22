/* The floating Cody bubble: on every screen (except Ask Cody and the class room), tap it to ask a quick
   question without leaving the page. The talk is saved as a chat, so "Open in Ask Cody" continues it there.
   Stop cancels while Cody is thinking. Words that say a student is at risk get Cody's care response. */
import * as S from './store.js';
import { ask } from './ai.js';
import { md } from './md.js';
import { mascot } from './mascot.js';
import { esc, ICON } from './ui.js';
import './care.js';

let btn = null, panel = null, chatId = null, ctrl = null;
const hiddenOn = () => /^#\/(chat|room)/.test(location.hash);

export function mount() {
  btn = document.createElement('button');
  btn.className = 'cody-bubble'; btn.type = 'button'; btn.setAttribute('aria-label', 'Ask Cody a quick question'); btn.setAttribute('aria-expanded', 'false');
  btn.innerHTML = mascot('happy', 46);
  panel = document.createElement('section');
  panel.className = 'bubble-panel'; panel.hidden = true; panel.setAttribute('aria-label', 'Quick question for Cody');
  panel.innerHTML = `<header><b>Ask Cody</b><a class="link open-full" href="#/chat">Open in Ask Cody</a><button type="button" class="icon-btn close" aria-label="Close">×</button></header>
    <div class="b-log" aria-live="polite"></div>
    <form class="b-form"><textarea rows="1" maxlength="1500" placeholder="Ask a quick question…" aria-label="Your question"></textarea><button class="btn primary b-send" aria-label="Send">${ICON.send}</button></form>`;
  document.body.append(btn, panel);
  btn.addEventListener('click', () => toggle(panel.hidden));
  panel.querySelector('.close').addEventListener('click', () => toggle(false));
  panel.querySelector('.open-full').addEventListener('click', () => toggle(false));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) toggle(false); });
  const box = panel.querySelector('textarea');
  box.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); panel.querySelector('.b-form').requestSubmit(); } });
  panel.querySelector('.b-form').addEventListener('submit', (e) => { e.preventDefault(); if (ctrl) { ctrl.abort(); return; } send(box.value.trim()); });
  paint();
}
export function update() { if (!btn) return; const hide = hiddenOn(); btn.hidden = hide; if (hide) toggle(false); }
function toggle(open) {
  panel.hidden = !open; btn.setAttribute('aria-expanded', String(open)); btn.classList.toggle('open', open);
  if (open) { paint(); panel.querySelector('textarea').focus(); }
}
function paint() {
  const c = chatId && S.chat(chatId), log = panel.querySelector('.b-log');
  panel.querySelector('.open-full').href = c ? '#/chat/' + c.id : '#/chat';
  log.innerHTML = c && c.msgs.length ? c.msgs.slice(-8).map((m) => m.role === 'me' ? `<div class="b-me">${esc(m.text)}</div>`
    : m.care ? `<div class="b-cody"></div>` : `<div class="b-cody">${md(m.text)}</div>`).join('')
    : `<div class="b-hello">${mascot('wave', 64)}<p>Stuck on something? Ask me here without leaving the page.</p></div>`;
  if (c) [...log.querySelectorAll('.b-cody')].forEach((el, i, all) => { const m = c.msgs.filter((x) => x.role !== 'me').slice(-all.length)[i]; if (m && m.care) el.appendChild(window.CodyCare.card(m.care, m.aiWords)); });
  log.scrollTop = log.scrollHeight;
}
async function send(text) {
  if (!text) return;
  const box = panel.querySelector('textarea'), sendBtn = panel.querySelector('.b-send');
  let c = chatId && S.chat(chatId);
  if (!c) { c = S.newChat({}); chatId = c.id; }
  box.value = '';
  S.addMsg(c, { role: 'me', text });
  const risk = window.CodyCare.check(text);
  if (risk) { S.addMsg(c, { role: 'cody', care: risk.lang, text: window.CodyCare.reply(risk.lang) }); c.mode = 'talk'; S.save(); paint(); return; }
  paint();
  const log = panel.querySelector('.b-log'); const wait = document.createElement('div'); wait.className = 'b-cody'; wait.innerHTML = '<div class="thinking"><span></span><span></span><span></span></div>'; log.appendChild(wait); log.scrollTop = log.scrollHeight;
  ctrl = new AbortController();
  sendBtn.innerHTML = ICON.stop; sendBtn.setAttribute('aria-label', 'Stop'); sendBtn.classList.add('stop');
  try {
    const page = document.querySelector('.page-head h1');
    const { data } = await ask('chat', { mode: 'tutor', name: S.get().name, messages: c.msgs.map((m) => ({ role: m.role, text: m.text })), context: page ? `The student is on Cody's "${page.textContent}" screen.` : '' }, { signal: ctrl.signal });
    const care = window.CodyCare.fromAI(data.reply);
    if (care) S.addMsg(c, { role: 'cody', care: window.CodyCare.langOf(text), aiWords: care.aiWords, text: window.CodyCare.reply(window.CodyCare.langOf(text), care.aiWords) });
    else S.addMsg(c, { role: 'cody', text: data.reply, draw: data.draw });
    if (c.title === 'New chat' && data.title) { c.title = data.title; S.save(); }
    S.award(2, 1);
  } catch (e) {
    S.addMsg(c, { role: 'cody', text: e.name === 'AbortError' ? '*You stopped this answer.*' : `Sorry, I couldn't answer that. ${e.message}` });
  } finally {
    ctrl = null; sendBtn.innerHTML = ICON.send; sendBtn.setAttribute('aria-label', 'Send'); sendBtn.classList.remove('stop');
    paint();
  }
}
