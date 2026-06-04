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
}: {
  scheduledId: string;
  routineId: string;
  routineName: string;
  routineFocus: string;
  scheduledDate: string;
}) {
  const router = useRouter();

  async function handleStart() {
    const result = await startWorkout(routineId, scheduledDate);
    if (result.success && result.workoutId) {
      router.push(`/workout/${result.workoutId}`);
    }
  }

  const colorClass = FOCUS_COLORS[routineFocus] ?? 'border-zinc-700 bg-zinc-900/20';

  return (
    <div className={`flex items-center justify-between rounded-xl border p-4 ${colorClass}`}>
      <div>
        <p className="font-semibold text-white">{routineName}</p>
        <p className="text-sm text-zinc-400">{routineFocus}</p>
      </div>
      <button
        onClick={handleStart}
        className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
      >
        Start →
      </button>
    </div>
  );
}