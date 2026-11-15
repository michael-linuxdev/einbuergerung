// Service Worker: alles für die Offline-Nutzung vorhalten.
// Bei jeder Inhaltsänderung (Code ODER Daten) CACHE hochzählen, damit Geräte die neue Version laden.
// Code und Daten kommen immer aus demselben Cache – so passen sie zusammen, bis der Nutzer „Jetzt laden“ tippt.
const CACHE = 'eb-v1.6.0';
const ASSETS = [
  './', 'index.html', 'app.css', 'manifest.webmanifest',
  'js/core.js', 'js/data.js', 'js/i18n.js', 'js/install.js', 'js/main.js', 'js/router.js', 'js/speech.js', 'js/store.js', 'js/views/amt.js', 'js/views/app.js', 'js/views/check.js', 'js/views/docs.js', 'js/views/kurs.js', 'js/views/plan.js', 'js/views/start.js', 'js/views/test.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png',
  'data/questions.json', 'data/info.json', 'data/behoerden-sn.json',
  'data/kurs-a1.json', 'data/kurs-a2.json', 'data/kurs-b1.json', 'data/dtz.json', 'data/glossar.json', 'fonts/Lora-Variable.ttf',
  'icons/qr.svg', 'img/aufgabe_21.webp', 'img/aufgabe_55.webp', 'img/aufgabe_130.webp', 'img/aufgabe_176.webp',
  'img/aufgabe_187.webp', 'img/aufgabe_226.webp', 'img/sachsen_1.webp', 'img/sachsen_8.webp'
];
// Wörterbücher der Hilfssprachen werden erst geladen, wenn jemand die Sprache wählt
const DICT = /\/data\/i18n\/[a-z]{2}\.json$/;

async function install() {
  const c = await caches.open(CACHE);
  // bisher benutzte Wörterbücher auch in die neue Version übernehmen (frisch vom Server)
  const used = new Set();
  for (const k of await caches.keys()) {
    if (k === CACHE) continue;
    for (const r of await (await caches.open(k)).keys()) { const p = new URL(r.url).pathname; if (DICT.test(p)) used.add('data/i18n/' + p.split('/').pop()); }
  }
  // cache: 'reload' umgeht den HTTP-Cache des Browsers, sonst landet evtl. eine alte Datei in der neuen Version
  await Promise.all([...ASSETS, ...used].map(async u => {
    const r = await fetch(new Request(u, { cache: 'reload' }));
    if (!r.ok) { if (ASSETS.includes(u)) throw new Error(u + ' ' + r.status); return; }
    await c.put(u, r);
  }));
}
self.addEventListener('install', e => {
  e.waitUntil(install());
  // Beim allerersten Besuch sofort aktiv werden; bei Updates wartet die neue Version, bis der Nutzer „Jetzt laden“ tippt
  if (!self.registration.active) self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
  // die App meldet ein geladenes Wörterbuch → für offline ablegen
  if (e.data?.type === 'CACHE' && DICT.test(new URL(e.data.url, self.location).pathname)) {
    e.waitUntil(caches.open(CACHE).then(async c => { if (!(await c.match(e.data.url))) { const r = await fetch(e.data.url); if (r.ok) await c.put(e.data.url, r); } }));
  }
});
// Erst Cache, sonst Netz. Nur erfolgreiche Antworten werden gespeichert (kein 404/500 im Cache).
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const hit = await c.match(e.request, { ignoreSearch: true });
    if (hit) return hit;
    const r = await fetch(e.request);
    if (r.ok && (DICT.test(url.pathname) || url.pathname.includes('/img/'))) c.put(e.request, r.clone());
    return r;
  })().catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || Response.error())));
});
