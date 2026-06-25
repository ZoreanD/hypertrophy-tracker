import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { getProfileFromCookie } from '../../../../lib/session';

// Cancel the pending rest push by clearing the nonce — the queued QStash
// callback will still fire but find no match and no-op.
export async function POST(_req: NextRequest) {
  try {
    const profile = await getProfileFromCookie();
    if (!profile) return NextResponse.json({ success: false }, { status: 401 });

    await prisma.profile.update({
      where: { id: profile.id },
      data: { restNonce: null, restFireAt: null },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('push/cancel error:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
