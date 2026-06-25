import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { getProfileFromCookie } from '../../../../lib/session';

// Save (or refresh) the browser's push subscription for the current profile.
export async function POST(req: NextRequest) {
  try {
    const profile = await getProfileFromCookie();
    if (!profile) return NextResponse.json({ success: false }, { status: 401 });

    const sub = await req.json();
    const endpoint: string | undefined = sub?.endpoint;
    const p256dh: string | undefined = sub?.keys?.p256dh;
    const auth: string | undefined = sub?.keys?.auth;
    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json({ success: false, error: 'Invalid subscription' }, { status: 400 });
    }

    await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: { profileId: profile.id, p256dh, auth },
      create: { profileId: profile.id, endpoint, p256dh, auth },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('push/subscribe error:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
