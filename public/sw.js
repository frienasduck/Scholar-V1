// Scholar Service Worker v2 — versioned cache with update handling
const CACHE = "scholar-v2";
const OFFLINE_FALLBACK = "/";

const CORE_ASSETS = [
  "/",
  "/logo.svg",
  "/manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(CORE_ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET
  if (request.method !== "GET") return;

  // Never cache API calls, YouTube, or external resources
  if (url.pathname.startsWith("/api/") || url.hostname !== self.location.hostname) {
    return;
  }

  // Network-first for navigation, cache-first for assets
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match(OFFLINE_FALLBACK)))
    );
  } else {
    event.respondWith(
      caches.match(request).then((cached) => {
        return (
          cached ||
          fetch(request)
            .then((response) => {
              if (response.ok && response.type === "basic") {
                const copy = response.clone();
                caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
              }
              return response;
            })
            .catch(() => cached)
        );
      })
    );
  }
});
