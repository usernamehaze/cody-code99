/* #/import?src=…&t=…  Text sent from the Cody browser extension (or any link) becomes a reviewer.
   The text arrives in the #fragment (never sent to a server). It is moved to this tab's
   sessionStorage and wiped from the address bar at once, so it is not left in history. */
import * as S from '../store.js';
import { makeReviewer } from './reviewers.js';
import { esc, header, toast } from '../ui.js';

const KEY = 'cody.import';

export function render(root, params) {
  if (params.get('t')) {
    try { sessionStorage.setItem(KEY, JSON.stringify({ src: params.get('src') || 'A web page', t: params.get('t') })); } catch (e) { /* private mode: keep it in memory below */ }
    render.pending = { src: params.get('src') || 'A web page', t: params.get('t') };
    history.replaceState(null, '', '#/import');
  }
  let got = render.pending;
  try { got = JSON.parse(sessionStorage.getItem(KEY) || 'null') || got; } catch (e) { /* use memory */ }
  if (!got || !got.t) { location.hash = '#/reviewers'; return; }
  const words = got.t.split(/\s+/).filter(Boolean).length;
  root.innerHTML = `
    ${header('Make a reviewer', 'Sent from the Cody extension')}
    <section class="card import">
      <h2 class="eyebrow">From</h2><p class="from"><b>${esc(got.src)}</b> <span class="muted">· ${words.toLocaleString('en-US')} words</span></p>
      <blockquote class="preview">${esc(got.t.slice(0, 600))}${got.t.length > 600 ? '…' : ''}</blockquote>
      <div class="row"><button class="btn primary go">Make my reviewer</button><a class="btn" href="#/draw?q=${encodeURIComponent(got.src.slice(0, 120))}">Draw it instead</a><button class="btn ghost cancel">Cancel</button></div>
      <p class="status muted" aria-live="polite"></p>
    </section>`;
  const status = root.querySelector('.status'), go = root.querySelector('.go');
  const done = () => { try { sessionStorage.removeItem(KEY); } catch (e) { /* */ } render.pending = null; };
  go.addEventListener('click', async () => {
    go.disabled = true;
    try { const rev = await makeReviewer({ text: got.t, name: got.src }, (m) => { status.textContent = m; }); done(); S.award(15, 2); toast('Your reviewer is ready!'); location.hash = '#/reviewer/' + rev.id; }
    catch (e) { status.textContent = e.message; go.disabled = false; }
  });
  root.querySelector('.cancel').addEventListener('click', () => { done(); location.hash = '#/reviewers'; });
}
