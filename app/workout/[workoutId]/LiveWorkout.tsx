'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { logSet, deleteSet, finishWorkout } from '../../actions/workout-session';

type PlannedExercise = {
  routineExerciseId: string;
  exerciseId: string;
  exerciseName: string;
  primaryMuscle: string;
  equipment: string;
  targetSets: number;
  targetRepMin: number;
  targetRepMax: number;
  targetRir: number;
  restTimerSecs: number;
  progressionStyle: string;
  plannedOrder: number;
  history: {
    lastWeight: number;
    lastReps: number;
    lastRir: number;
    lastDate: string;
    lastExecutionOrder: number;
    allSets: { weight: number; reps: number; rir: number }[];
  } | null;
};

type LoggedSet = {
  id: string;
  exerciseId: string;
  weightLbs: number;
  reps: number;
  rir: number;
  isWarmup: boolean;
  executionOrder: number;
};

type Summary = {
  exerciseSummaries: any[];
  deloadRecommended: boolean;
  totalSets: number;
  durationMins: number;
};

export default function LiveWorkout({
  workout,
  plannedExercises,
  loggedSets: initialLoggedSets,
  profileId,
}: {
  workout: { id: string; focus: string; date: string };
  plannedExercises: PlannedExercise[];
  loggedSets: LoggedSet[];
  profileId: string;
}) {
  const router = useRouter();
  const startTime = useRef(Date.now());

  const [loggedSets, setLoggedSets] = useState<LoggedSet[]>(initialLoggedSets);
  const [expandedExercise, setExpandedExercise] = useState<string | null>(
    plannedExercises[0]?.exerciseId ?? null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);

  // Rest timer state
  const [restTimer, setRestTimer] = useState<number | null>(null);
  const [restTarget, setRestTarget] = useState(120);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Per-exercise input state
  const [inputs, setInputs] = useState<Record<string, {
    weight: string;
    reps: string;
    rir: string;
    isWarmup: boolean;
  }>>({});

  // Execution order counter
  const executionOrderRef = useRef(0);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function startRestTimer(secs: number) {
    if (timerRef.current) clearInterval(timerRef.current);
    setRestTarget(secs);
    setRestTimer(secs);
    timerRef.current = setInterval(() => {
      setRestTimer((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timerRef.current!);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function getInput(exerciseId: string, history: PlannedExercise['history']) {
    if (inputs[exerciseId]) return inputs[exerciseId];
    return {
      weight: history ? String(history.lastWeight) : '',
      reps: '',
      rir: '',
      isWarmup: false,
    };
  }

  function updateInput(exerciseId: string, field: string, value: string | boolean) {
    setInputs((prev) => ({
      ...prev,
      [exerciseId]: {
        ...getInput(exerciseId, null),
        ...prev[exerciseId],
        [field]: value,
      },
    }));
  }

  async function handleLogSet(ex: PlannedExercise) {
    const input = getInput(ex.exerciseId, ex.history);
    const weight = parseFloat(input.weight);
    const reps = parseInt(input.reps);
    const rir = parseFloat(input.rir);

    if (isNaN(weight) || isNaN(reps) || isNaN(rir)) {
      alert('Fill in weight, reps, and RIR before logging.');
      return;
    }

    const execOrder = executionOrderRef.current++;

    const result = await logSet({
      workoutId: workout.id,
      exerciseId: ex.exerciseId,
      weightLbs: weight,
      reps,
      rir,
      isWarmup: input.isWarmup,
      executionOrder: execOrder,
    });

    if (result.success && result.setId) {
      setLoggedSets((prev) => [
        ...prev,
        {
          id: result.setId!,
          exerciseId: ex.exerciseId,
          weightLbs: weight,
          reps,
          rir,
          isWarmup: input.isWarmup,
          executionOrder: execOrder,
        },
      ]);

      // Clear reps and RIR, keep weight for next set
      setInputs((prev) => ({
        ...prev,
        [ex.exerciseId]: {
          ...prev[ex.exerciseId],
          weight: input.weight,
          reps: '',
          rir: '',
        },
      }));

      if (!input.isWarmup) {
        startRestTimer(ex.restTimerSecs);
      }
    }
  }

  async function handleDeleteSet(setId: string) {
    await deleteSet(setId);
    setLoggedSets((prev) => prev.filter((s) => s.id !== setId));
  }

  async function handleFinish() {
    setIsSubmitting(true);
    const durationMins = Math.round((Date.now() - startTime.current) / 60000);
    const result = await finishWorkout(workout.id, durationMins);

    if (result.success && result.summary) {
      setSummary(result.summary);
    } else {
      alert('Failed to finish workout.');
      setIsSubmitting(false);
    }
  }

  function getProgressionHint(ex: PlannedExercise, currentOrder: number) {
    if (!ex.history) return null;

    const lastOrder = ex.history.lastExecutionOrder;
    const positionChanged = Math.abs(lastOrder - currentOrder) >= 2;
    const hitTopOfRange = ex.history.lastReps >= ex.targetRepMax;
    const rirWasGood = ex.history.lastRir >= ex.targetRir;

    if (positionChanged) {
      const direction = currentOrder > lastOrder ? 'later' : 'earlier';
      return {
        type: 'context' as const,
        text: `Exercise ${direction} in session vs last time. ${
          direction === 'later' ? 'Expect slightly fewer reps.' : 'May perform better fresh.'
        }`,
      };
    }
    if (hitTopOfRange && rirWasGood) {
      return { type: 'increase' as const, text: `Hit ${ex.history.lastReps} reps last time — ready to add weight.` };
    }
    return {
      type: 'maintain' as const,
      text: `Last: ${ex.history.lastReps} reps @ ${ex.history.lastWeight}lbs (${ex.history.lastRir} RIR)`,
    };
  }

  // ── Summary Screen ────────────────────────────────────────────────────────

  if (summary) {
    const improved = summary.exerciseSummaries.filter((e) => e.progressionFlag === 'improved').length;
    const maintained = summary.exerciseSummaries.filter((e) => e.progressionFlag === 'maintained').length;
    const declined = summary.exerciseSummaries.filter((e) => e.progressionFlag === 'declined').length;
    const contextChange = summary.exerciseSummaries.filter((e) => e.progressionFlag === 'context_change').length;
    const skipped = summary.exerciseSummaries.filter((e) => e.status === 'skipped').length;

    let grade = '';
    let gradeColor = '';
    if (declined === 0 && improved > 0) { grade = 'Strong session'; gradeColor = 'text-emerald-400'; }
    else if (declined === 0) { grade = 'Solid session — held your numbers'; gradeColor = 'text-zinc-200'; }
    else if (declined <= 1) { grade = 'Good session — minor dips noted'; gradeColor = 'text-yellow-400'; }
    else { grade = 'Tough session'; gradeColor = 'text-red-400'; }

    return (
      <div className="mx-auto max-w-2xl space-y-8 p-6 md:p-12">
        <header className="border-b border-zinc-800 pb-6">
          <h1 className="text-3xl font-bold text-white">Session Complete</h1>
          <p className="mt-1 text-zinc-400">{summary.durationMins} mins · {summary.totalSets} working sets</p>
        </header>

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
              Multiple unexplained performance declines detected. Consider scheduling a deload week — reduce load by 40-50%, cut volume by half, keep RIR high.
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
              {ex.progressionNote && (
                <p className="mt-1 text-xs text-zinc-500">{ex.progressionNote}</p>
              )}
              {ex.sets?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {ex.sets.map((s: any, i: number) => (
                    <span key={i} className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
                      {s.weight}lbs × {s.reps} @ {s.rir} RIR
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
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

  // ── Live Workout Screen ───────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 pb-32 md:p-8">

      {/* Header */}
      <header className="flex items-center justify-between border-b border-zinc-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{workout.focus}</h1>
          <p className="text-sm text-zinc-400">
            {new Date(workout.date).toLocaleDateString('en-US', {
              weekday: 'long', month: 'short', day: 'numeric',
            })}
          </p>
        </div>
        <button
          onClick={handleFinish}
          disabled={isSubmitting}
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {isSubmitting ? 'Saving...' : 'Finish'}
        </button>
      </header>

      {/* Rest Timer Banner */}
      {restTimer !== null && (
        <div className="sticky top-0 z-20 rounded-xl border border-zinc-700 bg-zinc-900/95 p-4 backdrop-blur">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-500">Rest Timer</p>
              <p className="text-3xl font-bold tabular-nums text-emerald-400">
                {Math.floor(restTimer / 60)}:{String(restTimer % 60).padStart(2, '0')}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => startRestTimer(restTarget)}
                className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:border-zinc-500"
              >
                Reset
              </button>
              <button
                onClick={() => {
                  if (timerRef.current) clearInterval(timerRef.current);
                  setRestTimer(null);
                }}
                className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:border-zinc-500"
              >
                Skip
              </button>
            </div>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-1000"
              style={{ width: `${((restTarget - restTimer) / restTarget) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Exercise List */}
      {plannedExercises.map((ex, index) => {
        const setsForExercise = loggedSets.filter(
          (s) => s.exerciseId === ex.exerciseId && !s.isWarmup
        );
        const isComplete = setsForExercise.length >= ex.targetSets;
        const isExpanded = expandedExercise === ex.exerciseId;
        const input = getInput(ex.exerciseId, ex.history);
        const hint = getProgressionHint(ex, index);

        return (
          <div
            key={ex.exerciseId}
            className={`rounded-xl border transition-colors ${
              isComplete
                ? 'border-emerald-700 bg-emerald-950/20'
                : isExpanded
                ? 'border-zinc-600 bg-zinc-900'
                : 'border-zinc-800 bg-zinc-900/30'
            }`}
          >
            {/* Exercise Header — tap to expand */}
            <button
              className="flex w-full items-center justify-between p-4 text-left"
              onClick={() => setExpandedExercise(isExpanded ? null : ex.exerciseId)}
            >
              <div className="flex items-center gap-3">
                <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                  isComplete ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-400'
                }`}>
                  {isComplete ? '✓' : index + 1}
                </span>
                <div>
                  <p className={`font-semibold ${isComplete ? 'text-emerald-300' : 'text-white'}`}>
                    {ex.exerciseName}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {setsForExercise.length}/{ex.targetSets} sets · {ex.targetRepMin}–{ex.targetRepMax} reps · {ex.targetRir} RIR
                  </p>
                </div>
              </div>
              <span className="text-zinc-600">{isExpanded ? '▲' : '▼'}</span>
            </button>

            {/* Expanded Content */}
            {isExpanded && (
              <div className="space-y-4 border-t border-zinc-800 p-4">

                {/* History / Progression Hint */}
                {hint && (
                  <div className={`rounded-lg p-3 text-xs ${
                    hint.type === 'increase' ? 'bg-emerald-900/30 text-emerald-400'
                    : hint.type === 'context' ? 'bg-yellow-900/30 text-yellow-400'
                    : 'bg-zinc-800/50 text-zinc-400'
                  }`}>
                    {hint.text}
                  </div>
                )}

                {/* Previous sets for reference */}
                {ex.history && (
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs text-zinc-600">Last session:</span>
                    {ex.history.allSets.map((s, i) => (
                      <span key={i} className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
                        {s.weight}lbs × {s.reps}
                      </span>
                    ))}
                  </div>
                )}

                {/* Logged sets this session */}
                {setsForExercise.length > 0 && (
                  <div className="space-y-1">
                    {setsForExercise.map((s, i) => (
                      <div key={s.id} className="flex items-center justify-between rounded-md bg-zinc-800/50 px-3 py-2">
                        <span className="text-xs text-zinc-400">Set {i + 1}</span>
                        <span className="text-sm font-medium text-white">
                          {s.weightLbs}lbs × {s.reps} @ {s.rir} RIR
                          {s.isWarmup && <span className="ml-1 text-xs text-zinc-500">(warmup)</span>}
                        </span>
                        <button
                          onClick={() => handleDeleteSet(s.id)}
                          className="text-xs text-zinc-600 hover:text-red-400"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Input Row */}
                {!isComplete && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="mb-1 block text-xs text-zinc-500">Weight (lbs)</label>
                        <input
                          type="number"
                          step="2.5"
                          value={input.weight}
                          onChange={(e) => updateInput(ex.exerciseId, 'weight', e.target.value)}
                          className="w-full rounded-md border border-zinc-700 bg-zinc-950 p-2 text-center text-sm text-white focus:border-emerald-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-zinc-500">Reps</label>
                        <input
                          type="number"
                          value={input.reps}
                          onChange={(e) => updateInput(ex.exerciseId, 'reps', e.target.value)}
                          className="w-full rounded-md border border-zinc-700 bg-zinc-950 p-2 text-center text-sm text-white focus:border-emerald-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-zinc-500">RIR</label>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="5"
                          value={input.rir}
                          onChange={(e) => updateInput(ex.exerciseId, 'rir', e.target.value)}
                          className="w-full rounded-md border border-zinc-700 bg-zinc-950 p-2 text-center text-sm text-white focus:border-emerald-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 text-xs text-zinc-500">
                        <input
                          type="checkbox"
                          checked={input.isWarmup}
                          onChange={(e) => updateInput(ex.exerciseId, 'isWarmup', e.target.checked)}
                          className="rounded"
                        />
                        Warmup set
                      </label>
                    </div>

                    <button
                      onClick={() => handleLogSet(ex)}
                      className="w-full rounded-md bg-zinc-700 py-2.5 text-sm font-semibold text-white hover:bg-zinc-600"
                    >
                      Log Set {setsForExercise.length + 1} of {ex.targetSets}
                    </button>
                  </div>
                )}

                {isComplete && (
                  <p className="text-center text-sm text-emerald-400">
                    ✓ All {ex.targetSets} sets complete
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Finish Button (bottom) */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-zinc-800 bg-zinc-950/95 p-4 backdrop-blur">
        <div className="mx-auto max-w-2xl">
          <button
            onClick={handleFinish}
            disabled={isSubmitting}
            className="w-full rounded-md bg-emerald-600 py-3 font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {isSubmitting ? 'Saving...' : 'Finish Workout'}
          </button>
        </div>
      </div>
    </div>
  );
}