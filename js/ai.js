/* Talks to Cody's server (api/ai.js). The keys stay on the server.
   On the website the server is the same address. In the Android app, window.CODY_API (set by
   scripts/build-mobile.mjs) points at the deployed site. */
export const API = (window.CODY_API || '').replace(/\/+$/, '');
export async function ask(task, input) {
  let r;
  try {
    r = await fetch(API + '/api/ai', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ task, ...input }) });
  } catch (e) { throw new Error('You seem to be offline. The sample reviewers still work.'); }
  let j = null; try { j = await r.json(); } catch (e) { /* not JSON */ }
  if (!r.ok || !j || !j.ok) throw new Error((j && j.error) || 'Cody could not reach the AI. Please try again.');
  return j;
}
