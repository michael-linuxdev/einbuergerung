// Service Worker: alles für die Offline-Nutzung vorhalten.
// Bei jeder Inhaltsänderung CACHE hochzählen, damit Geräte die neue Version laden.
const CACHE = 'eb-v1.2.0';
const ASSETS = [
  './', 'index.html', 'app.css', 'app.js', 'manifest.webmanifest',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png',
  'data/questions.json', 'data/info.json', 'data/behoerden-sn.json',
  'data/kurs-a1.json', 'data/kurs-a2.json', 'data/kurs-b1.json', 'data/dtz.json', 'data/glossar.json', 'fonts/Lora-Variable.ttf',
  'img/aufgabe_21.webp', 'img/aufgabe_55.webp', 'img/aufgabe_130.webp', 'img/aufgabe_176.webp',
  'img/aufgabe_187.webp', 'img/aufgabe_226.webp', 'img/sachsen_1.webp', 'img/sachsen_8.webp'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Daten: erst Netz (aktuell), sonst Cache. Rest: erst Cache, sonst Netz.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.includes('/data/')) {
    e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request)));
  } else {
    e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request)));
  }
});
