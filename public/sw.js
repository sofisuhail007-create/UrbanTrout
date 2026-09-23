const CACHE_NAME = "urban-trout-v4";
const STATIC_ASSETS = [
  "/favicon.ico",
  "/headerfooterlogo.png",
  "/sitelogo.png",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Skip API routes, admin, checkout, Next.js RSC requests, fonts, or external origins
  if (
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/admin") ||
    url.pathname.startsWith("/checkout") ||
    url.pathname.startsWith("/fonts/") ||
    url.searchParams.has("_rsc") ||
    event.request.headers.get("RSC") === "1"
  ) {
    return;
  }

  // 1. Navigation requests (HTML pages): ALWAYS NETWORK-FIRST
  // Customers must NEVER be trapped on stale cached pages when online
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          return networkResponse;
        })
        .catch(async () => {
          // Fallback only if device is completely offline
          const cached = await caches.match(event.request);
          return cached || caches.match("/favicon.ico");
        })
    );
    return;
  }

  // 2. Static assets & images: Stale-While-Revalidate / Cache fallback
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            networkResponse.type === "basic"
          ) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

// ─── Web Push Notification Handlers ──────────────────────────────────
self.addEventListener("push", (event) => {
  let data = {
    title: "Urban Trout 🐟",
    body: "Fresh Rainbow Trout harvest update in Srinagar!",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    url: "/shop",
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    } catch (_) {
      const text = event.data.text();
      if (text) data.body = text;
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || "/icon-192.png",
    badge: data.badge || "/icon-192.png",
    image: data.image || undefined,
    data: {
      url: data.url || "/shop",
      dateOfArrival: Date.now(),
    },
    vibrate: [120, 60, 120],
    tag: data.tag || "urban-trout-update",
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const rawUrl = event.notification.data?.url || "/";
  const targetUrl = new URL(rawUrl, self.location.origin).href;

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url === targetUrl && "focus" in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});
