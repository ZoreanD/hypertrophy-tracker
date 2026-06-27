import { redirect } from 'next/navigation';
import Link from 'next/link';
import prisma from '../../../lib/prisma';
import { getProfileFromCookie } from '../../../lib/session';
import { canViewRoutine, canViewNumbers, getRoutineLastNumbers } from '../../../lib/social';
import SharedRoutineActions from './SharedRoutineActions';

export const dynamic = 'force-dynamic';

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default async function SharedRoutinePage({
  params,
  searchParams,
}: {
  params: Promise<{ routineId: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const me = await getProfileFromCookie();
  if (!me) return redirect('/login');

  const { routineId } = await params;
  const { t: token } = await searchParams;

  const routine = await prisma.routine.findUnique({
    where: { id: routineId },
    select: {
      id: true, name: true, focus: true, profileId: true,
      visibility: true, shareToken: true, isTrial: true,
      profile: { select: { user: { select: { username: true } } } },
      exercises: {
        orderBy: { order: 'asc' },
        select: {
          id: true, exerciseId: true, targetSets: true, targetRepMin: true,
          targetRepMax: true, targetRir: true,
          exercise: { select: { name: true, isTimeBased: true } },
        },
      },
    },
  });

  if (!routine) return redirect('/following');

  const allowed = await canViewRoutine(me.id, routine, token);
  if (!allowed) {
    return (
      <main className="min-h-screen bg-zinc-950 p-6 text-zinc-100 md:p-12">
        <div className="mx-auto max-w-2xl space-y-4">
          <Link href="/following" className="text-sm text-zinc-500 hover:text-zinc-300">← Following</Link>
          <p className="text-center text-zinc-400">Follow @{routine.profile.user.username} to view this routine.</p>
        </div>
      </main>
    );
  }

  const isMe = me.id === routine.profileId;
  const showNumbers = await canViewNumbers(me.id, routine);
  const numbers = showNumbers ? await getRoutineLastNumbers(routine.profileId, routine.id) : null;
  const username = routine.profile.user.username;

  const dateLabel = numbers?.date
    ? new Date(numbers.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-zinc-100 md:p-12">
      <div className="mx-auto max-w-2xl space-y-6">
        <Link href={`/u/${encodeURIComponent(username)}`} className="text-sm text-zinc-500 hover:text-zinc-300">
          ← @{username}
        </Link>

        <header className="border-b border-zinc-800 pb-5">
          <h1 className="text-2xl font-bold text-white">{routine.name}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {routine.focus ? `${routine.focus} · ` : ''}by @{username}
            {showNumbers && dateLabel && <> · their last session {dateLabel}</>}
          </p>
        </header>

        {!isMe && <SharedRoutineActions routineId={routine.id} />}

        <section className="space-y-3">
          {routine.exercises.map((re) => {
            const n = numbers?.byExercise[re.exerciseId];
            return (
              <div key={re.id} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-white">{re.exercise.name}</p>
                  <span className="text-xs text-zinc-500">
                    {re.targetSets} × {re.targetRepMin}–{re.targetRepMax} @ {re.targetRir} RIR
                  </span>
                </div>
                {showNumbers ? (
                  n ? (
                    <p className="mt-2 text-sm">
                      <span className="text-zinc-500">@{username}'s last: </span>
                      <span className="font-medium text-emerald-400">
                        {n.durationSeconds && n.durationSeconds > 0
                          ? (n.weightLbs > 0 ? `${n.weightLbs}lbs, ${fmtDuration(n.durationSeconds)}` : fmtDuration(n.durationSeconds))
                          : `${n.weightLbs}lbs × ${n.reps} @ ${n.rir} RIR`}
                      </span>
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-zinc-600">No logged sets yet.</p>
                  )
                ) : (
                  <p className="mt-2 text-xs text-zinc-600">Follow to see @{username}'s numbers.</p>
                )}
              </div>
            );
          })}
        </section>
      </div>
    </main>
  );
}
