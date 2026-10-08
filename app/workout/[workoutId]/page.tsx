import prisma from '../../../lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '../../../lib/auth';
import { redirect } from 'next/navigation';
import LiveWorkout from './LiveWorkout';
import CompletedWorkout from './CompletedWorkout';
import { getCurrentBodyweight } from '../../actions/workout-session';
import { todayInZone, resolveTimeZone } from '../../../lib/timezone';
import { returnContext } from '../../../lib/trainingGap';
import { bestSetBy1RM, topEffectiveLoad } from '../../../lib/effectiveLoad';
import { findComparableSession, PositionedSession } from '../../../lib/positionHistory';
import { RETURNING_GAP_DAYS, RETURNING_SESSIONS, TrainingState } from '../../../lib/trainingState';

export const dynamic = 'force-dynamic';

export default async function LiveWorkoutPage({
  params,
}: {
  params: Promise<{ workoutId: string }>;
}) {
  const { workoutId } = await params;

  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (!token) return redirect('/login');

  const decoded = await verifyToken(token);
  if (!decoded) return redirect('/login');

  const profile = await prisma.profile.findUnique({
    where: { userId: decoded.userId },
  });
  if (!profile) return redirect('/setup');

  const currentBodyweight = await getCurrentBodyweight(profile.id);

  const allExercises = await prisma.exercise.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      primaryMuscle: true,
      movementPattern: true,
      equipment: true,
      isUnilateral: true,
      isAssisted: true,
      isBodyweight: true,
      weightIsPerSide: true,
      isTimeBased: true,
    },
  });

  const workout = await prisma.workout.findUnique({
    where: { id: workoutId },
    include: {
      routine: {
        include: {
          exercises: {
            include: { exercise: true },
            orderBy: { order: 'asc' },
          },
        },
      },
      sets: {
        include: { exercise: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!workout || workout.profileId !== profile.id) return redirect('/calendar');

  // Completed workout — show read-only view
  if (workout.durationMins > 0) {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100">
        <CompletedWorkout
          workout={{
            id: workout.id,
            routineId: workout.routineId ?? null,
            focus: workout.focus,
            date: workout.date.toISOString(),
            durationMins: workout.durationMins,
            summaryJson: workout.summaryJson ?? null,
          }}
          trialRoutineId={workout.routine?.isTrial ? workout.routineId : null}
          canReopen={workout.date.toISOString().slice(0, 10) === todayInZone(resolveTimeZone(profile.timezone))}
          plannedExercises={(workout.routine?.exercises ?? []).map((re) => ({
            exerciseId: re.exerciseId,
            exerciseName: re.exercise.name,
            targetSets: re.targetSets,
            targetRepMin: re.targetRepMin,
            targetRepMax: re.targetRepMax,
            targetRir: re.targetRir,
            isAssisted: re.exercise.isAssisted,
          }))}
          loggedSets={workout.sets.map((s) => ({
            id: s.id,
            exerciseId: s.exerciseId,
            exerciseName: s.exercise.name,
            weightLbs: s.weightLbs,
            reps: s.reps,
            rir: s.rir,
            durationSeconds: s.durationSeconds ?? null,
            isWarmup: s.isWarmup,
            setType: s.setType ?? 'STRAIGHT',
            side: s.side ?? null,
          }))}
        />
      </main>
    );
  }

  // Active workout — build exercise histories
  const exerciseHistories: Record<string, any> = {};

  // Index is this exercise's planned slot today — the position we compare against.
  const plannedList = workout.routine?.exercises ?? [];
  for (const [index, re] of plannedList.entries()) {
    const lastSets = await prisma.set.findMany({
      where: {
        exerciseId: re.exerciseId,
        workout: { profileId: profile.id },
        isWarmup: false,
        NOT: { workoutId: workout.id },
      },
      include: { workout: { select: { date: true } } },
      // By workout DAY first — createdAt alone sorts by insert time, which can
      // put an older session ahead of the genuine previous one.
      orderBy: [{ workout: { date: 'desc' } }, { createdAt: 'desc' }],
      // Needs to span at least TWO sessions so prevWeight can be derived. A
      // single myo-rep or drop-set session can write well over 10 rows for one
      // exercise, which would swallow the previous session entirely.
      take: 40,
    });

    if (lastSets.length === 0) {
      exerciseHistories[re.exerciseId] = null;
      continue;
    }

    const byWorkout = new Map<string, typeof lastSets>();
    lastSets.forEach((s) => {
      const wid = s.workout.date.toISOString();
      if (!byWorkout.has(wid)) byWorkout.set(wid, []);
      byWorkout.get(wid)!.push(s);
    });

    const rawSessions = Array.from(byWorkout.values());
    // Compare against the last time this exercise ran in a COMPARABLE slot.
    // An exercise done last, on pre-fatigued muscles, isn't comparable to the
    // same movement done fresh — treating them as equivalent is what makes a
    // reasonable session look like a decline.
    const positioned: PositionedSession<(typeof rawSessions)[number][number]>[] =
      rawSessions.map((sets) => ({
        executionOrder: sets[0]?.executionOrder ?? 0,
        date: sets[0].workout.date,
        sets,
      }));
    const match = findComparableSession(positioned, index);
    const lastSession = match ? match.session.sets : rawSessions[0];
    // The session before the compared one, at a comparable slot too.
    const matchIdx = match ? positioned.indexOf(match.session) : 0;
    const prevMatch = findComparableSession(positioned.slice(matchIdx + 1), index);
    const prevSession = prevMatch ? prevMatch.session.sets : rawSessions[matchIdx + 1];
    const shape = {
      isAssisted: re.exercise.isAssisted,
      isBodyweight: re.exercise.isBodyweight,
      weightIsPerSide: re.exercise.weightIsPerSide,
    };
    // Time-based exercises store reps=0, so rank by duration — the "best set"
    // is the longest hold. Everything else ranks by estimated 1RM, matching the
    // summary. Ranking by weight x reps favoured the lighter back-off set, so a
    // heavy top set followed by an autoregulated drop was recorded as if the
    // lighter load were the day's best.
    const isTimeBased = re.exercise.isTimeBased;
    const bestSet = isTimeBased
      ? lastSession.reduce((b, s) => ((s.durationSeconds ?? 0) > (b.durationSeconds ?? 0) ? s : b))
      : (bestSetBy1RM(lastSession, shape) ?? lastSession[0]);

    exerciseHistories[re.exerciseId] = {
      lastWeight: bestSet.weightLbs,
      lastReps: bestSet.reps,
      lastRir: bestSet.rir,
      lastDate: lastSession[0].workout.date,
      lastExecutionOrder: bestSet.executionOrder,
      // Whether the comparison above is positionally like-for-like, so the UI
      // can caveat rather than silently compare across different fatigue states.
      samePosition: match?.samePosition ?? true,
      slotDelta: match?.slotDelta ?? 0,
      skippedNewerCount: match?.skippedNewerCount ?? 0,
      // Heaviest EFFECTIVE load touched, per session. "Did you back off?" is a
      // question about top-end load, not about the best set — dropping weight
      // mid-session to stay in the rep range is autoregulation, not regression.
      topLoad: topEffectiveLoad(lastSession, shape),
      prevTopLoad: prevSession ? topEffectiveLoad(prevSession, shape) : null,
      prevWeight: prevSession
        ? (bestSetBy1RM(prevSession, shape)?.weightLbs ?? null)
        : null,
      allSets: lastSession.map((s) => ({
        weight: s.weightLbs,
        reps: s.reps,
        rir: s.rir,
        durationSeconds: s.durationSeconds ?? null,
      })),
    };
  }

// Offer return mode only when there's a genuine break behind this session.
  // Measured from logged working sets (never the planned calendar), and it
  // expires on its own once RETURNING_SESSIONS have been logged.
  const ret = await returnContext(
    profile.id, workout.id, workout.date, RETURNING_GAP_DAYS, RETURNING_SESSIONS,
  );

return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <LiveWorkout
        workout={{
          id: workout.id,
          focus: workout.focus,
          date: workout.date.toISOString(),
          routineId: workout.routineId,
        }}
        plannedExercises={(workout.routine?.exercises ?? []).map((re, index) => ({
          routineExerciseId: re.id,
          exerciseId: re.exerciseId,
          exerciseName: re.exercise.name,
          primaryMuscle: re.exercise.primaryMuscle,
          movementPattern: re.exercise.movementPattern,
          equipment: re.exercise.equipment,
          isUnilateral: re.exercise.isUnilateral,
          isAssisted: re.exercise.isAssisted,
          isBodyweight: re.exercise.isBodyweight,
          isTimeBased: re.exercise.isTimeBased,
          targetSets: re.targetSets,
          targetRepMin: re.targetRepMin,
          targetRepMax: re.targetRepMax,
          targetRir: re.targetRir,
          restTimerSecs: re.restTimerSecs ?? 120,
          progressionStyle: re.progressionStyle,
          plannedOrder: index,
          history: exerciseHistories[re.exerciseId] ?? null,
        }))}
        loggedSets={workout.sets.map((s) => ({
          id: s.id,
          exerciseId: s.exerciseId,
          weightLbs: s.weightLbs,
          reps: s.reps,
          rir: s.rir,
          durationSeconds: s.durationSeconds ?? null,
          isWarmup: s.isWarmup,
          executionOrder: s.executionOrder,
          setType: s.setType ?? 'STRAIGHT',
          setGroupId: s.setGroupId ?? null,
          side: s.side ?? null,
        }))}
        profileId={profile.id}
        currentBodyweight={currentBodyweight}
        allExercises={allExercises}
        isAdHoc={!workout.routineId}
        trainingState={(workout.trainingState ?? 'NORMAL') as TrainingState}
        suggestedReturn={ret}
      />
    </main>
  );
}