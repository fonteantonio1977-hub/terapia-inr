const CACHE='inr-coumadin-vendor-v3';
const PRECACHE=['./','./index.html','./404.html','./manifest.json','./app.js','./icon-192.png','./icon-512.png','./apple-touch-icon.png','./vendor/react.production.min.js','./vendor/react-dom.production.min.js','./vendor/Recharts.min.js'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(PRECACHE)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(self.clients.claim());});
self.addEventListener('fetch',e=>{e.respondWith(fetch(e.request).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html'))));});
self.addEventListener('message',(event)=>{ if(event.data && event.data.type==='SKIP_WAITING'){ self.skipWaiting(); } });