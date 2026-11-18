/* Shared by the popup and the background worker: where Cody lives, and how text is handed to it.
   The text rides in the link's #fragment, which browsers never send to any server; Cody reads it
   and removes it from the address bar at once (see js/views/import.js in the app). */
export const DEFAULT_APP = 'https://cody-code99.vercel.app';
const MAX = 24000; // what Cody reads from one set of notes

export async function appUrl() {
  const { app } = await chrome.storage.sync.get('app');
  return (app || DEFAULT_APP).replace(/\/+$/, '');
}
export async function openReviewer(text, source) {
  const t = String(text || '').replace(/\s+\n/g, '\n').replace(/[ \t]+/g, ' ').trim().slice(0, MAX);
  if (t.length < 40) throw new Error('There is not enough text here. Highlight a few sentences first.');
  const q = new URLSearchParams({ src: String(source || 'A web page').slice(0, 80), t });
  await chrome.tabs.create({ url: `${await appUrl()}/#/import?${q}` });
}
export async function openDraw(question) {
  const q = String(question || '').replace(/\s+/g, ' ').trim().slice(0, 200);
  if (!q) return;
  await chrome.tabs.create({ url: `${await appUrl()}/#/draw?q=${encodeURIComponent(q)}` });
}
