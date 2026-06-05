'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { logSet, deleteSet, getSubstituteExercises } from '../../actions/workout-session';

type LoggedSet = {
  id: string;
  exerciseId: string;
  weightLbs: number;
  reps: number;
  rir: number;
  isWarmup: boolean;
  executionOrder: number;
  setType: string;
  setGroupId: string | null;
  side: string | null;
};

type PlannedExercise = {
  routineExerciseId: string;
  exerciseId: string;
  exerciseName: string;
  primaryMuscle: string;
  equipment: string;
  isUnilateral: boolean;
  isAssisted: boolean;
  isBodyweight: boolean;
  targetSets: number;
  targetRepMin: number;
  targetRepMax: number;
  targetRir: number;
  restTimerSecs: number;
  progressionStyle: string | null;
  plannedOrder: number;
  history: {
    lastWeight: number;
    lastReps: number;
    lastRir: number;
    lastDate: string;
    allSets: { weight: number; reps: number; rir: number }[];
  } | null;
};

type WorkoutSummary = {
  exerciseSummaries: any[];
  deloadRecommended: boolean;
  totalSets: number;
  durationMins: number;
};

// Per-exercise input state
type ExInputs = {
  weight: string;
  reps: string;
  rir: string;
  isWarmup: boolean;
};

