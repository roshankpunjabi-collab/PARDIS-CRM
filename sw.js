const CACHE_NAME = "pardis-crm-v4";

const APP_SHELL = [
  "index.html",
  "dashboard.html",
  "chitragandha.html",
  "style.css",
  "script.js",
  "supabase.js",
  "manifest.json",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "images/pardis-logo.png",
  "images/pardis-flame.png",
  "images/pardis-wordmark.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Never cache Supabase API calls or third-party scripts —
  // inventory data must always come straight from the network.
  if (url.origin.includes("supabase.co") || url.origin.includes("jsdelivr.net")) {
    return;
  }

  // App shell: cache-first, falling back to network, and
  // refreshing the cache in the background when online.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
