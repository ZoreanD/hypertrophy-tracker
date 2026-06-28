// Zorean Hypertrophy Service Worker
const CACHE_NAME = 'zorean-hypertrophy-v6';

// ── Rest-timer notifications ────────────────────────────────────────────────
// The page's setInterval freezes while backgrounded, and an *orphaned* SW
// setTimeout is killed when the browser terminates the idle SW (~30s). The key
// is event.waitUntil(): it tells the browser the SW has work in flight so it's
// kept alive until the promise settles (browsers cap this at a few minutes,
// which covers a normal rest). TimestampTrigger is used when available (fires
// even with everything dead), but it's unsupported on most Android Chrome.
const REST_NOTIF_TAG = 'rest-timer';

// Rotating "rest complete" nudges. Keep in sync with lib/restMessages.ts.
const REST_MESSAGES = [
  'Time to log your next set.',
  "Rest's up — back to the iron.",
  'Recovered? Go get the next one.',
  'Your next set is waiting.',
  "Break's over. Let's move.",
  'Hop back in and log it.',
  "One more set — you've got this.",
  'The bar is calling your name.',
  "Don't let it cool down. Next set!",
  'Back to work, champ.',
  "Gains don't make themselves. Next set!",
  'Stop scrolling, start lifting. 💪',
];
function pickRestMessage() {
  return REST_MESSAGES[Math.floor(Math.random() * REST_MESSAGES.length)];
}

let restTimeoutId = null;
let restResolve = null;

function restNotifOptions(extra) {
  return Object.assign({
    body: pickRestMessage(),
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: REST_NOTIF_TAG,
    renotify: true,
    vibrate: [200, 100, 200],
  }, extra || {});
}

// Settle any pending wait + clear the timer, so a waitUntil promise resolves
// and the browser can release the SW.
function settleRest() {
  if (restTimeoutId) { clearTimeout(restTimeoutId); restTimeoutId = null; }
  if (restResolve) { const r = restResolve; restResolve = null; r(); }
}

function cancelRestNotification() {
  settleRest();
  return self.registration.getNotifications({ tag: REST_NOTIF_TAG, includeTriggered: true })
    .then((notifs) => notifs.forEach((n) => n.close()))
    .catch(() => {});
}

// Returns a promise that stays pending until the notification fires (or is
// cancelled) — pass it to event.waitUntil to keep the SW alive.
function scheduleRestNotification(endTime) {
  settleRest();
  if ('TimestampTrigger' in self) {
    return self.registration.showNotification('Rest complete', restNotifOptions({
      showTrigger: new TimestampTrigger(endTime),
    }));
  }
  const delay = Math.max(0, endTime - Date.now());
  return new Promise((resolve) => {
    restResolve = resolve;
    restTimeoutId = setTimeout(async () => {
      restTimeoutId = null;
      const done = restResolve; restResolve = null;
      try {
        // If the SW was frozen on a long rest, this fires late — typically the
        // moment the app is reopened. Skip then: a window is visible (user is
        // already looking) or it's firing well past time. Otherwise a "rest
        // complete" buzz pops up exactly when you return, which is the opposite
        // of helpful.
        const lateBy = Date.now() - endTime;
        const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        const anyVisible = windows.some((c) => c.visibilityState === 'visible');
        if (!anyVisible && lateBy < 30000) {
          await self.registration.showNotification('Rest complete', restNotifOptions());
        }
      } finally {
        if (done) done();
      }
    }, delay);
  });
}

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'START_REST_TIMER') {
    event.waitUntil(scheduleRestNotification(data.endTime));
  } else if (data.type === 'CANCEL_REST_TIMER') {
    event.waitUntil(cancelRestNotification());
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

// Server-sent rest-complete push (reliable for long rests, since the push
// service wakes the SW even after it's been frozen/killed). Always show a
// notification — Chrome penalizes silent pushes under userVisibleOnly.
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { /* non-JSON */ }
  event.waitUntil(
    self.registration.showNotification(
      data.title || 'Rest complete',
      restNotifOptions(data.body ? { body: data.body } : {})
    )
  );
});

// Re-subscribe transparently if the browser rotates the subscription.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil((async () => {
    try {
      const sub = await self.registration.pushManager.subscribe(
        event.oldSubscription ? event.oldSubscription.options : undefined
      );
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub),
      });
    } catch (e) { /* will re-subscribe on next app open */ }
  })());
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
