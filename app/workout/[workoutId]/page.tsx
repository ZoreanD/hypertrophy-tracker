import prisma from '../../../lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '../../../lib/auth';
import { redirect } from 'next/navigation';
import LiveWorkout from './LiveWorkout';

export const dynamic = 'force-dynamic';

export default async function LiveWorkoutPage({
  params,
}: {
  params: { workoutId: string };
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (!token) return redirect('/login');

  const decoded = await verifyToken(token);
  if (!decoded) return redirect('/login');

  const profile = await prisma.profile.findUnique({
    where: { userId: decoded.userId },
  });
  if (!profile) return redirect('/setup');

  const workout = await prisma.workout.findUnique({
    where: { id: params.workoutId },
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

  // For each planned exercise, get the last session history
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

    // Group by workout to get last session
    const byWorkout = new Map<string, typeof lastSets>();
    lastSets.forEach((s) => {
      const wid = s.workout.date.toISOString();
      if (!byWorkout.has(wid)) byWorkout.set(wid, []);
      byWorkout.get(wid)!.push(s);
    });

    const lastSession = Array.from(byWorkout.values())[0];
    const bestSet = lastSession.reduce((b, s) =>
      s.weightLbs * s.reps > b.weightLbs * b.reps ? s : b
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
          equipment: re.exercise.equipment,
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
            isWarmup: s.isWarmup,
            executionOrder: s.executionOrder,
            setType: s.setType ?? 'STRAIGHT',
            setGroupId: s.setGroupId ?? null,
        }))}
        profileId={profile.id}
      />
    </main>
  );
}