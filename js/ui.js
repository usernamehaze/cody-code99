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
