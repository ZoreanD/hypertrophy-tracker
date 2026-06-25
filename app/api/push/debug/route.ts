import { NextRequest, NextResponse } from 'next/server';

// TEMP diagnostic — reports which push env vars are present on the deployed
// server and whether a live QStash publish succeeds. No secrets are returned.
// Remove once push is verified.
export async function GET(req: NextRequest) {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  const origin = host ? `${proto}://${host}` : undefined;

  const env = {
    VAPID_PUBLIC_KEY: !!process.env.VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY: !!process.env.VAPID_PRIVATE_KEY,
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    VAPID_SUBJECT: !!process.env.VAPID_SUBJECT,
    QSTASH_TOKEN: !!process.env.QSTASH_TOKEN,
    QSTASH_URL: process.env.QSTASH_URL || '(default https://qstash.upstash.io)',
    APP_URL: process.env.APP_URL || '(unset)',
    derivedOrigin: origin || '(none)',
  };

  // Live publish test (1s delay, dummy nonce -> /api/push/send will no-op).
  let publish: { status?: number; body?: string; error?: string } = {};
  try {
    const token = process.env.QSTASH_TOKEN;
    const base = (process.env.QSTASH_URL || 'https://qstash.upstash.io').replace(/\/$/, '');
    const callback = `${origin}/api/push/send`;
    const res = await fetch(`${base}/v2/publish/${callback}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Upstash-Delay': '1s',
      },
      body: JSON.stringify({ profileId: 'debug', nonce: 'debug' }),
    });
    publish = { status: res.status, body: (await res.text()).slice(0, 200) };
  } catch (e: any) {
    publish = { error: e?.message || 'publish threw' };
  }

  return NextResponse.json({ env, publish });
}
