/* Accounts on the device side (api/account.js): Continue with Google, keeping a copy of Cody in the account so
   it follows the student to any device, and Premium (free during Code 99).
   Sign-in leaves for Google's own page and comes back to Cody with a signed token in the address (#id_token=…).
   That token is sent to Cody's server once, checked there, and wiped from the address at once. */
import * as S from './store.js';
import { API } from './ai.js';

const call = async (body) => {
  let r; try { r = await fetch(API + '/api/account', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); }
  catch (e) { throw new Error('You seem to be offline.'); }
  const j = await r.json().catch(() => null);
  if (j && j.signedOut) { const s = S.get(); delete s.account; S.save(); }
  if (!r.ok || !j || !j.ok) throw new Error((j && j.error) || 'Could not reach your account.');
  return j;
};
let cfg = null;
export const config = () => cfg || (cfg = fetch(API + '/api/account').then((r) => r.json()).catch(() => ({ google: null })));
export const me = () => S.get().account || null;
export const premium = () => !!(me() && me().premium);

export async function signIn() {
  const c = await config();
  if (!c.google) throw new Error('Google sign-in is not switched on for this Cody site yet.');
  const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)), (x) => x.toString(16).padStart(2, '0')).join('');
  try { sessionStorage.setItem('cody.nonce', nonce); sessionStorage.setItem('cody.back', location.hash || '#/'); } catch (e) { /* private mode: sign-in still works once */ }
  location.assign('https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({ client_id: c.google, redirect_uri: location.origin + '/', response_type: 'id_token', scope: 'openid email profile', nonce, prompt: 'select_account' }));
}
// on load: coming back from Google? (runs before the app shows any screen)
export async function finishSignIn() {
  const h = new URLSearchParams(location.hash.replace(/^#/, ''));
  const idToken = h.get('id_token'), failed = h.get('error');
  if (!idToken && !failed) return null;
  let nonce = '', back = '#/plan'; try { nonce = sessionStorage.getItem('cody.nonce') || ''; back = sessionStorage.getItem('cody.back') || back; sessionStorage.removeItem('cody.nonce'); } catch (e) { /* */ }
  history.replaceState(null, '', location.pathname + back); // (the token never stays in the address or history)
  if (failed) return { error: 'Google sign-in was cancelled.' };
  try {
    const j = await call({ action: 'signin', idToken, nonce });
    const s = S.get();
    s.account = { session: j.session, name: j.user.name, email: j.user.email, picture: j.user.picture, premium: j.premium };
    if (!s.name && j.user.name) s.name = j.user.name;
    if (j.data) S.mergeIn(j.data); else S.save();
    await backup();
    return { ok: true, name: j.user.name };
  } catch (e) { return { error: e.message }; }
}
export function signOut() { const s = S.get(); delete s.account; if (s.theme) delete s.theme; S.save(); }
export async function unlockPremium() { const j = await call({ action: 'premium', session: me().session }); me().premium = j.premium; S.save(); }
export async function deleteAccount() { await call({ action: 'delete', session: me().session }); signOut(); }

// a copy in the account, a few seconds after anything changes
let timer = null, last = '';
export async function backup() {
  if (!me()) return;
  const data = S.forAccount(), text = JSON.stringify(data);
  if (text === last) return;
  try { await call({ action: 'save', session: me().session, data }); last = text; me().savedAt = Date.now(); }
  catch (e) { /* tried again on the next change */ }
}
export function watch() {
  S.onChange(() => { if (!me() || timer) return; timer = setTimeout(() => { timer = null; backup(); }, 4000); }); // at most 4s behind, even while busy
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') backup(); }); // leaving the app saves too
  // picks up what was done on another device
  if (me()) call({ action: 'load', session: me().session }).then((j) => { if (j.data) S.mergeIn(j.data); if (me()) { me().premium = j.premium; S.save(); } }).catch(() => {});
}
