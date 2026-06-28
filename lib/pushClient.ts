// Client-side helper to register this device's Web Push subscription and save
// it to the server. Used app-wide (PushRegistrar) and when opting into live
// updates (SubscribeToggle).

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const arr = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export type PushResult = 'granted' | 'denied' | 'unsupported' | 'error';

// Ensure a push subscription exists for this device and is saved server-side.
// prompt=true requests notification permission (call only from a user gesture);
// prompt=false silently registers only if permission was already granted.
export async function ensurePushSubscription(opts?: { prompt?: boolean }): Promise<PushResult> {
  if (typeof window === 'undefined') return 'unsupported';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return 'unsupported';
  }

  let permission = Notification.permission;
  if (permission === 'default' && opts?.prompt) {
    permission = await Notification.requestPermission().catch(() => 'denied' as NotificationPermission);
  }
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'unsupported';

  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapid) return 'error';

  try {
    const reg = await navigator.serviceWorker.ready;
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid),
      }));
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sub),
    });
    return 'granted';
  } catch {
    return 'error';
  }
}
