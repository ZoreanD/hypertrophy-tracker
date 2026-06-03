'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createRoutine, updateRoutine, deleteRoutine } from '../../actions/routine';

// ── Types ──────────────────────────────────────────────────────────────────

type Exercise = {
  id: string;
  name: string;
  primaryMuscle: string;
  secondaryMuscles: string[];
  equipment: string;
  movementPattern: string;
};

type RoutineExerciseEntry = {
  exerciseId: string;
  exerciseName: string;
  primaryMuscle: string;
  order: number;
  targetSets: number;
  targetRepMin: number;
  targetRepMax: number;
  targetRir: number;
  restTimerSecs: number;
  progressionStyle: string;
};
type EditMode = {
  routineId: string;
  initialName: string;
  initialFocus: string;
  initialNotes: string;
  initialExercises: RoutineExerciseEntry[];
};

// ── Constants ──────────────────────────────────────────────────────────────

const SPLITS = [
  { value: 'Push', label: 'Push', group: 'PPL' },
  { value: 'Pull', label: 'Pull', group: 'PPL' },
  { value: 'Legs', label: 'Legs', group: 'PPL' },
  { value: 'Upper', label: 'Upper', group: 'Upper/Lower' },
  { value: 'Lower', label: 'Lower', group: 'Upper/Lower' },
  { value: 'Fullbody', label: 'Fullbody', group: 'Fullbody' },
  { value: 'Chest', label: 'Chest', group: 'Bro Split' },
  { value: 'Back', label: 'Back', group: 'Bro Split' },
  { value: 'Shoulders', label: 'Shoulders', group: 'Bro Split' },
  { value: 'Arms', label: 'Arms', group: 'Bro Split' },
  { value: 'Chest_Back', label: 'Chest + Back', group: 'Arnold' },
  { value: 'Shoulders_Arms', label: 'Shoulders + Arms', group: 'Arnold' },
  { value: 'Core', label: 'Core / Abs', group: 'Accessory' },
  { value: 'Cardio', label: 'Cardio / Conditioning', group: 'Cardio' },
  { value: 'Custom', label: 'Custom', group: 'Other' },
];

const REP_RANGES = [
  { label: '3–5 (Strength)', min: 3, max: 5 },
  { label: '5–8 (Strength-Hypertrophy)', min: 5, max: 8 },
  { label: '8–12 (Hypertrophy)', min: 8, max: 12 },
  { label: '10–15 (Hypertrophy-Endurance)', min: 10, max: 15 },
  { label: '15–20 (Endurance/Pump)', min: 15, max: 20 },
  { label: '20–30 (Metabolic)', min: 20, max: 30 },
];

const PROGRESSION_STYLES = [
  {
    value: 'DOUBLE_PROGRESSION',
    label: 'Double Progression',
    tag: '⭐ Best for Hypertrophy',
    tagColor: 'text-emerald-400',
  },
  {
    value: 'RPE_AUTOREGULATION',
    label: 'RPE / RIR Auto-Regulation',
    tag: '✅ Good for Hypertrophy',
    tagColor: 'text-emerald-400',
  },
  {
    value: 'UNDULATING',
    label: 'Undulating Periodization (DUP)',
    tag: '✅ Good for Hypertrophy',
    tagColor: 'text-emerald-400',
  },
  {
    value: 'PERCENTAGE',
    label: 'Percentage-Based (1RM %)',
    tag: '💪 Strength Focus',
    tagColor: 'text-yellow-400',
  },
  {
    value: 'LINEAR',
    label: 'Linear Progression',
    tag: '📈 Beginner / Strength',
    tagColor: 'text-zinc-400',
  },
];

const REST_PRESETS = [
  { label: '60s', value: 60 },
  { label: '90s', value: 90 },
  { label: '2min', value: 120 },
  { label: '3min', value: 180 },
  { label: '5min', value: 300 },
];

// ── Muscle volume requirements per split ──────────────────────────────────

