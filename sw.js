const CACHE_NAME = 'luna-v11';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './assets/elena_mono_low.png',
  './assets/elena_mono_talk.png',
  './assets/elena_mono_smile.png',
  './assets/elena_mono_thinking.png',
  './assets/elena_mono_error.png',
  './assets/elena_mono_low_headphones.jpg',
  './assets/elena_mono_talk_headphones.jpg',
  './assets/elena_mono_put_headphones.jpg',
  './assets/elena_mono_low_open_eyes_headphones.jpg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    fetch(e.request).catch(() => {
      return caches.match(e.request, { ignoreSearch: true });
    })
  );
});
