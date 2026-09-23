/* Offline cache.
 *
 * The audio never changes, so it is served from the cache and only fetched
 * once. The code does change, so it is fetched first and only falls back to
 * the cache when the network is gone — otherwise a browser that ran the app
 * once would keep serving that first version forever, however many times you
 * pulled. Bump VERSION on release and old caches are dropped on activate.
 */

const VERSION = 'v4';
const CACHE = `dual-n-back-${VERSION}`;

const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/main.js', 'js/ui.js', 'js/game.js', 'js/engine.js', 'js/audio.js',
  'js/store.js', 'js/icons.js', 'js/results.js', 'js/stats.js', 'js/select.js', 'js/rehab.js', 'js/session.js',
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

async function store(request, response) {
  if (response && response.ok) (await caches.open(CACHE)).put(request, response.clone());
  return response;
}

async function cacheFirst(request) {
  return (await caches.match(request)) || store(request, await fetch(request));
}

async function networkFirst(request) {
  try {
    return await store(request, await fetch(request));
  } catch (err) {
    const hit = await caches.match(request);
    if (hit) return hit;
    throw err;
  }
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(url.pathname.includes('/assets/')
    ? cacheFirst(e.request)      // sounds and the icon never change
    : networkFirst(e.request));  // markup, styles and scripts do
});
