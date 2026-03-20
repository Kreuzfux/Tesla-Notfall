/* Minimal PWA Service Worker:
   - precaches the app HTML
   - on navigation/document requests: network-first, fallback to cached HTML
*/

const CACHE_NAME = "tesla-notfall-v1";
const APP_HTML = "./tesla-notfall.html";

function isHtmlDocument(request) {
  const accept = request.headers && request.headers.get ? request.headers.get("accept") : "";
  return request.mode === "navigate" || (accept && accept.includes("text/html"));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll([APP_HTML]))
      .then(() => self.skipWaiting())
      .catch(() => {
        // If caching fails, we'll still try to serve via network.
      })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Claim control so navigations are handled immediately.
      await self.clients.claim();

      // Cleanup old caches.
      const keys = await caches.keys();
      await Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Only handle GET document-like requests.
  if (request.method !== "GET" || !isHtmlDocument(request)) return;

  event.respondWith(
    (async () => {
      try {
        // Network first for always-fresh content.
        const response = await fetch(request);

        // Best-effort: update cached app HTML when we can.
        if (response && response.ok) {
          const cache = await caches.open(CACHE_NAME);
          // Cache the app HTML explicitly, since navigation URLs may differ.
          cache.put(APP_HTML, response.clone()).catch(() => {});
        }

        return response;
      } catch (err) {
        // Offline fallback.
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(APP_HTML);
        if (cached) return cached;
        return new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
      }
    })()
  );
});

