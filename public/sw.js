// SW v3 - Solo PWA installabilita, ZERO interferenza rete
// NESSUN fetch listener = browser gestisce tutto normalmente

self.addEventListener("install", function() {
  self.skipWaiting();
});

self.addEventListener("activate", function(event) {
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(names.map(function(n) { return caches.delete(n); }));
    }).then(function() {
      return self.clients.claim();
    })
  );
});