'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { logSet, deleteSet, getSubstituteExercises, getExerciseHistory } from '../../actions/workout-session';
import { EXERCISE_SCIENCE_NOTES } from '../../routines/new/exerciseNotes';
import Tooltip from '../../components/Tooltip';
import { GLOSSARY } from '../../components/glossary';

// ── Types ─────────────────────────────────────────────────────────────────

type PlannedExercise = {
  routineExerciseId: string;
  exerciseId: string;
  exerciseName: string;
  primaryMuscle: string;
  movementPattern: string;
  equipment: string;
  isUnilateral: boolean;
  isAssisted: boolean;
  isBodyweight: boolean;
  isTimeBased: boolean;
  targetSets: number;
  targetRepMin: number;
  targetRepMax: number;
  targetRir: number;
  restTimerSecs: number;
  progressionStyle: string;
  plannedOrder: number;
  history: {
    lastWeight: number;
    lastReps: number | null;
    lastRir: number;
    lastDate: string;
    lastExecutionOrder: number;
    allSets: { weight: number; reps: number | null; rir: number; durationSeconds: number | null }[];
  } | null;
};

type LoggedSet = {
  id: string;
  exerciseId: string;
  weightLbs: number;
  reps: number | null;
  rir: number;
  durationSeconds: number | null;
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
  movementPattern: string;
  equipment: string;
  isUnilateral: boolean;
  isTimeBased: boolean;
  isBodyweight: boolean;
  isAssisted: boolean;
};

type SwapRecord = {
  originalId: string;
  originalName: string;
  replacement: Substitute;
};

type ExerciseOption = {
  id: string;
  name: string;
  primaryMuscle: string;
  movementPattern: string;
  equipment: string;
  isUnilateral: boolean;
  isAssisted: boolean;
  isBodyweight: boolean;
  weightIsPerSide?: boolean;
  isTimeBased?: boolean;
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
  allExercises,
  isAdHoc,
}: {
  workout: { id: string; focus: string; date: string };
  plannedExercises: PlannedExercise[];
  loggedSets: LoggedSet[];
  profileId: string;
  currentBodyweight: number | null;
  allExercises: ExerciseOption[];
  isAdHoc: boolean;
}) {
  const router = useRouter();
  const startTime = useRef(Date.now());
  // Tracks how many logSet calls are still in flight. Used to gate Finish Workout.
  const pendingLogs = useRef(0);
  // Temp IDs that were deleted before the server confirmed them. On confirmation
  // we immediately delete the now-orphaned DB row instead of swapping the ID.
  const cancelledTempIds = useRef<Set<string>>(new Set());
  // Timestamp of the last doLogSet call per exerciseId. Guards against double-taps
  // without holding a lock across the server round-trip (which would block L→R
  // unilateral logging and multi-call superset handlers).
  const lastLoggedAt = useRef<Record<string, number>>({});

  const [loggedSets, setLoggedSets] = useState<LoggedSet[]>(initialLoggedSets);
  const [expandedExercise, setExpandedExercise] = useState<string | null>(
    plannedExercises[0]?.exerciseId ?? null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);

  // Reorderable exercise list
  const [exerciseOrder, setExerciseOrder] = useState<string[]>(
    plannedExercises.map((e) => e.exerciseId)
  );
  const [activeExercises, setActiveExercises] = useState<PlannedExercise[]>(plannedExercises);
  const exMap = Object.fromEntries(activeExercises.map((e) => [e.exerciseId, e]));

  const [showAddExercise, setShowAddExercise] = useState(false);
  const [addExerciseSearch, setAddExerciseSearch] = useState('');
  const [adHocSetCounts, setAdHocSetCounts] = useState<Record<string, number>>({});

  function getAdHocSetCount(exId: string) {
    return adHocSetCounts[exId] ?? 3;
  }

  function adjustAdHocSetCount(exId: string, delta: number) {
    setAdHocSetCounts((prev) => {
      const current = prev[exId] ?? 3;
      const next = Math.min(8, Math.max(1, current + delta));
      return { ...prev, [exId]: next };
    });
  }
  const filteredAddExercises = allExercises
    .filter((e) =>
      e.name.toLowerCase().includes(addExerciseSearch.toLowerCase()) &&
      !exerciseOrder.includes(e.id)
    )
    .slice(0, 20);

  function addAdHocExercise(ex: ExerciseOption) {
    const newEntry: PlannedExercise = {
      routineExerciseId: `adhoc-${ex.id}`,
      exerciseId: ex.id,
      exerciseName: ex.name,
      primaryMuscle: ex.primaryMuscle,
      movementPattern: ex.movementPattern,
      equipment: ex.equipment,
      isUnilateral: ex.isUnilateral,
      isAssisted: ex.isAssisted,
      isBodyweight: ex.isBodyweight,
      isTimeBased: ex.isTimeBased ?? false,
      targetSets: getAdHocSetCount(ex.id),
      targetRepMin: 8,
      targetRepMax: 12,
      targetRir: 1,
      restTimerSecs: 120,
      progressionStyle: 'DOUBLE_PROGRESSION',
      plannedOrder: activeExercises.length,
      history: null,
    };
    setActiveExercises((prev) => [...prev, newEntry]);
    setExerciseOrder((prev) => [...prev, ex.id]);
    setExpandedExercise(ex.id);
    setAddExerciseSearch('');
    setShowAddExercise(false);
  }

  // Rest timer
  const [restTimer, setRestTimer] = useState<number | null>(null);
  const [restTarget, setRestTarget] = useState(120);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const restEndTimeRef = useRef<number | null>(null);

  // Per-exercise input state
  const [inputs, setInputs] = useState<Record<string, {
    weight: string; reps: string; rir: string; isWarmup: boolean;
  }>>({});

  // Set mode per exercise — derived from already-logged sets so a mid-workout
  // reload/remount doesn't silently revert supersets/myo-reps/dropsets to STRAIGHT.
  const [setModes, setSetModes] = useState<Record<string, SetMode>>(() => {
    const modes: Record<string, SetMode> = {};
    for (const s of initialLoggedSets) {
      if (s.isWarmup) continue;
      if (s.setType === 'SUPERSET_A') modes[s.exerciseId] = 'SUPERSET';
      else if (s.setType === 'MYOREP_ACTIVATION') modes[s.exerciseId] = 'MYOREP';
      else if (s.setType === 'DROPSET_PRIMARY') modes[s.exerciseId] = 'DROPSET';
    }
    return modes;
  });

  // Superset partner per exercise — not restored from logged sets because
  // marking an exercise as a B-partner hides its standalone logging UI
  // (including L/R selector), which breaks independent use after reload.
  // Mode (SUPERSET) is restored via setModes above; user re-selects partner.
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

  // Flashing on click
  const [flashingExercise, setFlashingExercise] = useState<string | null>(null);

  const [unilateralPhase, setUnilateralPhase] = useState<Record<string, 'LEFT' | 'RIGHT'>>({});
  const [unilateralPendingSide, setUnilateralPendingSide] = useState<Record<string, 'LEFT' | 'RIGHT'>>({});
  const [activeDropForSet, setActiveDropForSet] = useState<string | null>(null);
  const [inlineDropInputs, setInlineDropInputs] = useState<Record<string, { weight: string; reps: string; rir: string }>>({});
  const [activeSupersetPairDrop, setActiveSupersetPairDrop] = useState<string | null>(null);
  const [supersetDropInputs, setSupersetDropInputs] = useState<Record<string, { weightA: string; repsA: string; rirA: string; weightB: string; repsB: string; rirB: string }>>({});

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // Tell the service worker to (de)schedule the background rest-complete
  // notification. The SW fires it only if no window is visible when time's up.
  function messageRestTimerSW(message: { type: 'START_REST_TIMER'; endTime: number } | { type: 'CANCEL_REST_TIMER' }) {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.ready.then((reg) => reg.active?.postMessage(message)).catch(() => {});
  }

  // Snap timer display when app returns to foreground (the interval is throttled
  // while hidden, so the on-screen count can be stale on return).
  useEffect(() => {
  function onVisible() {
    if (document.visibilityState === 'visible' && restEndTimeRef.current !== null) {
      const remaining = Math.round((restEndTimeRef.current - Date.now()) / 1000);
      if (remaining <= 0) {
        clearInterval(timerRef.current!);
        timerRef.current = null;
        restEndTimeRef.current = null;
        setRestTimer(null);
        // Already elapsed by the time we returned — close the notification.
        messageRestTimerSW({ type: 'CANCEL_REST_TIMER' });
      }
    }
  }

  document.addEventListener('visibilitychange', onVisible);
  return () => document.removeEventListener('visibilitychange', onVisible);
}, []);

  useEffect(() => {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}, []);

  function startRestTimer(secs: number) {
    if (timerRef.current) clearInterval(timerRef.current);
    const endTime = Date.now() + secs * 1000;
    restEndTimeRef.current = endTime;
    setRestTarget(secs);
    setRestTimer(secs);
    // The SW fires the notification at endTime even if this page is frozen.
    messageRestTimerSW({ type: 'START_REST_TIMER', endTime });
    timerRef.current = setInterval(() => {
      const remaining = Math.round((restEndTimeRef.current! - Date.now()) / 1000);
      if (remaining <= 0) {
        clearInterval(timerRef.current!);
        timerRef.current = null;
        restEndTimeRef.current = null;
        setRestTimer(null);
        // Only suppress the notification if the app is genuinely in the
        // foreground. A backgrounded tab's interval is throttled (not frozen),
        // so it can tick late while hidden — cancelling here would kill the
        // very notification we want to deliver.
        if (document.visibilityState === 'visible') {
          messageRestTimerSW({ type: 'CANCEL_REST_TIMER' });
        }
      } else {
        setRestTimer(remaining);
      }
    }, 1000);
  }

  function stopRestTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    restEndTimeRef.current = null;
    setRestTimer(null);
    messageRestTimerSW({ type: 'CANCEL_REST_TIMER' });
  }

  // TEMP diagnostic — reports notification capabilities and schedules a test
  // notification 5s out so we can confirm background delivery on the device.
  async function runNotifDiag() {
    const supportsTrigger = 'TimestampTrigger' in window;
    const perm = typeof Notification !== 'undefined' ? Notification.permission : 'unavailable';
    let swState = 'none';
    try {
      const reg = await navigator.serviceWorker.ready;
      swState = reg.active ? 'active' : reg.waiting ? 'waiting' : reg.installing ? 'installing' : 'unknown';
      reg.active?.postMessage({ type: 'START_REST_TIMER', endTime: Date.now() + 5000 });
    } catch (e) {
      swState = 'error: ' + (e as Error).message;
    }
    alert(
      `TimestampTrigger supported: ${supportsTrigger}\n` +
      `Notification permission: ${perm}\n` +
      `Service worker: ${swState}\n\n` +
      `Scheduled a test notification in 5 seconds. Switch to another app now and wait for it.`
    );
  }

  function getInput(exerciseId: string, history: PlannedExercise['history'], side?: string) {
  const key = side ? `${exerciseId}-${side}` : exerciseId;
  if (inputs[key]) return inputs[key];
  return { weight: history ? String(history.lastWeight) : '', reps: '', rir: '', isWarmup: false };
}

