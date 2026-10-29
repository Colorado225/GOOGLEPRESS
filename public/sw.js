/* PressingPro CI — Service Worker PWA (manuel, sans dépendance)
 *
 * Stratégies :
 *  - Navigations : réseau d'abord, repli sur la coquille en cache (hors ligne).
 *  - Assets hachés du build (/assets/, images, icônes) : cache d'abord
 *    (noms immuables grâce au hachage Vite), remplissage au premier passage.
 *  - Polices Google Fonts : cache d'abord après le premier chargement.
 *  - Modules du serveur de dev Vite (/src/, /@…, node_modules) : jamais interceptés.
 * Incrémenter VERSION à chaque évolution de ce fichier pour purger l'ancien cache.
 */
const VERSION = 'pressingpro-v2';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
  );
});

function cacheFirst(request) {
  return caches.match(request).then(
    (cached) =>
      cached ||
      fetch(request).then((response) => {
        const copy = response.clone();
        caches.open(VERSION).then((cache) => cache.put(request, copy));
        return response;
      }),
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Polices externes : cache d'abord (servies avec CORS par Google Fonts)
  if (url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com') {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Serveur de dev Vite : modules sources et HMR passent toujours par le réseau
  if (url.pathname.startsWith('/src/') || url.pathname.startsWith('/@') || url.pathname.includes('node_modules')) {
    return;
  }

  // Navigations : réseau d'abord, coquille en cache si hors ligne
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/index.html')));
    return;
  }

  // Assets du build et images : cache d'abord
  if (url.pathname.startsWith('/assets/') || /\.(?:png|jpe?g|webp|svg|ico|woff2?)$/.test(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Le reste (manifeste…) : réseau d'abord, repli cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(VERSION).then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(() => caches.match(request)),
  );
});
