const CACHE_NAME = "lerndeck-shell-v122";
const APP_SHELL_URLS = [
  "/",
  "/index.html",
  "/teacher",
  "/teacher.html",
  "/pwa-splash.css?v=2026-08-30-pwa-splash-v1",
  "/styles.css?v=2026-09-06-practice-layout-v1",
  "/app.js?v=2026-09-06-practice-layout-v1",
  "/teacher.css?v=2026-09-06-teacher-practice-v1",
  "/teacher.js?v=2026-09-06-teacher-practice-v1",
  "/ui-motion.css?v=2026-08-30-ui-motion-v1",
  "/ui-motion.js?v=2026-08-30-ui-motion-v1",
  "/irregular-verbs.js?v=2026-09-06-optional-to-v2",
  "/pwa.js?v=2026-08-30-pwa-splash-v3",
  "/manifest.webmanifest",
  "/teacher.webmanifest",
  "/assets/icons/lerndeck-stack.svg",
  "/assets/icons/image-plus.svg",
  "/assets/icons/learn-mode.svg",
  "/icons/favicon-32.png?v=2026-08-30-app-icon-v1",
  "/icons/icon-192.png?v=2026-08-30-app-icon-v1",
  "/icons/icon-512.png?v=2026-08-30-app-icon-v1",
  "/icons/icon-512-maskable.png?v=2026-08-30-app-icon-v1",
  "/icons/icon-1024.png?v=2026-08-30-app-icon-v1",
  "/icons/apple-touch-icon.png?v=2026-08-30-app-icon-v1",
  "/icons/apple-touch-icon-167.png?v=2026-08-30-app-icon-v1",
  "/icons/apple-touch-icon-152.png?v=2026-08-30-app-icon-v1",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL_URLS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      )),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET") {
    return;
  }

  if (url.origin !== self.location.origin) {
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        const fallbackPath = url.pathname === "/teacher" || url.pathname === "/teacher.html"
          ? "/teacher.html"
          : "/index.html";
        return cache.match(fallbackPath);
      }),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }

        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
        return networkResponse;
      });
    }),
  );
});
