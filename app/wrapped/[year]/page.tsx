import prisma from '../../../lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '../../../lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { buildWrapped, WrappedWorkout, activeWrappedYear } from '../../../lib/wrapped';
import { resolveTimeZone, todayInZone } from '../../../lib/timezone';
import WrappedStory from './WrappedStory';

export const dynamic = 'force-dynamic';

export default async function WrappedPage({
  params,
}: {
  params: Promise<{ year: string }>;
}) {
  const { year: yearParam } = await params;

  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (!token) return redirect('/login');

  const decoded = await verifyToken(token);
  if (!decoded) return redirect('/login');

  const profile = await prisma.profile.findUnique({
    where: { userId: decoded.userId },
  });
  if (!profile) return redirect('/setup');

  const user = await prisma.user.findUnique({
    where: { id: profile.userId },
    select: { username: true },
  });

  const parsed = Number(yearParam);
  const year = Number.isInteger(parsed) && parsed >= 2000 && parsed <= 2100
    ? parsed : new Date().getFullYear();

  const timeZone = resolveTimeZone(profile.timezone);

  // Pull a slightly wider window than the calendar year: a session logged late
  // on Dec 31 local time can be stored as Jan 1 UTC (and vice versa).
  // buildWrapped does the authoritative filtering in the lifter's own zone.
  const rows = await prisma.workout.findMany({
    where: {
      profileId: profile.id,
      durationMins: { gt: 0 },
      date: {
        gte: new Date(`${year - 1}-12-30T00:00:00.000Z`),
        lte: new Date(`${year + 1}-01-02T23:59:59.999Z`),
      },
    },
    select: {
      id: true, date: true, focus: true, durationMins: true,
      sets: {
        where: { isWarmup: false },
        select: {
          weightLbs: true, reps: true, side: true, isWarmup: true,
          durationSeconds: true, assistanceWeightLbs: true, bodyweightLbs: true,
          exercise: {
            select: {
              id: true, name: true, primaryMuscle: true, secondaryMuscles: true,
              isAssisted: true, isBodyweight: true, weightIsPerSide: true,
              isTimeBased: true,
            },
          },
        },
      },
    },
    orderBy: { date: 'asc' },
  });

  const workouts: WrappedWorkout[] = rows.map((w) => ({
    id: w.id,
    date: w.date,
    focus: w.focus,
    durationMins: w.durationMins,
    sets: w.sets.map((s) => ({
      weightLbs: s.weightLbs,
      reps: s.reps,
      side: s.side ?? null,
      isWarmup: s.isWarmup,
      durationSeconds: s.durationSeconds ?? null,
      assistanceWeightLbs: s.assistanceWeightLbs ?? null,
      bodyweightLbs: s.bodyweightLbs ?? null,
      exercise: {
        ...s.exercise,
        secondaryMuscles: s.exercise.secondaryMuscles as unknown as string[],
      },
    })),
  }));

  const data = buildWrapped(workouts, year);
  // Past years stay viewable by direct link; only the in-window year auto-opens
  // from the dashboard.
  const isLive = activeWrappedYear(todayInZone(timeZone)) === year;

  if (!data.hasData) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 p-6 text-center text-zinc-100">
        <div className="space-y-4">
          <h1 className="text-2xl font-bold text-white">No {year} Wrapped yet</h1>
          <p className="text-zinc-400">There are no completed workouts logged for {year}.</p>
          <Link href="/dashboard" className="inline-block rounded-md border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 hover:border-zinc-500 hover:text-white">
            ← Dashboard
          </Link>
        </div>
      </main>
    );
  }

  return <WrappedStory data={data} username={user?.username ?? 'lifter'} isLive={isLive} />;
}
