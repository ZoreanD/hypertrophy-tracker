'use client';
import { useRouter } from 'next/navigation';
import Tooltip from '../../components/Tooltip';
import { GLOSSARY } from '../../components/glossary';

type LoggedSet = {
  id: string;
  exerciseId: string;
  exerciseName: string;
  weightLbs: number;
  reps: number;
  rir: number;
  durationSeconds: number | null;
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

type Summary = {
  exerciseSummaries: any[];
  deloadRecommended: boolean;
  totalSets: number;
  durationMins: number;
};

function formatDuration(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatSetDisplay(weight: number, reps: number, rir: number, durationSeconds?: number | null): string {
  if (durationSeconds != null && durationSeconds > 0) {
    return weight > 0 ? `${weight}lbs, ${formatDuration(durationSeconds)}` : formatDuration(durationSeconds);
  }
  return `${weight}lbs × ${reps} @ ${rir} RIR`;
}

export default function CompletedWorkout({
  workout,
  plannedExercises,
  loggedSets,
}: {
  workout: { id: string; routineId: string | null; focus: string; date: string; durationMins: number; summaryJson: any };
  plannedExercises: PlannedExercise[];
  loggedSets: LoggedSet[];
}) {
  const router = useRouter();
  const workingSets = loggedSets.filter((s) => !s.isWarmup);
  const totalSets = workingSets.length;
  const summary = workout.summaryJson as Summary | null;

  const header = (
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
  );

  // ── Rich summary view (workouts finished after #43) ───────────────────────
  if (summary?.exerciseSummaries) {
    const improved = summary.exerciseSummaries.filter((e) => e.progressionFlag === 'improved').length;
    const maintained = summary.exerciseSummaries.filter((e) => e.progressionFlag === 'maintained').length;
    const declined = summary.exerciseSummaries.filter((e) => e.progressionFlag === 'declined').length;
    const contextChange = summary.exerciseSummaries.filter((e) => e.progressionFlag === 'context_change').length;
    const skipped = summary.exerciseSummaries.filter((e) => e.status === 'skipped').length;

    let grade = '', gradeColor = '';
    if (declined === 0 && improved > 0) { grade = 'Strong session'; gradeColor = 'text-emerald-400'; }
    else if (declined === 0) { grade = 'Solid session — held your numbers'; gradeColor = 'text-zinc-200'; }
    else if (declined <= 1) { grade = 'Good session — minor dips noted'; gradeColor = 'text-yellow-400'; }
    else { grade = 'Tough session'; gradeColor = 'text-red-400'; }

    return (
      <div className="mx-auto max-w-2xl space-y-8 p-6 md:p-12">
        {header}

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <p className={`text-xl font-bold ${gradeColor}`}>{grade}</p>
          <div className="mt-3 flex flex-wrap gap-4 text-sm">
            {improved > 0 && <span className="text-emerald-400">↑ {improved} improved</span>}
            {maintained > 0 && <span className="text-zinc-400">→ {maintained} maintained</span>}
            {declined > 0 && <span className="text-red-400">↓ {declined} declined</span>}
            {contextChange > 0 && <span className="text-yellow-400">⇄ {contextChange} position change</span>}
            {skipped > 0 && <span className="text-zinc-600">○ {skipped} skipped</span>}
          </div>
        </div>

        {summary.deloadRecommended && (
          <div className="rounded-xl border border-yellow-700 bg-yellow-900/20 p-4">
            <p className="font-semibold text-yellow-400">Deload Recommended</p>
            <p className="mt-1 text-sm text-yellow-300/70">
              Multiple unexplained performance declines detected. Consider a{' '}
              <Tooltip definition={GLOSSARY.deload}>deload</Tooltip> week — reduce load by 40–50%,
              cut volume by half, keep <Tooltip definition={GLOSSARY.RIR}>RIR</Tooltip> high.
            </p>
          </div>
        )}

        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-200">Exercise Breakdown</h2>
          {summary.exerciseSummaries.map((ex: any) => (
            <div key={ex.exerciseName} className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
              <div className="flex items-center justify-between">
                <p className="font-medium text-white">{ex.exerciseName}</p>
                <span className={`text-xs font-medium ${
                  ex.progressionFlag === 'improved' ? 'text-emerald-400'
                  : ex.progressionFlag === 'maintained' ? 'text-zinc-400'
                  : ex.progressionFlag === 'declined' ? 'text-red-400'
                  : ex.progressionFlag === 'context_change' ? 'text-yellow-400'
                  : ex.progressionFlag === 'first_time' ? 'text-blue-400'
                  : 'text-zinc-600'
                }`}>
                  {ex.progressionFlag === 'improved' ? '↑ Improved'
                  : ex.progressionFlag === 'maintained' ? '→ Maintained'
                  : ex.progressionFlag === 'declined' ? '↓ Declined'
                  : ex.progressionFlag === 'context_change' ? '⇄ Position change'
                  : ex.progressionFlag === 'first_time' ? '★ First session'
                  : '○ Skipped'}
                </span>
              </div>

              {ex.planned && (
                <div className="mt-2 flex items-center gap-3 text-xs">
                  <span className="text-zinc-600">Planned:</span>
                  <span className="text-zinc-500">
                    {ex.planned.sets} sets · {ex.planned.repMin}–{ex.planned.repMax} reps · {ex.planned.rir} RIR
                  </span>
                  <span className="text-zinc-700">→</span>
                  <span className={ex.status === 'skipped' ? 'text-zinc-600' : ex.sets?.length >= ex.planned.sets ? 'text-emerald-400' : 'text-yellow-400'}>
                    {ex.status === 'skipped' ? 'Skipped' : `${ex.sets?.length} sets completed`}
                  </span>
                </div>
              )}

              {ex.restNote && (
                <p className="mt-1 text-xs text-yellow-400">⏱ {ex.restNote}</p>
              )}

              {ex.asymmetryFlag && (
                <div className={`mt-2 rounded-lg px-3 py-2 text-xs ${
                  ex.asymmetryFlag.level === 'significant'
                    ? 'bg-red-900/20 text-red-400'
                    : 'bg-yellow-900/20 text-yellow-400'
                }`}>
                  {ex.asymmetryFlag.level === 'significant' ? '🔴' : '⚠'} {ex.asymmetryFlag.pct}% asymmetry — {ex.asymmetryFlag.weakSide} side is weaker.
                  {ex.asymmetryFlag.level === 'significant'
                    ? ' Address before progressing weight.'
                    : ' Monitor over coming sessions.'}
                </div>
              )}

              {ex.progressionNote && (
                <p className="mt-1 text-xs text-zinc-500">{ex.progressionNote}</p>
              )}

              {ex.sets?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {ex.sets.map((s: any, i: number) => (
                    <span key={i} className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
                      {s.side ? `${s.side} ` : ''}{formatSetDisplay(s.weightLbs, s.reps, s.rir, s.durationSeconds)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="space-y-3">
          {!workout.routineId && (
            <button
              onClick={() => router.push(`/routines/new?fromWorkout=${workout.id}`)}
              className="w-full rounded-md border border-emerald-700 py-3 font-semibold text-emerald-400 hover:bg-emerald-950/40"
            >
              Save as Routine
            </button>
          )}
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full rounded-md bg-emerald-600 py-3 font-semibold text-white hover:bg-emerald-500"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ── Fallback static view (old workouts without summaryJson) ───────────────
  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6 md:p-12">
      {header}
      <div className="space-y-4">
        {plannedExercises.map((ex) => {
          const sets = workingSets.filter((s) => s.exerciseId === ex.exerciseId);
          const completed = sets.length >= ex.targetSets;
          return (
            <div key={ex.exerciseId} className={`rounded-xl border p-4 ${
              completed ? 'border-emerald-800 bg-emerald-950/20'
              : sets.length > 0 ? 'border-yellow-800 bg-yellow-950/10'
              : 'border-zinc-800 bg-zinc-900/30'
            }`}>
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
                    <span key={s.id} className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
                      {s.side ? `${s.side} ` : ''}
                      {ex.isAssisted ? `${s.weightLbs}lbs assist` : `${s.weightLbs}lbs`} × {s.reps} @ {s.rir} RIR
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="space-y-3">
          {!workout.routineId && (
            <button
              onClick={() => router.push(`/routines/new?fromWorkout=${workout.id}`)}
              className="w-full rounded-md border border-emerald-700 py-3 font-semibold text-emerald-400 hover:bg-emerald-950/40"
            >
              Save as Routine
            </button>
          )}
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full rounded-md bg-emerald-600 py-3 font-semibold text-white hover:bg-emerald-500"
          >
            Back to Dashboard
          </button>
        </div>
    </div>
  );
}