/* Offline support.
   - App shell (html/css/js): network-first, so a new deploy is never stuck behind a stale cache.
   - Page images (assets/web, icons): stale-while-revalidate - instant, and picks up changed pages next visit.
   Anything else (review tool, API calls, cross-origin fonts) is left to the network untouched. */
const VERSION = 'rcb-v2';
const SHELL_CACHE = `${VERSION}-shell`;
const IMAGE_CACHE = `${VERSION}-images`;

const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/base.css',
  'css/hud.css',
  'js/core.js',
  'js/bus.js',
  'js/data.js',
  'js/store.js',
  'js/audio-engine.js',
  'js/music.js',
  'js/audio.js',
  'js/haptics.js',
  'js/fx.js',
  'js/gestures.js',
  'js/reader.js',
  'js/scrollview.js',
  'js/ui.js',
  'js/app.js',
  'icons/icon-192.png',
  'icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    // On a weak connection don't wait out the browser's long fetch timeout: if we hold a cached copy, use it after 3s.
    const cached = await cache.match(request, { ignoreSearch: true });
    const network = fetch(request).then((res) => { if (res.ok) cache.put(request, res.clone()); return res; });
    if (!cached) return await network;
    const timeout = new Promise((resolve) => setTimeout(() => resolve(cached), 3000));
    network.catch(() => null); // a late failure after the cache won the race is not an error
    return await Promise.race([network, timeout]);
  } catch (err) {
    const hit = await cache.match(request, { ignoreSearch: true });
    if (hit) return hit;
    if (request.mode === 'navigate') {
      const shell = await cache.match('index.html');
      if (shell) return shell;
    }
    throw err;
  }
}

/** <audio> asks for byte ranges; the cache holds whole files, so slice a 206 out of the cached 200. */
async function rangeFromCache(request) {
  const cache = await caches.open(IMAGE_CACHE);
  const hit = await cache.match(request.url, { ignoreSearch: true });
  if (!hit) return fetch(request);
  const buf = await hit.arrayBuffer();
  const m = /bytes=(\d*)-(\d*)/.exec(request.headers.get('range') || '');
  const start = m && m[1] ? Number(m[1]) : 0;
  const end = m && m[2] ? Math.min(Number(m[2]), buf.byteLength - 1) : buf.byteLength - 1;
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type': hit.headers.get('Content-Type') || 'audio/mpeg',
      'Content-Range': `bytes ${start}-${end}/${buf.byteLength}`,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes'
    }
  });
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(IMAGE_CACHE);
  const hit = await cache.match(request, { ignoreSearch: true });
  const refresh = fetch(request)
    .then((res) => { if (res.ok) cache.put(request, res.clone()); return res; })
    .catch(() => null);
  return hit || (await refresh) || Response.error();
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const path = url.pathname;
  const base = self.registration.scope.replace(self.location.origin, '');
  const rel = path.startsWith(base) ? path.slice(base.length) : path.replace(/^\//, '');

  if (/^assets\/music\//.test(rel)) {
    // whole-file fetches are cached by warmCache(); range requests are answered from that copy when present
    event.respondWith(request.headers.has('range') ? rangeFromCache(request) : staleWhileRevalidate(request));
  } else if (/^(assets\/web\/|icons\/)/.test(rel)) {
    event.respondWith(staleWhileRevalidate(request));
  } else if (request.mode === 'navigate' && (rel === '' || rel === 'index.html')) {
    event.respondWith(networkFirst(request));
  } else if (/^(css\/|js\/)/.test(rel) || rel === 'manifest.webmanifest') {
    event.respondWith(networkFirst(request));
  }
});
