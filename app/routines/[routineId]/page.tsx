import prisma from '../../../lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '../../../lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import RoutineBuilder from '../new/RoutineBuilder';
import RoutineShareControl from './RoutineShareControl';

export const dynamic = 'force-dynamic';

export default async function EditRoutinePage({
  params,
}: {
  params: Promise<{ routineId: string }>;
}) {
  const { routineId } = await params;

  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (!token) return redirect('/login');

  const decoded = await verifyToken(token);
  if (!decoded) return redirect('/login');

  const profile = await prisma.profile.findUnique({
    where: { userId: decoded.userId },
  });
  if (!profile) return redirect('/setup');

  const routine = await prisma.routine.findUnique({
    where: { id: routineId },
    include: {
      exercises: {
        include: { exercise: true },
        orderBy: { order: 'asc' },
      },
    },
  });

  if (!routine || routine.profileId !== profile.id) return redirect('/routines');

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

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-zinc-100 md:p-12">
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="border-b border-zinc-800 pb-6">
          <Link href="/routines" className="mb-3 inline-block text-sm text-zinc-500 hover:text-zinc-300">
            ← Back to Routines
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-white">Edit Routine</h1>
          <p className="mt-1 text-zinc-400">
            Changes apply to future workouts only. Past sessions are unchanged.
          </p>
        </header>
        <RoutineShareControl routineId={routine.id} initialVisibility={routine.visibility} />
        <RoutineBuilder
          exercises={exercises}
          editMode={{
            routineId: routine.id,
            initialName: routine.name,
            initialFocus: routine.focus ?? 'Push',
            initialNotes: routine.notes ?? '',
            initialWeeklyFrequency: routine.weeklyFrequency ?? 1,
            initialExercises: routine.exercises.map((re) => ({
              exerciseId: re.exerciseId,
              exerciseName: re.exercise.name,
              primaryMuscle: re.exercise.primaryMuscle,
              secondaryMuscles: re.exercise.secondaryMuscles,
              order: re.order,
              targetSets: re.targetSets,
              targetRepMin: re.targetRepMin,
              targetRepMax: re.targetRepMax,
              targetRir: re.targetRir,
              restTimerSecs: re.restTimerSecs ?? 120,
              progressionStyle: re.progressionStyle,
            })),
          }}
        />
      </div>
    </main>
  );
}