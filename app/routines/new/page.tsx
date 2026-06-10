import prisma from '../../../lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '../../../lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import RoutineBuilder from './RoutineBuilder';

export default async function NewRoutinePage({
  searchParams,
}: {
  searchParams: Promise<{ fromWorkout?: string }>;
}) {
  const { fromWorkout } = await searchParams;

  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (!token) return redirect('/login');

  const decodedToken = await verifyToken(token);
  if (!decodedToken) return redirect('/login');

  const profile = await prisma.profile.findUnique({
    where: { userId: decodedToken.userId },
  });
  if (!profile) return redirect('/setup');

  const exercises = await prisma.exercise.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      primaryMuscle: true,
      secondaryMuscles: true,
      equipment: true,
      movementPattern: true,
    },
  });

  // #50 — pre-populate from ad-hoc workout
  type InitialExercise = {
    exerciseId: string;
    exerciseName: string;
    primaryMuscle: string;
    secondaryMuscles: string[];
    order: number;
    targetSets: number;
    targetRepMin: number;
    targetRepMax: number;
    targetRir: number;
    restTimerSecs: number;
    progressionStyle: string;
  };

  let fromWorkoutExercises: InitialExercise[] = [];

  if (fromWorkout) {
    const sourceWorkout = await prisma.workout.findUnique({
      where: { id: fromWorkout },
      include: {
        sets: {
          where: { isWarmup: false },
          include: {
            exercise: {
              select: {
                id: true,
                name: true,
                primaryMuscle: true,
                secondaryMuscles: true,
                equipment: true,
                movementPattern: true,
              },
            },
          },
          orderBy: { executionOrder: 'asc' },
        },
      },
    });

    if (sourceWorkout) {
      const seen = new Map<string, InitialExercise>();
      for (const s of sourceWorkout.sets) {
        if (seen.has(s.exerciseId)) {
          seen.get(s.exerciseId)!.targetSets += 1;
        } else {
          seen.set(s.exerciseId, {
            exerciseId: s.exerciseId,
            exerciseName: s.exercise.name,
            primaryMuscle: s.exercise.primaryMuscle,
            secondaryMuscles: s.exercise.secondaryMuscles ?? [],
            order: seen.size,
            targetSets: 1,
            targetRepMin: s.reps,
            targetRepMax: s.reps,
            targetRir: Math.round(s.rir),
            restTimerSecs: 120,
            progressionStyle: 'DOUBLE_PROGRESSION',
          });
        }
      }
      fromWorkoutExercises = Array.from(seen.values());
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-zinc-100 md:p-12">
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="border-b border-zinc-800 pb-6">
          <Link href="/routines" className="mb-3 inline-block text-sm text-zinc-500 hover:text-zinc-300">
            ← Back to Routines
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-white">New Routine</h1>
          <p className="mt-1 text-zinc-400">
            {fromWorkoutExercises.length > 0
              ? 'Pre-filled from your workout. Adjust targets and save.'
              : 'Build your training template. Set targets for each exercise.'}
          </p>
        </header>
        <RoutineBuilder
          exercises={exercises}
          fromWorkoutExercises={fromWorkoutExercises.length > 0 ? fromWorkoutExercises : undefined}
        />
      </div>
    </main>
  );
}