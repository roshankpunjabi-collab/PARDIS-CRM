// Deliberately does NOT cache your HTML/CSS/JS.
// A service worker with a fetch handler is required for Chrome/Android
// to treat the site as installable — but every request here goes
// straight to the network, every time. No stale content, ever.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Clean up any old cached data from earlier versions of this SW.
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
