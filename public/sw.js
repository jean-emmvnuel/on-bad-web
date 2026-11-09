// Service worker On Bade : app hors ligne, chargement instantané, clic sur les notifications.
// Les fichiers JS/CSS construits par Vite ont un nom qui change à chaque version (empreinte) :
// on les met en cache au premier passage, et la page (réseau d'abord) pointe toujours vers les bons.
// Change VERSION seulement pour vider tout le cache (ex. icônes modifiées).
const VERSION = 'jebade-web-react-v1';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'data/privacy.json',
  'assets/favicon.svg', 'assets/favicon.ico', 'assets/apple-touch-icon.png', 'assets/icon-192.png', 'assets/icon-512.png',
];
const FONTS = /^https:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com)\//;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Appels au backend : jamais de cache, les données doivent toujours être fraîches.
  if (url.pathname.includes('/api/')) return;

  // Pages (liens partagés compris) : réseau d'abord, la page en cache si hors ligne.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put('index.html', copy)); return res; })
        .catch(() => caches.match('index.html')),
    );
    return;
  }

  // Polices : cache d'abord (elles ne changent pas).
  if (FONTS.test(req.url)) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); return res; })),
    );
    return;
  }

  // Fichiers du site : réponse immédiate du cache, mise à jour en arrière-plan.
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.open(VERSION).then((c) => c.match(req, { ignoreSearch: true }).then((hit) => {
        const net = fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => hit);
        return hit || net;
      })),
    );
  }
});

// Clic sur une notification : ouvre l'écran concerné dans la fenêtre existante, sinon en ouvre une.
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const path = e.notification.data?.path || '/';
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const win = wins.find((w) => new URL(w.url).origin === self.location.origin);
    if (win) { await win.focus(); win.postMessage({ type: 'navigate', path }); return; }
    await self.clients.openWindow(`./#${path}`);
  })());
});
