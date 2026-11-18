/* Right-click on highlighted text: make a reviewer from it, or ask Cody to draw it. */
import { openReviewer, openDraw } from './shared.js';

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.contextMenus.removeAll();
  chrome.contextMenus.create({ id: 'cody-reviewer', title: 'Make a Cody reviewer from this', contexts: ['selection'] });
  chrome.contextMenus.create({ id: 'cody-draw', title: 'Draw “%s” with Cody', contexts: ['selection'] });
});
chrome.contextMenus.onClicked.addListener((info, tab) => {
  const source = (tab && tab.title) || 'A web page';
  if (info.menuItemId === 'cody-reviewer') openReviewer(info.selectionText, source).catch(() => openDraw(info.selectionText));
  if (info.menuItemId === 'cody-draw') openDraw(info.selectionText);
});
