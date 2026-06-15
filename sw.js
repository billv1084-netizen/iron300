const CACHE = 'shazam-v2.0';
const SHELL = ['./', 'index.html', 'manifest.json', 'icon-180.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      // cache: 'reload' bypasses the HTTP cache so we never store a stale GitHub-Pages copy
      .then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});


self.addEventListener('fetch', e => {
  const req = e.request;
  // Never touch GitHub API or non-GET — backup/restore must always hit the network.
  if (req.method !== 'GET' || req.url.includes('api.github.com')) return;

  // Page navigations: network-first so a deployed update shows up, fall back to cached shell offline.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put('./', copy)).catch(() => {});
        return res;
      }).catch(() => caches.match('./').then(r => r || caches.match('index.html')))
    );
    return;
  }

  // Static assets: cache-first; on failure just fail (never return HTML for an image/font).
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      return res;
    }))
  );
});