function updateInput(exerciseId: string, field: string, value: string | boolean, side?: string) {
  const key = side ? `${exerciseId}-${side}` : exerciseId;
  // Seed the base from the exercise's real history so the pre-populated weight
  // isn't wiped when the first edit is to reps/RIR (prev[key] doesn't exist yet).
  const history = exMap[exerciseId]?.history ?? null;
  setInputs((prev) => ({
    ...prev,
    [key]: { ...getInput(exerciseId, history, side), ...prev[key], [field]: value },
  }));
}

  // ── Stopwatch (time-based exercises) ────────────────────────────────────
  const [stopwatches, setStopwatches] = useState<Record<string, { running: boolean; elapsedSec: number; startedAt: number | null }>>({});
  const [stopwatchTick, setStopwatchTick] = useState(0);

  useEffect(() => {
    const anyRunning = Object.values(stopwatches).some((s) => s.running);
    if (!anyRunning) return;
    const interval = setInterval(() => setStopwatchTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [stopwatches]);

  function getStopwatchSeconds(key: string): number {
    const sw = stopwatches[key];
    if (!sw) return 0;
    if (sw.running && sw.startedAt) {
      return sw.elapsedSec + Math.floor((Date.now() - sw.startedAt) / 1000);
    }
    return sw.elapsedSec;
  }

  function toggleStopwatch(key: string) {
    setStopwatches((prev) => {
      const sw = prev[key] ?? { running: false, elapsedSec: 0, startedAt: null };
      if (sw.running) {
        const elapsed = sw.elapsedSec + Math.floor((Date.now() - (sw.startedAt ?? Date.now())) / 1000);
        return { ...prev, [key]: { running: false, elapsedSec: elapsed, startedAt: null } };
      }
      return { ...prev, [key]: { running: true, elapsedSec: sw.elapsedSec, startedAt: Date.now() } };
    });
  }

  function resetStopwatch(key: string) {
    setStopwatches((prev) => ({ ...prev, [key]: { running: false, elapsedSec: 0, startedAt: null } }));
  }

  function formatDuration(totalSec: number): string {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function formatSetDisplay(weight: number, reps: number | null, rir: number, durationSeconds?: number | null): string {
    if (durationSeconds != null && durationSeconds > 0) {
      return weight > 0 ? `${weight}lbs, ${formatDuration(durationSeconds)}` : formatDuration(durationSeconds);
    }
    return `${weight}lbs × ${reps} @ ${rir} RIR`;
  }

  function getMode(exerciseId: string): SetMode {
    return setModes[exerciseId] ?? 'STRAIGHT';
  }

  function setMode(exerciseId: string, mode: SetMode) {
    setSetModes((prev) => ({ ...prev, [exerciseId]: mode }));
    setSupersetPartners((prev) => ({ ...prev, [exerciseId]: null }));
    setMyorepPhase((prev) => ({ ...prev, [exerciseId]: 'activation' }));
    setDropPhase((prev) => ({ ...prev, [exerciseId]: false }));
  }

  // ── Reorder ──────────────────────────────────────────────────────────────

  function moveUp(exId: string) {
    setExerciseOrder((prev) => {
      const i = prev.indexOf(exId);
      if (i <= 0) return prev;
      const next = [...prev];
      [next[i - 1], next[i]] = [next[i], next[i - 1]];
      return next;
    });
  }

  function moveDown(exId: string) {
    setExerciseOrder((prev) => {
      const i = prev.indexOf(exId);
      if (i >= prev.length - 1) return prev;
      const next = [...prev];
      [next[i], next[i + 1]] = [next[i + 1], next[i]];
      return next;
    });
  }

  // ── Log set helpers ──────────────────────────────────────────────────────

  function doLogSet(params: {
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
    durationSeconds?: number | null;
    skipTimer?: boolean;
  }) {
    // Guard against double-taps: ignore calls within 300ms for the same
    // exercise + side combination. Keying on side (not just exerciseId) lets
    // programmatic L+R calls in the same superset handler fire without conflict,
    // while still catching a human tapping the same button twice.
    const now = Date.now();
    const debounceKey = `${params.exerciseId}-${params.side ?? ''}`;
    if (now - (lastLoggedAt.current[debounceKey] ?? 0) < 300) return false;
    lastLoggedAt.current[debounceKey] = now;

    const execOrder = exerciseOrder.indexOf(params.exerciseId);
    const tempId = `opt-${generateGroupId()}`;

    setLoggedSets((prev) => [...prev, {
      id: tempId,
      exerciseId: params.exerciseId,
      weightLbs: params.weight,
      reps: params.reps,
      rir: params.rir,
      durationSeconds: params.durationSeconds ?? null,
      isWarmup: params.isWarmup,
      executionOrder: execOrder >= 0 ? execOrder : 0,
      setType: params.setType,
      setGroupId: params.setGroupId,
      side: params.side ?? null,
    }]);
    if (!params.isWarmup && !params.skipTimer) startRestTimer(params.restSecs);

    // Guard #1: increment pending count so Finish is blocked until this resolves
    pendingLogs.current += 1;

    logSet({
      workoutId: workout.id,
      exerciseId: params.exerciseId,
      weightLbs: params.weight,
      reps: params.reps,
      rir: params.rir,
      isWarmup: params.isWarmup,
      executionOrder: execOrder >= 0 ? execOrder : 0,
      setType: params.setType,
      setGroupId: params.setGroupId,
      side: params.side ?? null,
      assistanceWeightLbs: params.assistanceWeightLbs ?? null,
      bodyweightLbs: params.bodyweightLbs ?? null,
      durationSeconds: params.durationSeconds ?? null,
    }).then((result) => {
      pendingLogs.current -= 1;
      if (result.success && result.setId) {
        if (cancelledTempIds.current.has(tempId)) {
          // User deleted while in flight — clean up the now-orphaned DB row
          cancelledTempIds.current.delete(tempId);
          deleteSet(result.setId);
        } else {
          setLoggedSets((prev) => prev.map((s) => s.id === tempId ? { ...s, id: result.setId! } : s));
        }
      } else {
        setLoggedSets((prev) => prev.filter((s) => s.id !== tempId));
        alert('Failed to save set — check your connection and try again.');
      }
    }).catch(() => {
      // Network error or server throw — roll back and unblock Finish Workout
      pendingLogs.current -= 1;
      setLoggedSets((prev) => prev.filter((s) => s.id !== tempId));
      alert('Failed to save set — check your connection and try again.');
    });

    return true;
  }

  // ── Straight set ─────────────────────────────────────────────────────────

  async function handleLogStraightSet(ex: PlannedExercise) {
    const currentSide = ex.isUnilateral ? (unilateralPhase[ex.exerciseId] ?? 'LEFT') : null;
    const input = getInput(ex.exerciseId, ex.history, currentSide ?? undefined);
    let rir = parseFloat(input.rir);

    let weight: number;
    let reps: number;
    let durationSeconds: number | null = null;

    if (ex.isTimeBased) {
      const swKey = currentSide ? `${ex.exerciseId}-${currentSide}` : ex.exerciseId;
      durationSeconds = getStopwatchSeconds(swKey);
      if (durationSeconds <= 0) return alert('Start and stop the timer to record a duration.');
      weight = input.weight ? parseFloat(input.weight) : 0;
      if (isNaN(weight)) weight = 0;
      // Stored as 0 (reps column is non-nullable); time-based sets are identified
      // by durationSeconds in history/chart/progression logic, not by reps.
      reps = 0;
      rir = 0;
    } else {
      weight = parseFloat(input.weight);
      reps = parseInt(input.reps);
      if (isNaN(weight) || isNaN(reps) || isNaN(rir)) return alert('Fill in weight, reps, and RIR.');
    }

    const ok = await doLogSet({
      exerciseId: ex.exerciseId,
      weight, reps, rir,
      durationSeconds,
      isWarmup: input.isWarmup,
      setType: 'STRAIGHT',
      setGroupId: null,
      restSecs: ex.restTimerSecs,
      side: currentSide,
      skipTimer: ex.isUnilateral && !unilateralPendingSide[ex.exerciseId],
      assistanceWeightLbs: ex.isAssisted ? weight : null,
      bodyweightLbs: (ex.isAssisted || ex.isBodyweight) ? currentBodyweight : null,
    });
    if (ok && ex.isTimeBased) {
      const swKey = currentSide ? `${ex.exerciseId}-${currentSide}` : ex.exerciseId;
      resetStopwatch(swKey);
    }

    if (ok) {
      if (ex.isUnilateral) {
        if (!unilateralPendingSide[ex.exerciseId]) {
          // First side logged — mark as pending, switch to other side, no timer
          const nextSide = currentSide === 'LEFT' ? 'RIGHT' : 'LEFT';
          updateInput(ex.exerciseId, 'weight', input.weight, nextSide);
          setUnilateralPhase((prev) => ({ ...prev, [ex.exerciseId]: nextSide }));
          setUnilateralPendingSide((prev) => ({ ...prev, [ex.exerciseId]: currentSide! }));
        } else {
          // Second side logged — clear pending, reset to LEFT, start timer
          setUnilateralPhase((prev) => ({ ...prev, [ex.exerciseId]: 'LEFT' }));
          setUnilateralPendingSide((prev) => { const n = { ...prev }; delete n[ex.exerciseId]; return n; });
          startRestTimer(ex.restTimerSecs);
        }
      } else {
        setInputs((prev) => ({
          ...prev,
          [ex.exerciseId]: { ...prev[ex.exerciseId], weight: input.weight, reps: '', rir: '', isWarmup: false },
        }));
      }
      setFlashingExercise(ex.exerciseId);
      setTimeout(() => setFlashingExercise(null), 600);
    }
  }

  // ── Superset ─────────────────────────────────────────────────────────────

  async function handleSearchSupersetPartner(ex: PlannedExercise) {
    setShowPartnerSearch((prev) => ({ ...prev, [ex.exerciseId]: true }));
    const result = await getSubstituteExercises(ex.exerciseId, ex.primaryMuscle, ex.movementPattern);
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
    const sideA = exMap[ex.exerciseId]?.isUnilateral ? (unilateralPhase[ex.exerciseId] ?? 'LEFT') : null;
    // Use the partner's own flag — a partner pulled from substitutes isn't in exMap.
    const sideB = partner && partner.isUnilateral ? (unilateralPhase[partner.id] ?? 'LEFT') : null;

    const groupId = generateGroupId();
    const isSameMuscle = ex.primaryMuscle === partner.primaryMuscle;

    if (partner.isUnilateral) {
      const bLeftKey = `${ex.exerciseId}-B-LEFT`;
      const bRightKey = `${ex.exerciseId}-B-RIGHT`;
      const inputBLeft = supersetInputs[bLeftKey] ?? { weight: '', reps: '', rir: '' };
      const inputBRight = supersetInputs[bRightKey] ?? { weight: '', reps: '', rir: '' };
      const wBL = parseFloat(inputBLeft.weight), rBL = parseInt(inputBLeft.reps), rirBL = parseFloat(inputBLeft.rir);
      const wBR = parseFloat(inputBRight.weight), rBR = parseInt(inputBRight.reps), rirBR = parseFloat(inputBRight.rir);

      if (ex.isUnilateral) {
        const aLeftInput = getInput(ex.exerciseId, ex.history, 'LEFT');
        const aRightInput = getInput(ex.exerciseId, ex.history, 'RIGHT');
        const wAL = parseFloat(aLeftInput.weight), rAL = parseInt(aLeftInput.reps), rirAL = parseFloat(aLeftInput.rir);
        const wAR = parseFloat(aRightInput.weight), rAR = parseInt(aRightInput.reps), rirAR = parseFloat(aRightInput.rir);
        if (isNaN(wAL) || isNaN(rAL) || isNaN(rirAL) || isNaN(wAR) || isNaN(rAR) || isNaN(rirAR) || isNaN(wBL) || isNaN(rBL) || isNaN(rirBL) || isNaN(wBR) || isNaN(rBR) || isNaN(rirBR)) {
          return alert('Fill in weight, reps, and RIR for all inputs.');
        }
        await doLogSet({ exerciseId: ex.exerciseId, weight: wAL, reps: rAL, rir: rirAL, isWarmup: false, setType: 'SUPERSET_A', setGroupId: groupId, restSecs: ex.restTimerSecs, side: 'LEFT' });
        await doLogSet({ exerciseId: ex.exerciseId, weight: wAR, reps: rAR, rir: rirAR, isWarmup: false, setType: 'SUPERSET_A', setGroupId: groupId, restSecs: ex.restTimerSecs, side: 'RIGHT' });
        updateInput(ex.exerciseId, 'reps', '', 'LEFT');
        updateInput(ex.exerciseId, 'rir', '', 'LEFT');
        updateInput(ex.exerciseId, 'reps', '', 'RIGHT');
        updateInput(ex.exerciseId, 'rir', '', 'RIGHT');
      } else {
        if (isNaN(wA) || isNaN(rA) || isNaN(rirA) || isNaN(wBL) || isNaN(rBL) || isNaN(rirBL) || isNaN(wBR) || isNaN(rBR) || isNaN(rirBR)) {
          return alert('Fill in weight, reps, and RIR for all inputs.');
        }
        await doLogSet({ exerciseId: ex.exerciseId, weight: wA, reps: rA, rir: rirA, isWarmup: false, setType: 'SUPERSET_A', setGroupId: groupId, restSecs: ex.restTimerSecs, side: sideA });
        setInputs((prev) => ({ ...prev, [ex.exerciseId]: { ...prev[ex.exerciseId], reps: '', rir: '' } }));
      }
      await doLogSet({ exerciseId: partner.id, weight: wBL, reps: rBL, rir: rirBL, isWarmup: false, setType: 'SUPERSET_B', setGroupId: groupId, restSecs: ex.restTimerSecs, side: 'LEFT' });
      await doLogSet({ exerciseId: partner.id, weight: wBR, reps: rBR, rir: rirBR, isWarmup: false, setType: 'SUPERSET_B', setGroupId: groupId, restSecs: ex.restTimerSecs, side: 'RIGHT' });
      setSupersetInputs((prev) => ({ ...prev, [bLeftKey]: { weight: inputBLeft.weight, reps: '', rir: '' }, [bRightKey]: { weight: inputBRight.weight, reps: '', rir: '' } }));
    } else {
      if (ex.isUnilateral) {
        const aLeftInput = getInput(ex.exerciseId, ex.history, 'LEFT');
        const aRightInput = getInput(ex.exerciseId, ex.history, 'RIGHT');
        const wAL = parseFloat(aLeftInput.weight), rAL = parseInt(aLeftInput.reps), rirAL = parseFloat(aLeftInput.rir);
        const wAR = parseFloat(aRightInput.weight), rAR = parseInt(aRightInput.reps), rirAR = parseFloat(aRightInput.rir);
        if (isNaN(wAL) || isNaN(rAL) || isNaN(rirAL) || isNaN(wAR) || isNaN(rAR) || isNaN(rirAR) || isNaN(wB) || isNaN(rB) || isNaN(rirB)) {
          return alert('Fill in weight, reps, and RIR for all inputs.');
        }
        await doLogSet({ exerciseId: ex.exerciseId, weight: wAL, reps: rAL, rir: rirAL, isWarmup: false, setType: 'SUPERSET_A', setGroupId: groupId, restSecs: ex.restTimerSecs, side: 'LEFT' });
        await doLogSet({ exerciseId: ex.exerciseId, weight: wAR, reps: rAR, rir: rirAR, isWarmup: false, setType: 'SUPERSET_A', setGroupId: groupId, restSecs: ex.restTimerSecs, side: 'RIGHT' });
        await doLogSet({ exerciseId: partner.id, weight: wB, reps: rB, rir: rirB, isWarmup: false, setType: 'SUPERSET_B', setGroupId: groupId, restSecs: ex.restTimerSecs, side: sideB });
        updateInput(ex.exerciseId, 'reps', '', 'LEFT');
        updateInput(ex.exerciseId, 'rir', '', 'LEFT');
        updateInput(ex.exerciseId, 'reps', '', 'RIGHT');
        updateInput(ex.exerciseId, 'rir', '', 'RIGHT');
        setSupersetInputs((prev) => ({ ...prev, [ex.exerciseId]: { weight: inputB.weight, reps: '', rir: '' } }));
      } else {
        if (isNaN(wA) || isNaN(rA) || isNaN(rirA) || isNaN(wB) || isNaN(rB) || isNaN(rirB)) {
          return alert('Fill in weight, reps, and RIR for both exercises.');
        }
        await doLogSet({ exerciseId: ex.exerciseId, weight: wA, reps: rA, rir: rirA, isWarmup: false, setType: 'SUPERSET_A', setGroupId: groupId, restSecs: ex.restTimerSecs, side: sideA });
        await doLogSet({ exerciseId: partner.id, weight: wB, reps: rB, rir: rirB, isWarmup: false, setType: 'SUPERSET_B', setGroupId: groupId, restSecs: ex.restTimerSecs, side: sideB });
        setInputs((prev) => ({ ...prev, [ex.exerciseId]: { ...prev[ex.exerciseId], reps: '', rir: '' } }));
        setSupersetInputs((prev) => ({ ...prev, [ex.exerciseId]: { weight: inputB.weight, reps: '', rir: '' } }));
      }
    }

    setFlashingExercise(ex.exerciseId);
    setTimeout(() => setFlashingExercise(null), 600);

    if (isSameMuscle) startRestTimer(ex.restTimerSecs * 1.5);
  }

  async function handleLogSupersetDrop(ex: PlannedExercise, groupId: string) {
    const partner = supersetPartners[ex.exerciseId];
    if (!partner) return;
    const d = supersetDropInputs[groupId] ?? { weightA: '', repsA: '', rirA: '', weightB: '', repsB: '', rirB: '' };
    const wA = parseFloat(d.weightA), rA = parseInt(d.repsA), rirA = parseFloat(d.rirA);
    const wB = parseFloat(d.weightB), rB = parseInt(d.repsB), rirB = parseFloat(d.rirB);
    if (isNaN(wA) || isNaN(rA) || isNaN(rirA) || isNaN(wB) || isNaN(rB) || isNaN(rirB)) {
      return alert('Fill in weight, reps, and RIR for both exercises.');
    }
    await doLogSet({ exerciseId: ex.exerciseId, weight: wA, reps: rA, rir: rirA, isWarmup: false, setType: 'SS_DROP_A', setGroupId: groupId, restSecs: 10 });
    await doLogSet({ exerciseId: partner.id, weight: wB, reps: rB, rir: rirB, isWarmup: false, setType: 'SS_DROP_B', setGroupId: groupId, restSecs: 10 });
    setSupersetDropInputs((prev) => ({ ...prev, [groupId]: { ...d, repsA: '', rirA: '', repsB: '', rirB: '' } }));
    setActiveSupersetPairDrop(null);
    setFlashingExercise(ex.exerciseId);
    setTimeout(() => setFlashingExercise(null), 600);
  }

  // ── Myo-reps ─────────────────────────────────────────────────────────────

  async function handleLogMyorep(ex: PlannedExercise) {
    const currentSide = ex.isUnilateral ? (unilateralPhase[ex.exerciseId] ?? 'LEFT') : null;
    const input = getInput(ex.exerciseId, ex.history, currentSide ?? undefined);
    const weight = parseFloat(input.weight);
    const reps = parseInt(input.reps);
    const rir = parseFloat(input.rir);
    if (isNaN(weight) || isNaN(reps) || isNaN(rir)) return alert('Fill in weight, reps, and RIR.');

    const phase = myorepPhase[ex.exerciseId] ?? 'activation';

    if (phase === 'activation') {
      const groupId = generateGroupId();
      setMyorepGroupIds((prev) => ({ ...prev, [ex.exerciseId]: groupId }));
      await doLogSet({ exerciseId: ex.exerciseId, weight, reps, rir, isWarmup: false, setType: 'MYOREP_ACTIVATION', setGroupId: groupId, restSecs: 25, side: currentSide });
      setMyorepPhase((prev) => ({ ...prev, [ex.exerciseId]: 'mini' }));
    } else {
      const groupId = myorepGroupIds[ex.exerciseId] ?? generateGroupId();
      await doLogSet({ exerciseId: ex.exerciseId, weight, reps, rir, isWarmup: false, setType: 'MYOREP_MINI', setGroupId: groupId, restSecs: 25, side: currentSide });
    }

    if (ex.isUnilateral) {
      const nextSide = currentSide === 'LEFT' ? 'RIGHT' : 'LEFT';
      updateInput(ex.exerciseId, 'weight', input.weight, nextSide);
      setUnilateralPhase((prev) => ({ ...prev, [ex.exerciseId]: nextSide }));
      if (nextSide === 'LEFT') startRestTimer(ex.restTimerSecs);
    } else {
      setInputs((prev) => ({ ...prev, [ex.exerciseId]: { ...prev[ex.exerciseId], reps: '', rir: '' } }));
    }
    setFlashingExercise(ex.exerciseId);
    setTimeout(() => setFlashingExercise(null), 600);
  }

  function handleEndMyorep(exerciseId: string) {
    setMyorepPhase((prev) => ({ ...prev, [exerciseId]: 'activation' }));
    setMyorepGroupIds((prev) => { const n = { ...prev }; delete n[exerciseId]; return n; });
  }

  // ── Drop sets ─────────────────────────────────────────────────────────────

  async function handleLogDropSet(ex: PlannedExercise) {
    const currentSide = ex.isUnilateral ? (unilateralPhase[ex.exerciseId] ?? 'LEFT') : null;
    const input = getInput(ex.exerciseId, ex.history, currentSide ?? undefined);
    const weight = parseFloat(input.weight);
    const reps = parseInt(input.reps);
    const rir = parseFloat(input.rir);
    if (isNaN(weight) || isNaN(reps) || isNaN(rir)) return alert('Fill in weight, reps, and RIR.');

    const isInDrop = dropPhase[ex.exerciseId] ?? false;

    if (!isInDrop) {
      const groupId = generateGroupId();
      setDropGroupIds((prev) => ({ ...prev, [ex.exerciseId]: groupId }));
      await doLogSet({ exerciseId: ex.exerciseId, weight, reps, rir, isWarmup: false, setType: 'DROPSET_PRIMARY', setGroupId: groupId, restSecs: 10, side: currentSide });
      setDropPhase((prev) => ({ ...prev, [ex.exerciseId]: true }));
    } else {
      const groupId = dropGroupIds[ex.exerciseId] ?? generateGroupId();
      await doLogSet({ exerciseId: ex.exerciseId, weight, reps, rir, isWarmup: false, setType: 'DROPSET_DROP', setGroupId: groupId, restSecs: 10, side: currentSide });
    }

    if (ex.isUnilateral) {
      const nextSide = currentSide === 'LEFT' ? 'RIGHT' : 'LEFT';
      updateInput(ex.exerciseId, 'weight', input.weight, nextSide);
      setUnilateralPhase((prev) => ({ ...prev, [ex.exerciseId]: nextSide }));
      if (nextSide === 'LEFT') startRestTimer(ex.restTimerSecs);
    } else {
      setInputs((prev) => ({ ...prev, [ex.exerciseId]: { ...prev[ex.exerciseId], weight: input.weight, reps: '', rir: '' } }));
    }
    setFlashingExercise(ex.exerciseId);
    setTimeout(() => setFlashingExercise(null), 600);
  }

  function handleEndDropSet(exerciseId: string) {
    setDropPhase((prev) => ({ ...prev, [exerciseId]: false }));
    setDropGroupIds((prev) => { const n = { ...prev }; delete n[exerciseId]; return n; });
    startRestTimer(exMap[exerciseId]?.restTimerSecs ?? 120);
  }

  async function handleInlineDrop(originalSetId: string, ex: PlannedExercise) {
    const dropInput = inlineDropInputs[originalSetId];
    if (!dropInput) return;

    const weight = parseFloat(dropInput.weight);
    const reps = parseInt(dropInput.reps);
    const rir = parseFloat(dropInput.rir);
    if (isNaN(weight) || isNaN(reps) || isNaN(rir)) return alert('Fill in weight, reps, and RIR for the drop.');

    const ok = await doLogSet({
      exerciseId: ex.exerciseId,
      weight, reps, rir,
      isWarmup: false,
      setType: 'DROPSET_DROP',
      setGroupId: originalSetId,
      restSecs: ex.restTimerSecs,
    });

    if (ok) {
      setInlineDropInputs((prev) => ({ ...prev, [originalSetId]: { weight: '', reps: '', rir: '' } }));
      setActiveDropForSet(null);
      setFlashingExercise(ex.exerciseId);
      setTimeout(() => setFlashingExercise(null), 600);
    }
  }

  // ── Swap ──────────────────────────────────────────────────────────────────

  async function handleOpenPivot(ex: PlannedExercise) {
    setPivotingExerciseId(ex.exerciseId);
    setLoadingSubstitutes(true);
    const result = await getSubstituteExercises(ex.exerciseId, ex.primaryMuscle, ex.movementPattern);
    setSubstitutes(result.substitutes ?? []);
    setLoadingSubstitutes(false);
  }

  async function handleConfirmSwap(originalEx: PlannedExercise, substitute: Substitute) {
    setSwaps((prev) => [...prev, { originalId: originalEx.exerciseId, originalName: originalEx.exerciseName, replacement: substitute }]);
    setActiveExercises((prev) => prev.map((ex) =>
      ex.exerciseId === originalEx.exerciseId
        ? { ...ex, exerciseId: substitute.id, exerciseName: substitute.name, primaryMuscle: substitute.primaryMuscle, equipment: substitute.equipment, isUnilateral: substitute.isUnilateral, isTimeBased: substitute.isTimeBased, isBodyweight: substitute.isBodyweight, isAssisted: substitute.isAssisted, history: null }
        : ex
    ));
    // Update the order list too
    setExerciseOrder((prev) => prev.map((id) => id === originalEx.exerciseId ? substitute.id : id));
    setPivotingExerciseId(null);
    setSubstitutes([]);
    setExpandedExercise(substitute.id);

    // Backfill the substitute's own prior history so weight prefill and the
    // "last time" hints work after a swap (fetched async, patched in on arrival).
    const fetched = await getExerciseHistory(substitute.id, profileId, originalEx.plannedOrder);
    if (!fetched) return;
    const history = {
      lastWeight: fetched.lastWeight,
      lastReps: fetched.lastReps,
      lastRir: fetched.lastRir,
      lastDate: String(fetched.lastDate),
      lastExecutionOrder: fetched.lastExecutionOrder,
      allSets: fetched.allSets.map((s) => ({
        weight: s.weight, reps: s.reps, rir: s.rir, durationSeconds: s.durationSeconds,
      })),
    };
    setActiveExercises((prev) => prev.map((ex) =>
      ex.exerciseId === substitute.id ? { ...ex, history } : ex
    ));
  }

  function handleDeleteSet(setId: string) {
    setLoggedSets((prev) => prev.filter((s) => s.id !== setId));
    if (setId.startsWith('opt-')) {
      // Set is still in flight — register so doLogSet cleans up the DB row on confirmation
      cancelledTempIds.current.add(setId);
    } else {
      deleteSet(setId);
    }
  }

  // ── Finish (API route to avoid server action re-render) ──────────────────

  async function handleFinish() {
    setIsSubmitting(true);
    // Cancel any pending rest-timer notification so it can't fire after the
    // workout is already done.
    stopRestTimer();
    // Wait for any optimistic set saves still in flight so the DB is fully
    // up-to-date before finishWorkout queries it.
    if (pendingLogs.current > 0) {
      await new Promise<void>((resolve) => {
        const poll = setInterval(() => {
          if (pendingLogs.current === 0) { clearInterval(poll); resolve(); }
        }, 50);
      });
    }
    const durationMins = Math.max(1, Math.round((Date.now() - startTime.current) / 60000));
    try {
      const res = await fetch('/api/finish-workout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workoutId: workout.id, durationMins }),
      });
      const result = await res.json();
      if (result.success && result.summary) {
        setSummary(result.summary);
      } else {
        alert('Failed to finish workout.');
        setIsSubmitting(false);
      }
    } catch {
      alert('Failed to finish workout.');
      setIsSubmitting(false);
    }
  }

  function getProgressionHint(ex: PlannedExercise, currentOrder: number) {
    if (!ex.history) return null;
    if (ex.isTimeBased) return null;
    const lastOrder = ex.history.lastExecutionOrder;
    const positionChanged = Math.abs(lastOrder - currentOrder) >= 2;
    if (ex.history.lastReps == null) return null;
    const hitTopOfRange = ex.history.lastReps >= ex.targetRepMax;
    const rirWasGood = ex.history.lastRir >= ex.targetRir;
    if (positionChanged) {
      const direction = currentOrder > lastOrder ? 'later' : 'earlier';
      return { type: 'context' as const, text: `Exercise ${direction} in session vs last time. ${direction === 'later' ? 'Expect slightly fewer reps.' : 'May perform better fresh.'}` };
    }
    if (hitTopOfRange && rirWasGood) return { type: 'increase' as const, text: `Hit ${ex.history.lastReps} reps last time — ready to add weight.` };
    return { type: 'maintain' as const, text: `Last: ${ex.history.lastReps} reps @ ${ex.history.lastWeight}lbs (${ex.history.lastRir} RIR)` };
  }

  function getWarmupSuggestions(lastWeight: number, sessionIndex: number) {
    const round = (w: number) => Math.round(w / 2.5) * 2.5;
    if (sessionIndex <= 1) {
      return [
        { pct: 40, weight: round(lastWeight * 0.4), reps: 10 },
        { pct: 65, weight: round(lastWeight * 0.65), reps: 5 },
      ];
    }
    return [
      { pct: 60, weight: round(lastWeight * 0.6), reps: 5 },
    ];
  }

  // ── Summary screen ────────────────────────────────────────────────────────
    const supersetPartnerOf = Object.entries(supersetPartners).reduce((acc, [sourceId, p]) => {
      if (p) acc[p.id] = sourceId;
      return acc;
    }, {} as Record<string, string>);
    
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
              Multiple unexplained performance declines detected. Consider a <Tooltip definition={GLOSSARY.deload}>deload</Tooltip> week — reduce load by 40–50%, cut volume by half, keep <Tooltip definition={GLOSSARY.RIR}>RIR</Tooltip> high.
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
                  <span className={ex.status === 'skipped' ? 'text-zinc-600' : ex.sets.length >= ex.planned.sets ? 'text-emerald-400' : 'text-yellow-400'}>
                    {ex.status === 'skipped' ? 'Skipped' : `${ex.sets.length} sets completed`}
                  </span>
                </div>
              )}

              {ex.restNote && (
                <p className={`mt-1 text-xs ${
                  ex.avgRestSecs < (ex.planned?.sets ?? 120) * 0.7
                    ? 'text-yellow-400'
                    : 'text-zinc-500'
                }`}>
                  ⏱ {ex.restNote}
                </p>
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

              {ex.progressionNote && <p className="mt-1 text-xs text-zinc-500">{ex.progressionNote}</p>}
              {ex.sets?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {ex.sets.map((s: any, i: number) => (
                    <span key={i} className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
                      {formatSetDisplay(s.weight, s.reps, s.rir, s.durationSeconds)}
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
          <button onClick={() => router.push('/dashboard')} className="mb-1 text-sm text-zinc-500 hover:text-zinc-300">
            ← Dashboard
          </button>
          <h1 className="text-2xl font-bold text-white">{workout.focus}</h1>
          <p className="text-sm text-zinc-400">
            {new Date(workout.date.slice(0, 10) + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={runNotifDiag} className="rounded-md border border-zinc-700 px-2 py-2 text-xs text-zinc-400 hover:border-zinc-500" title="Test notification">🔔</button>
          <button onClick={handleFinish} disabled={isSubmitting} className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">
            {isSubmitting ? 'Saving...' : 'Finish'}
          </button>
        </div>
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
              <button onClick={stopRestTimer} className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:border-zinc-500">Skip</button>
            </div>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
            <div className="h-full rounded-full bg-emerald-500 transition-all duration-1000" style={{ width: `${((restTarget - restTimer) / restTarget) * 100}%` }} />
          </div>
        </div>
      )}

      {exerciseOrder.map((exId, index) => {
        const ex = exMap[exId];
        if (!ex) return null;

        const mode = getMode(ex.exerciseId);
        const partnerForEx = supersetPartners[ex.exerciseId];
    
        
        const setsForExercise = loggedSets.filter((s) => 
          (s.exerciseId === ex.exerciseId || (mode === 'SUPERSET' && partnerForEx && s.exerciseId === partnerForEx.id)) 
          && !s.isWarmup
        );
        // Count completed sets across every mode the exercise participates in.
        // - STRAIGHT sets count individually (unilateral L+R = one set)
        // - Superset pairs count once per setGroupId (counts whether this exercise
        //   is the A source or the B partner, so both cards advance)
        // - Each dropset cluster (DROPSET_PRIMARY) and myo-rep cluster
        //   (MYOREP_ACTIVATION) counts as one set
        const ownSets = loggedSets.filter((s) => s.exerciseId === ex.exerciseId && !s.isWarmup);
        const aSetsOnly = ownSets.filter((s) => s.setType === 'STRAIGHT');
        const straightCount = ex.isUnilateral ? Math.floor(aSetsOnly.length / 2) : aSetsOnly.length;
        const supersetGroups = new Set(
          ownSets.filter((s) => s.setType === 'SUPERSET_A' || s.setType === 'SUPERSET_B').map((s) => s.setGroupId)
        ).size;
        const dropsetGroups = new Set(
          ownSets.filter((s) => s.setType === 'DROPSET_PRIMARY').map((s) => s.setGroupId)
        ).size;
        const myorepGroups = new Set(
          ownSets.filter((s) => s.setType === 'MYOREP_ACTIVATION').map((s) => s.setGroupId)
        ).size;
        const completedSetCount = straightCount + supersetGroups + dropsetGroups + myorepGroups;
        const isComplete = completedSetCount >= ex.targetSets;
        const isExpanded = expandedExercise === ex.exerciseId;
        const isPivoting = pivotingExerciseId === ex.exerciseId;
        const wasSwapped = swaps.some((s) => s.replacement.id === ex.exerciseId);
        const currentSide = ex.isUnilateral ? (unilateralPhase[ex.exerciseId] ?? 'LEFT') : null;
        const input = getInput(ex.exerciseId, ex.history, currentSide ?? undefined);
        const hint = getProgressionHint(ex, index);
        const partner = supersetPartners[ex.exerciseId];
        const supersetInput = supersetInputs[ex.exerciseId] ?? { weight: '', reps: '', rir: '' };
        const myoPhase = myorepPhase[ex.exerciseId] ?? 'activation';
        const inDrop = dropPhase[ex.exerciseId] ?? false;
        const dropSetsLogged = setsForExercise.filter((s) => s.setType === 'DROPSET_DROP').length;

        return (
          <div key={exId} className={`rounded-xl border transition-all duration-300 ${
            flashingExercise === ex.exerciseId ? 'border-emerald-400 bg-emerald-950/40 scale-[1.01]'
            : isComplete ? 'border-emerald-700 bg-emerald-950/20'
            : isPivoting ? 'border-yellow-600 bg-yellow-950/10'
            : isExpanded ? 'border-zinc-600 bg-zinc-900'
            : 'border-zinc-800 bg-zinc-900/30'
          }`}>

            {/* Exercise header with reorder buttons */}
            <div className="flex items-center p-4 gap-2">
              {/* Reorder */}
              <div className="flex flex-col gap-0.5 shrink-0">
                <button onClick={() => moveUp(exId)} disabled={index === 0}
                  className="rounded px-1 py-0.5 text-xs text-zinc-600 hover:text-zinc-300 disabled:opacity-20">▲</button>
                <button onClick={() => moveDown(exId)} disabled={index === exerciseOrder.length - 1}
                  className="rounded px-1 py-0.5 text-xs text-zinc-600 hover:text-zinc-300 disabled:opacity-20">▼</button>
              </div>

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
                  <p className="text-xs text-zinc-500">{completedSetCount}/{ex.targetSets} sets · {ex.targetRepMin}–{ex.targetRepMax} reps · {ex.targetRir} RIR</p>
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
              <span className="ml-1 text-sm text-zinc-600">{isExpanded ? '▲' : '▼'}</span>
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

                {/* Paired as superset partner — log from the source exercise */}
                {supersetPartnerOf[ex.exerciseId] && (
                  <div className="rounded-lg bg-zinc-800/50 px-4 py-3 text-xs text-zinc-400">
                    ⇄ Paired as superset with{' '}
                    <span className="text-white">
                      {exMap[supersetPartnerOf[ex.exerciseId]]?.exerciseName ?? 'another exercise'}
                    </span>
                    {' '}— log sets from that card.
                  </div>
                )}

                {/* Progression hint */}
                {hint && (
                  <div className={`rounded-lg p-3 text-xs ${hint.type === 'increase' ? 'bg-emerald-900/30 text-emerald-400' : hint.type === 'context' ? 'bg-yellow-900/30 text-yellow-400' : 'bg-zinc-800/50 text-zinc-400'}`}>
                    {hint.text}
                  </div>
                )}

                {/* Science note */}
                {EXERCISE_SCIENCE_NOTES[ex.exerciseName] && (
                  <p className="text-xs text-blue-400/70">
                    ℹ {EXERCISE_SCIENCE_NOTES[ex.exerciseName]}
                  </p>
                )}

                {/* Last session */}
                {ex.history && (
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs text-zinc-600">Last session:</span>
                    {ex.history.allSets.map((s, i) => (
                      <span key={i} className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">{formatSetDisplay(s.weight, s.reps, s.rir, s.durationSeconds)}</span>
                    ))}
                  </div>
                )}

                {/* Warm-up suggestions */}
                {ex.history && setsForExercise.length === 0 && (
                  <div className="rounded-lg bg-zinc-800/50 px-3 py-2 space-y-1">
                    <p className="text-xs text-zinc-500 font-medium">Suggested warm-up</p>
                    {getWarmupSuggestions(ex.history.lastWeight, index).map((s, i) => (
                      <p key={i} className="text-xs text-zinc-400">
                        {s.pct}% — {s.weight}lbs × {s.reps} reps
                      </p>
                    ))}
                  </div>
                )}

                {/* Logged sets */}
                {setsForExercise.length > 0 && (
                  <div className="space-y-1">
                    {mode === 'SUPERSET' ? (
                      // Group superset sets by setGroupId; include drop sets per pair
                      (() => {
                        const groups: Record<string, LoggedSet[]> = {};
                        setsForExercise.forEach((s) => {
                          const key = s.setGroupId ?? s.id;
                          if (!groups[key]) groups[key] = [];
                          groups[key].push(s);
                        });
                        return Object.entries(groups).map(([groupId, groupSets], gi) => {
                          const aSets = groupSets.filter((s) => s.setType === 'SUPERSET_A');
                          const bSets = groupSets.filter((s) => s.setType === 'SUPERSET_B');
                          const aDropSets = groupSets.filter((s) => s.setType === 'SS_DROP_A');
                          const bDropSets = groupSets.filter((s) => s.setType === 'SS_DROP_B');
                          const isPairDropActive = activeSupersetPairDrop === groupId;
                          const dropInput = supersetDropInputs[groupId] ?? { weightA: '', repsA: '', rirA: '', weightB: '', repsB: '', rirB: '' };
                          return (
                            <div key={groupId} className="rounded-md bg-zinc-800/50 px-3 py-2 space-y-1">
                              <span className="text-xs text-zinc-500">Pair {gi + 1}</span>
                              <div className="space-y-0.5">
                                {aSets.map((s) => (
                                  <div key={s.id} className="flex items-center justify-between">
                                    <span className="text-xs text-zinc-500">SS-A{s.side ? ` ${s.side}` : ''}</span>
                                    <span className="text-xs font-medium text-white">{formatSetDisplay(s.weightLbs, s.reps, s.rir, s.durationSeconds)}</span>
                                    <button onClick={() => handleDeleteSet(s.id)} className="text-xs text-zinc-600 hover:text-red-400">✕</button>
                                  </div>
                                ))}
                                {bSets.map((s) => (
                                  <div key={s.id} className="flex items-center justify-between">
                                    <span className="text-xs text-zinc-500">SS-B{s.side ? ` ${s.side}` : ''}</span>
                                    <span className="text-xs font-medium text-white">{formatSetDisplay(s.weightLbs, s.reps, s.rir, s.durationSeconds)}</span>
                                    <button onClick={() => handleDeleteSet(s.id)} className="text-xs text-zinc-600 hover:text-red-400">✕</button>
                                  </div>
                                ))}
                                {aDropSets.map((s, di) => (
                                  <div key={s.id} className="flex items-center justify-between">
                                    <span className="text-xs text-orange-500">Drop {di + 1} A</span>
                                    <span className="text-xs font-medium text-white">{formatSetDisplay(s.weightLbs, s.reps, s.rir, s.durationSeconds)}</span>
                                    <button onClick={() => handleDeleteSet(s.id)} className="text-xs text-zinc-600 hover:text-red-400">✕</button>
                                  </div>
                                ))}
                                {bDropSets.map((s, di) => (
                                  <div key={s.id} className="flex items-center justify-between">
                                    <span className="text-xs text-orange-500">Drop {di + 1} B</span>
                                    <span className="text-xs font-medium text-white">{formatSetDisplay(s.weightLbs, s.reps, s.rir, s.durationSeconds)}</span>
                                    <button onClick={() => handleDeleteSet(s.id)} className="text-xs text-zinc-600 hover:text-red-400">✕</button>
                                  </div>
                                ))}
                              </div>
                              <button
                                onClick={() => setActiveSupersetPairDrop(isPairDropActive ? null : groupId)}
                                className={`text-xs px-1.5 py-0.5 rounded border transition-colors ${isPairDropActive ? 'border-orange-600 text-orange-400' : 'border-zinc-700 text-zinc-600 hover:border-orange-600 hover:text-orange-400'}`}
                              >
                                {isPairDropActive ? '✕' : '→ Drop pair'}
                              </button>
                              {isPairDropActive && (
                                <div className="rounded-md border border-orange-700/50 bg-orange-950/10 p-3 space-y-2">
                                  <p className="text-xs text-orange-400">Drop both — reduce weight 20–30%</p>
                                  <div className="space-y-1">
                                    <p className="text-xs text-zinc-500">{ex.exerciseName}</p>
                                    <div className="grid grid-cols-3 gap-2">
                                      <div><label className="mb-1 block text-xs text-zinc-500">Weight</label><input type="number" step="2.5" value={dropInput.weightA} onChange={e => setSupersetDropInputs(prev => ({ ...prev, [groupId]: { ...dropInput, weightA: e.target.value } }))} className="w-full rounded-md border border-zinc-700 bg-zinc-950 p-2 text-center text-sm text-white focus:border-orange-500 focus:outline-none" /></div>
                                      <div><label className="mb-1 block text-xs text-zinc-500">Reps</label><input type="number" value={dropInput.repsA} onChange={e => setSupersetDropInputs(prev => ({ ...prev, [groupId]: { ...dropInput, repsA: e.target.value } }))} className="w-full rounded-md border border-zinc-700 bg-zinc-950 p-2 text-center text-sm text-white focus:border-orange-500 focus:outline-none" /></div>
                                      <div><label className="mb-1 block text-xs text-zinc-500">RIR</label><input type="number" step="0.5" min="0" max="5" value={dropInput.rirA} onChange={e => setSupersetDropInputs(prev => ({ ...prev, [groupId]: { ...dropInput, rirA: e.target.value } }))} className="w-full rounded-md border border-zinc-700 bg-zinc-950 p-2 text-center text-sm text-white focus:border-orange-500 focus:outline-none" /></div>
                                    </div>
                                  </div>
                                  <div className="space-y-1">
                                    <p className="text-xs text-zinc-500">{partner?.name}</p>
                                    <div className="grid grid-cols-3 gap-2">
                                      <div><label className="mb-1 block text-xs text-zinc-500">Weight</label><input type="number" step="2.5" value={dropInput.weightB} onChange={e => setSupersetDropInputs(prev => ({ ...prev, [groupId]: { ...dropInput, weightB: e.target.value } }))} className="w-full rounded-md border border-zinc-700 bg-zinc-950 p-2 text-center text-sm text-white focus:border-orange-500 focus:outline-none" /></div>
                                      <div><label className="mb-1 block text-xs text-zinc-500">Reps</label><input type="number" value={dropInput.repsB} onChange={e => setSupersetDropInputs(prev => ({ ...prev, [groupId]: { ...dropInput, repsB: e.target.value } }))} className="w-full rounded-md border border-zinc-700 bg-zinc-950 p-2 text-center text-sm text-white focus:border-orange-500 focus:outline-none" /></div>
                                      <div><label className="mb-1 block text-xs text-zinc-500">RIR</label><input type="number" step="0.5" min="0" max="5" value={dropInput.rirB} onChange={e => setSupersetDropInputs(prev => ({ ...prev, [groupId]: { ...dropInput, rirB: e.target.value } }))} className="w-full rounded-md border border-zinc-700 bg-zinc-950 p-2 text-center text-sm text-white focus:border-orange-500 focus:outline-none" /></div>
                                    </div>
                                  </div>
                                  <button onClick={() => handleLogSupersetDrop(ex, groupId)} className="w-full rounded-md bg-orange-700/50 py-2 text-sm font-semibold text-orange-200 hover:bg-orange-700/70">Log Drop Pair</button>
                                </div>
                              )}
                            </div>
                          );
                        });
                      })()
                    ) : ex.isUnilateral ? (
                      // Unilateral straight sets: group consecutive L+R into one "Set N" block
                      (() => {
                        const straightSets = setsForExercise.filter(s => s.setType === 'STRAIGHT');
                        const otherSets = setsForExercise.filter(s => s.setType !== 'STRAIGHT');
                        // Group consecutive opposite-side sets into L/R pairs. Walking
                        // the list (rather than slicing in twos) keeps pairing aligned
                        // even if one side of an earlier set was deleted.
                        const pairs: LoggedSet[][] = [];
                        for (const s of straightSets) {
                          const last = pairs[pairs.length - 1];
                          if (last && last.length < 2 && !last.some(x => x.side === s.side)) last.push(s);
                          else pairs.push([s]);
                        }
                        return (
                          <>
                            {pairs.map((pair, pi) => (
                              <div key={pair[0].id} className="rounded-md bg-zinc-800/50 px-3 py-2 space-y-1">
                                <span className="text-xs text-zinc-500">Set {pi + 1}</span>
                                {pair.map(s => (
                                  <div key={s.id} className="flex items-center justify-between">
                                    <span className="text-xs text-zinc-500">{s.side}</span>
                                    <span className="text-sm font-medium text-white">{formatSetDisplay(s.weightLbs, s.reps, s.rir, s.durationSeconds)}</span>
                                    <button onClick={() => handleDeleteSet(s.id)} className="text-xs text-zinc-600 hover:text-red-400">✕</button>
                                  </div>
                                ))}
                                {pair.length === 1 && unilateralPendingSide[ex.exerciseId] && (
                                  <p className="text-xs text-yellow-400/70">Waiting for {pair[0].side === 'LEFT' ? 'RIGHT' : 'LEFT'} side…</p>
                                )}
                              </div>
                            ))}
                            {otherSets.map((s, i) => (
                              <div key={s.id} className="flex items-center justify-between rounded-md bg-zinc-800/50 px-3 py-2">
                                <span className="text-xs text-zinc-500">
                                  {s.setType === 'MYOREP_ACTIVATION' ? 'Activation'
                                  : s.setType === 'MYOREP_MINI' ? `Mini ${i + 1}`
                                  : s.setType === 'DROPSET_PRIMARY' ? `Primary${s.side ? ` ${s.side}` : ''}`
                                  : s.setType === 'DROPSET_DROP' ? `Drop${s.side ? ` ${s.side}` : ''}`
                                  : `Set ${i + 1}`}
                                </span>
                                <span className="text-sm font-medium text-white">{formatSetDisplay(s.weightLbs, s.reps, s.rir, s.durationSeconds)}</span>
                                <button onClick={() => handleDeleteSet(s.id)} className="text-xs text-zinc-600 hover:text-red-400">✕</button>
                              </div>
                            ))}
                          </>
                        );
                      })()
                    ) : (
                      setsForExercise.map((s, i) => (
                        <div key={s.id} className="space-y-1">
                          <div className="flex items-center justify-between rounded-md bg-zinc-800/50 px-3 py-2">
                            <span className="text-xs text-zinc-500">
                              {s.setType === 'STRAIGHT' ? `Set ${i + 1}`
                              : s.setType === 'MYOREP_ACTIVATION' ? 'Activation'
                              : s.setType === 'MYOREP_MINI' ? `Mini ${i}`
                              : s.setType === 'DROPSET_PRIMARY' ? `Primary${s.side ? ` ${s.side}` : ''}`
                              : s.setType === 'DROPSET_DROP' ? `Drop${s.side ? ` ${s.side}` : ''}`
                              : `Set ${i + 1}`}
                            </span>
                            <span className="text-sm font-medium text-white">
                              {formatSetDisplay(s.weightLbs, s.reps, s.rir, s.durationSeconds)}
                            </span>
                            <div className="flex items-center gap-2">
                              {s.setType === 'STRAIGHT' && mode === 'STRAIGHT' && (
                                <button
                                  onClick={() => setActiveDropForSet(activeDropForSet === s.id ? null : s.id)}
                                  className={`text-xs px-1.5 py-0.5 rounded border transition-colors ${
                                    activeDropForSet === s.id
                                      ? 'border-orange-600 text-orange-400'
                                      : 'border-zinc-700 text-zinc-600 hover:border-orange-600 hover:text-orange-400'
                                  }`}
                                >
                                  {activeDropForSet === s.id ? '✕' : '→ Drop'}
                                </button>
                              )}
                              <button onClick={() => handleDeleteSet(s.id)} className="text-xs text-zinc-600 hover:text-red-400">✕</button>
                            </div>
                          </div>

                          {/* Inline drop input */}
                          {activeDropForSet === s.id && (
                            <div className="ml-4 rounded-md border border-orange-700/50 bg-orange-950/10 p-3 space-y-2">
                              <p className="text-xs text-orange-400">Drop set — reduce weight 20–30% and log</p>
                              <div className="grid grid-cols-3 gap-2">
                                <div>
                                  <label className="mb-1 block text-xs text-zinc-500">Weight</label>
                                  <input type="number" step="2.5"
                                    value={inlineDropInputs[s.id]?.weight ?? ''}
                                    onChange={(e) => setInlineDropInputs((prev) => ({ ...prev, [s.id]: { ...prev[s.id], weight: e.target.value } }))}
                                    className="w-full rounded-md border border-zinc-700 bg-zinc-950 p-2 text-center text-sm text-white focus:border-orange-500 focus:outline-none" />
                                </div>
                                <div>
                                  <label className="mb-1 block text-xs text-zinc-500">Reps</label>
                                  <input type="number"
                                    value={inlineDropInputs[s.id]?.reps ?? ''}
                                    onChange={(e) => setInlineDropInputs((prev) => ({ ...prev, [s.id]: { ...prev[s.id], reps: e.target.value } }))}
                                    className="w-full rounded-md border border-zinc-700 bg-zinc-950 p-2 text-center text-sm text-white focus:border-orange-500 focus:outline-none" />
                                </div>
                                <div>
                                  <label className="mb-1 block text-xs text-zinc-500"><Tooltip definition={GLOSSARY.RIR}>RIR</Tooltip></label>
                                  <input type="number" step="0.5" min="0" max="5"
                                    value={inlineDropInputs[s.id]?.rir ?? ''}
                                    onChange={(e) => setInlineDropInputs((prev) => ({ ...prev, [s.id]: { ...prev[s.id], rir: e.target.value } }))}
                                    className="w-full rounded-md border border-zinc-700 bg-zinc-950 p-2 text-center text-sm text-white focus:border-orange-500 focus:outline-none" />
                                </div>
                              </div>
                              <button onClick={() => handleInlineDrop(s.id, ex)}
                                className="w-full rounded-md bg-orange-700/50 py-2 text-sm font-semibold text-orange-200 hover:bg-orange-700/70">
                                Log Drop
                              </button>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Mode selector — always visible so the user can change mode even after logging */}
                {!supersetPartnerOf[ex.exerciseId] && (
                  <div className="flex gap-2">
                    {(ex.isTimeBased ? ['STRAIGHT'] : ['STRAIGHT', 'SUPERSET', 'MYOREP', 'DROPSET'] as SetMode[]).map((m) => (
                      <button key={m} onClick={() => setMode(ex.exerciseId, m as SetMode)}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${mode === m ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}>
                        {m === 'STRAIGHT' ? 'Straight' : m === 'SUPERSET' ? 'Superset' : m === 'MYOREP' ? 'Myo-reps': 'Drop set'}
                      </button>
                    ))}
                  </div>
                )}

                {/* ── STRAIGHT set input ── */}
                {mode === 'STRAIGHT' && !isComplete && !supersetPartnerOf[ex.exerciseId] && (
                  <div className="space-y-3">
                    {ex.isUnilateral && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (!unilateralPendingSide[ex.exerciseId]) {
                              setUnilateralPhase((prev) => ({ ...prev, [ex.exerciseId]: 'LEFT' }));
                            }
                          }}
                          disabled={!!unilateralPendingSide[ex.exerciseId]}
                          className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                            (unilateralPhase[ex.exerciseId] ?? 'LEFT') === 'LEFT'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700 disabled:cursor-not-allowed'
                          }`}
                        >LEFT</button>
                        <span className="text-xs text-zinc-600">→</span>
                        <button
                          type="button"
                          onClick={() => {
                            if (!unilateralPendingSide[ex.exerciseId]) {
                              setUnilateralPhase((prev) => ({ ...prev, [ex.exerciseId]: 'RIGHT' }));
                            }
                          }}
                          disabled={!!unilateralPendingSide[ex.exerciseId]}
                          className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                            (unilateralPhase[ex.exerciseId] ?? 'LEFT') === 'RIGHT'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700 disabled:cursor-not-allowed'
                          }`}
                        >RIGHT</button>
                        <span className="ml-2 text-xs text-zinc-500">
                          logging {unilateralPhase[ex.exerciseId] ?? 'LEFT'} side
                          {unilateralPendingSide[ex.exerciseId] && (
                            <span className="ml-1 text-yellow-400">({unilateralPendingSide[ex.exerciseId]} pending)</span>
                          )}
                        </span>
                      </div>
                    )}
                    {ex.isAssisted && (
                      <div>
                        <label className="mb-1 block text-xs text-zinc-500">
                          Assistance Weight (lbs) — subtracted from bodyweight ({currentBodyweight ?? '?'}lbs)
                        </label>
                        <input type="number" step="5" value={input.weight}
                          onChange={(e) => updateInput(ex.exerciseId, 'weight', e.target.value, currentSide ?? undefined)}
                          className="w-full rounded-md border border-zinc-700 bg-zinc-950 p-2 text-center text-sm text-white focus:border-emerald-500 focus:outline-none" />
                        {currentBodyweight && input.weight && (
                          <p className="mt-1 text-xs text-zinc-600">
                            Effective load: {Math.round(currentBodyweight - parseFloat(input.weight))}lbs
                          </p>
                        )}
                      </div>
                    )}
                    {ex.isTimeBased ? (
                      <div className="space-y-2">
                        <div>
                          <label className="mb-1 block text-xs text-zinc-500">Weight (lbs, optional)</label>
                          <input type="number" step="2.5" value={input.weight} onChange={(e) => updateInput(ex.exerciseId, 'weight', e.target.value, currentSide ?? undefined)} className="w-full rounded-md border border-zinc-700 bg-zinc-950 p-2 text-center text-sm text-white focus:border-emerald-500 focus:outline-none" />
                        </div>
                        <div className="flex items-center justify-center gap-3 rounded-md border border-zinc-700 bg-zinc-950 p-3">
                          <span className="text-2xl font-mono text-white">
                            {formatDuration(getStopwatchSeconds(currentSide ? `${ex.exerciseId}-${currentSide}` : ex.exerciseId))}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleStopwatch(currentSide ? `${ex.exerciseId}-${currentSide}` : ex.exerciseId)}
                            className={`rounded-md px-4 py-2 text-sm font-semibold ${stopwatches[currentSide ? `${ex.exerciseId}-${currentSide}` : ex.exerciseId]?.running ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'}`}
                          >
                            {stopwatches[currentSide ? `${ex.exerciseId}-${currentSide}` : ex.exerciseId]?.running ? 'Stop' : 'Start'}
                          </button>
                          <button
                            type="button"
                            onClick={() => resetStopwatch(currentSide ? `${ex.exerciseId}-${currentSide}` : ex.exerciseId)}
                            className="rounded-md border border-zinc-700 px-3 py-2 text-xs text-zinc-400 hover:text-white"
                          >
                            Reset
                          </button>
                        </div>
                      </div>
                    ) : (
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="mb-1 block text-xs text-zinc-500">Weight (lbs)</label>
                        <input type="number" step="2.5" value={input.weight} onChange={(e) => updateInput(ex.exerciseId, 'weight', e.target.value, currentSide ?? undefined)} className="w-full rounded-md border border-zinc-700 bg-zinc-950 p-2 text-center text-sm text-white focus:border-emerald-500 focus:outline-none" />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-zinc-500">Reps</label>
                        <input type="number" value={input.reps} onChange={(e) => updateInput(ex.exerciseId, 'reps', e.target.value, currentSide ?? undefined)} className="w-full rounded-md border border-zinc-700 bg-zinc-950 p-2 text-center text-sm text-white focus:border-emerald-500 focus:outline-none" />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-zinc-500">RIR</label>
                        <input type="number" step="0.5" min="0" max="5" value={input.rir} onChange={(e) => updateInput(ex.exerciseId, 'rir', e.target.value, currentSide ?? undefined)} className="w-full rounded-md border border-zinc-700 bg-zinc-950 p-2 text-center text-sm text-white focus:border-emerald-500 focus:outline-none" />
                      </div>
                    </div>
                    )}
                    <button
                      onClick={() => updateInput(ex.exerciseId, 'isWarmup', !input.isWarmup, currentSide ?? undefined)}
                      className={`rounded px-3 py-1 text-xs font-medium transition ${input.isWarmup ? 'bg-yellow-600/30 text-yellow-300' : 'bg-zinc-800 text-zinc-500'}`}
                    >
                      Warmup
                    </button>
                    <button onClick={() => handleLogStraightSet(ex)} className="w-full rounded-md bg-zinc-700 py-2.5 text-sm font-semibold text-white hover:bg-zinc-600">
                      {ex.isUnilateral
                        ? `Log ${unilateralPhase[ex.exerciseId] ?? 'LEFT'} — Set ${completedSetCount + (unilateralPendingSide[ex.exerciseId] ? 0 : 1)} of ${ex.targetSets}`
                        : `Log Set ${completedSetCount + 1} of ${ex.targetSets}`}
                    </button>
                  </div>
                )}

                {/* ── SUPERSET input ── */}
                {mode === 'SUPERSET' && !isComplete && !supersetPartnerOf[ex.exerciseId] && (
                  <div className="space-y-3">
                    {!partner ? (
                      <div className="space-y-2">
                        <p className="text-xs text-zinc-400">Select the exercise you're pairing with:</p>

                        {/* ── Session exercises ── */}
                        <div className="rounded-lg border border-zinc-700 bg-zinc-950 overflow-hidden">
                          <p className="px-3 py-1.5 text-xs text-zinc-600 border-b border-zinc-800">In this session</p>
                          {activeExercises
                            .filter((e) => e.exerciseId !== ex.exerciseId)
                            .map((e) => (
                              <button
                                key={e.exerciseId}
                                onClick={() => handleSelectSupersetPartner(ex.exerciseId, {
                                  id: e.exerciseId,
                                  name: e.exerciseName,
                                  primaryMuscle: e.primaryMuscle,
                                  movementPattern: e.movementPattern,
                                  equipment: e.equipment,
                                  isUnilateral: e.isUnilateral,
                                  isTimeBased: e.isTimeBased,
                                  isBodyweight: e.isBodyweight,
                                  isAssisted: e.isAssisted,
                                })}
                                className="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-zinc-800"
                              >
                                <span className="text-sm text-white">{e.exerciseName}</span>
                                <span className="text-xs text-zinc-500">{e.primaryMuscle.replace(/_/g, ' ')}</span>
                              </button>
                            ))}
                          {activeExercises.filter((e) => e.exerciseId !== ex.exerciseId).length === 0 && (
                            <p className="px-3 py-2 text-xs text-zinc-600">No other exercises in this session.</p>
                          )}
                        </div>

                        {/* ── Other exercises ── */}
                        <div className="rounded-lg border border-zinc-700 bg-zinc-950 overflow-hidden">
                          <p className="px-3 py-1.5 text-xs text-zinc-600 border-b border-zinc-800">Add a different exercise</p>
                          <div className="p-2">
                            <input
                              type="text"
                              placeholder="Search exercises..."
                              onChange={(e) => {
                                setShowPartnerSearch((prev) => ({ ...prev, [ex.exerciseId]: true }));
                                handleSearchSupersetPartner(ex);
                              }}
                              className="w-full rounded-md border border-zinc-700 bg-zinc-900 p-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                            />
                          </div>
                          {showPartnerSearch[ex.exerciseId] && (
                            <div className="max-h-40 overflow-y-auto">
                              {(partnerSubstitutes[ex.exerciseId] ?? []).map((sub) => (
                                <button key={sub.id} onClick={() => handleSelectSupersetPartner(ex.exerciseId, sub)} className="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-zinc-800">
                                  <span className="text-sm text-white">{sub.name}</span>
                                  <span className="text-xs text-zinc-500">{sub.primaryMuscle.replace(/_/g, ' ')}</span>
                                </button>
                              ))}
                              {(partnerSubstitutes[ex.exerciseId] ?? []).length === 0 && (
                                <p className="p-3 text-xs text-zinc-500">No exercises found.</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {ex.primaryMuscle === partner.primaryMuscle && (
                          <div className="rounded-lg bg-yellow-900/20 p-2 text-xs text-yellow-400">
                            Same-biomechanical superset — both exercises hit {ex.primaryMuscle.replace(/_/g, ' ')}. Expect reduced reps vs straight sets.
                          </div>
                        )}
                        {ex.primaryMuscle !== partner.primaryMuscle && (
                          <div className="rounded-lg bg-emerald-900/20 p-2 text-xs text-emerald-400">
                            Agonist-antagonist superset — volume maintained. Time-efficient pairing.
                          </div>
                        )}

                        <p className="text-xs font-medium text-zinc-400">{ex.exerciseName}</p>
                        {ex.isUnilateral ? (
                          <>
                            {(['LEFT', 'RIGHT'] as const).map((side) => {
                              const aInput = getInput(ex.exerciseId, ex.history, side);
                              return (
                                <div key={side} className="space-y-1">
                                  <p className="text-xs text-zinc-600">{side}</p>
                                  <div className="grid grid-cols-3 gap-2">
                                    <div><label className="mb-1 block text-xs text-zinc-500">Weight</label><input type="number" step="2.5" value={aInput.weight} onChange={(e) => updateInput(ex.exerciseId, 'weight', e.target.value, side)} className="w-full rounded-md border border-zinc-700 bg-zinc-950 p-2 text-center text-sm text-white focus:border-emerald-500 focus:outline-none" /></div>
                                    <div><label className="mb-1 block text-xs text-zinc-500">Reps</label><input type="number" value={aInput.reps} onChange={(e) => updateInput(ex.exerciseId, 'reps', e.target.value, side)} className="w-full rounded-md border border-zinc-700 bg-zinc-950 p-2 text-center text-sm text-white focus:border-emerald-500 focus:outline-none" /></div>
                                    <div><label className="mb-1 block text-xs text-zinc-500">RIR</label><input type="number" step="0.5" min="0" max="5" value={aInput.rir} onChange={(e) => updateInput(ex.exerciseId, 'rir', e.target.value, side)} className="w-full rounded-md border border-zinc-700 bg-zinc-950 p-2 text-center text-sm text-white focus:border-emerald-500 focus:outline-none" /></div>
                                  </div>
                                </div>
                              );
                            })}
                          </>
                        ) : (
                          <div className="grid grid-cols-3 gap-2">
                            <div><label className="mb-1 block text-xs text-zinc-500">Weight</label><input type="number" step="2.5" value={input.weight} onChange={(e) => updateInput(ex.exerciseId, 'weight', e.target.value)} className="w-full rounded-md border border-zinc-700 bg-zinc-950 p-2 text-center text-sm text-white focus:border-emerald-500 focus:outline-none" /></div>
                            <div><label className="mb-1 block text-xs text-zinc-500">Reps</label><input type="number" value={input.reps} onChange={(e) => updateInput(ex.exerciseId, 'reps', e.target.value)} className="w-full rounded-md border border-zinc-700 bg-zinc-950 p-2 text-center text-sm text-white focus:border-emerald-500 focus:outline-none" /></div>
                            <div><label className="mb-1 block text-xs text-zinc-500">RIR</label><input type="number" step="0.5" min="0" max="5" value={input.rir} onChange={(e) => updateInput(ex.exerciseId, 'rir', e.target.value)} className="w-full rounded-md border border-zinc-700 bg-zinc-950 p-2 text-center text-sm text-white focus:border-emerald-500 focus:outline-none" /></div>
                          </div>
                        )}

                        <p className="text-xs font-medium text-zinc-400">{partner.name}</p>
                        {partner.isUnilateral ? (
                          <>
                            {(['LEFT', 'RIGHT'] as const).map((side) => {
                              const bKey = `${ex.exerciseId}-B-${side}`;
                              const bInput = supersetInputs[bKey] ?? { weight: '', reps: '', rir: '' };
                              return (
                                <div key={side} className="space-y-1">
                                  <p className="text-xs text-zinc-600">{side}</p>
                                  <div className="grid grid-cols-3 gap-2">
                                    <div><label className="mb-1 block text-xs text-zinc-500">Weight</label><input type="number" step="2.5" value={bInput.weight} onChange={(e) => setSupersetInputs((prev) => ({ ...prev, [bKey]: { ...bInput, weight: e.target.value } }))} className="w-full rounded-md border border-zinc-700 bg-zinc-950 p-2 text-center text-sm text-white focus:border-emerald-500 focus:outline-none" /></div>
                                    <div><label className="mb-1 block text-xs text-zinc-500">Reps</label><input type="number" value={bInput.reps} onChange={(e) => setSupersetInputs((prev) => ({ ...prev, [bKey]: { ...bInput, reps: e.target.value } }))} className="w-full rounded-md border border-zinc-700 bg-zinc-950 p-2 text-center text-sm text-white focus:border-emerald-500 focus:outline-none" /></div>
                                    <div><label className="mb-1 block text-xs text-zinc-500">RIR</label><input type="number" step="0.5" min="0" max="5" value={bInput.rir} onChange={(e) => setSupersetInputs((prev) => ({ ...prev, [bKey]: { ...bInput, rir: e.target.value } }))} className="w-full rounded-md border border-zinc-700 bg-zinc-950 p-2 text-center text-sm text-white focus:border-emerald-500 focus:outline-none" /></div>
                                  </div>
                                </div>
                              );
                            })}
                          </>
                        ) : (
                          <div className="grid grid-cols-3 gap-2">
                            <div><label className="mb-1 block text-xs text-zinc-500">Weight</label><input type="number" step="2.5" value={supersetInput.weight} onChange={(e) => setSupersetInputs((prev) => ({ ...prev, [ex.exerciseId]: { ...supersetInput, weight: e.target.value } }))} className="w-full rounded-md border border-zinc-700 bg-zinc-950 p-2 text-center text-sm text-white focus:border-emerald-500 focus:outline-none" /></div>
                            <div><label className="mb-1 block text-xs text-zinc-500">Reps</label><input type="number" value={supersetInput.reps} onChange={(e) => setSupersetInputs((prev) => ({ ...prev, [ex.exerciseId]: { ...supersetInput, reps: e.target.value } }))} className="w-full rounded-md border border-zinc-700 bg-zinc-950 p-2 text-center text-sm text-white focus:border-emerald-500 focus:outline-none" /></div>
                            <div><label className="mb-1 block text-xs text-zinc-500">RIR</label><input type="number" step="0.5" min="0" max="5" value={supersetInput.rir} onChange={(e) => setSupersetInputs((prev) => ({ ...prev, [ex.exerciseId]: { ...supersetInput, rir: e.target.value } }))} className="w-full rounded-md border border-zinc-700 bg-zinc-950 p-2 text-center text-sm text-white focus:border-emerald-500 focus:outline-none" /></div>
                          </div>
                        )}

                        <div className="flex gap-2">
                          <button onClick={() => handleLogSupersetPair(ex)} className="flex-1 rounded-md bg-zinc-700 py-2.5 text-sm font-semibold text-white hover:bg-zinc-600">
                            Log Superset Pair {setsForExercise.filter((s) => s.setType === 'SUPERSET_A').length + 1}
                          </button>
                          <button onClick={() => setSupersetPartners((prev) => ({ ...prev, [ex.exerciseId]: null }))} className="rounded-md border border-zinc-700 px-3 text-xs text-zinc-500 hover:text-zinc-300">Change</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── MYOREP input ── */}
                {mode === 'MYOREP' && !isComplete && !supersetPartnerOf[ex.exerciseId] && (
                  <div className="space-y-3">
                    {ex.isUnilateral && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => { if (myoPhase === 'activation') setUnilateralPhase((prev) => ({ ...prev, [ex.exerciseId]: 'LEFT' })); }}
                          disabled={myoPhase !== 'activation'}
                          className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                            (unilateralPhase[ex.exerciseId] ?? 'LEFT') === 'LEFT'
                              ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700 disabled:cursor-not-allowed'
                          }`}
                        >LEFT</button>
                        <span className="text-xs text-zinc-600">→</span>
                        <button
                          type="button"
                          onClick={() => { if (myoPhase === 'activation') setUnilateralPhase((prev) => ({ ...prev, [ex.exerciseId]: 'RIGHT' })); }}
                          disabled={myoPhase !== 'activation'}
                          className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                            (unilateralPhase[ex.exerciseId] ?? 'LEFT') === 'RIGHT'
                              ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700 disabled:cursor-not-allowed'
                          }`}
                        >RIGHT</button>
                        <span className="ml-2 text-xs text-zinc-500">
                          logging {unilateralPhase[ex.exerciseId] ?? 'LEFT'} side
                        </span>
                      </div>
                    )}
                    <div className={`rounded-lg p-3 text-xs ${myoPhase === 'activation' ? 'bg-blue-900/20 text-blue-400' : 'bg-purple-900/20 text-purple-400'}`}>
                      {myoPhase === 'activation'
                        ? 'Activation set: 12–30 reps, 0–1 RIR. Go close to failure.'
                        : 'Mini-set: 3–5 reps, 20–30s rest between. Stop when reps drop below 3.'}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div><label className="mb-1 block text-xs text-zinc-500">Weight</label><input type="number" step="2.5" value={input.weight} onChange={(e) => updateInput(ex.exerciseId, 'weight', e.target.value, currentSide ?? undefined)} className="w-full rounded-md border border-zinc-700 bg-zinc-950 p-2 text-center text-sm text-white focus:border-emerald-500 focus:outline-none" /></div>
                      <div><label className="mb-1 block text-xs text-zinc-500">Reps</label><input type="number" value={input.reps} onChange={(e) => updateInput(ex.exerciseId, 'reps', e.target.value, currentSide ?? undefined)} className="w-full rounded-md border border-zinc-700 bg-zinc-950 p-2 text-center text-sm text-white focus:border-emerald-500 focus:outline-none" /></div>
                      <div><label className="mb-1 block text-xs text-zinc-500">RIR</label><input type="number" step="0.5" min="0" max="5" value={input.rir} onChange={(e) => updateInput(ex.exerciseId, 'rir', e.target.value, currentSide ?? undefined)} className="w-full rounded-md border border-zinc-700 bg-zinc-950 p-2 text-center text-sm text-white focus:border-emerald-500 focus:outline-none" /></div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleLogMyorep(ex)} className="flex-1 rounded-md bg-zinc-700 py-2.5 text-sm font-semibold text-white hover:bg-zinc-600">
                        {myoPhase === 'activation' ? 'Log Activation Set' : `Log Mini-set ${setsForExercise.filter((s) => s.setType === 'MYOREP_MINI').length + 1}`}
                      </button>
                      {myoPhase === 'mini' && (
                        <button onClick={() => handleEndMyorep(ex.exerciseId)} className="rounded-md border border-zinc-700 px-3 text-xs text-zinc-400 hover:text-emerald-400 hover:border-emerald-700">Done</button>
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
                {mode === 'DROPSET' && !isComplete && !supersetPartnerOf[ex.exerciseId] && (
                  <div className="space-y-3">
                    {ex.isUnilateral && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => { if (!inDrop) setUnilateralPhase((prev) => ({ ...prev, [ex.exerciseId]: 'LEFT' })); }}
                          disabled={inDrop}
                          className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                            (unilateralPhase[ex.exerciseId] ?? 'LEFT') === 'LEFT'
                              ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700 disabled:cursor-not-allowed'
                          }`}
                        >LEFT</button>
                        <span className="text-xs text-zinc-600">→</span>
                        <button
                          type="button"
                          onClick={() => { if (!inDrop) setUnilateralPhase((prev) => ({ ...prev, [ex.exerciseId]: 'RIGHT' })); }}
                          disabled={inDrop}
                          className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                            (unilateralPhase[ex.exerciseId] ?? 'LEFT') === 'RIGHT'
                              ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700 disabled:cursor-not-allowed'
                          }`}
                        >RIGHT</button>
                        <span className="ml-2 text-xs text-zinc-500">
                          logging {unilateralPhase[ex.exerciseId] ?? 'LEFT'} side
                        </span>
                      </div>
                    )}
                    <div className={`rounded-lg p-3 text-xs ${!inDrop ? 'bg-orange-900/20 text-orange-400' : 'bg-red-900/20 text-red-400'}`}>
                      {!inDrop
                        ? 'Primary set: go to failure or 0–1 RIR. Then immediately reduce weight.'
                        : `Drop ${dropSetsLogged + 1}: reduce weight 20–30% and go again.`}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div><label className="mb-1 block text-xs text-zinc-500">Weight</label><input type="number" step="2.5" value={input.weight} onChange={(e) => updateInput(ex.exerciseId, 'weight', e.target.value, currentSide ?? undefined)} className="w-full rounded-md border border-zinc-700 bg-zinc-950 p-2 text-center text-sm text-white focus:border-emerald-500 focus:outline-none" /></div>
                      <div><label className="mb-1 block text-xs text-zinc-500">Reps</label><input type="number" value={input.reps} onChange={(e) => updateInput(ex.exerciseId, 'reps', e.target.value, currentSide ?? undefined)} className="w-full rounded-md border border-zinc-700 bg-zinc-950 p-2 text-center text-sm text-white focus:border-emerald-500 focus:outline-none" /></div>
                      <div><label className="mb-1 block text-xs text-zinc-500">RIR</label><input type="number" step="0.5" min="0" max="5" value={input.rir} onChange={(e) => updateInput(ex.exerciseId, 'rir', e.target.value, currentSide ?? undefined)} className="w-full rounded-md border border-zinc-700 bg-zinc-950 p-2 text-center text-sm text-white focus:border-emerald-500 focus:outline-none" /></div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleLogDropSet(ex)} className="flex-1 rounded-md bg-zinc-700 py-2.5 text-sm font-semibold text-white hover:bg-zinc-600">
                        {!inDrop ? 'Log Primary Set' : `Log Drop ${dropSetsLogged + 1}`}
                      </button>
                      {inDrop && (
                        <button onClick={() => handleEndDropSet(ex.exerciseId)} className="rounded-md border border-zinc-700 px-3 text-xs text-zinc-400 hover:text-emerald-400 hover:border-emerald-700">Done</button>
                      )}
                    </div>
                    {inDrop && (
                      <p className="text-xs text-zinc-600">
                        {dropSetsLogged} drop{dropSetsLogged !== 1 ? 's' : ''} logged · tap Done when finished
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
        <div className="mx-auto max-w-2xl space-y-2">

          {/* Add exercise search panel */}
          {showAddExercise && (
            <div className="rounded-xl border border-zinc-700 bg-zinc-900 shadow-xl mb-2">
              <div className="p-3">
                <input
                  type="text"
                  value={addExerciseSearch}
                  onChange={(e) => setAddExerciseSearch(e.target.value)}
                  placeholder="Search exercises..."
                  autoFocus
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 p-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <ul className="max-h-48 overflow-y-auto">
                {filteredAddExercises.length === 0 && (
                  <li className="p-3 text-center text-xs text-zinc-500">No exercises found.</li>
                )}
                {filteredAddExercises.map((ex) => (
                  <li key={ex.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-zinc-800">
                    <button
                      type="button"
                      onClick={() => addAdHocExercise(ex)}
                      className="flex flex-1 items-center justify-between text-left"
                    >
                      <span className="text-sm text-white">{ex.name}</span>
                      <span className="text-xs text-zinc-500 mr-3">{ex.primaryMuscle.replace(/_/g, ' ')}</span>
                    </button>
                    <div className="flex items-center gap-1 rounded-md border border-zinc-700 px-1">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); adjustAdHocSetCount(ex.id, -1); }}
                        className="px-2 py-1 text-zinc-400 hover:text-white"
                      >
                        −
                      </button>
                      <span className="w-6 text-center text-sm text-white">{getAdHocSetCount(ex.id)}</span>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); adjustAdHocSetCount(ex.id, 1); }}
                        className="px-2 py-1 text-zinc-400 hover:text-white"
                      >
                        +
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowAddExercise((v) => !v)}
              className="rounded-md border border-zinc-700 px-4 py-3 text-sm font-semibold text-zinc-400 hover:border-zinc-500 hover:text-white"
            >
              {showAddExercise ? '✕' : '+ Exercise'}
            </button>
            <button
              onClick={handleFinish}
              disabled={isSubmitting}
              className="flex-1 rounded-md bg-emerald-600 py-3 font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Finish Workout'}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
