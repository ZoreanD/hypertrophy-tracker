import prisma from '../../lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '../../lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function HistoryPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (!token) return redirect('/login');

  const decoded = await verifyToken(token);
  if (!decoded) return redirect('/login');

  const profile = await prisma.profile.findUnique({ where: { userId: decoded.userId } });
  if (!profile) return redirect('/setup');

  const workouts = await prisma.workout.findMany({
    where: { profileId: profile.id, durationMins: { gt: 0 } },
    include: {
      routine: { select: { name: true } },
      _count: { select: { sets: true } },
    },
    orderBy: { date: 'desc' },
  });

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-zinc-100 md:p-12">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="border-b border-zinc-800 pb-6">
          <Link href="/dashboard" className="mb-3 inline-block text-sm text-zinc-500 hover:text-zinc-300">
            ← Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-white">Workout History</h1>
          <p className="mt-1 text-zinc-400">
            {workouts.length} completed workout{workouts.length !== 1 ? 's' : ''}
          </p>
        </header>

        {workouts.length === 0 && (
          <p className="text-sm text-zinc-500">No completed workouts yet.</p>
        )}

        <div className="space-y-3">
          {workouts.map((w) => (
            <Link
              key={w.id}
              href={`/workout/${w.id}`}
              className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 hover:border-zinc-600 transition"
            >
              <div>
                <p className="font-medium text-white">
                  {w.routine?.name ?? w.focus}
                  {!w.routineId && (
                    <span className="ml-2 rounded-full bg-zinc-700 px-2 py-0.5 text-xs text-zinc-400">
                      ad-hoc
                    </span>
                  )}
                </p>
                <p className="text-sm text-zinc-500">
                  {new Date(w.date.toISOString().slice(0, 10) + 'T12:00:00').toLocaleDateString('en-US', {
                    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
                  })}
                  {' · '}{w.durationMins} min{' · '}{w._count.sets} sets
                </p>
              </div>
              <span className="text-zinc-600">→</span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}