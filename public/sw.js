// Bump à chaque déploiement pour invalider le cache
const CACHE_NAME = "prompteur-v3";
const STATIC_ASSETS = ["/manifest.json", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((c) => c.addAll(STATIC_ASSETS).catch(() => {}))
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Ne JAMAIS toucher aux routes dynamiques (API, RSC, Next.js data)
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_next/data/") ||
    url.search.includes("_rsc=")
  ) return;

  // Network-first pour HTML : on a toujours la dernière version du code
  const isHTML =
    req.mode === "navigate" ||
    (req.headers.get("accept") || "").includes("text/html");

  if (isHTML) {
    e.respondWith(
      fetch(req).then((resp) => {
        const clone = resp.clone();
        caches.open(CACHE_NAME).then((c) => c.put(req, clone)).catch(() => {});
        return resp;
      }).catch(() => caches.match(req).then((c) => c || caches.match("/")))
    );
    return;
  }

  // Cache-first pour les assets statiques (images, fonts), avec revalidation en arrière-plan
  e.respondWith(
    caches.match(req).then((cached) => {
      const fetched = fetch(req).then((resp) => {
        if (resp && resp.status === 200 && resp.type !== "opaque") {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, clone)).catch(() => {});
        }
        return resp;
      }).catch(() => cached);
      return cached || fetched;
    })
  );
});
