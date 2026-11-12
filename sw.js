const C = 'coach-1794457394470';
self.addEventListener('install', e => { e.waitUntil(caches.open(C).then(c => c.addAll(['./', './index.html', './manifest.webmanifest', './icon-180.png']))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  if (u.pathname.endsWith('version.json')) return;
  // Selve appen hentes alltid fersk fra nettet (ikke fra nettleserens mellomlager); lagret kopi brukes bare uten nett.
  const html = e.request.mode === 'navigate' || u.pathname.endsWith('/') || u.pathname.endsWith('.html');
  e.respondWith(fetch(html ? new Request(u.href, { cache: 'no-store', credentials: 'same-origin' }) : e.request).then(r => { const cp = r.clone(); caches.open(C).then(c => c.put(e.request, cp)); return r; }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html'))));
});
