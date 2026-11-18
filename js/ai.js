/* Talks to Cody's server (api/ai.js). The keys stay on the server. */
export async function ask(task, input) {
  let r;
  try {
    r = await fetch('/api/ai', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ task, ...input }) });
  } catch (e) { throw new Error('You seem to be offline. The sample reviewers still work.'); }
  let j = null; try { j = await r.json(); } catch (e) { /* not JSON */ }
  if (!r.ok || !j || !j.ok) throw new Error((j && j.error) || 'Cody could not reach the AI. Please try again.');
  return j;
}
