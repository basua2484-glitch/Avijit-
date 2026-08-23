const CACHE_NAME = 'hostel-manager-v2';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './webapp/style.css',
  './webapp/app.js',
  './webapp/index.html',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/icon.svg',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap'
];

// 1. Install Event: Pre-cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[ServiceWorker] Pre-caching offline assets');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
      .catch((err) => {
        console.warn('[ServiceWorker] Pre-cache error (non-fatal):', err);
      })
  );
});

// 2. Activate Event: Clean up old cache versions & claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[ServiceWorker] Removing old cache version:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Fetch Event: Stale-While-Revalidate / Cache-First with Network Fallback
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          // If valid response, update cache in background
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Fallback to cached version or index.html if navigating
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html') || cachedResponse;
          }
          return cachedResponse;
        });

      return cachedResponse || fetchPromise;
    })
  );
});
