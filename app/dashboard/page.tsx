import prisma from '../../lib/prisma';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifyToken } from '../../lib/auth';
import LogoutButton from './LogoutButton';
import NavIcon from '../components/NavIcon';
import VolumeChart from './VolumeChart';
import Tooltip from '../components/Tooltip';
import { GLOSSARY } from '../components/glossary';
import ProgressionChart from './ProgressionChart';
import TodayWorkoutCard from './TodayWorkoutCard';
import { getHourlyQuote } from './quotes';

export const dynamic = 'force-dynamic';

const VOLUME_LANDMARKS: Record<string, { mev: number; mav: number; label: string }> = {
  CHEST: { mev: 8, mav: 18, label: 'Chest' },
  BACK: { mev: 8, mav: 20, label: 'Back' },
  QUADS: { mev: 8, mav: 18, label: 'Quads' },
  HAMSTRINGS: { mev: 6, mav: 16, label: 'Hamstrings' },
  GLUTES: { mev: 0, mav: 12, label: 'Glutes' },
  SIDE_REAR_DELT: { mev: 8, mav: 22, label: 'Delts' },
  BICEPS: { mev: 6, mav: 14, label: 'Biceps' },
  TRICEPS: { mev: 4, mav: 12, label: 'Triceps' },
  CALVES: { mev: 6, mav: 16, label: 'Calves' },
  ABS: { mev: 0, mav: 12, label: 'Abs' },
};

const MUSCLE_GROUP_MAP: Record<string, string> = {
  CHEST_UPPER: 'CHEST',
  CHEST_MID_LOWER: 'CHEST',
  LATS: 'BACK',
  TRAPS_MID: 'BACK',
  TRAPS_UPPER: 'BACK',
  TRAPS_LOWER: 'BACK',
  RHOMBOIDS: 'BACK',
  TERES_MAJOR: 'BACK',
  LOWER_BACK: 'BACK',
  FRONT_DELT: 'SIDE_REAR_DELT',
  SIDE_DELT: 'SIDE_REAR_DELT',
  REAR_DELT: 'SIDE_REAR_DELT',
  BICEPS_LONG_HEAD: 'BICEPS',
  BICEPS_SHORT_HEAD: 'BICEPS',
  BRACHIALIS: 'BICEPS',
  BRACHIORADIALIS: 'BICEPS',
  TRICEPS_LONG_HEAD: 'TRICEPS',
  TRICEPS_LATERAL_HEAD: 'TRICEPS',
  TRICEPS_MEDIAL_HEAD: 'TRICEPS',
  QUAD_VASTUS_LATERALIS: 'QUADS',
  QUAD_VASTUS_MEDIALIS: 'QUADS',
  QUAD_RECTUS_FEMORIS: 'QUADS',
  HAMSTRING_BICEPS_FEMORIS: 'HAMSTRINGS',
  HAMSTRING_MEDIAL: 'HAMSTRINGS',
  GLUTE_MAX: 'GLUTES',
  GLUTE_MED: 'GLUTES',
  HIP_ABDUCTOR: 'GLUTES',
  HIP_ADDUCTOR: 'GLUTES',
  GASTROCNEMIUS: 'CALVES',
  SOLEUS: 'CALVES',
  ABS: 'ABS',
  OBLIQUES: 'ABS',
};

