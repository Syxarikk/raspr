const CACHE = 'adcontrol-v1';
const ASSETS = ['./', './index.html', './styles.css', './app.js', './manifest.webmanifest', './pwa-icon.svg'];
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
});
self.addEventListener('fetch', (event) => {
  event.respondWith(caches.match(event.request).then((res) => res || fetch(event.request)));
});
