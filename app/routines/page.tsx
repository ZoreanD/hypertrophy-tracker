import prisma from '../../lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '../../lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function RoutinesPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (!token) return redirect('/login');

  const decodedToken = await verifyToken(token);
  if (!decodedToken) return redirect('/login');

  const profile = await prisma.profile.findUnique({
    where: { userId: decodedToken.userId },
  });
  if (!profile) return redirect('/setup');

  const routines = await prisma.routine.findMany({
    where: { profileId: profile.id },
    include: {
      exercises: {
        include: { exercise: true },
        orderBy: { order: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-zinc-100 md:p-12">
      <div className="mx-auto max-w-4xl space-y-8">

        <header className="flex items-center justify-between border-b border-zinc-800 pb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Routines</h1>
            <p className="mt-1 text-zinc-400">Your saved training templates.</p>
          </div>
          <Link
            href="/routines/new"
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            + New Routine
          </Link>
        </header>

        {routines.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-700 p-12 text-center">
            <p className="text-zinc-400">No routines yet.</p>
            <p className="mt-1 text-sm text-zinc-500">
              Create your first routine to start planning your mesocycle.
            </p>
            <Link
              href="/routines/new"
              className="mt-4 inline-block rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
            >
              Build a Routine
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {routines.map((routine) => (
              <div
                key={routine.id}
                className="rounded-xl border border-zinc-800 bg-zinc-900 p-6"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-white">{routine.name}</h2>
                    <p className="text-sm text-zinc-400">{routine.focus}</p>
                    {routine.notes && (
                      <p className="mt-1 text-xs text-zinc-500">{routine.notes}</p>
                    )}
                  </div>
                  <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-300">
                    {routine.exercises.length} exercises
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {routine.exercises.map((re) => (
                    <span
                      key={re.id}
                      className="rounded-md bg-zinc-800 px-2 py-1 text-xs text-zinc-400"
                    >
                      {re.exercise.name}
                    </span>
                  ))}
                </div>

                {/* Volume summary per muscle group */}
                <div className="mt-4 flex flex-wrap gap-3">
                  {Object.entries(
                    routine.exercises.reduce((acc: Record<string, number>, re) => {
                      const m = re.exercise.primaryMuscle;
                      acc[m] = (acc[m] || 0) + re.targetSets;
                      return acc;
                    }, {})
                  ).map(([muscle, sets]) => (
                    <span key={muscle} className="text-xs text-zinc-500">
                      {muscle.replace(/_/g, ' ')}: <span className="text-zinc-300">{sets} sets</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </main>
  );
}