'use client';

import { useRouter } from 'next/navigation';
import { startWorkout } from '../actions/workout-session';

const FOCUS_COLORS: Record<string, string> = {
  Push: 'border-blue-700 bg-blue-900/20',
  Pull: 'border-purple-700 bg-purple-900/20',
  Legs: 'border-green-700 bg-green-900/20',
  Upper: 'border-cyan-700 bg-cyan-900/20',
  Lower: 'border-teal-700 bg-teal-900/20',
  Fullbody: 'border-yellow-700 bg-yellow-900/20',
  Chest: 'border-red-700 bg-red-900/20',
  Back: 'border-indigo-700 bg-indigo-900/20',
  Shoulders: 'border-orange-700 bg-orange-900/20',
  Arms: 'border-pink-700 bg-pink-900/20',
  Core: 'border-lime-700 bg-lime-900/20',
  Cardio: 'border-rose-700 bg-rose-900/20',
};

export default function TodayWorkoutCard({
  scheduledId,
  routineId,
  routineName,
  routineFocus,
  scheduledDate,
  existingWorkoutId,
  existingDurationMins,
}: {
  scheduledId: string;
  routineId: string;
  routineName: string;
  routineFocus: string;
  scheduledDate: string;
  existingWorkoutId: string | null;
  existingDurationMins: number | null;
}) {
  const router = useRouter();

  async function handleStart() {
    const result = await startWorkout(routineId, scheduledDate);
    if (result.success && result.workoutId) {
      router.push(`/workout/${result.workoutId}`);
    }
  }

  const colorClass = FOCUS_COLORS[routineFocus] ?? 'border-zinc-700 bg-zinc-900/20';
  const isCompleted = existingWorkoutId !== null && existingDurationMins !== null && existingDurationMins > 0;
  const isInProgress = existingWorkoutId !== null && (existingDurationMins === null || existingDurationMins === 0);

  return (
    <div className={`flex items-center justify-between rounded-xl border p-4 ${colorClass}`}>
      <div>
        <p className="font-semibold text-white">{routineName}</p>
        <p className="text-sm text-zinc-400">{routineFocus}</p>
        {isCompleted && (
          <p className="mt-0.5 text-xs font-semibold text-green-500">✓ Completed · {existingDurationMins} mins</p>
        )}
        {isInProgress && (
          <p className="mt-0.5 text-xs text-yellow-400">⏳ In progress</p>
        )}
      </div>
      <div className="flex gap-2">
        {isCompleted ? (
          <button
            onClick={() => router.push(`/workout/${existingWorkoutId}`)}
            className="rounded-md border border-zinc-600 px-4 py-2 text-sm font-semibold text-zinc-300 hover:border-zinc-400 hover:text-white"
          >
            View
          </button>
        ) : isInProgress ? (
          <button
            onClick={() => router.push(`/workout/${existingWorkoutId}`)}
            className="rounded-md bg-yellow-600 px-4 py-2 text-sm font-semibold text-white hover:bg-yellow-500"
          >
            Continue →
          </button>
        ) : (
          <button
            onClick={handleStart}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            Start →
          </button>
        )}
      </div>
    </div>
  );
}