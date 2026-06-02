// app/dashboard/page.tsx
import prisma from '../../lib/prisma';
import ProgressChart from './ProgressChart';
import Link from 'next/link';

export default async function Dashboard() {
  // 1. Get the user profile
  const profile = await prisma.profile.findFirst();
  
  if (!profile) return <div className="p-12 text-white">No profile found.</div>;

  // 2. Grab an exercise from the database to test the chart
  const testExercise = await prisma.exercise.findFirst({
    orderBy: { name: 'asc' }
  });

  // 3. Fetch today's metrics or the most recent one
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const currentMetric = await prisma.bodyMetric.findFirst({
    where: { profileId: profile.id },
    orderBy: { date: 'desc' },
  });

  // 4. Fetch the last 7 days of workouts for the activity log
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const recentWorkouts = await prisma.workout.findMany({
    where: {
      profileId: profile.id,
      date: { gte: sevenDaysAgo },
    },
    orderBy: { date: 'desc' },
  });

  // 5. Render the Dashboard
  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-zinc-100 md:p-12">
      <div className="mx-auto max-w-4xl space-y-8">
        
        {/* Header */}
        <header className="flex items-center justify-between border-b border-zinc-800 pb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Command Center</h1>
            <p className="mt-1 text-zinc-400">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <Link 
            href="/workout/new" 
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600"
          >
            + Log Workout
          </Link>
        </header>

        {/* Daily Macros Grid */}
        <section>
          <h2 className="mb-4 text-xl font-semibold text-zinc-200">Daily Targets ({profile.currentGoal})</h2>
          <div className="grid gap-4 sm:grid-cols-3">
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
          </div>
        </section>

        {/* --- The Chart Component --- */}
        {testExercise && (
          <section className="mt-12">
            <h2 className="mb-4 text-xl font-semibold text-zinc-200">Progression Tracking</h2>
            <ProgressChart 
              profileId={profile.id} 
              exerciseId={testExercise.id} 
              exerciseName={testExercise.name} 
            />
          </section>
        )}

        {/* Recent Activity */}
        <section>
          <h2 className="mb-4 text-xl font-semibold text-zinc-200">7-Day Volume</h2>
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
                      <p className="font-medium text-white">{workout.focus} Day</p>
                      <p className="text-sm text-zinc-400">
                        {workout.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-zinc-300">{workout.durationMins} mins</p>
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