export default async function Dashboard() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (!token) return redirect('/login');

  const decodedToken = await verifyToken(token);
  if (!decodedToken) return redirect('/login');

  const profile = await prisma.profile.findUnique({
    where: { userId: decodedToken.userId },
  });
  if (!profile) return redirect('/setup');

  const user = await prisma.user.findUnique({
    where: { id: decodedToken.userId },
    select: { username: true },
  });
  const quote = getHourlyQuote();

  const currentMetric = await prisma.bodyMetric.findFirst({
    where: { profileId: profile.id },
    orderBy: { date: 'desc' },
  });

  const now = new Date();
  const currentDay = now.getDay(); // 0=Sun, 1=Mon, ...
  const weekStartDay = profile.weekStartDay ?? 0;
  const daysFromStart = (currentDay - weekStartDay + 7) % 7;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - daysFromStart);
  weekStart.setHours(0, 0, 0, 0);
  const recentWorkouts = await prisma.workout.findMany({
    where: {
      profileId: profile.id,
      date: { gte: weekStart },
    },
    include: {
      sets: {
        where: { isWarmup: false },
        include: { exercise: true },
      },
    },
    orderBy: { date: 'desc' },
  });

  const weeklySetsByGroup: Record<string, number> = {};
  recentWorkouts.forEach((workout) => {
    workout.sets.forEach((set) => {
      const group = MUSCLE_GROUP_MAP[set.exercise.primaryMuscle] ?? set.exercise.primaryMuscle;
      weeklySetsByGroup[group] = (weeklySetsByGroup[group] || 0) + 1;
    });
  });

  const volumeData = Object.entries(VOLUME_LANDMARKS).map(([key, landmark]) => ({
    muscle: key,
    label: landmark.label,
    sets: weeklySetsByGroup[key] || 0,
    mev: landmark.mev,
    mav: landmark.mav,
    status: !weeklySetsByGroup[key] ? 'none'
      : weeklySetsByGroup[key] < landmark.mev ? 'below_mev'
      : weeklySetsByGroup[key] <= landmark.mav ? 'in_mav'
      : 'above_mav',
  }));

  const eightWeeksAgo = new Date();
  eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);

  const allRecentWorkouts = await prisma.workout.findMany({
    where: {
      profileId: profile.id,
      date: { gte: eightWeeksAgo },
    },
    include: {
      sets: { where: { isWarmup: false } },
    },
    orderBy: { date: 'asc' },
  });

  const weeklyVolume: { week: string; sets: number; workouts: number }[] = [];
  for (let i = 7; i >= 0; i--) {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - (i * 7 + 6));
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() - i * 7);
    weekEnd.setHours(23, 59, 59, 999);

    const weekWorkouts = allRecentWorkouts.filter(
      (w) => w.date >= weekStart && w.date <= weekEnd
    );
    const totalSets = weekWorkouts.reduce((sum, w) => sum + w.sets.length, 0);

    weeklyVolume.push({
      week: weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      sets: totalSets,
      workouts: weekWorkouts.length,
    });
  }

  const loggedExerciseIds = await prisma.set.findMany({
    where: { workout: { profileId: profile.id } },
    select: { exerciseId: true },
    distinct: ['exerciseId'],
  });

  const loggedExercises = await prisma.exercise.findMany({
    where: { id: { in: loggedExerciseIds.map((s) => s.exerciseId) } },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  const defaultExercise = loggedExercises[0] ?? null;
  let progressionData: { date: string; e1RM: number; weight: number; reps: number }[] = [];

  if (defaultExercise) {
    const sets = await prisma.set.findMany({
      where: {
        exerciseId: defaultExercise.id,
        workout: { profileId: profile.id },
        isWarmup: false,
      },
      include: { workout: { select: { date: true } } },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });

    const byDate = new Map<string, typeof sets>();
    sets.forEach((s) => {
      const key = s.workout.date.toISOString().split('T')[0];
      if (!byDate.has(key)) byDate.set(key, []);
      byDate.get(key)!.push(s);
    });

    progressionData = Array.from(byDate.entries()).flatMap(([date, dateSets]) => {
      const repSets = dateSets.filter((s) => s.reps != null && !(s.durationSeconds != null && s.durationSeconds > 0));
      if (repSets.length === 0) return [];
      const best = repSets.reduce((b, s) =>
        s.weightLbs * s.reps! > b.weightLbs * b.reps! ? s : b
      );
      return [{
        date,
        e1RM: Math.round(best.weightLbs * (1 + best.reps! / 30)),
        weight: best.weightLbs,
        reps: best.reps!,
      }];
    });
  }

  const firstWorkout = await prisma.workout.findFirst({
    where: { profileId: profile.id },
    orderBy: { date: 'asc' },
  });
  const weeksSinceStart = firstWorkout
    ? Math.floor((Date.now() - firstWorkout.date.getTime()) / (7 * 24 * 60 * 60 * 1000))
    : 0;
  const mesocycleWeek = (weeksSinceStart % 6) + 1;

  // Today's scheduled workouts
// CST = UTC-6 (CDT = UTC-5, but hardcoding CST for now)
const CDT_OFFSET = 5 * 60 * 60 * 1000;
const todayDateStr = new Date(Date.now() - CDT_OFFSET).toISOString().split('T')[0];
const todayStartUTC = new Date(todayDateStr + 'T00:00:00.000Z');
const todayEndUTC = new Date(todayDateStr + 'T23:59:59.999Z');

const todayScheduled = await prisma.scheduledWorkout.findMany({
  where: {
    profileId: profile.id,
    date: { gte: todayStartUTC, lte: todayEndUTC },
  },
  include: { routine: true },
  orderBy: { date: 'asc' },
});

const todayWorkouts = await prisma.workout.findMany({
  where: {
    profileId: profile.id,
    date: { gte: todayStartUTC, lte: todayEndUTC },
  },
  select: { id: true, routineId: true, durationMins: true, focus: true },
});

// In-progress ad-hoc workouts (no routine) — these aren't covered by the
// scheduled "Today" cards, so surface them here so they're resumable. Scheduled
// routine workouts already show their in-progress state in TodayWorkoutCard.
const inProgressWorkouts = todayWorkouts.filter((w) => w.durationMins === 0 && !w.routineId);

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-zinc-100 md:p-12">
      <div className="mx-auto max-w-4xl space-y-8">

        <header className="border-b border-zinc-800 pb-6 space-y-4">
          {/* Date + nav buttons */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-zinc-500">
              {new Date(Date.now() - 5 * 60 * 60 * 1000).toLocaleDateString('en-US', {
                weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/Chicago',
              })}
            </p>
            <div className="ff-nav flex flex-wrap gap-2">
              <Link href="/workout/new" title="Log a workout" className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-500">
                <span className="nav-ico" aria-hidden><NavIcon name="log" /></span><span className="nav-label">+ Log</span>
              </Link>
              <Link href="/routines" title="Routines" className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm font-semibold text-zinc-300 hover:border-zinc-500 hover:text-white">
                <span className="nav-ico" aria-hidden><NavIcon name="routines" /></span><span className="nav-label">Routines</span>
              </Link>
              <Link href="/calendar" title="Calendar" className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm font-semibold text-zinc-300 hover:border-zinc-500 hover:text-white">
                <span className="nav-ico" aria-hidden><NavIcon name="calendar" /></span><span className="nav-label">Calendar</span>
              </Link>
              <Link href="/following" title="Following" className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm font-semibold text-zinc-300 hover:border-zinc-500 hover:text-white">
                <span className="nav-ico" aria-hidden><NavIcon name="following" /></span><span className="nav-label">Following</span>
              </Link>
              <Link href="/history" title="History" className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm font-semibold text-zinc-300 hover:border-zinc-500 hover:text-white">
                <span className="nav-ico" aria-hidden><NavIcon name="history" /></span><span className="nav-label">History</span>
              </Link>
              <Link href="/settings" title="Settings" className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm font-semibold text-zinc-300 hover:border-zinc-500 hover:text-white">
                <span className="nav-ico" aria-hidden><NavIcon name="settings" /></span><span className="nav-label">Settings</span>
              </Link>
              <LogoutButton />
            </div>
          </div>

          {/* Welcome + quote */}
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">
              Welcome back, {user?.username ?? 'Athlete'}
            </h1>
            <p className="mt-2 text-sm text-zinc-500 italic">"{quote}"</p>
          </div>
        </header>

        {/* In-progress workouts (resume) — covers ad-hoc, which aren't scheduled */}
        {inProgressWorkouts.length > 0 && (
          <section>
            <h2 className="mb-3 text-xl font-semibold text-zinc-200">In progress</h2>
            <div className="space-y-2">
              {inProgressWorkouts.map((w) => (
                <div key={w.id} className="flex items-center justify-between rounded-xl border border-yellow-800/60 bg-yellow-950/10 p-4">
                  <div>
                    <p className="font-semibold text-white">{w.focus}</p>
                    <p className="text-xs text-yellow-400">⏳ In progress{w.routineId ? '' : ' · ad-hoc'}</p>
                  </div>
                  <Link
                    href={`/workout/${w.id}`}
                    className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
                  >
                    Resume
                  </Link>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Today's Sessions */}
      {todayScheduled.length > 0 && (
        <section>
          <h2 className="mb-3 text-xl font-semibold text-zinc-200">Today</h2>
          <div className="space-y-2">
            {todayScheduled.map((s) => {
              // Prefer completed workout over in-progress; most recent if multiple in-progress
              const matching = todayWorkouts.filter((w) => w.routineId === s.routineId);
              const existing = matching.find((w) => w.durationMins > 0)
                ?? matching[matching.length - 1]
                ?? null;
              return (
                <TodayWorkoutCard
                  key={s.id}
                  scheduledId={s.id}
                  routineId={s.routineId}
                  routineName={s.routine.name}
                  routineFocus={s.routine.focus ?? ''}
                  scheduledDate={s.date.toISOString()}
                  existingWorkoutId={existing?.id ?? null}
                  existingDurationMins={existing?.durationMins ?? null}
                />
              );
            })}
          </div>
        </section>
      )}

        <section className="grid gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-zinc-400">Target Calories</p>
              <span className="cursor-help text-xs text-zinc-600" title="Daily calorie target based on your TDEE and goal. CUT = TDEE - 300-500kcal, BULK = TDEE + 275kcal, MAINTAIN = TDEE.">?</span>
            </div>
            <p className="mt-2 text-4xl font-bold text-white">
              {currentMetric?.targetCalories || '---'}
              <span className="ml-1 text-lg font-normal text-zinc-500">kcal</span>
            </p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-zinc-400">Target Protein</p>
              <span className="cursor-help text-xs text-zinc-600" title="Daily protein target. CUT = 2.2g/kg bodyweight, BULK = 1.8g/kg, MAINTAIN = 2.0g/kg. Higher during cut to preserve muscle.">?</span>
            </div>
            <p className="mt-2 text-4xl font-bold text-emerald-400">
              {currentMetric?.targetProtein || '---'}
              <span className="ml-1 text-lg font-normal text-zinc-500">g</span>
            </p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-zinc-400">Calculated TDEE</p>
              <span className="cursor-help text-xs text-zinc-600" title="Total Daily Energy Expenditure — calories burned per day at your activity level. Calculated using Mifflin-St Jeor BMR × activity multiplier.">?</span>
            </div>
            <p className="mt-2 text-4xl font-bold text-zinc-300">
              {currentMetric?.calculatedTdee || '---'}
              <span className="ml-1 text-lg font-normal text-zinc-500">kcal</span>
            </p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-zinc-400"><Tooltip definition={GLOSSARY.mesocycle}>Mesocycle</Tooltip></p>
            </div>
            <p className="mt-2 text-4xl font-bold text-zinc-300">
              Week {mesocycleWeek}
              <span className="ml-1 text-lg font-normal text-zinc-500">of 6</span>
            </p>
            <p className="mt-1 text-xs text-zinc-600">
              {mesocycleWeek <= 2 ? 'Accumulation — start conservative'
                : mesocycleWeek <= 4 ? 'Intensification — push hard'
                : mesocycleWeek === 5 ? 'Peak — near MRV'
                : 'Deload next week'}
            </p>
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-xl font-semibold text-zinc-200">Weekly Volume</h2>
          <p className="mb-4 text-sm text-zinc-500">
            Direct working sets per muscle group this week vs <Tooltip definition={GLOSSARY.MEV}>MEV</Tooltip>/<Tooltip definition={GLOSSARY.MAV}>MAV</Tooltip> landmarks.
          </p>
          <VolumeChart data={volumeData} />
        </section>

        <section>
          <h2 className="mb-2 text-xl font-semibold text-zinc-200">Progressive Overload</h2>
          <p className="mb-4 text-sm text-zinc-500">
            Estimated 1RM trend per exercise over time using the Epley formula.
          </p>
          {loggedExercises.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-700 p-8 text-center">
              <p className="text-zinc-400">No workout data yet.</p>
              <p className="mt-1 text-sm text-zinc-500">Log your first session to see trends.</p>
            </div>
          ) : (
            <ProgressionChart
              exercises={loggedExercises}
              defaultExerciseId={defaultExercise?.id ?? ''}
              initialData={progressionData}
              profileId={profile.id}
            />
          )}
        </section>

        <section>
          <h2 className="mb-4 text-xl font-semibold text-zinc-200">8-Week Volume Trend</h2>
          <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
            <div className="grid grid-cols-8 gap-0 divide-x divide-zinc-800">
              {weeklyVolume.map((week, i) => {
                const isCurrentWeek = i === weeklyVolume.length - 1;
                const maxSets = Math.max(...weeklyVolume.map((w) => w.sets), 1);
                const heightPct = week.sets > 0 ? Math.max((week.sets / maxSets) * 100, 8) : 0;

                return (
                  <div key={week.week} className={`flex flex-col items-center p-3 ${isCurrentWeek ? 'bg-zinc-800/50' : ''}`}>
                    <div className="flex h-20 w-full items-end justify-center">
                      <div
                        className={`w-4 rounded-t transition-all ${isCurrentWeek ? 'bg-emerald-500' : 'bg-zinc-700'}`}
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>
                    <p className="mt-2 text-center text-xs font-medium text-white">{week.sets}</p>
                    <p className="text-center text-xs text-zinc-600">{week.week}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-xl font-semibold text-zinc-200">Recent Sessions</h2>
          {recentWorkouts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-700 p-8 text-center">
              <p className="text-zinc-400">No workouts recorded in the last 7 days.</p>
              <p className="mt-1 text-sm text-zinc-500">Time to hit the iron.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
              <ul className="divide-y divide-zinc-800">
                {recentWorkouts.map((workout: any) => (
                  <li key={workout.id} className="flex items-center justify-between p-4 hover:bg-zinc-800/50">
                    <div>
                      <p className="font-medium text-white">{workout.focus}</p>
                      <p className="text-sm text-zinc-400">
                        {workout.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-zinc-300">{workout.durationMins} mins</p>
                      <p className="text-xs text-zinc-600">{workout.sets.length} sets</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

      </div>
    </main>
  );
}