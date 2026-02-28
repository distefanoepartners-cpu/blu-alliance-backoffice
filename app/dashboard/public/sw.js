// Service Worker minimale — PWA installabile, ZERO cache
const CACHE_VERSION = 'v2-nocache';

self.addEventListener('install', (event) => {
  // Pulisci tutte le cache vecchie di next-pwa
  event.waitUntil(
    caches.keys().then(names => 
      Promise.all(names.map(name => caches.delete(name)))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(names.map(name => caches.delete(name)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: tutto dalla rete, nessun cache
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});