// Zorean Hypertrophy Service Worker
const CACHE_NAME = 'zorean-hypertrophy-v2';

// ── Rest-timer notifications ────────────────────────────────────────────────
// The page's setInterval is frozen while the tab is backgrounded, so the SW
// owns firing the "rest complete" notification. The page posts the absolute
// end time; we fire only if no app window is currently visible (otherwise the
// on-screen countdown is enough and a notification would be noise).
let restTimeoutId = null;

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'START_REST_TIMER') {
    if (restTimeoutId) clearTimeout(restTimeoutId);
    const delay = Math.max(0, data.endTime - Date.now());
    restTimeoutId = setTimeout(async () => {
      restTimeoutId = null;
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const anyVisible = windows.some((c) => c.visibilityState === 'visible');
      if (anyVisible) return;
      self.registration.showNotification('Rest complete', {
        body: 'Time to log your next set.',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: 'rest-timer',
        renotify: true,
        vibrate: [200, 100, 200],
      });
    }, delay);
  } else if (data.type === 'CANCEL_REST_TIMER') {
    if (restTimeoutId) { clearTimeout(restTimeoutId); restTimeoutId = null; }
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const c of windows) { if ('focus' in c) return c.focus(); }
      if (self.clients.openWindow) return self.clients.openWindow('/');
    })
  );
});

const STATIC_ASSETS = [
  '/',
  '/dashboard',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // Skip API routes and auth — always fetch fresh
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/login')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
