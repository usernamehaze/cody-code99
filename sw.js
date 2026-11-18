/* Offline: the app's own files are kept after the first visit, so the samples work without internet.
   Network first (so a new deploy shows at once), the cache when offline. /api is never cached. */
const CACHE = 'cody-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.pathname.startsWith('/api/')) return;
  e.respondWith(fetch(e.request).then((r) => { if (r.ok && (url.origin === location.origin || url.hostname.endsWith('cdnjs.cloudflare.com') || url.hostname.includes('fonts.g'))) { const c = r.clone(); caches.open(CACHE).then((k) => k.put(e.request, c)); } return r; })
    .catch(() => caches.match(e.request).then((r) => r || caches.match('/'))));
});
