// Setter sammen to versjoner av appen av de samme kildefilene:
//  1) dist/pt-appen.html  – Claude-artefakten (database og AI via Claude)
//  2) dist/web/           – egen app (Supabase-database og innlogging, ingen AI), klar for GitHub Pages
const fs = require('fs');
const path = require('path');
const src = (f) => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8');
const out = (...p) => path.join(__dirname, 'dist', ...p);

const artifact = `<title>Coach</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
${src('styles.css')}
</style>
<div id="root"></div>
<script>
${src('logo.js')}
</script>
<script>
${src('exercises.js')}
</script>
<script>
${src('body.js')}
</script>
<script>
${src('engine.js')}
</script>
<script>
${src('core.js')}
</script>
<script>
${src('app.js')}
</script>
`;
fs.mkdirSync(out(), { recursive: true });
fs.writeFileSync(out('pt-appen.html'), artifact);
console.log('dist/pt-appen.html', (artifact.length / 1024).toFixed(1) + ' KB');

// Egen app. Nøkkelen er Supabase sin offentlige «anon»-nøkkel: den er laget for å ligge i nettleseren,
// og tilgangen styres av radreglene i databasen (hver bruker ser bare sine egne rader).
const BUILD = String(Date.now());
const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'web.config.json'), 'utf8'));
const web = `<!doctype html>
<html lang="nb">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Coach</title>
<meta name="description" content="Coach – mat, trening og fremgang.">
<meta name="theme-color" content="#120e0b">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black">
<meta name="apple-mobile-web-app-title" content="Coach">
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="icon-180.png">
<link rel="icon" type="image/png" sizes="192x192" href="icon-192.png">
<script>if (navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches)) document.documentElement.classList.add('standalone');</script>
<style>
html { height: 100%; background: #120e0b; overflow: hidden; overscroll-behavior: none; }
body { margin: 0; height: 100%; min-height: 100dvh; overflow: hidden; overscroll-behavior: none; }
/* Hele skjermen, også under statuslinjen og hjem-streken på iPhone */
#root { position: fixed; inset: 0; box-sizing: border-box; padding-top: env(safe-area-inset-top, 0px); }
/* Som app på hjemskjermen. Statuslinjen er nå heldekkende («black»): da går visningen helt ned på iOS 26 (WebKit bug 301108).
   Apper som ble lagt til med gammel innstilling, får i tillegg en litt høyere side, som får iOS til å bruke hele høyden. */
html.standalone, html.standalone body { background: #120e0b; }
@media (display-mode: standalone) { html { min-height: min(100lvh, calc(100% + env(safe-area-inset-top, 0px))); } }
[hidden] { display: none !important; }
${src('styles.css')}
</style>
</head>
<body>
<div id="root"></div>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3/dist/umd/supabase.js"></script>
<script>window.COACH_CONFIG = ${JSON.stringify({ url: cfg.supabaseUrl, key: cfg.supabaseAnonKey })}; window.COACH_BUILD = '${BUILD}';</script>
<script>
${src('logo.js')}
</script>
<script>
${src('standalone.js')}
</script>
<script>
${src('exercises.js')}
</script>
<script>
${src('body.js')}
</script>
<script>
${src('engine.js')}
</script>
<script>
${src('core.js')}
</script>
<script>
${src('app.js')}
</script>
<script>
if ('serviceWorker' in navigator) window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(function (r) { try { r.update(); } catch (e) {} }).catch(function () {}); });
</script>
</body>
</html>
`;
fs.mkdirSync(out('web'), { recursive: true });
fs.writeFileSync(out('web', 'index.html'), web);
fs.writeFileSync(out('web', 'manifest.webmanifest'), JSON.stringify({
  name: 'Coach', short_name: 'Coach', start_url: './', scope: './', display: 'standalone', orientation: 'portrait',
  background_color: '#120e0b', theme_color: '#120e0b', lang: 'nb',
  icons: [
    { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
  ]
}, null, 2));
// Enkel service worker: appen åpner raskt og virker uten nett for selve skallet; data hentes alltid fra Supabase.
fs.writeFileSync(out('web', 'version.json'), JSON.stringify({ build: BUILD }));
fs.writeFileSync(out('web', 'sw.js'), `const C = 'coach-${BUILD}';
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
`);
fs.writeFileSync(out('web', '.nojekyll'), '');
console.log('dist/web/index.html', (web.length / 1024).toFixed(1) + ' KB');
