import { appUrl, DEFAULT_APP, openReviewer, openDraw } from './shared.js';

const $ = (id) => document.getElementById(id);
const say = (t) => { $('msg').textContent = t; };

// read the open tab (only when the student clicks: that's what activeTab allows)
async function grab(selectionOnly) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !/^https?:/.test(tab.url || '')) throw new Error('Cody can read normal web pages, not this one.');
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    args: [selectionOnly],
    func: (sel) => {
      const picked = String(getSelection() || '').trim();
      if (sel) return picked;
      const main = document.querySelector('article, main, [role=main]') || document.body;
      return picked || main.innerText;
    },
  });
  return { text: result, title: tab.title };
}
async function run(selectionOnly) {
  try { say('Reading…'); const { text, title } = await grab(selectionOnly); await openReviewer(text, title); window.close(); }
  catch (e) { say(e.message); }
}
$('page').addEventListener('click', () => run(false));
$('sel').addEventListener('click', () => run(true));
$('draw').addEventListener('submit', async (e) => { e.preventDefault(); await openDraw($('q').value); window.close(); });
$('open').addEventListener('click', async (e) => { e.preventDefault(); await chrome.tabs.create({ url: await appUrl() }); window.close(); });

(async () => { const { app } = await chrome.storage.sync.get('app'); $('app').value = app || ''; $('app').placeholder = DEFAULT_APP; })();
$('save').addEventListener('click', async () => {
  const v = $('app').value.trim();
  if (v && !/^https?:\/\/[^\s/]+/.test(v)) return say('Use a full address, like https://cody.vercel.app');
  await chrome.storage.sync.set({ app: v }); say('Saved.');
});
