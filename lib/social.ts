import prisma from './prisma';

// Minimal shape needed to decide access — pass a routine selected with these
// fields rather than re-fetching inside the helper.
export type RoutineAccess = {
  profileId: string; // owner
  visibility: 'PRIVATE' | 'FOLLOWERS' | 'LINK';
  shareToken: string | null;
};

// Is `followerId` following `followingId`? (Following yourself is implicitly true
// so self-access checks fall through cleanly.)
export async function isFollowing(followerId: string, followingId: string): Promise<boolean> {
  if (followerId === followingId) return true;
  const edge = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId, followingId } },
    select: { id: true },
  });
  return !!edge;
}

// Can this viewer open the routine at all (see its structure)?
//   own it | LINK + correct token | FOLLOWERS + follows owner. PRIVATE = no.
export async function canViewRoutine(
  viewerProfileId: string | null,
  routine: RoutineAccess,
  token?: string | null
): Promise<boolean> {
  if (viewerProfileId && viewerProfileId === routine.profileId) return true;
  if (routine.visibility === 'LINK') {
    return !!token && !!routine.shareToken && token === routine.shareToken;
  }
  if (routine.visibility === 'FOLLOWERS') {
    if (!viewerProfileId) return false;
    return isFollowing(viewerProfileId, routine.profileId);
  }
  return false; // PRIVATE
}

export type ExerciseNumber = {
  weightLbs: number;
  reps: number;
  rir: number;
  durationSeconds: number | null;
};

// The owner's most recent completed session on a routine, reduced to the best
// set per exercise. This is what powers the "live" challenge numbers — it
// reflects the latest finish automatically (no snapshot).
export async function getRoutineLastNumbers(
  ownerProfileId: string,
  routineId: string
): Promise<{ date: Date | null; byExercise: Record<string, ExerciseNumber> }> {
  const last = await prisma.workout.findFirst({
    where: { profileId: ownerProfileId, routineId, durationMins: { gt: 0 } },
    orderBy: { date: 'desc' },
    select: {
      date: true,
      sets: {
        where: { isWarmup: false },
        select: { exerciseId: true, weightLbs: true, reps: true, rir: true, durationSeconds: true },
      },
    },
  });
  if (!last) return { date: null, byExercise: {} };

  const score = (s: { weightLbs: number; reps: number; durationSeconds: number | null }) =>
    s.durationSeconds && s.durationSeconds > 0 ? s.durationSeconds : s.weightLbs * s.reps;

  const byExercise: Record<string, ExerciseNumber> = {};
  for (const s of last.sets) {
    const cur = byExercise[s.exerciseId];
    if (!cur || score(s) > score(cur)) {
      byExercise[s.exerciseId] = {
        weightLbs: s.weightLbs, reps: s.reps, rir: s.rir, durationSeconds: s.durationSeconds,
      };
    }
  }
  return { date: last.date, byExercise };
}

// Can this viewer see the OWNER's lift numbers? Only your own, or a routine that
// is shared (not private) belonging to someone you follow. Numbers surface only
// in the Following section — never on a viewer's trial/owned copies.
export async function canViewNumbers(
  viewerProfileId: string | null,
  routine: RoutineAccess
): Promise<boolean> {
  if (!viewerProfileId) return false;
  if (viewerProfileId === routine.profileId) return true;
  if (routine.visibility === 'PRIVATE') return false;
  return isFollowing(viewerProfileId, routine.profileId);
}
