import prisma from '../../lib/prisma';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifyToken } from '../../lib/auth';
import LogoutButton from './LogoutButton';
import VolumeChart from './VolumeChart';
import ProgressionChart from './ProgressionChart';
import TodayWorkoutCard from './TodayWorkoutCard';

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

  const currentMetric = await prisma.bodyMetric.findFirst({
    where: { profileId: profile.id },
    orderBy: { date: 'desc' },
  });

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const recentWorkouts = await prisma.workout.findMany({
    where: {
      profileId: profile.id,
      date: { gte: sevenDaysAgo },
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

    progressionData = Array.from(byDate.entries()).map(([date, dateSets]) => {
      const best = dateSets.reduce((b, s) =>
        s.weightLbs * s.reps > b.weightLbs * b.reps ? s : b
      );
      return {
        date,
        e1RM: Math.round(best.weightLbs * (1 + best.reps / 30)),
        weight: best.weightLbs,
        reps: best.reps,
      };
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
const CST_OFFSET = 5 * 60 * 60 * 1000; // CDT = UTC-5
const nowCST = new Date(Date.now() - CST_OFFSET);
const todayStart = new Date(nowCST);
todayStart.setHours(0, 0, 0, 0);
const todayEnd = new Date(nowCST);
todayEnd.setHours(23, 59, 59, 999);
// Convert back to UTC for DB query
const todayStartUTC = new Date(todayStart.getTime() + CST_OFFSET);
const todayEndUTC = new Date(todayEnd.getTime() + CST_OFFSET);

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
  select: { id: true, routineId: true, durationMins: true },
});

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-zinc-100 md:p-12">
      <div className="mx-auto max-w-4xl space-y-8">

        <header className="flex items-center justify-between border-b border-zinc-800 pb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Command Center</h1>
            <p className="mt-1 text-zinc-400">
              {new Date(Date.now() - 5 * 60 * 60 * 1000).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/Chicago' })}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <LogoutButton />
            <Link href="/settings" className="rounded-md border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 hover:border-zinc-500 hover:text-white">
              Settings
            </Link>
            <Link href="/routines" className="rounded-md border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 hover:border-zinc-500 hover:text-white">
              Routines
            </Link>
            <Link href="/calendar" className="rounded-md border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 hover:border-zinc-500 hover:text-white">
              Calendar
            </Link>
            <Link href="/workout/new" className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500">
              + Log Workout
            </Link>
          </div>
        </header>

        {/* Today's Sessions */}
      {todayScheduled.length > 0 && (
        <section>
          <h2 className="mb-3 text-xl font-semibold text-zinc-200">Today</h2>
          <div className="space-y-2">
            {todayScheduled.map((s) => {
              const existing = todayWorkouts.find((w) => w.routineId === s.routineId);
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
            <p className="text-sm font-medium text-zinc-400">Target Calories</p>
            <p className="mt-2 text-4xl font-bold text-white">
              {currentMetric?.targetCalories || '---'}
              <span className="ml-1 text-lg font-normal text-zinc-500">kcal</span>
            </p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <p className="text-sm font-medium text-zinc-400">Target Protein</p>
            <p className="mt-2 text-4xl font-bold text-emerald-400">
              {currentMetric?.targetProtein || '---'}
              <span className="ml-1 text-lg font-normal text-zinc-500">g</span>
            </p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <p className="text-sm font-medium text-zinc-400">Calculated TDEE</p>
            <p className="mt-2 text-4xl font-bold text-zinc-300">
              {currentMetric?.calculatedTdee || '---'}
              <span className="ml-1 text-lg font-normal text-zinc-500">kcal</span>
            </p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <p className="text-sm font-medium text-zinc-400">Mesocycle</p>
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
            Direct working sets per muscle group this week vs MEV/MAV landmarks.
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