// Otter Jump service worker — makes the installed PWA work fully offline.
//
// Strategy:
//   - Precache the whole app shell on install (it's small and fully static).
//   - Navigations: network-first (so an online launch gets the latest HTML),
//     falling back to the cached shell when offline.
//   - Other same-origin GETs: stale-while-revalidate (instant from cache, then
//     refreshed in the background).
//   - Bump VERSION to ship an update; old caches are deleted on activate.

const VERSION = "otter-jump-v1";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./js/levelgen.js",
  "./assets/characters/characters.json",
  "./assets/characters/one.png",
  "./assets/characters/silly-bunny.png",
  "./assets/characters/teddy.png",
  "./assets/characters/zoomy.png",
  "./assets/characters/kiwi.png",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-maskable-512.png",
  "./assets/icons/apple-touch-icon.png",
  "./assets/icons/favicon-64.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  if (new URL(req.url).origin !== self.location.origin) return; // only our own assets

  // Page navigations: prefer the network, fall back to the cached shell offline.
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put("./index.html", copy));
          return res;
        })
        .catch(() => caches.match("./index.html").then((r) => r || caches.match("./")))
    );
    return;
  }

  // Static assets: serve from cache immediately, refresh in the background.
  e.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === "basic") {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
