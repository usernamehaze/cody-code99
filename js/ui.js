/* Small helpers shared by every screen. */
export const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const fmt = (n) => Number(n || 0).toLocaleString('en-US');

const P = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const ICON = {
  home: P('<path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>'),
  file: P('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6M9 9h1"/>'),
  pencil: P('<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>'),
  quiz: P('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .8-1 1.5V14M12 17.5h.01"/>'),
  cards: P('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>'),
  game: P('<path d="M6 9h12a4 4 0 0 1 0 8c-1.5 0-2.3-1-3-2H9c-.7 1-1.5 2-3 2a4 4 0 0 1 0-8z"/><path d="M7 13h3M8.5 11.5v3M15.5 12.5h.01M17.5 14h.01"/>'),
  plan: P('<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M8 3v4M16 3v4"/>'),
  upload: P('<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>'),
  me: P('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
  check: P('<path d="m5 12 5 5 9-10"/>'),
  sound: P('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>'),
  chat: P('<path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12z"/><path d="M8.5 12h.01M12 12h.01M15.5 12h.01"/>'),
  mic: P('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>'),
  image: P('<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m21 16-5-5-9 8"/>'),
  send: P('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  copy: P('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>'),
  plus: P('<path d="M12 5v14M5 12h14"/>'),
  users: P('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>'),
  undo: P('<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>'),
  stop: P('<rect x="6" y="6" width="12" height="12" rx="2"/>'),
  play: P('<path d="M7 4.5v15l12-7.5z"/>'),
  share: P('<path d="M12 15V3M7 8l5-5 5 5M5 14v5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5"/>'),
  flame: P('<path d="M12 21c-3.9 0-7-2.8-7-6.6 0-2.9 1.8-4.9 3.6-6.6.4 1.9 1.4 3 2.6 3.4C11 8.2 12 5.4 14.6 3c.3 3.3 4.4 5.9 4.4 11.1 0 4-3.1 6.9-7 6.9z"/><path d="M12 21c-1.7 0-3-1.2-3-2.9 0-1.6 1.3-2.7 2.3-3.7.4 1.4 1.2 2 1.9 2.2.6-.8.8-1.7.6-2.7 1.3 1 2.2 2.4 2.2 4.1 0 1.7-1.4 3-4 3z"/>'),
  clock: P('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9.5 2.5h5"/>'),
  trash: P('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
};
// Cody's face: curly braces for cheeks (a coder's smile)
export const LOGO = `<svg viewBox="0 0 48 48" aria-hidden="true"><rect width="48" height="48" rx="12" fill="#2dd4bf"/><path d="M15 13c-3 0-4 1.5-4 4v3c0 2-1 3-3 4 2 1 3 2 3 4v3c0 2.5 1 4 4 4M33 13c3 0 4 1.5 4 4v3c0 2 1 3 3 4-2 1-3 2-3 4v3c0 2.5-1 4-4 4" fill="none" stroke="#0b2b33" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="19.5" cy="21" r="2.6" fill="#0b2b33"/><circle cx="28.5" cy="21" r="2.6" fill="#0b2b33"/><path d="M18.5 28c3 3.2 8 3.2 11 0" fill="none" stroke="#0b2b33" stroke-width="3" stroke-linecap="round"/></svg>`;

export function toast(text, kind = '') {
  const t = document.createElement('div');
  t.className = 'toast ' + kind; t.textContent = text; t.setAttribute('role', 'status');
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('in'));
  setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 300); }, 2600);
}
export function header(title, sub, right = '') {
  return `<header class="page-head"><div><h1>${esc(title)}</h1>${sub ? `<p class="sub">${esc(sub)}</p>` : ''}</div><div class="head-right">${right}</div></header>`;
}
export const empty = (text, action = '') => `<div class="empty"><p>${esc(text)}</p>${action}</div>`;
// read aloud (the browser's own voice; nothing leaves the device)
export function speak(text, onend) {
  if (!('speechSynthesis' in window)) { if (onend) onend(); return; }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text); u.rate = 1; u.lang = 'en-US';
  if (onend) u.onend = onend;
  speechSynthesis.speak(u);
}
export const hush = () => { if ('speechSynthesis' in window) speechSynthesis.cancel(); };

// "1 message", "3 messages"
export const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;

/* Show that it's working (Cassie's rule 8): the button shows a spinner and "-ing…" words, ignores repeat
   taps, and comes back when the work is done (or fails). Returns what the work returned. */
