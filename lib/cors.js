/* The Android app (Capacitor) runs Cody from https://localhost inside the phone, so its calls to the
   deployed site are cross-origin. Only those app origins (and the site itself) are allowed. */
const APP_ORIGINS = new Set(['https://localhost', 'capacitor://localhost', 'http://localhost']);
export function cors(req, res) {
  const o = req.headers.origin;
  if (o && APP_ORIGINS.has(o)) {
    res.setHeader('access-control-allow-origin', o);
    res.setHeader('vary', 'origin');
    res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
    res.setHeader('access-control-allow-headers', 'content-type');
    res.setHeader('access-control-max-age', '86400');
  }
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return true; }
  return false;
}
