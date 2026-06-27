import prisma from '../../../lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '../../../lib/auth';
import { redirect } from 'next/navigation';
import LiveWorkout from './LiveWorkout';
import CompletedWorkout from './CompletedWorkout';
import { getCurrentBodyweight } from '../../actions/workout-session';

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

  for (const re of workout.routine?.exercises ?? []) {
    const lastSets = await prisma.set.findMany({
      where: {
        exerciseId: re.exerciseId,
        workout: { profileId: profile.id },
        isWarmup: false,
        NOT: { workoutId: workout.id },
      },
      include: { workout: { select: { date: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10,
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

    const lastSession = Array.from(byWorkout.values())[0];
    // Time-based exercises store reps=0, so weight×reps is always 0 — rank by
    // duration instead so the "best set" is the longest hold, not the first.
    const isTimeBased = re.exercise.isTimeBased;
    const bestSet = lastSession.reduce((b, s) =>
      isTimeBased
        ? ((s.durationSeconds ?? 0) > (b.durationSeconds ?? 0) ? s : b)
        : (s.weightLbs * s.reps > b.weightLbs * b.reps ? s : b)
    );

    exerciseHistories[re.exerciseId] = {
      lastWeight: bestSet.weightLbs,
      lastReps: bestSet.reps,
      lastRir: bestSet.rir,
      lastDate: lastSession[0].workout.date,
      lastExecutionOrder: bestSet.executionOrder,
      allSets: lastSession.map((s) => ({
        weight: s.weightLbs,
        reps: s.reps,
        rir: s.rir,
        durationSeconds: s.durationSeconds ?? null,
      })),
    };
  }

return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <LiveWorkout
        workout={{
          id: workout.id,
          focus: workout.focus,
          date: workout.date.toISOString(),
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
      />
    </main>
  );
}