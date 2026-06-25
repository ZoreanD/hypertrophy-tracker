import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import prisma from '../../../../lib/prisma';
import { getProfileFromCookie } from '../../../../lib/session';
import { scheduleRestPush } from '../../../../lib/push';

// Schedule a rest-complete push `durationSecs` from now. Rotating the nonce
// invalidates any previously scheduled push for this profile.
export async function POST(req: NextRequest) {
  try {
    const profile = await getProfileFromCookie();
    if (!profile) return NextResponse.json({ success: false }, { status: 401 });

    const { durationSecs } = await req.json();
    const secs = Number(durationSecs);
    if (!Number.isFinite(secs) || secs <= 0 || secs > 3600) {
      return NextResponse.json({ success: false, error: 'Invalid duration' }, { status: 400 });
    }

    const nonce = randomUUID();
    await prisma.profile.update({
      where: { id: profile.id },
      data: { restNonce: nonce, restFireAt: new Date(Date.now() + secs * 1000) },
    });

    // Derive the public origin from the request so QStash's callback URL is
    // always correct, regardless of whether APP_URL is configured.
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
    const proto = req.headers.get('x-forwarded-proto') || 'https';
    const appUrl = host ? `${proto}://${host}` : undefined;

    const result = await scheduleRestPush({ profileId: profile.id, nonce, delaySecs: secs, appUrl });
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 502 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('push/schedule error:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
