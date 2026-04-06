// Self-unregister — service worker is no longer used
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      // Clear all caches
      caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))),
      // Unregister self
      self.registration.unregister()
    ])
  );
});
