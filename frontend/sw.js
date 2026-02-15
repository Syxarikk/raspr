const CACHE = 'adcontrol-v2';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './js/api.js',
  './js/session.js',
  './manifest.webmanifest',
  './pwa-icon.svg',
];
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
});
self.addEventListener('fetch', (event) => {
  event.respondWith(caches.match(event.request).then((res) => res || fetch(event.request)));
});
