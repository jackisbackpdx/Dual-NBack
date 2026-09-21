/* Tiny offline cache so a round still runs with no network. */
const CACHE = 'dual-n-back-v1';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/main.js', 'js/ui.js', 'js/game.js', 'js/engine.js', 'js/audio.js',
  'js/store.js', 'js/icons.js', 'js/results.js', 'js/stats.js',
  'assets/icon.svg',
  'assets/sounds/tap.wav', 'assets/sounds/level.wav',
  'assets/sounds/letter-0.wav', 'assets/sounds/letter-1.wav', 'assets/sounds/letter-2.wav',
  'assets/sounds/letter-3.wav', 'assets/sounds/letter-4.wav', 'assets/sounds/letter-5.wav',
  'assets/sounds/letter-6.wav',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request)));
});
