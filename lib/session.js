/* Cody's own sign-in session (made after Google's sign-in is checked in api/account.js): a small signed
   note saying which Google account this is and until when. Only the server knows the secret that signs it,
   so a browser can't make one up or change it. Used by the account (api/account.js) and study rooms (api/class.js). */
import crypto from 'node:crypto';

const env = (k) => (process.env[k] || '').trim();
export const signInOn = () => !!env('GOOGLE_CLIENT_ID');
const DAYS = 60;
const b64u = (buf) => Buffer.from(buf).toString('base64url');
const secret = () => env('SESSION_SECRET') || crypto.createHash('sha256').update('cody|' + env('GOOGLE_CLIENT_ID') + '|' + (env('KV_REST_API_TOKEN') || env('UPSTASH_REDIS_REST_TOKEN') || Object.entries(process.env).filter(([k]) => /_KV_REST_API_TOKEN$/.test(k)).map(([, v]) => v)[0] || 'local')).digest('hex');
const sign = (body) => crypto.createHmac('sha256', secret()).update(body).digest('base64url');

export function makeSession(user) {
  const body = b64u(JSON.stringify({ s: user.sub, e: user.email, n: user.name, x: Date.now() + DAYS * 864e5 }));
  return `${body}.${sign(body)}`;
}
export function readSession(token) {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig) return null;
  const want = sign(body);
  if (sig.length !== want.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return null;
  try { const u = JSON.parse(Buffer.from(body, 'base64url').toString()); return u.x > Date.now() && /^\d{5,30}$/.test(u.s) ? u : null; } catch (e) { return null; }
}

// a private label for an account (not its Google number): lets a device tell whose things it holds
export const ownerId = (sub) => sign('owner|' + sub).slice(0, 22);