export async function busy(btn, words, work) {
  if (!btn || btn.dataset.busy) return undefined;
  const before = btn.innerHTML, width = btn.offsetWidth;
  btn.dataset.busy = '1'; btn.disabled = true; btn.setAttribute('aria-busy', 'true');
  btn.style.minWidth = width + 'px';
  btn.innerHTML = `<span class="spin" aria-hidden="true"></span><span>${esc(words)}</span>`;
  try { return await work(); }
  finally { if (btn.isConnected) { btn.innerHTML = before; btn.disabled = false; btn.removeAttribute('aria-busy'); btn.style.minWidth = ''; } delete btn.dataset.busy; }
}

/* Destructive actions are obvious (Cassie's rule 6): a sheet instead of the browser's OK/Cancel.
   The title names the thing, the text says what goes and whether it comes back, Cancel has focus
   (so Enter on autopilot keeps things), and the action is red and says what it does.
   askSure({ title, body, action, danger = true }) -> Promise<boolean> */
// a question with a few answers, as a sheet (like askSure): resolves with the picked value, or null for Not now
export function choose({ title, body = '', options, art = '', later = 'Not now' }) {
  return new Promise((done) => {
    const back = document.createElement('div');
    back.className = 'sure-back';
    back.innerHTML = `<div class="sure-sheet choose-sheet" role="dialog" aria-modal="true" aria-labelledby="ch-t">
      ${art ? `<div class="ch-art" aria-hidden="true">${art}</div>` : ''}<h2 id="ch-t">${esc(title)}</h2>${body ? `<p>${esc(body)}</p>` : ''}
      <div class="ch-list">${options.map((o, i) => `<button type="button" class="ch-opt${o.primary ? ' primary' : ''}" data-i="${i}">${o.icon || ''}<span><b>${esc(o.label)}</b>${o.sub ? `<small>${esc(o.sub)}</small>` : ''}</span></button>`).join('')}</div>
      <button type="button" class="btn ghost ch-later">${esc(later)}</button></div>`;
    const before = document.activeElement;
    const close = (v) => { document.removeEventListener('keydown', keys, true); back.remove(); if (before && before.focus) before.focus({ preventScroll: true }); done(v); };
    const keys = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close(null); }
      if (e.key === 'Tab') { const f = [...back.querySelectorAll('button')]; const i = f.indexOf(document.activeElement); e.preventDefault(); f[(i + (e.shiftKey ? f.length - 1 : 1)) % f.length].focus(); }
    };
    back.addEventListener('click', (e) => { if (e.target === back) close(null); });
    back.querySelectorAll('.ch-opt').forEach((b) => b.addEventListener('click', () => close(options[+b.dataset.i].value)));
    back.querySelector('.ch-later').addEventListener('click', () => close(null));
    document.addEventListener('keydown', keys, true);
    document.body.appendChild(back);
    back.querySelector('.ch-opt').focus();
  });
}

export function askSure({ title, body = '', action, danger = true }) {
  return new Promise((done) => {
    const back = document.createElement('div');
    back.className = 'sure-back';
    back.innerHTML = `<div class="sure-sheet" role="alertdialog" aria-modal="true" aria-labelledby="sure-t" aria-describedby="sure-b">
      <h2 id="sure-t">${esc(title)}</h2>${body ? `<p id="sure-b">${esc(body)}</p>` : ''}
      <div class="sure-row"><button type="button" class="btn sure-no">Cancel</button><button type="button" class="btn ${danger ? 'sure-danger' : 'primary'} sure-yes">${esc(action)}</button></div></div>`;
    const before = document.activeElement;
    const close = (ok) => { document.removeEventListener('keydown', keys, true); back.remove(); if (before && before.focus) before.focus({ preventScroll: true }); done(ok); };
    const keys = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close(false); }
      if (e.key === 'Tab') { const f = [...back.querySelectorAll('button')]; const i = f.indexOf(document.activeElement); e.preventDefault(); f[(i + (e.shiftKey ? f.length - 1 : 1)) % f.length].focus(); }
    };
    back.addEventListener('click', (e) => { if (e.target === back) close(false); });
    back.querySelector('.sure-no').addEventListener('click', () => close(false));
    back.querySelector('.sure-yes').addEventListener('click', () => close(true));
    document.addEventListener('keydown', keys, true);
    document.body.appendChild(back);
    back.querySelector('.sure-no').focus();
  });
}
