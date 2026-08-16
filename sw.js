const CACHE_NAME = 'daily-journal-v1';
const ASSETS = [
  './',
  './daily-journal.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './icons/icon-192.svg',
  './icons/icon-512.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      return caches.open(CACHE_NAME).then(cache => {
        // Put a clone in cache for offline use
        try { cache.put(event.request, response.clone()); } catch (e) { }
        return response;
      });
    }).catch(() => {
      // fallback to root
      return caches.match('./daily-journal.html');
    })))
  );
});