export default function LiveWorkout({
  workout,
  plannedExercises,
  loggedSets: initialLoggedSets,
  profileId,
  currentBodyweight,
}: {
  workout: { id: string; focus: string; date: string };
  plannedExercises: PlannedExercise[];
  loggedSets: LoggedSet[];
  profileId: string;
  currentBodyweight: number | null;
}) {
  const router = useRouter();
  const [sets, setSets] = useState<LoggedSet[]>(initialLoggedSets);

  // Which exercise card is expanded
  const [expandedId, setExpandedId] = useState<string | null>(
    plannedExercises[0]?.exerciseId ?? null
  );

  // Per-exercise input state keyed by exerciseId
  const [inputs, setInputs] = useState<Record<string, ExInputs>>(() => {
    const init: Record<string, ExInputs> = {};
    for (const ex of plannedExercises) {
      init[ex.exerciseId] = {
        weight: ex.history ? String(ex.history.lastWeight) : '',
        reps: ex.history ? String(ex.history.lastReps) : String(ex.targetRepMin),
        rir: String(ex.targetRir),
        isWarmup: false,
      };
    }
    return init;
  });

  const [saving, setSaving] = useState<string | null>(null); // exerciseId being saved
  const [flash, setFlash] = useState<string | null>(null);   // exerciseId flashing

  // Rest timer
  const [restTimer, setRestTimer] = useState<number | null>(null);
  const [restActive, setRestActive] = useState(false);
  const [restLabel, setRestLabel] = useState('');
  const restRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Next side for unilateral exercises
  const [nextSide, setNextSide] = useState<Record<string, 'LEFT' | 'RIGHT'>>({});

  // Substitute picker
  const [substituteFor, setSubstituteFor] = useState<string | null>(null);
  const [substitutes, setSubstitutes] = useState<any[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(false);

  const [startTime] = useState(() => Date.now());
  const [finishing, setFinishing] = useState(false);
  const [summary, setSummary] = useState<WorkoutSummary | null>(null);

  // Rest timer countdown
  useEffect(() => {
    if (restActive && restTimer !== null && restTimer > 0) {
      restRef.current = setInterval(() => {
        setRestTimer((t) => {
          if (t === null || t <= 1) {
            setRestActive(false);
            clearInterval(restRef.current!);
            return null;
          }
          return t - 1;
        });
      }, 1000);
    }
    return () => { if (restRef.current) clearInterval(restRef.current); };
  }, [restActive]);

  function startRestTimer(secs: number, label: string) {
    if (restRef.current) clearInterval(restRef.current);
    setRestLabel(label);
    setRestTimer(secs);
    setRestActive(true);
  }

  function updateInput(exerciseId: string, field: keyof ExInputs, value: string | boolean) {
    setInputs((prev) => ({
      ...prev,
      [exerciseId]: { ...prev[exerciseId], [field]: value },
    }));
  }

  function getWorkingSets(exerciseId: string) {
    return sets.filter((s) => s.exerciseId === exerciseId && !s.isWarmup);
  }

  async function handleLogSet(ex: PlannedExercise) {
    const inp = inputs[ex.exerciseId];
    if (!inp || saving) return;
    const w = parseFloat(inp.weight);
    const r = parseInt(inp.reps);
    const ri = parseInt(inp.rir);
    if (isNaN(w) || isNaN(r) || isNaN(ri)) return;

    setSaving(ex.exerciseId);

    let side: string | null = null;
    if (ex.isUnilateral) {
      const current = nextSide[ex.exerciseId] ?? 'LEFT';
      side = current;
      setNextSide((prev) => ({
        ...prev,
        [ex.exerciseId]: current === 'LEFT' ? 'RIGHT' : 'LEFT',
      }));
    }

    const result = await logSet({
      workoutId: workout.id,
      exerciseId: ex.exerciseId,
      weightLbs: w,
      reps: r,
      rir: ri,
      isWarmup: inp.isWarmup,
      executionOrder: ex.plannedOrder,
      setType: 'STRAIGHT',
      setGroupId: null,
      side,
      assistanceWeightLbs: ex.isAssisted ? w : null,
      bodyweightLbs: (ex.isAssisted || ex.isBodyweight) ? currentBodyweight : null,
    });

    if (result.success && result.setId) {
      const newSet: LoggedSet = {
        id: result.setId,
        exerciseId: ex.exerciseId,
        weightLbs: w,
        reps: r,
        rir: ri,
        isWarmup: inp.isWarmup,
        executionOrder: ex.plannedOrder,
        setType: 'STRAIGHT',
        setGroupId: null,
        side,
      };
      setSets((prev) => [...prev, newSet]);

      // Flash the card
      setFlash(ex.exerciseId);
      setTimeout(() => setFlash(null), 1000);

      // Keep weight, update reps/rir for next set
      updateInput(ex.exerciseId, 'isWarmup', false);

      if (!inp.isWarmup) {
        startRestTimer(ex.restTimerSecs, ex.exerciseName);

        // Auto-advance to next incomplete exercise
        const working = getWorkingSets(ex.exerciseId).length + 1;
        if (working >= ex.targetSets) {
          const next = plannedExercises.find((e) => {
            if (e.exerciseId === ex.exerciseId) return false;
            const ws = getWorkingSets(e.exerciseId);
            return ws.length < e.targetSets;
          });
          if (next) setExpandedId(next.exerciseId);
        }
      }
    }
    setSaving(null);
  }

  async function handleDeleteSet(setId: string) {
    await deleteSet(setId);
    setSets((prev) => prev.filter((s) => s.id !== setId));
  }

  async function handleSwap(ex: PlannedExercise) {
    setSubstituteFor(ex.exerciseId);
    setLoadingSubs(true);
    const result = await getSubstituteExercises(ex.exerciseId, ex.primaryMuscle, ex.equipment);
    setSubstitutes(result.substitutes ?? []);
    setLoadingSubs(false);
  }

  async function handleFinish() {
    if (finishing) return;
    setFinishing(true);
    const durationMins = Math.max(1, Math.round((Date.now() - startTime) / 60000));
    try {
      const res = await fetch('/api/finish-workout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workoutId: workout.id, durationMins }),
      });
      const result = await res.json();
      if (result.success && result.summary) {
        setSummary(result.summary as WorkoutSummary);
      } else {
        router.push('/dashboard');
      }
    } catch {
      router.push('/dashboard');
    }
  }

  // ── Post-workout summary ──────────────────────────────────────────────────
  if (summary) {
    return (
      <div className="mx-auto max-w-lg space-y-6 px-4 py-8">
        <div className="text-center">
          <p className="text-4xl">🏁</p>
          <h1 className="mt-2 text-2xl font-bold text-white">Workout Complete</h1>
          <p className="text-zinc-400">{summary.durationMins} mins · {summary.totalSets} working sets</p>
          {summary.deloadRecommended && (
            <p className="mt-2 rounded-lg bg-red-950/40 px-4 py-2 text-sm text-red-300">
              ⚠ Multiple declined lifts — consider a deload next session.
            </p>
          )}
        </div>

        <div className="space-y-3">
          {summary.exerciseSummaries.map((ex: any, i: number) => (
            <div key={i} className={`rounded-xl border p-4 ${
              ex.status === 'skipped' ? 'border-zinc-800 bg-zinc-900/20'
              : ex.progressionFlag === 'improved' ? 'border-emerald-800 bg-emerald-950/20'
              : ex.progressionFlag === 'declined' ? 'border-red-800 bg-red-950/20'
              : 'border-zinc-700 bg-zinc-900/30'
            }`}>
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-white">{ex.exerciseName}</p>
                <span className={`shrink-0 text-xs font-medium ${
                  ex.status === 'skipped' ? 'text-zinc-500'
                  : ex.progressionFlag === 'improved' ? 'text-emerald-400'
                  : ex.progressionFlag === 'declined' ? 'text-red-400'
                  : ex.progressionFlag === 'first_time' ? 'text-blue-400'
                  : 'text-zinc-400'
                }`}>
                  {ex.status === 'skipped' ? '○ Skipped'
                  : ex.progressionFlag === 'improved' ? '↑ Improved'
                  : ex.progressionFlag === 'declined' ? '↓ Declined'
                  : ex.progressionFlag === 'first_time' ? '★ First time'
                  : '→ Maintained'}
                </span>
              </div>
              {ex.status !== 'skipped' && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {ex.sets.map((s: any, j: number) => (
                    <span key={j} className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
                      {s.side ? `${s.side} ` : ''}{s.weight}lbs × {s.reps} @ {s.rir} RIR
                    </span>
                  ))}
                </div>
              )}
              {ex.progressionNote ? <p className="mt-1 text-xs text-zinc-400">{ex.progressionNote}</p> : null}
              {ex.restNote ? <p className="mt-1 text-xs text-yellow-400">{ex.restNote}</p> : null}
              {ex.asymmetryFlag ? (
                <p className={`mt-1 text-xs ${ex.asymmetryFlag.level === 'significant' ? 'text-red-400' : 'text-yellow-400'}`}>
                  {ex.asymmetryFlag.level === 'significant' ? '🔴' : '⚠'} {ex.asymmetryFlag.weakSide} side {ex.asymmetryFlag.pct}% weaker
                </p>
              ) : null}
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

  // ── Substitute picker ─────────────────────────────────────────────────────
  if (substituteFor) {
    const orig = plannedExercises.find((e) => e.exerciseId === substituteFor);
    return (
      <div className="mx-auto max-w-lg space-y-4 px-4 py-8">
        <button onClick={() => setSubstituteFor(null)} className="text-sm text-zinc-400 hover:text-white">← Back</button>
        <h2 className="text-lg font-bold text-white">Swap: {orig?.exerciseName}</h2>
        {loadingSubs ? (
          <p className="text-zinc-400">Loading…</p>
        ) : substitutes.length === 0 ? (
          <p className="text-zinc-400">No substitutes found for this muscle + movement pattern.</p>
        ) : (
          <div className="space-y-2">
            {substitutes.map((sub) => (
              <button
                key={sub.id}
                onClick={() => setSubstituteFor(null)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 p-3 text-left hover:border-zinc-500"
              >
                <p className="font-medium text-white">{sub.name}</p>
                <p className="text-xs text-zinc-500">{sub.equipment} · {sub.movementPattern}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Main workout screen ───────────────────────────────────────────────────
  const totalWorking = sets.filter((s) => !s.isWarmup).length;

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-8">

      {/* Rest timer — sticky banner */}
      {restTimer !== null && (
        <div className="sticky top-2 z-10 flex items-center justify-between rounded-lg bg-zinc-800 px-4 py-2 shadow-lg">
          <span className="text-sm text-zinc-300 truncate mr-2">{restLabel}</span>
          <span className={`font-mono text-lg font-bold shrink-0 ${restTimer <= 10 ? 'text-red-400' : 'text-emerald-400'}`}>
            {Math.floor(restTimer / 60)}:{String(restTimer % 60).padStart(2, '0')}
          </span>
          <button
            onClick={() => { setRestTimer(null); setRestActive(false); }}
            className="ml-3 text-xs text-zinc-500 hover:text-white shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-zinc-800 pb-4">
        <p className="text-sm text-zinc-500">
          {new Date(workout.date.slice(0, 10) + 'T12:00:00').toLocaleDateString('en-US', {
            weekday: 'long', month: 'long', day: 'numeric',
          })}
        </p>
        <h1 className="mt-1 text-3xl font-bold text-white">{workout.focus}</h1>
        <p className="mt-1 text-zinc-400">{totalWorking} working sets logged</p>
      </header>

      {/* Exercise cards */}
      <div className="space-y-3">
        {plannedExercises.map((ex) => {
          const working = getWorkingSets(ex.exerciseId);
          const allMySets = sets.filter((s) => s.exerciseId === ex.exerciseId);
          const done = working.length >= ex.targetSets;
          const partial = working.length > 0 && !done;
          const expanded = expandedId === ex.exerciseId;
          const inp = inputs[ex.exerciseId] ?? { weight: '', reps: String(ex.targetRepMin), rir: String(ex.targetRir), isWarmup: false };
          const isSaving = saving === ex.exerciseId;
          const isFlashing = flash === ex.exerciseId;
          const currentSide = nextSide[ex.exerciseId] ?? 'LEFT';

          return (
            <div
              key={ex.exerciseId}
              className={`rounded-xl border transition-colors ${
                isFlashing ? 'border-emerald-500 bg-emerald-950/30'
                : done ? 'border-emerald-800 bg-emerald-950/20'
                : partial ? 'border-yellow-800 bg-yellow-950/10'
                : expanded ? 'border-zinc-600 bg-zinc-900/60'
                : 'border-zinc-800 bg-zinc-900/30'
              }`}
            >
              {/* Card header — always visible, tap to expand/collapse */}
              <button
                className="w-full p-4 text-left"
                onClick={() => setExpandedId(expanded ? null : ex.exerciseId)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-white">{ex.exerciseName}</p>
                    <p className="text-xs text-zinc-500">
                      {working.length}/{ex.targetSets} sets · {ex.targetRepMin}–{ex.targetRepMax} reps · {ex.targetRir} RIR
                      {ex.isUnilateral && expanded ? ` · Next: ${currentSide}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium ${
                      done ? 'text-emerald-400' : partial ? 'text-yellow-400' : 'text-zinc-600'
                    }`}>
                      {done ? '✓ Done' : partial ? `${working.length}/${ex.targetSets}` : '○'}
                    </span>
                    <span className="text-zinc-600 text-xs">{expanded ? '▲' : '▼'}</span>
                  </div>
                </div>
              </button>

              {/* Expanded panel */}
              {expanded && (
                <div className="border-t border-zinc-800 px-4 pb-4 pt-3 space-y-3">

                  {/* Last session hint */}
                  {ex.history && (
                    <div className="rounded-lg bg-zinc-900 px-3 py-2">
                      <p className="text-xs text-zinc-500 mb-1">Last session</p>
                      <div className="flex flex-wrap gap-1">
                        {ex.history.allSets.map((s, i) => (
                          <span key={i} className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
                            {s.weight}lbs × {s.reps} @ {s.rir} RIR
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Already logged sets */}
                  {allMySets.length > 0 && (
                    <div className="space-y-1">
                      {allMySets.map((s, i) => {
                        const setNum = s.isWarmup
                          ? 'W'
                          : String(allMySets.filter((x, j) => j <= i && !x.isWarmup).length);
                        return (
                          <div key={s.id} className={`flex items-center justify-between rounded px-3 py-1.5 ${s.isWarmup ? 'bg-zinc-900/50' : 'bg-zinc-900'}`}>
                            <span className={`text-sm ${s.isWarmup ? 'text-zinc-500' : 'text-zinc-300'}`}>
                              {setNum}{s.side ? ` · ${s.side}` : ''} · {s.weightLbs}lbs × {s.reps} @ {s.rir} RIR
                            </span>
                            <button
                              onClick={() => handleDeleteSet(s.id)}
                              className="text-xs text-zinc-600 hover:text-red-400 ml-2"
                            >
                              ✕
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Inputs */}
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="mb-1 block text-xs text-zinc-500">
                        {ex.isAssisted ? 'Assist lbs' : ex.isBodyweight ? 'Added lbs' : 'Weight lbs'}
                      </label>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={inp.weight}
                        onChange={(e) => updateInput(ex.exerciseId, 'weight', e.target.value)}
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white focus:border-zinc-500 focus:outline-none"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-zinc-500">Reps</label>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={inp.reps}
                        onChange={(e) => updateInput(ex.exerciseId, 'reps', e.target.value)}
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white focus:border-zinc-500 focus:outline-none"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-zinc-500">RIR</label>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={inp.rir}
                        onChange={(e) => updateInput(ex.exerciseId, 'rir', e.target.value)}
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white focus:border-zinc-500 focus:outline-none"
                        placeholder="1"
                      />
                    </div>
                  </div>

                  {/* Warmup + bodyweight hint */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => updateInput(ex.exerciseId, 'isWarmup', !inp.isWarmup)}
                      className={`rounded px-3 py-1 text-xs font-medium transition ${inp.isWarmup ? 'bg-yellow-600/30 text-yellow-300' : 'bg-zinc-800 text-zinc-500'}`}
                    >
                      Warmup
                    </button>
                    {(ex.isBodyweight || ex.isAssisted) && currentBodyweight && (
                      <span className="text-xs text-zinc-500">BW: {currentBodyweight}lbs</span>
                    )}
                    <button
                      onClick={() => handleSwap(ex)}
                      className="ml-auto text-xs text-zinc-500 hover:text-zinc-300"
                    >
                      Swap exercise
                    </button>
                  </div>

                  {/* Log set button */}
                  <button
                    onClick={() => handleLogSet(ex)}
                    disabled={isSaving}
                    className={`w-full rounded-lg py-2.5 font-semibold transition ${
                      isFlashing
                        ? 'bg-emerald-500 text-white'
                        : 'bg-emerald-700 text-white hover:bg-emerald-600'
                    }`}
                  >
                    {isFlashing ? '✓ Logged' : isSaving ? 'Saving…' : inp.isWarmup ? 'Log Warmup Set' : 'Log Set'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={handleFinish}
        disabled={finishing}
        className="w-full rounded-md bg-red-700 py-3 font-semibold text-white hover:bg-red-600 disabled:opacity-50"
      >
        {finishing ? 'Finishing…' : 'Finish Workout'}
      </button>
    </div>
  );
}