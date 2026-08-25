'use server';

import prisma from '../../lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '../../lib/auth';
import { TrainingState, RETURNING_GAP_DAYS } from '../../lib/trainingState';

async function getProfile() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (!token) return null;
  const decoded = await verifyToken(token);
  if (!decoded) return null;
  return prisma.profile.findUnique({ where: { userId: decoded.userId } });
}

/**
 * Set how a session should be interpreted. Also stamps the gap so a RETURNING
 * session can scale its load suggestion to how long the break actually was.
 */
export async function setTrainingState(
  workoutId: string,
  state: TrainingState,
  gapDaysFromCaller?: number | null,
) {
  try {
    const profile = await getProfile();
    if (!profile) return { success: false };

    const workout = await prisma.workout.findUnique({
      where: { id: workoutId },
      select: { profileId: true, date: true },
    });
    if (!workout || workout.profileId !== profile.id) return { success: false };

    let gapDays: number | null = null;
    if (state === 'RETURNING') {
      // Use the BREAK the caller was shown, not "days since the last set".
      // On the second session back those differ: the break might be 10 days
      // while the previous set was yesterday, and recomputing here would store
      // a 1-day gap — which any consumer would read as "no reduction needed",
      // contradicting the reduced load the lifter was actually offered.
      gapDays = gapDaysFromCaller ?? null;
    }

    await prisma.workout.update({
      where: { id: workoutId },
      data: { trainingState: state, gapDays },
    });
    return { success: true, gapDays };
  } catch (error) {
    console.error('setTrainingState failed:', error);
    return { success: false };
  }
}

/**
 * Days since the last logged working set before this workout, and how many
 * sessions have been logged since that gap — used to decide whether to offer
 * return mode and when it should expire.
 */
export async function getGapContext(workoutId: string) {
  const profile = await getProfile();
  if (!profile) return { gapDays: null, sessionsSinceGap: 0 };

  const workout = await prisma.workout.findUnique({
    where: { id: workoutId },
    select: { date: true, profileId: true },
  });
  if (!workout || workout.profileId !== profile.id) {
    return { gapDays: null, sessionsSinceGap: 0 };
  }

  const last = await prisma.set.findFirst({
    where: {
      isWarmup: false,
      workout: { profileId: profile.id, id: { not: workoutId } },
    },
    orderBy: { workout: { date: 'desc' } },
    select: { workout: { select: { date: true } } },
  });
  if (!last) return { gapDays: null, sessionsSinceGap: 0 };

  const gapDays = Math.floor(
    (workout.date.getTime() - last.workout.date.getTime()) / 86400000,
  );
  return { gapDays: gapDays >= RETURNING_GAP_DAYS ? gapDays : null, sessionsSinceGap: 0 };
}
