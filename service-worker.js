// service-worker.js (safe navigation + asset caching) v3
const CACHE = 'inr-coumadin-cdn-max-v3';
const PRECACHE = [
  './','./index.html','./404.html','./manifest.json','./app.js',
  './icon-192.png','./icon-512.png','./apple-touch-icon.png',
  'https://cdn.jsdelivr.net/npm/react@18/umd/react.production.min.js',
  'https://cdn.jsdelivr.net/npm/react-dom@18/umd/react-dom.production.min.js',
  'https://cdn.jsdelivr.net/npm/recharts@2.12.7/umd/Recharts.min.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k !== CACHE ? caches.delete(k) : Promise.resolve())));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isNavigate = request.mode === 'navigate';
  const path = url.pathname;

  // SPA navigation fallback to index.html, but never for debug.html
  if (isSameOrigin && isNavigate && path.startsWith('/terapia-inr/') && !path.endsWith('/debug.html')) {
    event.respondWith(
      caches.match('./index.html').then(cached => {
        const fetchIndex = fetch('./index.html').then(r => {
          const copy = r.clone();
          caches.open(CACHE).then(c => c.put('./index.html', copy)).catch(()=>{});
          return r;
        }).catch(()=> cached || Response.error());
        return cached || fetchIndex;
      })
    );
    return;
  }

  // Assets and debug.html: network-first with cache fallback
  event.respondWith(
    fetch(request).then((r) => {
      const copy = r.clone();
      caches.open(CACHE).then(c => c.put(request, copy)).catch(()=>{});
      return r;
    }).catch(() => caches.match(request))
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
