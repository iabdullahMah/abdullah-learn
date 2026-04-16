/* abdullah-learn — service worker.
   Offline-first for the app shell; stale-while-revalidate for pages and
   manifest so new entries appear as soon as the network returns them.

   Versioning: bump CACHE_VERSION to invalidate old caches on deploy.
*/

const CACHE_VERSION = 'v1';
const SHELL_CACHE = 'al-shell-' + CACHE_VERSION;
const RUNTIME_CACHE = 'al-runtime-' + CACHE_VERSION;

// Bare-minimum shell — things the UI can't render without.
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/404.html',
  '/assets/shared.css?v=4',
  '/assets/enhance.js?v=1',
  '/assets/icon.svg',
  '/assets/icon-180.png',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
  '/manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      // Fetch each individually so one 404 doesn't poison the whole install.
      Promise.all(
        SHELL_ASSETS.map((url) =>
          fetch(url, { cache: 'no-cache' })
            .then((r) => (r.ok ? cache.put(url, r.clone()) : null))
            .catch(() => null)
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== SHELL_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Cross-origin (fonts, unpkg for Prism/React) — cache-first runtime.
  if (url.origin !== self.location.origin) {
    event.respondWith(runtimeCacheFirst(req));
    return;
  }

  // manifest.json — network-first so new pages appear immediately.
  if (url.pathname === '/manifest.json') {
    event.respondWith(networkFirst(req));
    return;
  }

  // HTML pages — stale-while-revalidate: instant paint, fresh next load.
  if (req.mode === 'navigate' || req.destination === 'document' ||
      url.pathname.endsWith('.html')) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  // Everything else same-origin — cache-first.
  event.respondWith(runtimeCacheFirst(req));
});

async function runtimeCacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res && res.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(req, res.clone());
    }
    return res;
  } catch (e) {
    return cached || new Response('', { status: 504 });
  }
}

async function networkFirst(req) {
  try {
    const res = await fetch(req);
    if (res && res.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(req, res.clone());
    }
    return res;
  } catch (e) {
    const cached = await caches.match(req);
    return cached || new Response('{}', { status: 503, headers: { 'content-type': 'application/json' } });
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(req);
  const fetching = fetch(req).then((res) => {
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  }).catch(() => cached || caches.match('/404.html'));
  return cached || fetching;
}
