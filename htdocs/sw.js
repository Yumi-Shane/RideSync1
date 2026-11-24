// Waynecorp
const V='rs-v5',FILES=['./','index.html','app.js','app.css','manifest-v2.json','rs-icon-192.png','rs-icon-512.png','ridesync-logo.png','rs-apple-180.png','rs-favicon.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(V).then(c=>Promise.all(FILES.map(f=>c.add(f).catch(()=>{})))).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);
 if(e.request.method!=='GET'||u.origin!==location.origin||u.pathname.endsWith('api.php')||u.search)return;
 e.respondWith(fetch(e.request).then(r=>{if(r.ok&&r.type==='basic'){const c=r.clone();caches.open(V).then(x=>x.put(e.request,c))}return r})
  .catch(()=>caches.match(e.request).then(m=>m||caches.match('index.html'))))});
