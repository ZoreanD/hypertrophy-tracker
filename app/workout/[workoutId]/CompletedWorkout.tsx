'use client';

import { useRouter } from 'next/navigation';

type LoggedSet = {
  id: string;
  exerciseId: string;
  exerciseName: string;
  weightLbs: number;
  reps: number;
  rir: number;
  isWarmup: boolean;
  setType: string;
  side: string | null;
};

type PlannedExercise = {
  exerciseId: string;
  exerciseName: string;
  targetSets: number;
  targetRepMin: number;
  targetRepMax: number;
  targetRir: number;
  isAssisted: boolean;
};

export default function CompletedWorkout({
  workout,
  plannedExercises,
  loggedSets,
}: {
  workout: { id: string; focus: string; date: string; durationMins: number };
  plannedExercises: PlannedExercise[];
  loggedSets: LoggedSet[];
}) {
  const router = useRouter();

  const workingSets = loggedSets.filter((s) => !s.isWarmup);
  const totalSets = workingSets.length;

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6 md:p-12">
      <header className="border-b border-zinc-800 pb-6">
        <p className="text-sm text-zinc-500">
          {new Date(workout.date.slice(0, 10) + 'T12:00:00').toLocaleDateString('en-US', {
            weekday: 'long', month: 'long', day: 'numeric',
          })}
        </p>
        <h1 className="mt-1 text-3xl font-bold text-white">{workout.focus}</h1>
        <p className="mt-1 text-zinc-400">
          {workout.durationMins} mins · {totalSets} working sets · Completed
        </p>
      </header>

      <div className="space-y-4">
        {plannedExercises.map((ex) => {
          const sets = workingSets.filter((s) => s.exerciseId === ex.exerciseId);
          const completed = sets.length >= ex.targetSets;

          return (
            <div
              key={ex.exerciseId}
              className={`rounded-xl border p-4 ${
                completed
                  ? 'border-emerald-800 bg-emerald-950/20'
                  : sets.length > 0
                  ? 'border-yellow-800 bg-yellow-950/10'
                  : 'border-zinc-800 bg-zinc-900/30'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-white">{ex.exerciseName}</p>
                  <p className="text-xs text-zinc-500">
                    {sets.length}/{ex.targetSets} sets · {ex.targetRepMin}–{ex.targetRepMax} reps · {ex.targetRir} RIR planned
                  </p>
                </div>
                <span className={`text-xs font-medium ${
                  completed ? 'text-emerald-400'
                  : sets.length > 0 ? 'text-yellow-400'
                  : 'text-zinc-600'
                }`}>
                  {completed ? '✓ Done' : sets.length > 0 ? 'Partial' : '○ Skipped'}
                </span>
              </div>

              {sets.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {sets.map((s) => (
                    <span
                      key={s.id}
                      className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300"
                    >
                      {s.side ? `${s.side} ` : ''}
                      {ex.isAssisted
                        ? `${s.weightLbs}lbs assist`
                        : `${s.weightLbs}lbs`} × {s.reps} @ {s.rir} RIR
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={() => router.push('/dashboard')}
        className="w-full rounded-md bg-emerald-600 py-3 font-semibold text-white hover:bg-emerald-500"
      >
        Back to Dashboard
      </button>
    </div>
  );
}
