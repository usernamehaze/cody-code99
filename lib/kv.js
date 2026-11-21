/* A tiny key-value store for class leaderboards.
   On Vercel: Upstash Redis (add it from Vercel → Storage → Upstash; that sets KV_REST_API_URL and
   KV_REST_API_TOKEN, or set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN yourself).
   On your own computer (npm run dev) with neither set: kept in memory, so a class works on one laptop. */
const url = () => process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '';
const token = () => process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';

export const kvMode = () => (url() && token() ? 'redis' : process.env.VERCEL ? 'off' : 'memory');

// ---- in memory (local only): the few Redis commands Cody uses ----
const mem = new Map();
function memCmd([cmd, key, ...a]) {
  const C = cmd.toUpperCase();
  if (C === 'HSET') { const h = mem.get(key) || new Map(); for (let i = 0; i < a.length; i += 2) h.set(String(a[i]), String(a[i + 1])); mem.set(key, h); return 1; }
  if (C === 'HGETALL') { const h = mem.get(key); return h ? [...h].flat() : []; }
  if (C === 'HMGET') { const h = mem.get(key) || new Map(); return a.map((f) => (h.has(String(f)) ? h.get(String(f)) : null)); }
  if (C === 'EXISTS') return mem.has(key) ? 1 : 0;
  if (C === 'ZADD') { const z = mem.get(key) || new Map(); for (let i = 0; i < a.length; i += 2) z.set(String(a[i + 1]), +a[i]); mem.set(key, z); return 1; }
  if (C === 'ZREVRANGE') { const z = mem.get(key) || new Map(); const s = [...z].sort((x, y) => y[1] - x[1]).slice(+a[0], +a[1] + 1); return s.flatMap(([m, sc]) => [m, String(sc)]); }
  if (C === 'ZCARD') return (mem.get(key) || new Map()).size;
  if (C === 'ZREM') { const z = mem.get(key); if (z) a.forEach((m) => z.delete(String(m))); return 1; }
  if (C === 'HDEL') { const h = mem.get(key); if (h) a.forEach((f) => h.delete(String(f))); return 1; }
  if (C === 'EXPIRE') return 1;
  if (C === 'GET') { const v = mem.get(key); return v == null ? null : String(v); }
  if (C === 'SET') { mem.set(key, String(a[0])); return 'OK'; }
  if (C === 'DEL') { mem.delete(key); return 1; }
  if (C === 'INCRBY') { const v = (+mem.get(key) || 0) + +a[0]; mem.set(key, String(v)); return v; }
  if (C === 'RPUSH') { const l = mem.get(key) || []; l.push(...a.map(String)); mem.set(key, l); return l.length; }
  if (C === 'LLEN') return (mem.get(key) || []).length;
  if (C === 'LRANGE' || C === 'LTRIM') {
    const l = mem.get(key) || [], n = l.length; let s = +a[0], e = +a[1];
    if (s < 0) s = Math.max(0, n + s); if (e < 0) e = n + e; e = Math.min(e, n - 1);
    const part = s > e ? [] : l.slice(s, e + 1);
    if (C === 'LTRIM') { mem.set(key, part); return 'OK'; }
    return part;
  }
  throw new Error('unknown command ' + C);
}

export async function kv(...cmd) {
  const mode = kvMode();
  if (mode === 'memory') return memCmd(cmd.map(String));
  if (mode === 'off') throw Object.assign(new Error('Class leaderboards are not set up on this server.'), { status: 503 });
  const r = await fetch(url(), { method: 'POST', headers: { authorization: `Bearer ${token()}`, 'content-type': 'application/json' }, body: JSON.stringify(cmd.map(String)), signal: AbortSignal.timeout(8000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error('store: ' + (j.error || r.status));
  return j.result;
}

// several commands in one trip (Upstash's /pipeline): -> their results, in order
export async function kvPipe(cmds) {
  const mode = kvMode();
  if (mode === 'memory') return cmds.map((c) => memCmd(c.map(String)));
  if (mode === 'off') throw Object.assign(new Error('Class rooms are not set up on this server.'), { status: 503 });
  const r = await fetch(url() + '/pipeline', { method: 'POST', headers: { authorization: `Bearer ${token()}`, 'content-type': 'application/json' }, body: JSON.stringify(cmds.map((c) => c.map(String))), signal: AbortSignal.timeout(8000) });
  const j = await r.json().catch(() => null);
  if (!r.ok || !Array.isArray(j)) throw new Error('store: ' + r.status);
  return j.map((x) => (x && x.error ? null : x && x.result));
}
