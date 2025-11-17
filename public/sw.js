// Service Worker for Buzzer Quiz PWA
// Network-first strategy - always fetch fresh, only use cache if offline

const CACHE_NAME = 'buzzer-quiz-v5'; // Bumped version to force cache refresh

// Install event - skip waiting to activate immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Fetch event - Network-first strategy for ALL files
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Network-first: Always try network first, fallback to cache only if offline
  event.respondWith(
    fetch(event.request, { 
      cache: 'no-store', // Don't use browser cache
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
      .then((response) => {
        // Network request succeeded - return fresh response
        return response;
      })
      .catch(() => {
        // Network failed - try cache as fallback (offline mode)
        return caches.match(event.request);
      })
  );
});

// Activate event - delete ALL old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          console.log('Deleting cache:', cacheName);
          return caches.delete(cacheName);
        })
      );
    })
  );

  return self.clients.claim();
});
