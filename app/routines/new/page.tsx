import prisma from '../../../lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '../../../lib/auth';
import { redirect } from 'next/navigation';
import RoutineBuilder from './RoutineBuilder';

export default async function NewRoutinePage() {
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

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-zinc-100 md:p-12">
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="border-b border-zinc-800 pb-6">
          <h1 className="text-3xl font-bold tracking-tight text-white">New Routine</h1>
          <p className="mt-1 text-zinc-400">
            Build your training template. Set targets for each exercise.
          </p>
        </header>
        <RoutineBuilder exercises={exercises} />
      </div>
    </main>
  );
}