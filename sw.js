const CACHE_NAME = 'command-center-v33';

// Only cache static assets that rarely change — NOT index.html
const ASSETS = [
  './icons/icon-192.svg',
  './icons/icon-512.svg',
  'https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;900&display=swap'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Always fetch index.html and manifest from network — never serve stale
  if (url.pathname.endsWith('.html') || url.pathname.endsWith('/') || url.pathname.endsWith('manifest.json')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // API calls (github, etc) — always network, no cache
  if (url.hostname !== location.hostname) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Static assets — cache-first, fallback to network
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      });
    })
  );
});
