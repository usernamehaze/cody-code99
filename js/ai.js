/* Talks to Cody's server (api/ai.js). The keys stay on the server.
   On the website the server is the same address. In the Android app, window.CODY_API (set by
   scripts/build-mobile.mjs) points at the deployed site.
   Every request carries the language the student picked (Me → Cody's language). Pass { signal } to be able
   to stop it (the Stop button while Cody is thinking): a stopped request throws an error named AbortError. */
import * as S from './store.js';

export const API = (window.CODY_API || '').replace(/\/+$/, '');
export async function ask(task, input, { signal } = {}) {
  let r;
  try {
    r = await fetch(API + '/api/ai', { method: 'POST', signal, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ task, lang: S.get().lang || 'en', ...input }) });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new Error('You seem to be offline. Check your connection and try again.');
  }
  let j = null; try { j = await r.json(); } catch (e) { /* not JSON */ }
  if (!r.ok || !j || !j.ok) throw new Error((j && j.error) || 'Cody could not reach the AI. Please try again.');
  return j;
}
// the languages Cody can write in (the server has the same list)
export const LANGS = [['en', 'English'], ['fil', 'Filipino'], ['taglish', 'Taglish'], ['hil', 'Hiligaynon (Ilonggo)'], ['ceb', 'Cebuano (Bisaya)'], ['ilo', 'Ilocano'], ['bik', 'Bikol'], ['war', 'Waray'], ['pam', 'Kapampangan'], ['pag', 'Pangasinan'], ['es', 'Spanish'], ['zh', 'Chinese'], ['ja', 'Japanese'], ['ko', 'Korean']];
