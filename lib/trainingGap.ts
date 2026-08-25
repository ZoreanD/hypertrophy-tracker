import prisma from './prisma';

/**
 * The date of a profile's most recent logged WORKING set.
 *
 * Deliberately reads Set rows, not Workout rows and never ScheduledWorkout:
 *  - the planned calendar says nothing about whether you actually trained, so
 *    rescheduling sessions within a week must not look like a break;
 *  - an abandoned workout shell with no sets isn't training either;
 *  - warm-ups alone aren't a session.
 */
export async function lastTrainedAt(profileId: string): Promise<Date | null> {
  const last = await prisma.set.findFirst({
    where: { isWarmup: false, workout: { profileId } },
    orderBy: { workout: { date: 'desc' } },
    select: { workout: { select: { date: true } } },
  });
  return last?.workout.date ?? null;
}

/** Whole days since the last logged working set, or null with no history. */
export async function trainingGapDays(profileId: string, now = new Date()): Promise<number | null> {
  const last = await lastTrainedAt(profileId);
  if (!last) return null;
  return Math.floor((now.getTime() - last.getTime()) / 86400000);
}

/**
 * Where this workout sits relative to the lifter's most recent real break.
 *
 * Walks back through the days they actually logged working sets, finds the most
 * recent gap of RETURNING_GAP_DAYS or more, and counts how many sessions have
 * happened since. Return mode applies only while that count is inside the
 * window, so it expires on its own instead of needing to be switched off.
 */
export async function returnContext(
  profileId: string,
  workoutId: string,
  workoutDate: Date,
  gapThreshold: number,
  windowSessions: number,
): Promise<{ gapDays: number; sessionIndex: number } | null> {
  const rows = await prisma.set.findMany({
    where: { isWarmup: false, workout: { profileId } },
    select: { workout: { select: { id: true, date: true } } },
    orderBy: { workout: { date: 'desc' } },
    take: 400,
  });

  // Distinct training days, newest first, excluding this session.
  const seen = new Set<string>();
  const days: Date[] = [];
  for (const r of rows) {
    if (r.workout.id === workoutId) continue;
    const key = r.workout.date.toISOString().slice(0, 10);
    if (seen.has(key)) continue;
    seen.add(key);
    days.push(r.workout.date);
  }
  if (days.length === 0) return null; // nothing to come back from

  // How many sessions since the break: 0 means this workout is the first back.
  let prev = workoutDate;
  for (let i = 0; i < days.length; i++) {
    const gap = Math.floor((prev.getTime() - days[i].getTime()) / 86400000);
    if (gap >= gapThreshold) {
      return i < windowSessions ? { gapDays: gap, sessionIndex: i } : null;
    }
    prev = days[i];
    if (i >= windowSessions) break; // past the window; no need to look further
  }
  return null;
}
