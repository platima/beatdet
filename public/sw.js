/**
 * BeatDet Service Worker — offline support and PWA caching.
 *
 * Strategy:
 *   Navigation requests (HTML pages): network-first with cache fallback,
 *   so the app always loads fresh content when online.
 *
 *   Static assets (JS, CSS, images, fonts): cache-first with background
 *   network update (stale-while-revalidate), for fast subsequent loads.
 *
 * Cache invalidation:
 *   Update CACHE_VERSION when deploying breaking changes that require
 *   clearing old cached assets. The activate handler automatically removes
 *   all caches whose name does not match CACHE_NAME.
 *
 *   NOTE: CACHE_VERSION must be bumped manually here (this file is compiled
 *   as a plain static asset and does not have access to the Next.js build
 *   environment). Update it to match the app VERSION on significant releases.
 */

const CACHE_VERSION = '0.5.0';
const CACHE_NAME = `beatdet-cache-${CACHE_VERSION}`;

// App shell pages to pre-cache on install so the app loads offline
// immediately after the first visit.
const PRECACHE_URLS = ['/', '/settings', '/changelog'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  // Remove all caches belonging to previous service worker versions.
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only intercept same-origin GET requests. Pass through everything else
  // (cross-origin audio fetches, external resources).
  if (
    request.method !== 'GET' ||
    !request.url.startsWith(self.location.origin)
  ) {
    return;
  }

  if (request.mode === 'navigate') {
    // Navigation requests: network-first so users always receive up-to-date
    // page content when online; fall back to the cached version offline.
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(request, response.clone()));
          }
          return response;
        })
        .catch(() =>
          caches
            .match(request)
            .then((cached) => cached || caches.match('/'))
        )
    );
  } else {
    // Static assets: serve from cache immediately (fast) and update the
    // cache entry in the background so the next request gets the refreshed
    // version (stale-while-revalidate).
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(request).then((cached) => {
          const networkFetch = fetch(request).then((response) => {
            if (response.ok) {
              cache.put(request, response.clone());
            }
            return response;
          });
          // Return the cached version immediately; network runs in background.
          return cached || networkFetch;
        })
      )
    );
  }
});
