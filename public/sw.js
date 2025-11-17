// Service Worker for Buzzer Quiz PWA

const CACHE_NAME = 'buzzer-quiz-v4'; // Updated: No HTML caching // Updated to clear cache // Bumped version to force cache refresh
const urlsToCache = [
  // Don't cache HTML files - always fetch fresh
  // '/',
  // '/index.html',
  // '/play.html',
  // '/multiplayer.html',
  '/css/styles.css',
  '/css/multiplayer.css',
  '/js/app.js',
  '/js/multiplayer.js',
  '/manifest.json',
  '/data/quiz-index.json'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache.map(url => new Request(url, {cache: 'reload'})));
      })
      .catch((error) => {
        console.log('Cache failed:', error);
      })
  );
  self.skipWaiting();
});

// Fetch event - NEVER cache HTML files, always fetch fresh
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // NEVER cache HTML files - always fetch fresh from network
  if (event.request.destination === 'document' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then((response) => {
          // Don't cache HTML files at all - always fetch fresh
          return response;
        })
        .catch(() => {
          // Only use cache if completely offline
          return caches.match(event.request);
        })
    );
    return; // Don't continue to other caching logic
  }

  // Cache-first strategy for assets (CSS, JS, images)
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }

        return fetch(event.request).then(
          (response) => {
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          }
        );
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );

  return self.clients.claim();
});
