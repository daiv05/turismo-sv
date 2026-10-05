const VERSION = 'v1';
const SHELL = `shell-${VERSION}`;
const ASSETS = `assets-${VERSION}`;
const TILES = `tiles-${VERSION}`;
const CONTENT = `content-${VERSION}`;
const API = `api-${VERSION}`;
const KNOWN = [SHELL, ASSETS, TILES, CONTENT, API];
const MAX_TILES = 400;

/**
 * Decides how a request is served: which cache, and whether the network or the cache answers first.
 */
function strategyFor(url, request, origin) {
  if (request.method !== 'GET') return null;
  const u = new URL(url);
  if (request.mode === 'navigate') return { cache: SHELL, mode: 'network-first' };
  if (u.origin === origin && u.pathname.startsWith('/app/assets/')) return { cache: ASSETS, mode: 'cache-first' };
  if (/\/tiles\/[^/]+\/(tileset\.json|tiles\/[^/]+\.glb)$/.test(u.pathname)) return { cache: TILES, mode: 'cache-first', limit: MAX_TILES };
  if (/\/(models|sprites|references)\/.+\.(glb|png|jpg|jpeg|webp)$/.test(u.pathname)) return { cache: CONTENT, mode: 'stale-while-revalidate' };
  if (u.origin === origin && u.pathname.startsWith('/api/') && !u.pathname.startsWith('/api/internal/')) return { cache: API, mode: 'network-first' };
  return null;
}

async function trim(cache, limit) {
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - limit))) await cache.delete(key);
}

async function respond(request, strategy) {
  const cache = await caches.open(strategy.cache);
  const store = async (response) => {
    if (response && response.ok) {
      await cache.put(request, response.clone());
      if (strategy.limit) await trim(cache, strategy.limit);
    }
    return response;
  };
  if (strategy.mode === 'cache-first') {
    const hit = await cache.match(request);
    return hit || store(await fetch(request));
  }
  if (strategy.mode === 'stale-while-revalidate') {
    const hit = await cache.match(request);
    const refresh = fetch(request).then(store).catch(() => hit);
    return hit || refresh;
  }
  try {
    return await store(await fetch(request));
  } catch (error) {
    const hit = await cache.match(request);
    if (hit) return hit;
    if (request.mode === 'navigate') {
      const shell = await cache.match('/');
      if (shell) return shell;
    }
    throw error;
  }
}

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => !KNOWN.includes(n)).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const strategy = strategyFor(event.request.url, event.request, self.location.origin);
  if (strategy) event.respondWith(respond(event.request, strategy));
});

self.strategyFor = strategyFor;
