import prisma from '../../lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '../../lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import CalendarView from './CalendarView';

export const dynamic = 'force-dynamic';

export default async function CalendarPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (!token) return redirect('/login');

  const decoded = await verifyToken(token);
  if (!decoded) return redirect('/login');

  const profile = await prisma.profile.findUnique({
    where: { userId: decoded.userId },
  });
  if (!profile) return redirect('/setup');

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59);

  const scheduled = await prisma.scheduledWorkout.findMany({
    where: {
      profileId: profile.id,
      date: { gte: start, lte: end },
    },
    include: { routine: true },
    orderBy: { date: 'asc' },
  });

  const completedWorkouts = await prisma.workout.findMany({
    where: {
      profileId: profile.id,
      durationMins: { gt: 0 },
      date: { gte: start, lte: end },
    },
    select: { id: true, routineId: true, date: true },
  });

  const completedMap = new Map(
    completedWorkouts.map((w) => [
      `${w.routineId}-${w.date.toISOString().split('T')[0]}`,
      w.id,
    ])
  );

  const routines = await prisma.routine.findMany({
    where: { profileId: profile.id },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-zinc-100 md:p-12">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="flex items-center justify-between border-b border-zinc-800 pb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Training Calendar</h1>
            <p className="mt-1 text-zinc-400">Tap a day to assign a routine.</p>
          </div>
          <Link
            href="/dashboard"
            className="rounded-md border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 hover:border-zinc-500 hover:text-white"
          >
            ← Dashboard
          </Link>
        </header>
        <CalendarView
          year={year}
          month={month}
          scheduled={scheduled.map((s) => ({
            id: s.id,
            date: s.date.toISOString(),
            routineId: s.routineId,
            routineName: s.routine.name,
            routineFocus: s.routine.focus ?? '',
            completedWorkoutId: completedMap.get(`${s.routineId}-${s.date.toISOString().split('T')[0]}`) ?? null,
          }))}
          routines={routines.map((r) => ({
            id: r.id,
            name: r.name,
            focus: r.focus ?? '',
          }))}
        />
      </div>
    </main>
  );
}