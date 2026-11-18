/* A light per-address limit, so a public demo link can't be used to flood the server.
   (In memory, so it resets when the function restarts; good enough for a school app.) */
const buckets = new Map();
export function limited(req, name, max, windowMs = 60 * 60 * 1000) {
  const ip = String(req.headers['x-forwarded-for'] || 'local').split(',')[0].trim();
  const key = name + '|' + ip, now = Date.now();
  const h = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  h.push(now); buckets.set(key, h);
  return h.length > max;
}
