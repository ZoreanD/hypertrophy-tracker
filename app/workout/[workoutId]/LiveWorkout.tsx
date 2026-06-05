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
  const [selectedExId, setSelectedExId] = useState<string | null>(null);
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [rir, setRir] = useState('1');
  const [isWarmup, setIsWarmup] = useState(false);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [restTimer, setRestTimer] = useState<number | null>(null);
  const [restActive, setRestActive] = useState(false);
  const restRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [startTime] = useState(() => Date.now());
  const [finishing, setFinishing] = useState(false);
  const [summary, setSummary] = useState<WorkoutSummary | null>(null);
  const [substituteFor, setSubstituteFor] = useState<string | null>(null);
  const [substitutes, setSubstitutes] = useState<any[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [nextSide, setNextSide] = useState<Record<string, 'LEFT' | 'RIGHT'>>({});

  const selectedEx = plannedExercises.find((e) => e.exerciseId === selectedExId) ?? null;

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

  function startRestTimer(secs: number) {
    if (restRef.current) clearInterval(restRef.current);
    setRestTimer(secs);
    setRestActive(true);
  }

  function getWorkingSets(exerciseId: string) {
    return sets.filter((s) => s.exerciseId === exerciseId && !s.isWarmup);
  }

  function getLastSuggestedWeight(ex: PlannedExercise): string {
    const mySets = sets.filter((s) => s.exerciseId === ex.exerciseId && !s.isWarmup);
    if (mySets.length > 0) return String(mySets[mySets.length - 1].weightLbs);
    if (ex.history) return String(ex.history.lastWeight);
    return '';
  }

  function openExercise(ex: PlannedExercise) {
    setSelectedExId(ex.exerciseId);
    setWeight(getLastSuggestedWeight(ex));
    setReps(ex.history ? String(ex.history.lastReps) : String(ex.targetRepMin));
    setRir(String(ex.targetRir));
    setIsWarmup(false);
    setFlash(null);
  }

  async function handleLogSet() {
    if (!selectedEx || saving) return;
    const w = parseFloat(weight);
    const r = parseInt(reps);
    const ri = parseInt(rir);
    if (isNaN(w) || isNaN(r) || isNaN(ri)) return;

    setSaving(true);
    const workingSets = getWorkingSets(selectedEx.exerciseId);
    const executionOrder = selectedEx.plannedOrder;

    // Determine side for unilateral
    let side: string | null = null;
    if (selectedEx.isUnilateral) {
      const current = nextSide[selectedEx.exerciseId] ?? 'LEFT';
      side = current;
      setNextSide((prev) => ({
        ...prev,
        [selectedEx.exerciseId]: current === 'LEFT' ? 'RIGHT' : 'LEFT',
      }));
    }

    const result = await logSet({
      workoutId: workout.id,
      exerciseId: selectedEx.exerciseId,
      weightLbs: w,
      reps: r,
      rir: ri,
      isWarmup,
      executionOrder,
      setType: 'STRAIGHT',
      setGroupId: null,
      side,
      assistanceWeightLbs: selectedEx.isAssisted ? w : null,
      bodyweightLbs: (selectedEx.isAssisted || selectedEx.isBodyweight) ? currentBodyweight : null,
    });

    if (result.success && result.setId) {
      const newSet: LoggedSet = {
        id: result.setId,
        exerciseId: selectedEx.exerciseId,
        weightLbs: w,
        reps: r,
        rir: ri,
        isWarmup,
        executionOrder,
        setType: 'STRAIGHT',
        setGroupId: null,
        side,
      };
      setSets((prev) => [...prev, newSet]);
      setFlash('✓ Logged');
      setTimeout(() => setFlash(null), 1200);
      if (!isWarmup) startRestTimer(selectedEx.restTimerSecs);
    }
    setSaving(false);
  }

  async function handleDeleteSet(setId: string) {
    await deleteSet(setId);
    setSets((prev) => prev.filter((s) => s.id !== setId));
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

  async function handleSwap(ex: PlannedExercise) {
    setSubstituteFor(ex.exerciseId);
    setLoadingSubs(true);
    const result = await getSubstituteExercises(ex.exerciseId, ex.primaryMuscle, ex.equipment);
    setSubstitutes(result.substitutes ?? []);
    setLoadingSubs(false);
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
              {ex.progressionNote ? (
                <p className="mt-1 text-xs text-zinc-400">{ex.progressionNote}</p>
              ) : null}
              {ex.restNote ? (
                <p className="mt-1 text-xs text-yellow-400">{ex.restNote}</p>
              ) : null}
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

  // ── Substitute picker modal ───────────────────────────────────────────────
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
                onClick={() => {
                  // Swap exerciseId in plannedExercises in-place (client-only visual swap)
                  // In a full impl this would update the DB; for now just close
                  setSubstituteFor(null);
                }}
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

  // ── Set logging panel ─────────────────────────────────────────────────────
  if (selectedEx) {
    const workingSets = getWorkingSets(selectedEx.exerciseId);
    const allMySets = sets.filter((s) => s.exerciseId === selectedEx.exerciseId);
    const currentSide = nextSide[selectedEx.exerciseId] ?? 'LEFT';

    return (
      <div className="mx-auto max-w-lg space-y-6 px-4 py-8">
        {/* Rest timer banner */}
        {restTimer !== null && (
          <div className="flex items-center justify-between rounded-lg bg-zinc-800 px-4 py-2">
            <span className="text-sm text-zinc-300">Rest timer</span>
            <span className={`font-mono text-lg font-bold ${restTimer <= 10 ? 'text-red-400' : 'text-emerald-400'}`}>
              {Math.floor(restTimer / 60)}:{String(restTimer % 60).padStart(2, '0')}
            </span>
            <button onClick={() => { setRestTimer(null); setRestActive(false); }} className="text-xs text-zinc-500 hover:text-white">Dismiss</button>
          </div>
        )}

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <button onClick={() => setSelectedExId(null)} className="mb-1 text-sm text-zinc-400 hover:text-white">← All exercises</button>
            <h2 className="text-xl font-bold text-white">{selectedEx.exerciseName}</h2>
            <p className="text-xs text-zinc-500">
              Target: {selectedEx.targetSets} sets · {selectedEx.targetRepMin}–{selectedEx.targetRepMax} reps · {selectedEx.targetRir} RIR
              {selectedEx.isUnilateral ? ` · Next: ${currentSide}` : ''}
            </p>
          </div>
          <button
            onClick={() => handleSwap(selectedEx)}
            className="shrink-0 rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-400 hover:border-zinc-500 hover:text-white"
          >
            Swap
          </button>
        </div>

        {/* History hint */}
        {selectedEx.history && (
          <div className="rounded-lg bg-zinc-900 px-4 py-3">
            <p className="text-xs text-zinc-500 mb-1">Last session</p>
            <div className="flex flex-wrap gap-1">
              {selectedEx.history.allSets.map((s, i) => (
                <span key={i} className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
                  {s.weight}lbs × {s.reps} @ {s.rir} RIR
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Already logged sets */}
        {allMySets.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Logged sets</p>
            {allMySets.map((s, i) => (
              <div key={s.id} className={`flex items-center justify-between rounded-lg px-3 py-2 ${s.isWarmup ? 'bg-zinc-900/50 text-zinc-500' : 'bg-zinc-900'}`}>
                <span className="text-sm text-zinc-300">
                  {s.isWarmup ? 'W' : i + 1 - allMySets.filter((x, j) => j < i && x.isWarmup).length}
                  {s.side ? ` · ${s.side}` : ''} · {s.weightLbs}lbs × {s.reps} @ {s.rir} RIR
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

        {/* Input form */}
        <div className="space-y-4 rounded-xl border border-zinc-700 bg-zinc-900/50 p-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs text-zinc-500">
                {selectedEx.isAssisted ? 'Assist lbs' : selectedEx.isBodyweight ? 'Added lbs' : 'Weight lbs'}
              </label>
              <input
                type="number"
                inputMode="decimal"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white focus:border-zinc-500 focus:outline-none"
                placeholder="0"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Reps</label>
              <input
                type="number"
                inputMode="numeric"
                value={reps}
                onChange={(e) => setReps(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white focus:border-zinc-500 focus:outline-none"
                placeholder="0"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">RIR</label>
              <input
                type="number"
                inputMode="numeric"
                value={rir}
                onChange={(e) => setRir(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white focus:border-zinc-500 focus:outline-none"
                placeholder="1"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsWarmup((v) => !v)}
              className={`rounded px-3 py-1 text-xs font-medium transition ${isWarmup ? 'bg-yellow-600/30 text-yellow-300' : 'bg-zinc-800 text-zinc-500'}`}
            >
              Warmup
            </button>
            {selectedEx.isBodyweight && currentBodyweight && (
              <span className="text-xs text-zinc-500">BW: {currentBodyweight}lbs</span>
            )}
          </div>

          <button
            onClick={handleLogSet}
            disabled={saving}
            className={`relative w-full rounded-lg py-3 font-semibold transition ${
              flash ? 'bg-emerald-600 text-white' : 'bg-emerald-700 text-white hover:bg-emerald-600'
            }`}
          >
            {flash ?? (saving ? 'Saving…' : 'Log Set')}
          </button>
        </div>

        {/* Progress indicator */}
        <p className="text-center text-sm text-zinc-500">
          {workingSets.length} / {selectedEx.targetSets} working sets
          {workingSets.length >= selectedEx.targetSets ? ' ✓' : ''}
        </p>
      </div>
    );
  }

  // ── Exercise list ─────────────────────────────────────────────────────────
  const totalWorking = sets.filter((s) => !s.isWarmup).length;

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-8">
      {/* Rest timer banner persists on list view too */}
      {restTimer !== null && (
        <div className="flex items-center justify-between rounded-lg bg-zinc-800 px-4 py-2">
          <span className="text-sm text-zinc-300">Rest timer</span>
          <span className={`font-mono text-lg font-bold ${restTimer <= 10 ? 'text-red-400' : 'text-emerald-400'}`}>
            {Math.floor(restTimer / 60)}:{String(restTimer % 60).padStart(2, '0')}
          </span>
          <button onClick={() => { setRestTimer(null); setRestActive(false); }} className="text-xs text-zinc-500 hover:text-white">Dismiss</button>
        </div>
      )}

      <header className="border-b border-zinc-800 pb-4">
        <p className="text-sm text-zinc-500">
          {new Date(workout.date.slice(0, 10) + 'T12:00:00').toLocaleDateString('en-US', {
            weekday: 'long', month: 'long', day: 'numeric',
          })}
        </p>
        <h1 className="mt-1 text-3xl font-bold text-white">{workout.focus}</h1>
        <p className="mt-1 text-zinc-400">{totalWorking} working sets logged</p>
      </header>

      <div className="space-y-3">
        {plannedExercises.map((ex) => {
          const working = getWorkingSets(ex.exerciseId);
          const done = working.length >= ex.targetSets;
          const partial = working.length > 0 && !done;

          return (
            <button
              key={ex.exerciseId}
              onClick={() => openExercise(ex)}
              className={`w-full rounded-xl border p-4 text-left transition hover:brightness-110 ${
                done ? 'border-emerald-800 bg-emerald-950/20'
                : partial ? 'border-yellow-800 bg-yellow-950/10'
                : 'border-zinc-800 bg-zinc-900/30'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-white">{ex.exerciseName}</p>
                  <p className="text-xs text-zinc-500">
                    {working.length}/{ex.targetSets} sets · {ex.targetRepMin}–{ex.targetRepMax} reps · {ex.targetRir} RIR planned
                  </p>
                </div>
                <span className={`text-xs font-medium ${
                  done ? 'text-emerald-400' : partial ? 'text-yellow-400' : 'text-zinc-600'
                }`}>
                  {done ? '✓ Done' : partial ? 'Partial' : '○ Tap to log'}
                </span>
              </div>
            </button>
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