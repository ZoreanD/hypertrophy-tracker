import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { sendPushToProfile } from '../../../../lib/push';
import { nudgeFor } from '../../../../lib/layoffNudge';

export const dynamic = 'force-dynamic';

/**
 * Daily sweep: nudge anyone who hasn't logged a working set in a while.
 *
 * Gaps are measured from real logged sets (see lib/trainingGap), so moving
 * sessions around the week never looks like a layoff. Each profile is notified
 * at most once per threshold, and the marker resets as soon as they train again.
 */
export async function GET(req: NextRequest) {
  // Vercel Cron sends this header; otherwise require the shared secret.
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const now = new Date();
    const profiles = await prisma.profile.findMany({
      select: { id: true, layoffNudgeDays: true },
    });

    let sent = 0;
    let reset = 0;

    for (const p of profiles) {
      const last = await prisma.set.findFirst({
        where: { isWarmup: false, workout: { profileId: p.id } },
        orderBy: { workout: { date: 'desc' } },
        select: { workout: { select: { date: true } } },
      });
      if (!last) continue; // never trained — nothing to come back to

      const gapDays = Math.floor((now.getTime() - last.workout.date.getTime()) / 86400000);

      // Trained recently: clear any nudge marker so the next real break starts
      // the escalation over from 7 days.
      if (gapDays < 7) {
        if (p.layoffNudgeDays != null) {
          await prisma.profile.update({
            where: { id: p.id },
            data: { layoffNudgeDays: null, layoffNudgeAt: null },
          });
          reset++;
        }
        continue;
      }

      const nudge = nudgeFor(gapDays, p.layoffNudgeDays);
      if (!nudge) continue;

      await sendPushToProfile(p.id, { title: nudge.title, body: nudge.body });
      await prisma.profile.update({
        where: { id: p.id },
        data: { layoffNudgeDays: nudge.threshold, layoffNudgeAt: now },
      });
      sent++;
    }

    return NextResponse.json({ ok: true, sent, reset, checked: profiles.length });
  } catch (error) {
    console.error('layoff-nudge error:', error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
