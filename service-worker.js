const CACHE='inr-coumadin-nosjsx-v2';const PRECACHE=[
'./','./index.html','./404.html','./manifest.json','./app.js','./icon-192.png','./icon-512.png','./apple-touch-icon.png',
'https://unpkg.com/react@18/umd/react.production.min.js','https://unpkg.com/react-dom@18/umd/react-dom.production.min.js','https://unpkg.com/recharts@2.12.7/umd/Recharts.min.js'
];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(PRECACHE)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(self.clients.claim());});
self.addEventListener('fetch',e=>{e.respondWith(fetch(e.request).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html'))));});
