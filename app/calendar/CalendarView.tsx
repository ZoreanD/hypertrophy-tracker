'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { assignRoutineToDay, removeRoutineFromDay, moveScheduledWorkout } from '../actions/calendar';
import { startWorkout } from '../actions/workout-session';

type ScheduledItem = {
  id: string;
  date: string;
  routineId: string;
  routineName: string;
  routineFocus: string;
};

type Routine = {
  id: string;
  name: string;
  focus: string;
};

const FOCUS_COLORS: Record<string, string> = {
  Push: 'bg-blue-900/60 text-blue-300 border-blue-700',
  Pull: 'bg-purple-900/60 text-purple-300 border-purple-700',
  Legs: 'bg-green-900/60 text-green-300 border-green-700',
  Upper: 'bg-cyan-900/60 text-cyan-300 border-cyan-700',
  Lower: 'bg-teal-900/60 text-teal-300 border-teal-700',
  Fullbody: 'bg-yellow-900/60 text-yellow-300 border-yellow-700',
  Chest: 'bg-red-900/60 text-red-300 border-red-700',
  Back: 'bg-indigo-900/60 text-indigo-300 border-indigo-700',
  Shoulders: 'bg-orange-900/60 text-orange-300 border-orange-700',
  Arms: 'bg-pink-900/60 text-pink-300 border-pink-700',
  Core: 'bg-lime-900/60 text-lime-300 border-lime-700',
  Cardio: 'bg-rose-900/60 text-rose-300 border-rose-700',
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

export default function CalendarView({
  year: initialYear,
  month: initialMonth,
  scheduled = [],
  routines = [],
}: {
  year: number;
  month: number;
  scheduled: ScheduledItem[];
  routines: Routine[];
}) {
  const router = useRouter();
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedRoutineId, setSelectedRoutineId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [movingItem, setMovingItem] = useState<ScheduledItem | null>(null);

  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString().split('T')[0];

  const scheduledByDate: Record<string, ScheduledItem[]> = {};
  scheduled.forEach((s) => {
    const dateKey = s.date.split('T')[0];
    if (!scheduledByDate[dateKey]) scheduledByDate[dateKey] = [];
    scheduledByDate[dateKey].push(s);
  });

  function getDateString(day: number) {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
    setSelectedDate(null);
    setMovingItem(null);
  }

  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
    setSelectedDate(null);
    setMovingItem(null);
  }

  function handleDayClick(dateStr: string) {
    setSelectedDate(dateStr === selectedDate ? null : dateStr);
    setSelectedRoutineId(routines[0]?.id ?? '');
    setMovingItem(null);
  }

  async function handleAssign() {
    if (!selectedDate || !selectedRoutineId) return;
    setIsLoading(true);
    await assignRoutineToDay(selectedRoutineId, selectedDate);
    setIsLoading(false);
    setSelectedDate(null);
    router.refresh();
  }

  async function handleRemove(scheduledId: string) {
    setIsLoading(true);
    await removeRoutineFromDay(scheduledId);
    setIsLoading(false);
    router.refresh();
  }

  async function handleStart(item: ScheduledItem) {
    const result = await startWorkout(item.routineId, selectedDate!);
    if (result.success && result.workoutId) {
      router.push(`/workout/${result.workoutId}`);
    }
  }

  async function handleMove(itemId: string, newDate: string) {
    setIsLoading(true);
    await moveScheduledWorkout(itemId, newDate);
    setMovingItem(null);
    setSelectedDate(null);
    setIsLoading(false);
    router.refresh();
  }

  const selectedItems = selectedDate ? (scheduledByDate[selectedDate] ?? []) : [];

  return (
    <div className="space-y-6">

      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={prevMonth}
          className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:border-zinc-500"
        >
          ← Prev
        </button>
        <h2 className="text-xl font-bold text-white">
          {MONTHS[month - 1]} {year}
        </h2>
        <button
          onClick={nextMonth}
          className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:border-zinc-500"
        >
          Next →
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1">
        {DAYS.map((d) => (
          <div key={d} className="py-2 text-center text-xs font-medium text-zinc-500">
            {d}
          </div>
        ))}

        {/* Empty cells before first day */}
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}

        {/* Day cells */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dateStr = getDateString(day);
          const items = scheduledByDate[dateStr] ?? [];
          const isToday = dateStr === today;
          const isSelected = dateStr === selectedDate;

          return (
            <button
              key={day}
              onClick={() => handleDayClick(dateStr)}
              className={`min-h-[72px] rounded-lg border p-1.5 text-left transition-colors ${
                isSelected
                  ? 'border-emerald-500 bg-emerald-950/30'
                  : isToday
                  ? 'border-zinc-500 bg-zinc-800/50'
                  : 'border-zinc-800 bg-zinc-900/30 hover:border-zinc-600'
              }`}
            >
              <span className={`text-xs font-medium ${
                isToday ? 'text-emerald-400' : 'text-zinc-400'
              }`}>
                {day}
              </span>
              <div className="mt-1 space-y-0.5">
                {items.slice(0, 2).map((item) => (
                  <div
                    key={item.id}
                    className={`truncate rounded border px-1 py-0.5 text-xs ${
                      FOCUS_COLORS[item.routineFocus] ?? 'bg-zinc-800 text-zinc-300 border-zinc-700'
                    }`}
                  >
                    {item.routineFocus || item.routineName}
                  </div>
                ))}
                {items.length > 2 && (
                  <div className="text-xs text-zinc-600">+{items.length - 2} more</div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Day detail panel */}
      {selectedDate && (
        <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-5 space-y-4">
          <h3 className="font-semibold text-white">
            {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', {
              weekday: 'long', month: 'long', day: 'numeric',
            })}
          </h3>

          {/* Existing assignments */}
          {selectedItems.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-zinc-500">Scheduled</p>
              {selectedItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-zinc-800 bg-zinc-800/50 p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-white">{item.routineName}</p>
                      <p className="text-xs text-zinc-500">{item.routineFocus}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleStart(item)}
                        className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-500"
                      >
                        Start
                      </button>
                      <button
                        onClick={() => setMovingItem(movingItem?.id === item.id ? null : item)}
                        className={`rounded-md border px-3 py-1 text-xs font-semibold ${
                          movingItem?.id === item.id
                            ? 'border-yellow-600 text-yellow-400'
                            : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'
                        }`}
                      >
                        {movingItem?.id === item.id ? 'Cancel' : 'Move'}
                      </button>
                      <button
                        onClick={() => handleRemove(item.id)}
                        disabled={isLoading}
                        className="text-xs text-zinc-600 hover:text-red-400"
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  {/* Move date picker */}
                  {movingItem?.id === item.id && (
                    <div className="rounded-md border border-yellow-700/50 bg-yellow-900/10 p-3 space-y-2">
                      <p className="text-xs text-yellow-400">Pick a new date</p>
                      <input
                        type="date"
                        className="w-full rounded-md border border-zinc-700 bg-zinc-950 p-2 text-sm text-white focus:border-yellow-500 focus:outline-none"
                        onChange={async (e) => {
                          if (!e.target.value) return;
                          await handleMove(item.id, e.target.value);
                        }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Assign a routine */}
          {routines.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs text-zinc-500">Add a routine</p>
              <select
                value={selectedRoutineId}
                onChange={(e) => setSelectedRoutineId(e.target.value)}
                className="w-full rounded-md border border-zinc-700 bg-zinc-950 p-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
              >
                {routines.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} {r.focus ? `— ${r.focus}` : ''}
                  </option>
                ))}
              </select>
              <button
                onClick={handleAssign}
                disabled={isLoading}
                className="w-full rounded-md bg-emerald-600 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {isLoading ? 'Saving...' : 'Assign to Day'}
              </button>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">
              No routines yet.{' '}
              <a href="/routines/new" className="text-emerald-400 hover:underline">
                Create one first.
              </a>
            </p>
          )}
        </div>
      )}
    </div>
  );
}