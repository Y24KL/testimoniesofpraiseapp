// Bump CACHE_NAME whenever the precache list changes; old caches are deleted on activate.
const CACHE_NAME = 'top-pwa-v2';
const STATIC_ASSETS = ['/', '/index.html', '/manifest.webmanifest', '/logo.webp', '/logo.png', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Never cache APIs or media: Firebase, Cloudinary, Bunny CDN, streams and audio/video files.
  if (
    url.origin !== self.location.origin ||
    /\.(m3u8|ts|m4s|mp4|mp3|aac|m4a|webm)$/i.test(url.pathname) ||
    request.headers.has('range')
  ) {
    return;
  }

  // Pages: network first so a new deploy shows up immediately; cached shell when offline.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/index.html')));
    return;
  }

  // Hashed build assets and icons: cache first (file names change when content changes).
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.status === 200 && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        }),
    ),
  );
});
