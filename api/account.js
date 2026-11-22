/* POST /api/account: accounts with "Continue with Google" (like Cassie's), so a student's reviewers, cards,
   chats and points follow them to any device.
     GET                                         -> { google: clientId | null, store }
     { action: 'signin', idToken, nonce }        -> { session, user, data, savedAt, premium }
     { action: 'load', session }                 -> { data, savedAt, premium }
     { action: 'save', session, data }           -> { savedAt }
     { action: 'premium', session }              -> { premium: true }   (free during Code 99)
     { action: 'delete', session }               -> {}                  everything kept for this account is deleted
   Google's sign-in token is checked here: its signature against Google's own keys, who it is for (our
   GOOGLE_CLIENT_ID), who made it, that it hasn't expired, and the nonce the browser made. Then Cody gives the
   browser its own session (signed with a secret only the server knows), valid 60 days.
   Kept per account (Upstash Redis): Google's account number, email, first name, the saved data and a premium flag.
   Settings (Vercel environment variables): GOOGLE_CLIENT_ID (turns sign-in on), SESSION_SECRET (optional). */
import crypto from 'node:crypto';
import { kv, kvMode } from '../lib/kv.js';
import { limited } from '../lib/limit.js';
import { cors } from '../lib/cors.js';
import { makeSession, readSession, ownerId } from '../lib/session.js';
export { makeSession, readSession };

const env = (k) => (process.env[k] || '').trim();
const MAX_DATA = 900000;

// Google's public keys (they change now and then; kept an hour)
let certs = { at: 0, keys: [] };
async function googleKeys(fresh) {
  if (!fresh && Date.now() - certs.at < 3600e3 && certs.keys.length) return certs.keys;
  const r = await fetch('https://www.googleapis.com/oauth2/v3/certs', { signal: AbortSignal.timeout(8000) });
  certs = { at: Date.now(), keys: (await r.json()).keys || [] };
  return certs.keys;
}
export async function verifyGoogle(idToken, nonce) {
  const parts = String(idToken || '').split('.');
  if (parts.length !== 3) throw new Error('bad token');
  const head = JSON.parse(Buffer.from(parts[0], 'base64url').toString()), claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  if (head.alg !== 'RS256') throw new Error('bad algorithm');
  let jwk = (await googleKeys(false)).find((k) => k.kid === head.kid);
  if (!jwk) jwk = (await googleKeys(true)).find((k) => k.kid === head.kid);
  if (!jwk) throw new Error('unknown key');
  const ok = crypto.verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), crypto.createPublicKey({ key: jwk, format: 'jwk' }), Buffer.from(parts[2], 'base64url'));
  if (!ok) throw new Error('bad signature');
  if (!['https://accounts.google.com', 'accounts.google.com'].includes(claims.iss)) throw new Error('bad issuer');
  if (claims.aud !== env('GOOGLE_CLIENT_ID')) throw new Error('not for Cody');
  if (!(claims.exp * 1000 > Date.now())) throw new Error('expired');
  if (!nonce || claims.nonce !== nonce) throw new Error('bad nonce');
  if (!claims.email || claims.email_verified === false) throw new Error('email not verified');
  return { sub: String(claims.sub), email: String(claims.email).slice(0, 120), name: String(claims.given_name || claims.name || '').slice(0, 40), picture: /^https:\/\/[a-z0-9.-]+\.googleusercontent\.com\//.test(claims.picture || '') ? claims.picture : '' };
}

const key = (sub) => `acct:${sub}`;
async function loadFor(sub) {
  const [data, savedAt, premium] = await kv('HMGET', key(sub), 'data', 'savedAt', 'premium');
  let parsed = null; try { parsed = data ? JSON.parse(data) : null; } catch (e) { parsed = null; }
  return { data: parsed, savedAt: +savedAt || 0, premium: premium === '1' };
}

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method === 'GET') return res.status(200).json({ ok: true, google: env('GOOGLE_CLIENT_ID') || null, store: kvMode() !== 'off' });
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
  const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  if (limited(req, 'account', 600)) return res.status(429).json({ ok: false, error: 'Too many tries. Wait a few minutes.' });
  try {
    if (b.action === 'signin') {
      if (!env('GOOGLE_CLIENT_ID')) return res.status(503).json({ ok: false, error: 'Google sign-in is not switched on for this Cody site yet.' });
      let user;
      try { user = await verifyGoogle(b.idToken, b.nonce); } catch (e) { return res.status(401).json({ ok: false, error: 'Google sign-in didn’t go through. Please try again.' }); }
      await kv('HSET', key(user.sub), 'email', user.email, 'name', user.name, 'seen', Date.now());
      const saved = await loadFor(user.sub);
      return res.status(200).json({ ok: true, session: makeSession(user), user: { name: user.name, email: user.email, picture: user.picture }, owner: ownerId(user.sub), ...saved });
    }
    const me = readSession(b.session);
    if (!me) return res.status(401).json({ ok: false, error: 'Please sign in again.', signedOut: true });
    if (b.action === 'load') return res.status(200).json({ ok: true, owner: ownerId(me.s), ...(await loadFor(me.s)) });
    if (b.action === 'save') {
      const text = JSON.stringify(b.data || {});
      if (text.length > MAX_DATA) return res.status(413).json({ ok: false, error: 'Your Cody is too big to back up. Delete a few old reviewers or chats.' });
      const savedAt = Date.now();
      await kv('HSET', key(me.s), 'data', text, 'savedAt', savedAt);
      return res.status(200).json({ ok: true, savedAt });
    }
    if (b.action === 'premium') { await kv('HSET', key(me.s), 'premium', '1'); return res.status(200).json({ ok: true, premium: true }); }
    if (b.action === 'delete') { await kv('DEL', key(me.s)); return res.status(200).json({ ok: true }); }
    return res.status(400).json({ ok: false, error: 'Unknown action' });
  } catch (e) {
    console.error('account', b.action, e.message);
    return res.status(e.status || 500).json({ ok: false, error: e.status === 503 ? 'Accounts need the class database connected on this server.' : 'Could not reach your account. Try again.' });
  }
}
