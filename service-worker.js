const CACHE_NAME = "snap-study-v2";
const APP_SHELL = ["/manifest.json"];

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
  // Never cache API calls.
  if (event.request.url.includes("/.netlify/functions/")) return;

  // Network-first for the HTML page itself (and navigations), so a new
  // deploy is picked up immediately. Falls back to cache only if offline.
  const isHTML =
    event.request.mode === "navigate" ||
    event.request.url.endsWith("/index.html") ||
    event.request.url.endsWith("/");

  if (isHTML) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first for other static assets (icons, manifest).
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
