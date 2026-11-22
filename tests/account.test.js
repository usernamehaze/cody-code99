// node --test: Google sign-in is checked properly, sessions can't be forged, data syncs, accounts delete
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

delete process.env.VERCEL; process.env.GOOGLE_CLIENT_ID = 'cody-test.apps.googleusercontent.com';
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256', use: 'sig' };
const realFetch = globalThis.fetch;
globalThis.fetch = async (u, init) => (String(u).includes('googleapis.com/oauth2/v3/certs') ? new Response(JSON.stringify({ keys: [jwk] })) : realFetch(u, init));
const token = (claims, key = privateKey) => {
  const h = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'k1' })).toString('base64url');
  const c = Buffer.from(JSON.stringify({ iss: 'https://accounts.google.com', aud: process.env.GOOGLE_CLIENT_ID, exp: Math.floor(Date.now() / 1000) + 600, sub: '1234567890', email: 'student@example.com', email_verified: true, given_name: 'Ana', nonce: 'n1', ...claims })).toString('base64url');
  return `${h}.${c}.${crypto.sign('RSA-SHA256', Buffer.from(`${h}.${c}`), key).toString('base64url')}`;
};
const { default: handler } = await import('../api/account.js');
const call = async (body) => { const res = { code: 0, body: null, status(c) { this.code = c; return this; }, json(o) { this.body = o; return this; } }; await handler({ method: 'POST', headers: { 'x-forwarded-for': '10.1.1.' + Math.floor(Math.random() * 200) }, body }, res); return res; };

test('a real Google token signs in; forged, expired, wrong-audience or wrong-nonce ones do not', async () => {
  const ok = await call({ action: 'signin', idToken: token(), nonce: 'n1' });
  assert.equal(ok.code, 200); assert.equal(ok.body.user.name, 'Ana'); assert.ok(ok.body.session);
  const other = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
  for (const [why, t, n] of [['forged', token({}, other), 'n1'], ['expired', token({ exp: 1 }), 'n1'], ['audience', token({ aud: 'someone-else' }), 'n1'], ['nonce', token(), 'n2'], ['issuer', token({ iss: 'https://evil.example' }), 'n1']]) {
    assert.equal((await call({ action: 'signin', idToken: t, nonce: n })).code, 401, why);
  }
});

test('sessions save, load, unlock premium, refuse tampering, and delete', async () => {
  const s = (await call({ action: 'signin', idToken: token(), nonce: 'n1' })).body.session;
  assert.equal((await call({ action: 'save', session: s, data: { points: 12, reviewers: [] } })).code, 200);
  const l = await call({ action: 'load', session: s });
  assert.equal(l.body.data.points, 12); assert.equal(l.body.premium, false);
  assert.equal((await call({ action: 'premium', session: s })).body.premium, true);
  assert.equal((await call({ action: 'load', session: s })).body.premium, true);
  const [body, sig] = s.split('.');
  const fake = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, 'base64url')), s: '999999999' })).toString('base64url');
  assert.equal((await call({ action: 'load', session: `${fake}.${sig}` })).code, 401, 'a changed session is refused');
  await call({ action: 'delete', session: s });
  assert.equal((await call({ action: 'load', session: s })).body.data, null);
});
