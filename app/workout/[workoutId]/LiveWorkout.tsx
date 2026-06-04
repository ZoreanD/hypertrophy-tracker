'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { logSet, deleteSet, finishWorkout, getSubstituteExercises } from '../../actions/workout-session';

// ── Types ─────────────────────────────────────────────────────────────────

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
  setType: string;
  setGroupId: string | null;
  side: string | null;
};

type Summary = {
  exerciseSummaries: any[];
  deloadRecommended: boolean;
  totalSets: number;
  durationMins: number;
};

type Substitute = {
  id: string;
  name: string;
  primaryMuscle: string;
  equipment: string;
  movementPattern: string;
};

type SwapRecord = {
  originalId: string;
  originalName: string;
  replacement: Substitute;
};

type SetMode = 'STRAIGHT' | 'SUPERSET' | 'MYOREP' | 'DROPSET';

// ── Helpers ───────────────────────────────────────────────────────────────

function generateGroupId() {
  return Math.random().toString(36).substring(2, 10);
}

// ── Component ─────────────────────────────────────────────────────────────

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
  const startTime = useRef(Date.now());

  const [loggedSets, setLoggedSets] = useState<LoggedSet[]>(initialLoggedSets);
  const [expandedExercise, setExpandedExercise] = useState<string | null>(
    plannedExercises[0]?.exerciseId ?? null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [activeExercises, setActiveExercises] = useState<PlannedExercise[]>(plannedExercises);

  // Rest timer
  const [restTimer, setRestTimer] = useState<number | null>(null);
  const [restTarget, setRestTarget] = useState(120);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Per-exercise input state
  const [inputs, setInputs] = useState<Record<string, {
    weight: string; reps: string; rir: string; isWarmup: boolean;
  }>>({});

  // Set mode per exercise
  const [setModes, setSetModes] = useState<Record<string, SetMode>>({});

  // Superset state per exercise
  const [supersetPartners, setSupersetPartners] = useState<Record<string, Substitute | null>>({});
  const [supersetInputs, setSupersetInputs] = useState<Record<string, {
    weight: string; reps: string; rir: string;
  }>>({});
  const [showPartnerSearch, setShowPartnerSearch] = useState<Record<string, boolean>>({});
  const [partnerSubstitutes, setPartnerSubstitutes] = useState<Record<string, Substitute[]>>({});

  // Myo-rep state
  const [myorepPhase, setMyorepPhase] = useState<Record<string, 'activation' | 'mini'>>({});
  const [myorepGroupIds, setMyorepGroupIds] = useState<Record<string, string>>({});

  // Drop set state
  const [dropGroupIds, setDropGroupIds] = useState<Record<string, string>>({});
  const [dropPhase, setDropPhase] = useState<Record<string, boolean>>({});

  // Pivot/swap state
  const [pivotingExerciseId, setPivotingExerciseId] = useState<string | null>(null);
  const [substitutes, setSubstitutes] = useState<Substitute[]>([]);
  const [loadingSubstitutes, setLoadingSubstitutes] = useState(false);
  const [swaps, setSwaps] = useState<SwapRecord[]>([]);

  const executionOrderRef = useRef(0);

  // Flashing on click
  const [flashingExercise, setFlashingExercise] = useState<string | null>(null);

  const [activeSide, setActiveSide] = useState<Record<string, 'LEFT' | 'RIGHT'>>({});

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  function startRestTimer(secs: number) {
    if (timerRef.current) clearInterval(timerRef.current);
    setRestTarget(secs);
    setRestTimer(secs);
    timerRef.current = setInterval(() => {
      setRestTimer((prev) => {
        if (prev === null || prev <= 1) { clearInterval(timerRef.current!); return null; }
        return prev - 1;
      });
    }, 1000);
  }

  function getInput(exerciseId: string, history: PlannedExercise['history']) {
    if (inputs[exerciseId]) return inputs[exerciseId];
    return { weight: history ? String(history.lastWeight) : '', reps: '', rir: '', isWarmup: false };
  }

  function updateInput(exerciseId: string, field: string, value: string | boolean) {
    setInputs((prev) => ({
      ...prev,
      [exerciseId]: { ...getInput(exerciseId, null), ...prev[exerciseId], [field]: value },
    }));
  }

  function getMode(exerciseId: string): SetMode {
    return setModes[exerciseId] ?? 'STRAIGHT';
  }

  function setMode(exerciseId: string, mode: SetMode) {
    setSetModes((prev) => ({ ...prev, [exerciseId]: mode }));
    // Reset sub-state when switching modes
    setSupersetPartners((prev) => ({ ...prev, [exerciseId]: null }));
    setMyorepPhase((prev) => ({ ...prev, [exerciseId]: 'activation' }));
    setDropPhase((prev) => ({ ...prev, [exerciseId]: false }));
  }

  // ── Log set helpers ──────────────────────────────────────────────────────

async function doLogSet(params: {
  exerciseId: string;
  weight: number;
  reps: number;
  rir: number;
  isWarmup: boolean;
  setType: string;
  setGroupId: string | null;
  restSecs: number;
  side?: string | null;
  assistanceWeightLbs?: number | null;
  bodyweightLbs?: number | null;
}) {
  const execOrder = executionOrderRef.current++;
  const result = await logSet({
    workoutId: workout.id,
    exerciseId: params.exerciseId,
    weightLbs: params.weight,
    reps: params.reps,
    rir: params.rir,
    isWarmup: params.isWarmup,
    executionOrder: execOrder,
    setType: params.setType,
    setGroupId: params.setGroupId,
    side: params.side ?? null,
    assistanceWeightLbs: params.assistanceWeightLbs ?? null,
    bodyweightLbs: params.bodyweightLbs ?? null,
  });

    if (result.success && result.setId) {
      setLoggedSets((prev) => [...prev, {
        id: result.setId!,
        exerciseId: params.exerciseId,
        weightLbs: params.weight,
        reps: params.reps,
        rir: params.rir,
        isWarmup: params.isWarmup,
        executionOrder: execOrder,
        setType: params.setType,
        setGroupId: params.setGroupId,
        side: params.side ?? null,
      }]);
      if (!params.isWarmup) startRestTimer(params.restSecs);
      return true;
    }
    return false;
  }

  // ── Straight set ─────────────────────────────────────────────────────────

  async function handleLogStraightSet(ex: PlannedExercise) {
    const input = getInput(ex.exerciseId, ex.history);
    const weight = parseFloat(input.weight);
    const reps = parseInt(input.reps);
    const rir = parseFloat(input.rir);
    if (isNaN(weight) || isNaN(reps) || isNaN(rir)) return alert('Fill in weight, reps, and RIR.');

    const side = ex.isUnilateral ? (activeSide[ex.exerciseId] ?? 'LEFT') : null;

    const ok = await doLogSet({
      exerciseId: ex.exerciseId,
      weight,
      reps,
      rir,
      isWarmup: input.isWarmup,
      setType: 'STRAIGHT',
      setGroupId: null,
      restSecs: ex.restTimerSecs,
      side,
      assistanceWeightLbs: ex.isAssisted ? weight : null,
      bodyweightLbs: (ex.isAssisted || ex.isBodyweight) ? currentBodyweight : null,
    });

    if (ok) {
      setInputs((prev) => ({
        ...prev,
        [ex.exerciseId]: { ...prev[ex.exerciseId], weight: input.weight, reps: '', rir: '' },
      }));
      // Auto-switch side for unilateral
      if (ex.isUnilateral) {
        setActiveSide((prev) => ({
          ...prev,
          [ex.exerciseId]: prev[ex.exerciseId] === 'LEFT' ? 'RIGHT' : 'LEFT',
        }));
      }
      setFlashingExercise(ex.exerciseId);
      setTimeout(() => setFlashingExercise(null), 600);
    }
  }

  // ── Superset ─────────────────────────────────────────────────────────────

  async function handleSearchSupersetPartner(ex: PlannedExercise) {
    setShowPartnerSearch((prev) => ({ ...prev, [ex.exerciseId]: true }));
    const result = await getSubstituteExercises(ex.exerciseId, ex.primaryMuscle, ex.equipment);
    setPartnerSubstitutes((prev) => ({ ...prev, [ex.exerciseId]: result.substitutes ?? [] }));
  }

  function handleSelectSupersetPartner(exerciseId: string, partner: Substitute) {
    setSupersetPartners((prev) => ({ ...prev, [exerciseId]: partner }));
    setShowPartnerSearch((prev) => ({ ...prev, [exerciseId]: false }));
  }

  async function handleLogSupersetPair(ex: PlannedExercise) {
    const partner = supersetPartners[ex.exerciseId];
    if (!partner) return alert('Select a superset partner first.');

    const inputA = getInput(ex.exerciseId, ex.history);
    const inputB = supersetInputs[ex.exerciseId] ?? { weight: '', reps: '', rir: '' };

    const wA = parseFloat(inputA.weight), rA = parseInt(inputA.reps), rirA = parseFloat(inputA.rir);
    const wB = parseFloat(inputB.weight), rB = parseInt(inputB.reps), rirB = parseFloat(inputB.rir);

    if (isNaN(wA) || isNaN(rA) || isNaN(rirA) || isNaN(wB) || isNaN(rB) || isNaN(rirB)) {
      return alert('Fill in weight, reps, and RIR for both exercises.');
    }

    const groupId = generateGroupId();

    // Detect superset type
    const isSameMuscle = ex.primaryMuscle === partner.primaryMuscle;
    const typeA = isSameMuscle ? 'SUPERSET_A' : 'SUPERSET_A';
    const typeB = isSameMuscle ? 'SUPERSET_B' : 'SUPERSET_B';

    await doLogSet({ exerciseId: ex.exerciseId, weight: wA, reps: rA, rir: rirA, isWarmup: false, setType: typeA, setGroupId: groupId, restSecs: ex.restTimerSecs });
    await doLogSet({ exerciseId: partner.id, weight: wB, reps: rB, rir: rirB, isWarmup: false, setType: typeB, setGroupId: groupId, restSecs: ex.restTimerSecs });

    // Clear inputs
    setInputs((prev) => ({ ...prev, [ex.exerciseId]: { ...prev[ex.exerciseId], reps: '', rir: '' } }));
    setSupersetInputs((prev) => ({ ...prev, [ex.exerciseId]: { weight: inputB.weight, reps: '', rir: '' } }));
    setFlashingExercise(ex.exerciseId);
    setTimeout(() => setFlashingExercise(null), 600);

    if (isSameMuscle) startRestTimer(ex.restTimerSecs * 1.5);
  }

  // ── Myo-reps ─────────────────────────────────────────────────────────────

  async function handleLogMyorep(ex: PlannedExercise) {
    const input = getInput(ex.exerciseId, ex.history);
    const weight = parseFloat(input.weight);
    const reps = parseInt(input.reps);
    const rir = parseFloat(input.rir);
    if (isNaN(weight) || isNaN(reps) || isNaN(rir)) return alert('Fill in weight, reps, and RIR.');

    const phase = myorepPhase[ex.exerciseId] ?? 'activation';

    if (phase === 'activation') {
      const groupId = generateGroupId();
      setMyorepGroupIds((prev) => ({ ...prev, [ex.exerciseId]: groupId }));
      await doLogSet({ exerciseId: ex.exerciseId, weight, reps, rir, isWarmup: false, setType: 'MYOREP_ACTIVATION', setGroupId: groupId, restSecs: 25 });
      setMyorepPhase((prev) => ({ ...prev, [ex.exerciseId]: 'mini' }));
    } else {
      const groupId = myorepGroupIds[ex.exerciseId] ?? generateGroupId();
      await doLogSet({ exerciseId: ex.exerciseId, weight, reps, rir, isWarmup: false, setType: 'MYOREP_MINI', setGroupId: groupId, restSecs: 25 });
    }

    setInputs((prev) => ({ ...prev, [ex.exerciseId]: { ...prev[ex.exerciseId], reps: '', rir: '' } }));
    setFlashingExercise(ex.exerciseId);
    setTimeout(() => setFlashingExercise(null), 600);
  }

  function handleEndMyorep(exerciseId: string) {
    setMyorepPhase((prev) => ({ ...prev, [exerciseId]: 'activation' }));
    setMyorepGroupIds((prev) => { const n = { ...prev }; delete n[exerciseId]; return n; });
  }

  // ── Drop sets ─────────────────────────────────────────────────────────────

  async function handleLogDropSet(ex: PlannedExercise) {
    const input = getInput(ex.exerciseId, ex.history);
    const weight = parseFloat(input.weight);
    const reps = parseInt(input.reps);
    const rir = parseFloat(input.rir);
    if (isNaN(weight) || isNaN(reps) || isNaN(rir)) return alert('Fill in weight, reps, and RIR.');

    const isInDrop = dropPhase[ex.exerciseId] ?? false;

    if (!isInDrop) {
      const groupId = generateGroupId();
      setDropGroupIds((prev) => ({ ...prev, [ex.exerciseId]: groupId }));
      await doLogSet({ exerciseId: ex.exerciseId, weight, reps, rir, isWarmup: false, setType: 'DROPSET_PRIMARY', setGroupId: groupId, restSecs: 10 });
      setDropPhase((prev) => ({ ...prev, [ex.exerciseId]: true }));
    } else {
      const groupId = dropGroupIds[ex.exerciseId] ?? generateGroupId();
      await doLogSet({ exerciseId: ex.exerciseId, weight, reps, rir, isWarmup: false, setType: 'DROPSET_DROP', setGroupId: groupId, restSecs: 10 });
    }

    setInputs((prev) => ({ ...prev, [ex.exerciseId]: { ...prev[ex.exerciseId], weight: input.weight, reps: '', rir: '' } }));
    setFlashingExercise(ex.exerciseId);
    setTimeout(() => setFlashingExercise(null), 600);
  }

  function handleEndDropSet(exerciseId: string) {
    setDropPhase((prev) => ({ ...prev, [exerciseId]: false }));
    setDropGroupIds((prev) => { const n = { ...prev }; delete n[exerciseId]; return n; });
    startRestTimer(activeExercises.find((e) => e.exerciseId === exerciseId)?.restTimerSecs ?? 120);
  }

  // ── Swap ──────────────────────────────────────────────────────────────────

  async function handleOpenPivot(ex: PlannedExercise) {
    setPivotingExerciseId(ex.exerciseId);
    setLoadingSubstitutes(true);
    const result = await getSubstituteExercises(ex.exerciseId, ex.primaryMuscle, ex.equipment);
    setSubstitutes(result.substitutes ?? []);
    setLoadingSubstitutes(false);
  }

  function handleConfirmSwap(originalEx: PlannedExercise, substitute: Substitute) {
    setSwaps((prev) => [...prev, { originalId: originalEx.exerciseId, originalName: originalEx.exerciseName, replacement: substitute }]);
    setActiveExercises((prev) => prev.map((ex) =>
      ex.exerciseId === originalEx.exerciseId
        ? { ...ex, exerciseId: substitute.id, exerciseName: substitute.name, primaryMuscle: substitute.primaryMuscle, equipment: substitute.equipment, history: null }
        : ex
    ));
    setPivotingExerciseId(null);
    setSubstitutes([]);
    setExpandedExercise(substitute.id);
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
      return { type: 'context' as const, text: `Exercise ${direction} in session vs last time. ${direction === 'later' ? 'Expect slightly fewer reps.' : 'May perform better fresh.'}` };
    }
    if (hitTopOfRange && rirWasGood) return { type: 'increase' as const, text: `Hit ${ex.history.lastReps} reps last time — ready to add weight.` };
    return { type: 'maintain' as const, text: `Last: ${ex.history.lastReps} reps @ ${ex.history.lastWeight}lbs (${ex.history.lastRir} RIR)` };
  }

  // ── Summary screen ────────────────────────────────────────────────────────

  if (summary) {
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

        {swaps.length > 0 && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <p className="mb-2 text-sm font-medium text-zinc-400">Exercise Swaps</p>
            <div className="space-y-1">
              {swaps.map((swap, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-zinc-500">
                  <span className="text-red-400/70 line-through">{swap.originalName}</span>
                  <span>→</span>
                  <span className="text-emerald-400">{swap.replacement.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {summary.deloadRecommended && (
          <div className="rounded-xl border border-yellow-700 bg-yellow-900/20 p-4">
            <p className="font-semibold text-yellow-400">Deload Recommended</p>
            <p className="mt-1 text-sm text-yellow-300/70">
              Multiple unexplained performance declines detected. Consider a deload week — reduce load by 40-50%, cut volume by half, keep RIR high.
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

              {/* Planned vs actual */}
              {ex.planned && (
                <div className="mt-2 flex items-center gap-3 text-xs">
                  <span className="text-zinc-600">Planned:</span>
                  <span className="text-zinc-500">
                    {ex.planned.sets} sets · {ex.planned.repMin}–{ex.planned.repMax} reps · {ex.planned.rir} RIR
                  </span>
                  <span className="text-zinc-700">→</span>
                  <span className={ex.status === 'skipped' ? 'text-zinc-600' : ex.sets.length >= ex.planned.sets ? 'text-emerald-400' : 'text-yellow-400'}>
                    {ex.status === 'skipped' ? 'Skipped' : `${ex.sets.length} sets completed`}
                  </span>
                </div>
              )}
              //asymmetry flag
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

              {ex.progressionNote && <p className="mt-1 text-xs text-zinc-500">{ex.progressionNote}</p>}
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

        <button onClick={() => router.push('/dashboard')} className="w-full rounded-md bg-emerald-600 py-3 font-semibold text-white hover:bg-emerald-500">
          Back to Dashboard
        </button>
      </div>
    );
  }

  // ── Live workout screen ───────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 pb-32 md:p-8">

      <header className="flex items-center justify-between border-b border-zinc-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{workout.focus}</h1>
          <p className="text-sm text-zinc-400">
            {new Date(workout.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </p>
        </div>
        <button onClick={handleFinish} disabled={isSubmitting} className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">
          {isSubmitting ? 'Saving...' : 'Finish'}
        </button>
      </header>

      {swaps.length > 0 && (
        <div className="rounded-lg border border-zinc-700 bg-zinc-900/50 px-4 py-2">
          <p className="text-xs text-zinc-500">
            {swaps.length} swap{swaps.length > 1 ? 's' : ''} this session
            {swaps.map((s, i) => (
              <span key={i} className="ml-2 text-zinc-400">
                · <span className="line-through text-zinc-600">{s.originalName}</span> → {s.replacement.name}
              </span>
            ))}
          </p>
        </div>
      )}

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
              <button onClick={() => startRestTimer(restTarget)} className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:border-zinc-500">Reset</button>
              <button onClick={() => { if (timerRef.current) clearInterval(timerRef.current); setRestTimer(null); }} className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:border-zinc-500">Skip</button>
            </div>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
            <div className="h-full rounded-full bg-emerald-500 transition-all duration-1000" style={{ width: `${((restTarget - restTimer) / restTarget) * 100}%` }} />
          </div>
        </div>
      )}

      {activeExercises.map((ex, index) => {
        const setsForExercise = loggedSets.filter((s) => s.exerciseId === ex.exerciseId && !s.isWarmup);
        const isComplete = setsForExercise.length >= ex.targetSets;
        const isExpanded = expandedExercise === ex.exerciseId;
        const isPivoting = pivotingExerciseId === ex.exerciseId;
        const wasSwapped = swaps.some((s) => s.replacement.id === ex.exerciseId);
        const input = getInput(ex.exerciseId, ex.history);
        const hint = getProgressionHint(ex, index);
        const mode = getMode(ex.exerciseId);
        const partner = supersetPartners[ex.exerciseId];
        const supersetInput = supersetInputs[ex.exerciseId] ?? { weight: '', reps: '', rir: '' };
        const myoPhase = myorepPhase[ex.exerciseId] ?? 'activation';
        const inDrop = dropPhase[ex.exerciseId] ?? false;
        const dropSetsLogged = setsForExercise.filter((s) => s.setType === 'DROPSET_DROP').length;

        return (
          <div key={ex.exerciseId} className={`rounded-xl border transition-all duration-300 ${
            flashingExercise === ex.exerciseId ? 'border-emerald-400 bg-emerald-950/40 scale-[1.01]'
            : isComplete ? 'border-emerald-700 bg-emerald-950/20'
            : isPivoting ? 'border-yellow-600 bg-yellow-950/10'
            : isExpanded ? 'border-zinc-600 bg-zinc-900'
            : 'border-zinc-800 bg-zinc-900/30'
          }`}>

            {/* Exercise header */}
            <div className="flex items-center justify-between p-4">
              <button className="flex flex-1 items-center gap-3 text-left" onClick={() => { setExpandedExercise(isExpanded ? null : ex.exerciseId); setPivotingExerciseId(null); }}>
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${isComplete ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-400'}`}>
                  {isComplete ? '✓' : index + 1}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <p className={`font-semibold ${isComplete ? 'text-emerald-300' : 'text-white'}`}>{ex.exerciseName}</p>
                    {wasSwapped && <span className="rounded-full bg-yellow-900/50 px-1.5 py-0.5 text-xs text-yellow-400">swapped</span>}
                    {mode !== 'STRAIGHT' && <span className="rounded-full bg-zinc-700 px-1.5 py-0.5 text-xs text-zinc-400">{mode.toLowerCase()}</span>}
                  </div>
                  <p className="text-xs text-zinc-500">{setsForExercise.length}/{ex.targetSets} sets · {ex.targetRepMin}–{ex.targetRepMax} reps · {ex.targetRir} RIR</p>
                </div>
              </button>

              {setsForExercise.length === 0 && !isComplete && (
                <button
                  onClick={() => { if (isPivoting) { setPivotingExerciseId(null); setSubstitutes([]); } else { handleOpenPivot(ex); setExpandedExercise(null); } }}
                  className={`ml-2 shrink-0 rounded-md border px-2 py-1 text-xs ${isPivoting ? 'border-yellow-600 text-yellow-400' : 'border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300'}`}
                >
                  {isPivoting ? 'Cancel' : 'Swap'}
                </button>
              )}
              <span className="ml-2 text-sm text-zinc-600">{isExpanded ? '▲' : '▼'}</span>
            </div>

            {/* Swap panel */}
            {isPivoting && (
              <div className="border-t border-zinc-800 p-4 space-y-3">
                <p className="text-sm font-medium text-yellow-400">Find a substitute</p>
                {loadingSubstitutes ? <p className="text-xs text-zinc-500">Loading...</p>
                : substitutes.length === 0 ? <p className="text-xs text-zinc-500">No substitutes found for this exact muscle + movement combination.</p>
                : (
                  <div className="space-y-2">
                    {substitutes.map((sub) => (
                      <button key={sub.id} onClick={() => handleConfirmSwap(ex, sub)} className="flex w-full items-center justify-between rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2.5 text-left hover:border-emerald-600 hover:bg-emerald-950/20">
                        <div>
                          <p className="text-sm font-medium text-white">{sub.name}</p>
                          <p className="text-xs text-zinc-500">{sub.equipment.replace(/_/g, ' ').toLowerCase()}</p>
                        </div>
                        <span className="text-xs text-emerald-400">Use this →</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Expanded content */}
            {isExpanded && !isPivoting && (
              <div className="space-y-4 border-t border-zinc-800 p-4">

                {/* Progression hint */}
                {hint && (
                  <div className={`rounded-lg p-3 text-xs ${hint.type === 'increase' ? 'bg-emerald-900/30 text-emerald-400' : hint.type === 'context' ? 'bg-yellow-900/30 text-yellow-400' : 'bg-zinc-800/50 text-zinc-400'}`}>
                    {hint.text}
                  </div>
                )}

                {/* Last session */}
                {ex.history && (
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs text-zinc-600">Last session:</span>
                    {ex.history.allSets.map((s, i) => (
                      <span key={i} className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">{s.weight}lbs × {s.reps}</span>
                    ))}
                  </div>
                )}

                {/* Logged sets */}
                {setsForExercise.length > 0 && (
                  <div className="space-y-1">
                    {setsForExercise.map((s, i) => (
                      <div key={s.id} className="flex items-center justify-between rounded-md bg-zinc-800/50 px-3 py-2">
                        <span className="text-xs text-zinc-500">
                          {s.setType === 'STRAIGHT' ? `Set ${i + 1}`
                          : s.setType === 'MYOREP_ACTIVATION' ? 'Activation'
                          : s.setType === 'MYOREP_MINI' ? `Mini ${i}`
                          : s.setType === 'DROPSET_PRIMARY' ? 'Primary'
                          : s.setType === 'DROPSET_DROP' ? `Drop ${dropSetsLogged}`
                          : s.setType === 'SUPERSET_A' ? `SS-A ${i + 1}`
                          : `SS-B ${i + 1}`}
                          {s.side && <span className="ml-1 text-zinc-600">{s.side}</span>}
                        </span>
                        <span className="text-sm font-medium text-white">
                          {ex.isAssisted
                            ? `${s.weightLbs}lbs assist × ${s.reps} @ ${s.rir} RIR`
                            : `${s.weightLbs}lbs × ${s.reps} @ ${s.rir} RIR`}
                        </span>
                        <button onClick={() => handleDeleteSet(s.id)} className="text-xs text-zinc-600 hover:text-red-400">✕</button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Mode selector — only before first working set */}
                {setsForExercise.length === 0 && (
                  <div className="flex gap-2">
                    {(['STRAIGHT', 'SUPERSET', 'MYOREP', 'DROPSET'] as SetMode[]).map((m) => (
                      <button key={m} onClick={() => setMode(ex.exerciseId, m)}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${mode === m ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}>
                        {m === 'STRAIGHT' ? 'Straight' : m === 'SUPERSET' ? 'Superset' : m === 'MYOREP' ? 'Myo-reps' : 'Drop set'}
                      </button>
                    ))}
                  </div>
                )}

                {/* ── STRAIGHT set input ── */}
                {mode === 'STRAIGHT' && !isComplete && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-2">
                    {/* Side selector for unilateral exercises */}
                    {ex.isUnilateral && (
                      <div className="flex gap-2">
                        <p className="text-xs text-zinc-500 mr-1 self-center">Side:</p>
                        {(['LEFT', 'RIGHT'] as const).map((side) => (
                          <button
                            key={side}
                            type="button"
                            onClick={() => setActiveSide((prev) => ({ ...prev, [ex.exerciseId]: side }))}
                            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                              (activeSide[ex.exerciseId] ?? 'LEFT') === side
                                ? 'bg-emerald-600 text-white'
                                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                            }`}
                          >
                            {side}
                          </button>
                        ))}
                      </div>
                    )}
                    {/* Assistance weight for assisted exercises */}
                    {ex.isAssisted && (
                      <div>
                        <label className="mb-1 block text-xs text-zinc-500">
                          Assistance Weight (lbs) — subtracted from bodyweight ({currentBodyweight ?? '?'}lbs)
                        </label>
                        <input
                          type="number"
                          step="5"
                          value={input.weight}
                          onChange={(e) => updateInput(ex.exerciseId, 'weight', e.target.value)}
                          className="w-full rounded-md border border-zinc-700 bg-zinc-950 p-2 text-center text-sm text-white focus:border-emerald-500 focus:outline-none"
                        />
                        {currentBodyweight && input.weight && (
                          <p className="mt-1 text-xs text-zinc-600">
                            Effective load: {Math.round(currentBodyweight - parseFloat(input.weight))}lbs
                          </p>
                        )}
                      </div>
                    )}
                      <div>
                        <label className="mb-1 block text-xs text-zinc-500">Weight (lbs)</label>
                        <input type="number" step="2.5" value={input.weight} onChange={(e) => updateInput(ex.exerciseId, 'weight', e.target.value)} className="w-full rounded-md border border-zinc-700 bg-zinc-950 p-2 text-center text-sm text-white focus:border-emerald-500 focus:outline-none" />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-zinc-500">Reps</label>
                        <input type="number" value={input.reps} onChange={(e) => updateInput(ex.exerciseId, 'reps', e.target.value)} className="w-full rounded-md border border-zinc-700 bg-zinc-950 p-2 text-center text-sm text-white focus:border-emerald-500 focus:outline-none" />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-zinc-500">RIR</label>
                        <input type="number" step="0.5" min="0" max="5" value={input.rir} onChange={(e) => updateInput(ex.exerciseId, 'rir', e.target.value)} className="w-full rounded-md border border-zinc-700 bg-zinc-950 p-2 text-center text-sm text-white focus:border-emerald-500 focus:outline-none" />
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-zinc-500">
                      <input type="checkbox" checked={input.isWarmup} onChange={(e) => updateInput(ex.exerciseId, 'isWarmup', e.target.checked)} className="rounded" />
                      Warmup set
                    </label>
                    <button onClick={() => handleLogStraightSet(ex)} className="w-full rounded-md bg-zinc-700 py-2.5 text-sm font-semibold text-white hover:bg-zinc-600">
                      Log Set {setsForExercise.length + 1} of {ex.targetSets}
                    </button>
                  </div>
                )}

                {/* ── SUPERSET input ── */}
                {mode === 'SUPERSET' && !isComplete && (
                  <div className="space-y-3">
                    {!partner ? (
                      <div className="space-y-2">
                        <p className="text-xs text-zinc-400">Select the exercise you're pairing with:</p>
                        <button onClick={() => handleSearchSupersetPartner(ex)} className="w-full rounded-md border border-zinc-700 py-2 text-sm text-zinc-400 hover:border-emerald-500 hover:text-emerald-400">
                          + Pick superset partner
                        </button>
                        {showPartnerSearch[ex.exerciseId] && (
                          <div className="max-h-48 overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-950">
                            {(partnerSubstitutes[ex.exerciseId] ?? []).map((sub) => (
                              <button key={sub.id} onClick={() => handleSelectSupersetPartner(ex.exerciseId, sub)} className="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-zinc-800">
                                <span className="text-sm text-white">{sub.name}</span>
                                <span className="text-xs text-zinc-500">{sub.primaryMuscle.replace(/_/g, ' ')}</span>
                              </button>
                            ))}
                            {(partnerSubstitutes[ex.exerciseId] ?? []).length === 0 && (
                              <p className="p-3 text-xs text-zinc-500">No matching exercises found.</p>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {/* Check if same-biomechanical */}
                        {ex.primaryMuscle === partner.primaryMuscle && (
                          <div className="rounded-lg bg-yellow-900/20 p-2 text-xs text-yellow-400">
                            Same-biomechanical superset — both exercises hit {ex.primaryMuscle.replace(/_/g, ' ')}. Expect reduced reps vs straight sets. More rest recommended.
                          </div>
                        )}
                        {ex.primaryMuscle !== partner.primaryMuscle && (
                          <div className="rounded-lg bg-emerald-900/20 p-2 text-xs text-emerald-400">
                            Agonist-antagonist superset — volume maintained. Time-efficient pairing.
                          </div>
                        )}

                        <p className="text-xs font-medium text-zinc-400">{ex.exerciseName}</p>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="mb-1 block text-xs text-zinc-500">Weight</label>
                            <input type="number" step="2.5" value={input.weight} onChange={(e) => updateInput(ex.exerciseId, 'weight', e.target.value)} className="w-full rounded-md border border-zinc-700 bg-zinc-950 p-2 text-center text-sm text-white focus:border-emerald-500 focus:outline-none" />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs text-zinc-500">Reps</label>
                            <input type="number" value={input.reps} onChange={(e) => updateInput(ex.exerciseId, 'reps', e.target.value)} className="w-full rounded-md border border-zinc-700 bg-zinc-950 p-2 text-center text-sm text-white focus:border-emerald-500 focus:outline-none" />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs text-zinc-500">RIR</label>
                            <input type="number" step="0.5" min="0" max="5" value={input.rir} onChange={(e) => updateInput(ex.exerciseId, 'rir', e.target.value)} className="w-full rounded-md border border-zinc-700 bg-zinc-950 p-2 text-center text-sm text-white focus:border-emerald-500 focus:outline-none" />
                          </div>
                        </div>

                        <p className="text-xs font-medium text-zinc-400">{partner.name}</p>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="mb-1 block text-xs text-zinc-500">Weight</label>
                            <input type="number" step="2.5" value={supersetInput.weight} onChange={(e) => setSupersetInputs((prev) => ({ ...prev, [ex.exerciseId]: { ...supersetInput, weight: e.target.value } }))} className="w-full rounded-md border border-zinc-700 bg-zinc-950 p-2 text-center text-sm text-white focus:border-emerald-500 focus:outline-none" />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs text-zinc-500">Reps</label>
                            <input type="number" value={supersetInput.reps} onChange={(e) => setSupersetInputs((prev) => ({ ...prev, [ex.exerciseId]: { ...supersetInput, reps: e.target.value } }))} className="w-full rounded-md border border-zinc-700 bg-zinc-950 p-2 text-center text-sm text-white focus:border-emerald-500 focus:outline-none" />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs text-zinc-500">RIR</label>
                            <input type="number" step="0.5" min="0" max="5" value={supersetInput.rir} onChange={(e) => setSupersetInputs((prev) => ({ ...prev, [ex.exerciseId]: { ...supersetInput, rir: e.target.value } }))} className="w-full rounded-md border border-zinc-700 bg-zinc-950 p-2 text-center text-sm text-white focus:border-emerald-500 focus:outline-none" />
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button onClick={() => handleLogSupersetPair(ex)} className="flex-1 rounded-md bg-zinc-700 py-2.5 text-sm font-semibold text-white hover:bg-zinc-600">
                            Log Superset Pair {setsForExercise.filter((s) => s.setType === 'SUPERSET_A').length + 1}
                          </button>
                          <button onClick={() => setSupersetPartners((prev) => ({ ...prev, [ex.exerciseId]: null }))} className="rounded-md border border-zinc-700 px-3 text-xs text-zinc-500 hover:text-zinc-300">
                            Change
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── MYOREP input ── */}
                {mode === 'MYOREP' && !isComplete && (
                  <div className="space-y-3">
                    <div className={`rounded-lg p-3 text-xs ${myoPhase === 'activation' ? 'bg-blue-900/20 text-blue-400' : 'bg-purple-900/20 text-purple-400'}`}>
                      {myoPhase === 'activation'
                        ? 'Activation set: 12–30 reps, 0–1 RIR. Go close to failure.'
                        : 'Mini-set: 3–5 reps, 20–30s rest between. Stop when reps drop below 3.'}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="mb-1 block text-xs text-zinc-500">Weight</label>
                        <input type="number" step="2.5" value={input.weight} onChange={(e) => updateInput(ex.exerciseId, 'weight', e.target.value)} className="w-full rounded-md border border-zinc-700 bg-zinc-950 p-2 text-center text-sm text-white focus:border-emerald-500 focus:outline-none" />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-zinc-500">Reps</label>
                        <input type="number" value={input.reps} onChange={(e) => updateInput(ex.exerciseId, 'reps', e.target.value)} className="w-full rounded-md border border-zinc-700 bg-zinc-950 p-2 text-center text-sm text-white focus:border-emerald-500 focus:outline-none" />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-zinc-500">RIR</label>
                        <input type="number" step="0.5" min="0" max="5" value={input.rir} onChange={(e) => updateInput(ex.exerciseId, 'rir', e.target.value)} className="w-full rounded-md border border-zinc-700 bg-zinc-950 p-2 text-center text-sm text-white focus:border-emerald-500 focus:outline-none" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleLogMyorep(ex)} className="flex-1 rounded-md bg-zinc-700 py-2.5 text-sm font-semibold text-white hover:bg-zinc-600">
                        {myoPhase === 'activation' ? 'Log Activation Set' : `Log Mini-set ${setsForExercise.filter((s) => s.setType === 'MYOREP_MINI').length + 1}`}
                      </button>
                      {myoPhase === 'mini' && (
                        <button onClick={() => handleEndMyorep(ex.exerciseId)} className="rounded-md border border-zinc-700 px-3 text-xs text-zinc-400 hover:text-emerald-400 hover:border-emerald-700">
                          Done
                        </button>
                      )}
                    </div>
                    {myoPhase === 'mini' && (
                      <p className="text-xs text-zinc-600">
                        {setsForExercise.filter((s) => s.setType === 'MYOREP_MINI').length} mini-sets logged · tap Done when reps drop below 3
                      </p>
                    )}
                  </div>
                )}

                {/* ── DROP SET input ── */}
                {mode === 'DROPSET' && !isComplete && (
                  <div className="space-y-3">
                    <div className={`rounded-lg p-3 text-xs ${!inDrop ? 'bg-orange-900/20 text-orange-400' : 'bg-red-900/20 text-red-400'}`}>
                      {!inDrop
                        ? 'Primary set: go to failure or 0–1 RIR. Then immediately reduce weight.'
                        : `Drop ${dropSetsLogged + 1}: reduce weight 20–30% and go again. Log when done.`}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="mb-1 block text-xs text-zinc-500">Weight</label>
                        <input type="number" step="2.5" value={input.weight} onChange={(e) => updateInput(ex.exerciseId, 'weight', e.target.value)} className="w-full rounded-md border border-zinc-700 bg-zinc-950 p-2 text-center text-sm text-white focus:border-emerald-500 focus:outline-none" />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-zinc-500">Reps</label>
                        <input type="number" value={input.reps} onChange={(e) => updateInput(ex.exerciseId, 'reps', e.target.value)} className="w-full rounded-md border border-zinc-700 bg-zinc-950 p-2 text-center text-sm text-white focus:border-emerald-500 focus:outline-none" />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-zinc-500">RIR</label>
                        <input type="number" step="0.5" min="0" max="5" value={input.rir} onChange={(e) => updateInput(ex.exerciseId, 'rir', e.target.value)} className="w-full rounded-md border border-zinc-700 bg-zinc-950 p-2 text-center text-sm text-white focus:border-emerald-500 focus:outline-none" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleLogDropSet(ex)} className="flex-1 rounded-md bg-zinc-700 py-2.5 text-sm font-semibold text-white hover:bg-zinc-600">
                        {!inDrop ? 'Log Primary Set' : `Log Drop ${dropSetsLogged + 1}`}
                      </button>
                      {inDrop && (
                        <button onClick={() => handleEndDropSet(ex.exerciseId)} className="rounded-md border border-zinc-700 px-3 text-xs text-zinc-400 hover:text-emerald-400 hover:border-emerald-700">
                          Done
                        </button>
                      )}
                    </div>
                    {inDrop && (
                      <p className="text-xs text-zinc-600">
                        {dropSetsLogged} drop{dropSetsLogged !== 1 ? 's' : ''} logged · tap Done when finished dropping
                      </p>
                    )}
                  </div>
                )}

                {isComplete && (
                  <p className="text-center text-sm text-emerald-400">✓ All {ex.targetSets} sets complete</p>
                )}
              </div>
            )}
          </div>
        );
      })}

      <div className="fixed bottom-0 left-0 right-0 border-t border-zinc-800 bg-zinc-950/95 p-4 backdrop-blur">
        <div className="mx-auto max-w-2xl">
          <button onClick={handleFinish} disabled={isSubmitting} className="w-full rounded-md bg-emerald-600 py-3 font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">
            {isSubmitting ? 'Saving...' : 'Finish Workout'}
          </button>
        </div>
      </div>
    </div>
  );
}