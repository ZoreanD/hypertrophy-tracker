import webpush from 'web-push';
import prisma from './prisma';

let configured = false;

// Configure web-push lazily so a missing key doesn't crash unrelated routes.
function ensureConfigured(): boolean {
  if (configured) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';
  if (!pub || !priv) return false;
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
  return true;
}

export type RestPushPayload = {
  title?: string;
  body?: string;
};

// Send a notification to every device subscribed for this profile. Dead
// subscriptions (410 Gone / 404) are pruned so they don't pile up.
export async function sendPushToProfile(profileId: string, payload: RestPushPayload): Promise<void> {
  if (!ensureConfigured()) {
    console.warn('[push] VAPID keys missing — cannot send push');
    return;
  }
  const subs = await prisma.pushSubscription.findMany({ where: { profileId } });
  const body = JSON.stringify(payload);

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body
        );
      } catch (err: any) {
        const status = err?.statusCode;
        if (status === 404 || status === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        } else {
          console.error('[push] send failed', status, err?.body || err?.message);
        }
      }
    })
  );
}

// Ask QStash to call our /api/push/send endpoint after `delaySecs`, carrying the
// profile + nonce so the callback can verify the rest is still the active one.
export async function scheduleRestPush(opts: {
  profileId: string;
  nonce: string;
  delaySecs: number;
}): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.QSTASH_TOKEN;
  const appUrl = process.env.APP_URL;
  if (!token) return { ok: false, error: 'QSTASH_TOKEN not set' };
  if (!appUrl) return { ok: false, error: 'APP_URL not set' };

  const callback = `${appUrl.replace(/\/$/, '')}/api/push/send`;
  const delay = Math.max(0, Math.round(opts.delaySecs));

  try {
    const res = await fetch(`https://qstash.upstash.io/v2/publish/${callback}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Upstash-Delay': `${delay}s`,
        // Collapse duplicate schedules for the same rest into one queued message.
        'Upstash-Deduplication-Id': `${opts.profileId}:${opts.nonce}`,
      },
      body: JSON.stringify({ profileId: opts.profileId, nonce: opts.nonce }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, error: `QStash ${res.status}: ${text}` };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'QStash request failed' };
  }
}
