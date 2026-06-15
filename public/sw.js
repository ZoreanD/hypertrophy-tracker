// Zorean Hypertrophy Service Worker
const CACHE_NAME = 'zorean-hypertrophy-v3';

// ── Rest-timer notifications ────────────────────────────────────────────────
// The page's setInterval freezes while backgrounded AND the SW itself is killed
// after ~30s idle, so a plain setTimeout never fires for a 90-180s rest. The
// reliable path is the Notification Triggers API (TimestampTrigger): the OS
// fires the notification at the timestamp even with the SW and page both dead.
// setTimeout is kept only as a fallback for browsers without trigger support.
let restTimeoutId = null;

const REST_NOTIF_TAG = 'rest-timer';

function restNotifOptions(extra) {
  return Object.assign({
    body: 'Time to log your next set.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: REST_NOTIF_TAG,
    renotify: true,
    vibrate: [200, 100, 200],
  }, extra || {});
}

function cancelRestNotification() {
  if (restTimeoutId) { clearTimeout(restTimeoutId); restTimeoutId = null; }
  // Close both already-shown and scheduled-but-not-yet-fired notifications.
  self.registration.getNotifications({ tag: REST_NOTIF_TAG, includeTriggered: true })
    .then((notifs) => notifs.forEach((n) => n.close()))
    .catch(() => {});
}

function scheduleRestNotification(endTime) {
  cancelRestNotification();
  if ('TimestampTrigger' in self) {
    self.registration.showNotification('Rest complete', restNotifOptions({
      showTrigger: new TimestampTrigger(endTime),
    }));
  } else {
    const delay = Math.max(0, endTime - Date.now());
    restTimeoutId = setTimeout(() => {
      restTimeoutId = null;
      self.registration.showNotification('Rest complete', restNotifOptions());
    }, delay);
  }
}

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'START_REST_TIMER') {
    scheduleRestNotification(data.endTime);
  } else if (data.type === 'CANCEL_REST_TIMER') {
    cancelRestNotification();
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
