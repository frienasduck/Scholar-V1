// Scholar Service Worker v3 — static assets only. Authenticated navigation
// responses must never persist across sign-out or account changes.
const CACHE = "scholar-v3";
const OFFLINE_FALLBACK = "/offline.html";

const CORE_ASSETS = [
  OFFLINE_FALLBACK,
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

  // Navigation is always network-only. Caching rendered HTML can expose a
  // previous account's private/admin page after sign-out on a shared device.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .catch(() => caches.match(OFFLINE_FALLBACK))
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
