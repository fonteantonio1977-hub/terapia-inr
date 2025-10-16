
const CACHE = 'inr-coumadin-ghp-full-hub-v1';
const PRECACHE_URLS = [
  'https://fonteantonio1977-hub.github.io/terapia-inr/',
  'https://fonteantonio1977-hub.github.io/terapia-inr/index.html',
  'https://fonteantonio1977-hub.github.io/terapia-inr/404.html',
  'https://fonteantonio1977-hub.github.io/terapia-inr/manifest.json',
  'https://fonteantonio1977-hub.github.io/terapia-inr/icon-192.png',
  'https://fonteantonio1977-hub.github.io/terapia-inr/icon-512.png',
  'https://fonteantonio1977-hub.github.io/terapia-inr/apple-touch-icon.png',
  'https://unpkg.com/react@18/umd/react.production.min.js','https://unpkg.com/react-dom@18/umd/react-dom.production.min.js','https://unpkg.com/recharts@2.12.7/umd/Recharts.min.js','https://unpkg.com/@babel/standalone@7.23.9/babel.min.js'
];
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => { event.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (PRECACHE_URLS.includes(url.href)) {
    event.respondWith(
      caches.open(CACHE).then(cache => cache.match(event.request).then(resp => resp || fetch(event.request).then(r => { cache.put(event.request, r.clone()); return r; })))
    ); return;
  }
  event.respondWith(fetch(event.request).then(r=>{const c=r.clone();caches.open(CACHE).then(cache=>cache.put(event.request,c));return r;}).catch(()=>caches.match(event.request).then(m=>m||caches.match('https://fonteantonio1977-hub.github.io/terapia-inr/index.html'))));
});