const MUSCLE_GROUP_MAP: Record<string, string> = {
  CHEST_UPPER: 'CHEST',
  CHEST_MID_LOWER: 'CHEST',
  FRONT_DELT: 'FRONT_DELT',
  SIDE_DELT: 'SIDE_REAR_DELT',
  REAR_DELT: 'SIDE_REAR_DELT',
  LATS: 'BACK',
  TRAPS_MID: 'BACK',
  TRAPS_UPPER: 'BACK',
  TRAPS_LOWER: 'BACK',
  RHOMBOIDS: 'BACK',
  TERES_MAJOR: 'BACK',
  LOWER_BACK: 'BACK',
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

// Volume requirements per split type
// MEV = minimum to appear in routine for this split to be valid
// Based on RP volume landmarks and Schoenfeld meta-analysis
const SPLIT_REQUIREMENTS: Record<string, { muscle: string; label: string; minSets: number; mev: number; mav: number }[]> = {
  Push: [
    { muscle: 'CHEST', label: 'Chest', minSets: 2, mev: 8, mav: 18 },
    { muscle: 'SIDE_REAR_DELT', label: 'Side/Rear Delts', minSets: 1, mev: 8, mav: 22 },
    { muscle: 'TRICEPS', label: 'Triceps', minSets: 1, mev: 4, mav: 12 },
  ],
  Pull: [
    { muscle: 'BACK', label: 'Back / Lats', minSets: 2, mev: 8, mav: 20 },
    { muscle: 'BICEPS', label: 'Biceps', minSets: 1, mev: 6, mav: 14 },
    { muscle: 'SIDE_REAR_DELT', label: 'Rear Delt', minSets: 1, mev: 8, mav: 22 },
  ],
  Legs: [
    { muscle: 'QUADS', label: 'Quads', minSets: 2, mev: 8, mav: 18 },
    { muscle: 'HAMSTRINGS', label: 'Hamstrings', minSets: 2, mev: 6, mav: 16 },
    { muscle: 'CALVES', label: 'Calves', minSets: 1, mev: 6, mav: 16 },
    { muscle: 'GLUTES', label: 'Glutes', minSets: 1, mev: 0, mav: 12 },
  ],
  Upper: [
    { muscle: 'CHEST', label: 'Chest', minSets: 1, mev: 8, mav: 18 },
    { muscle: 'BACK', label: 'Back', minSets: 1, mev: 8, mav: 20 },
    { muscle: 'SIDE_REAR_DELT', label: 'Delts', minSets: 1, mev: 8, mav: 22 },
    { muscle: 'BICEPS', label: 'Biceps', minSets: 1, mev: 6, mav: 14 },
    { muscle: 'TRICEPS', label: 'Triceps', minSets: 1, mev: 4, mav: 12 },
  ],
  Lower: [
    { muscle: 'QUADS', label: 'Quads', minSets: 2, mev: 8, mav: 18 },
    { muscle: 'HAMSTRINGS', label: 'Hamstrings', minSets: 1, mev: 6, mav: 16 },
    { muscle: 'GLUTES', label: 'Glutes', minSets: 1, mev: 0, mav: 12 },
    { muscle: 'CALVES', label: 'Calves', minSets: 1, mev: 6, mav: 16 },
  ],
  Fullbody: [
    { muscle: 'QUADS', label: 'Quads', minSets: 1, mev: 8, mav: 18 },
    { muscle: 'HAMSTRINGS', label: 'Hamstrings', minSets: 1, mev: 6, mav: 16 },
    { muscle: 'CHEST', label: 'Chest', minSets: 1, mev: 8, mav: 18 },
    { muscle: 'BACK', label: 'Back', minSets: 1, mev: 8, mav: 20 },
    { muscle: 'SIDE_REAR_DELT', label: 'Delts', minSets: 1, mev: 8, mav: 22 },
  ],
  Chest: [
    { muscle: 'CHEST', label: 'Chest', minSets: 3, mev: 8, mav: 18 },
  ],
  Back: [
    { muscle: 'BACK', label: 'Back / Lats', minSets: 3, mev: 8, mav: 20 },
  ],
  Shoulders: [
    { muscle: 'SIDE_REAR_DELT', label: 'Side/Rear Delts', minSets: 2, mev: 8, mav: 22 },
    { muscle: 'FRONT_DELT', label: 'Front Delt', minSets: 1, mev: 0, mav: 6 },
  ],
  Arms: [
    { muscle: 'BICEPS', label: 'Biceps', minSets: 2, mev: 6, mav: 14 },
    { muscle: 'TRICEPS', label: 'Triceps', minSets: 2, mev: 4, mav: 12 },
  ],
  Chest_Back: [
    { muscle: 'CHEST', label: 'Chest', minSets: 2, mev: 8, mav: 18 },
    { muscle: 'BACK', label: 'Back', minSets: 2, mev: 8, mav: 20 },
  ],
  Shoulders_Arms: [
    { muscle: 'SIDE_REAR_DELT', label: 'Side/Rear Delts', minSets: 2, mev: 8, mav: 22 },
    { muscle: 'BICEPS', label: 'Biceps', minSets: 1, mev: 6, mav: 14 },
    { muscle: 'TRICEPS', label: 'Triceps', minSets: 1, mev: 4, mav: 12 },
  ],
  Core: [
    { muscle: 'ABS', label: 'Abs / Core', minSets: 2, mev: 0, mav: 12 },
  ],
};

// ── Component ──────────────────────────────────────────────────────────────

export default function RoutineBuilder({
  exercises,
  editMode,
}: {
  exercises: Exercise[];
  editMode?: EditMode;
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Routine metadata
  const [name, setName] = useState(editMode?.initialName ?? '');
  const [focus, setFocus] = useState(editMode?.initialFocus ?? 'Push');
  const [notes, setNotes] = useState(editMode?.initialNotes ?? '');

  // Exercise search
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  // Selected exercises
  const [entries, setEntries] = useState<RoutineExerciseEntry[]>(editMode?.initialExercises ?? []);

  // Filter exercises by search query and current split
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return exercises.filter((ex) => ex.name.toLowerCase().includes(q)).slice(0, 20);
  }, [search, exercises]);

  // Volume checker against split requirements
  const volumeCheck = useMemo(() => {
  const requirements = SPLIT_REQUIREMENTS[focus] || [];
  if (requirements.length === 0) return [];

  // Count sets per muscle group using the mapping
  const setsByGroup: Record<string, number> = {};
  entries.forEach((entry) => {
    const group = MUSCLE_GROUP_MAP[entry.primaryMuscle] || entry.primaryMuscle;
    setsByGroup[group] = (setsByGroup[group] || 0) + entry.targetSets;
  });

  return requirements.map((req) => {
    const sets = setsByGroup[req.muscle] || 0;
    return {
      muscle: req.muscle,
      label: req.label,
      sets,
      minSets: req.minSets,
      mev: req.mev,
      mav: req.mav,
      met: sets >= req.minSets,
      status: sets === 0 ? 'none'
        : sets < req.mev ? 'below_mev'
        : sets <= req.mav ? 'in_mav'
        : 'above_mav',
    };
  });
}, [entries, focus]);

  const allRequirementsMet = volumeCheck.every((v) => v.met);

  function addExercise(ex: Exercise) {
    setEntries((prev) => [
      ...prev,
      {
        exerciseId: ex.id,
        exerciseName: ex.name,
        primaryMuscle: ex.primaryMuscle,
        order: prev.length,
        targetSets: 3,
        targetRepMin: 8,
        targetRepMax: 12,
        targetRir: 1,
        restTimerSecs: 120,
        progressionStyle: 'DOUBLE_PROGRESSION',
      },
    ]);
    setSearch('');
    setShowSearch(false);
  }

  function removeExercise(index: number) {
    setEntries((prev) => prev.filter((_, i) => i !== index).map((e, i) => ({ ...e, order: i })));
  }

  function updateEntry(index: number, field: keyof RoutineExerciseEntry, value: any) {
    setEntries((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }

  function applyRepRange(index: number, min: number, max: number) {
    setEntries((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], targetRepMin: min, targetRepMax: max };
      return updated;
    });
  }

  async function handleSubmit() {
  if (!name.trim()) return alert('Give your routine a name.');
  if (entries.length === 0) return alert('Add at least one exercise.');
  setIsSubmitting(true);

  let result;
  if (editMode) {
    result = await updateRoutine(editMode.routineId, { name, focus, notes, exercises: entries });
  } else {
    result = await createRoutine({ name, focus, notes, exercises: entries });
  }

  if (result.success) {
    router.push('/routines');
  } else {
    alert('Failed to save routine.');
    setIsSubmitting(false);
  }
}

  return (
    <div className="space-y-8">

      {/* ── Routine Metadata ── */}
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-400">Routine Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Leg Day A — Quad Bias"
            className="w-full rounded-md border border-zinc-700 bg-zinc-900 p-2 text-white focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-400">Split Focus</label>
            <select
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            className="w-full rounded-md border border-zinc-700 bg-zinc-900 p-2 text-white focus:border-emerald-500 focus:outline-none"
          >
            {Object.entries(
                SPLITS.reduce((acc: Record<string, typeof SPLITS>, s) => {
                    if (!acc[s.group]) acc[s.group] = [];
                    acc[s.group].push(s);
                    return acc;
                }, {})
            ).map(([group, options]) => (
                <optgroup key={group} label={group}>
                    {options.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                </optgroup>
            ))}
        </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-400">Notes (optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Focus on deep stretch"
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 p-2 text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* ── Volume Requirements Checker ── */}
      {SPLIT_REQUIREMENTS[focus] && volumeCheck.length > 0 && (
  <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
    <p className="mb-3 text-sm font-medium text-zinc-400">
      Volume Check — {focus}
    </p>
    <div className="space-y-2">
      {volumeCheck.map((v) => (
        <div key={v.muscle} className="flex items-center justify-between">
          <span className={`text-sm ${v.met ? 'text-zinc-200' : 'text-zinc-500'}`}>
            {v.label}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-600">
              {v.sets} sets
            </span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              v.status === 'none' ? 'bg-zinc-800 text-zinc-500'
              : v.status === 'below_mev' ? 'bg-yellow-900/50 text-yellow-400'
              : v.status === 'in_mav' ? 'bg-emerald-900/50 text-emerald-400'
              : 'bg-red-900/50 text-red-400'
            }`}>
              {v.status === 'none' ? '○ Missing'
              : v.status === 'below_mev' ? '⚠ Below MEV'
              : v.status === 'in_mav' ? '✓ In MAV'
              : '↑ Near MRV'}
            </span>
          </div>
        </div>
      ))}
    </div>
    <p className="mt-3 text-xs text-zinc-600">
      MEV = minimum for growth · MAV = optimal range · MRV = recovery limit
    </p>
  </div>
)}

      {/* ── Exercise List ── */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-zinc-200">Exercises</h2>

        {entries.length === 0 && (
          <div className="rounded-xl border border-dashed border-zinc-700 p-8 text-center text-sm text-zinc-500">
            No exercises added yet. Search below to add one.
          </div>
        )}

        {entries.map((entry, index) => (
          <div
            key={index}
            className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-4"
          >
            {/* Exercise header */}
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-white">{entry.exerciseName}</p>
                <p className="text-xs text-zinc-500">
                  {entry.primaryMuscle.replace(/_/g, ' ')}
                </p>
              </div>
              <button
                onClick={() => removeExercise(index)}
                className="text-zinc-600 hover:text-red-400 text-sm"
              >
                ✕
              </button>
            </div>

            {/* Progression style */}
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Progression Style</label>
              <select
                value={entry.progressionStyle}
                onChange={(e) => updateEntry(index, 'progressionStyle', e.target.value)}
                className="w-full rounded-md border border-zinc-700 bg-zinc-950 p-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
              >
                {PROGRESSION_STYLES.map((ps) => (
                  <option key={ps.value} value={ps.value}>
                    {ps.label} — {ps.tag}
                  </option>
                ))}
              </select>
            </div>

            {/* Sets + RIR */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Sets</label>
                <input
                  type="number"
                  value={entry.targetSets}
                  min={1}
                  max={10}
                  onChange={(e) => updateEntry(index, 'targetSets', Number(e.target.value))}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 p-2 text-center text-sm text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Target RIR</label>
                <input
                  type="number"
                  value={entry.targetRir}
                  min={0}
                  max={5}
                  step={0.5}
                  onChange={(e) => updateEntry(index, 'targetRir', Number(e.target.value))}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 p-2 text-center text-sm text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Rep range presets */}
            <div>
              <label className="mb-2 block text-xs text-zinc-500">Rep Range</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {REP_RANGES.map((rr) => (
                  <button
                    key={rr.label}
                    type="button"
                    onClick={() => applyRepRange(index, rr.min, rr.max)}
                    className={`rounded-full px-3 py-1 text-xs transition-colors ${
                      entry.targetRepMin === rr.min && entry.targetRepMax === rr.max
                        ? 'bg-emerald-600 text-white'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    }`}
                  >
                    {rr.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={entry.targetRepMin}
                  min={1}
                  onChange={(e) => updateEntry(index, 'targetRepMin', Number(e.target.value))}
                  className="w-20 rounded-md border border-zinc-700 bg-zinc-950 p-2 text-center text-sm text-white focus:border-emerald-500 focus:outline-none"
                />
                <span className="text-zinc-500">to</span>
                <input
                  type="number"
                  value={entry.targetRepMax}
                  min={1}
                  onChange={(e) => updateEntry(index, 'targetRepMax', Number(e.target.value))}
                  className="w-20 rounded-md border border-zinc-700 bg-zinc-950 p-2 text-center text-sm text-white focus:border-emerald-500 focus:outline-none"
                />
                <span className="text-zinc-500 text-xs">reps</span>
              </div>
            </div>

            {/* Rest timer */}
            <div>
              <label className="mb-2 block text-xs text-zinc-500">Rest Between Sets</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {REST_PRESETS.map((rp) => (
                  <button
                    key={rp.value}
                    type="button"
                    onClick={() => updateEntry(index, 'restTimerSecs', rp.value)}
                    className={`rounded-full px-3 py-1 text-xs transition-colors ${
                      entry.restTimerSecs === rp.value
                        ? 'bg-emerald-600 text-white'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    }`}
                  >
                    {rp.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}

        {/* ── Exercise Search ── */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowSearch(!showSearch)}
            className="w-full rounded-lg border border-dashed border-zinc-700 py-3 text-sm font-medium text-zinc-400 hover:border-emerald-500 hover:text-emerald-400"
          >
            + Add Exercise
          </button>

          {showSearch && (
            <div className="absolute z-10 mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-900 shadow-xl">
              <div className="p-3">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search exercises..."
                  autoFocus
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 p-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <ul className="max-h-64 overflow-y-auto">
                {filtered.length === 0 && (
                  <li className="p-4 text-center text-sm text-zinc-500">No exercises found.</li>
                )}
                {filtered.map((ex) => (
                  <li key={ex.id}>
                    <button
                      type="button"
                      onClick={() => addExercise(ex)}
                      className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-zinc-800"
                    >
                      <span className="text-sm text-white">{ex.name}</span>
                      <span className="text-xs text-zinc-500">
                        {ex.primaryMuscle.replace(/_/g, ' ')}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {editMode && (
      <button
        type="button"
        onClick={async () => {
          if (!confirm('Delete this routine? This cannot be undone.')) return;
          const result = await deleteRoutine(editMode.routineId);
          if (result.success) router.push('/routines');
    }}
        className="w-full rounded-md border border-red-800 py-3 text-sm font-semibold text-red-400 hover:bg-red-950/30"
      >
        Delete Routine
      </button>
)}

      {/* ── Save Button ── */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={isSubmitting}
        className="w-full rounded-md bg-emerald-600 py-3 font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
      >
        {isSubmitting ? 'Saving...' : editMode ? 'Save Changes' : 'Save Routine'}
      </button>

    </div>
  );
}