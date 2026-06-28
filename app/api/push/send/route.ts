import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { sendPushToProfile } from '../../../../lib/push';
import { pickRestMessage } from '../../../../lib/restMessages';

// QStash delayed callback. Fires the push only if the nonce still matches the
// profile's active rest (i.e. it wasn't cancelled or superseded). The nonce is
// an unguessable single-use token, so it doubles as the auth for this endpoint.
export async function POST(req: NextRequest) {
  try {
    const { profileId, nonce } = await req.json();
    if (!profileId || !nonce) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const profile = await prisma.profile.findUnique({ where: { id: profileId } });
    if (!profile || profile.restNonce !== nonce) {
      // Cancelled, superseded, or bogus — do nothing (still 200 so QStash doesn't retry).
      return NextResponse.json({ ok: true, skipped: true });
    }

    await prisma.profile.update({
      where: { id: profileId },
      data: { restNonce: null, restFireAt: null },
    });
    await sendPushToProfile(profileId, {
      title: 'Rest complete',
      body: pickRestMessage(),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('push/send error:', error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
