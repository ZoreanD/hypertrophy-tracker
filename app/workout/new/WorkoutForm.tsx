// app/workout/new/WorkoutForm.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { logWorkout } from '../../actions/workout';

// Defining the shape of our data
type Exercise = { id: string; name: string; muscleGroup: string };
type SetInput = { exerciseId: string; weightLbs: number; reps: number; rir: number };

export default function WorkoutForm({ 
  profileId, 
  exercises 
}: { 
  profileId: string; 
  exercises: Exercise[];
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [focus, setFocus] = useState('Push');
  const [duration, setDuration] = useState(60);
  const [currentWeight, setCurrentWeight] = useState(80); // kg
  
  // Sets State (Starts with one empty set by default)
  const [sets, setSets] = useState<SetInput[]>([
    { exerciseId: exercises[0]?.id || '', weightLbs: 0, reps: 0, rir: 0 }
  ]);

  const addSet = () => {
    setSets([...sets, { exerciseId: exercises[0]?.id || '', weightLbs: 0, reps: 0, rir: 0 }]);
  };

  const updateSet = (index: number, field: keyof SetInput, value: string | number) => {
    const newSets = [...sets];
    newSets[index] = { ...newSets[index], [field]: value };
    setSets(newSets);
  };

  const removeSet = (index: number) => {
    setSets(sets.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Call the Server Action
    const result = await logWorkout(
      profileId,
      currentWeight,
      focus,
      duration,
      sets
    );

    if (result.success) {
      // If successful, boot the user back to the dashboard to see their updated macros
      router.push('/dashboard');
    } else {
      alert('Failed to save workout. Check terminal for errors.');
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      
      {/* Top Level Workout Details */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col">
          <label className="mb-1 text-sm font-medium text-zinc-400">Focus / Split</label>
          <input 
            type="text" 
            value={focus} 
            onChange={(e) => setFocus(e.target.value)}
            className="rounded-md border border-zinc-700 bg-zinc-900 p-2 text-white focus:border-emerald-500 focus:outline-none" 
            required
          />
        </div>
        <div className="flex flex-col">
          <label className="mb-1 text-sm font-medium text-zinc-400">Duration (mins)</label>
          <input 
            type="number" 
            value={duration} 
            onChange={(e) => setDuration(Number(e.target.value))}
            className="rounded-md border border-zinc-700 bg-zinc-900 p-2 text-white focus:border-emerald-500 focus:outline-none" 
            required
          />
        </div>
        <div className="flex flex-col">
          <label className="mb-1 text-sm font-medium text-zinc-400">Current Bodyweight (lbs)</label>
          <input 
            type="number" 
            step="0.1"
            value={currentWeight} 
            onChange={(e) => setCurrentWeight(Number(e.target.value))}
            className="rounded-md border border-zinc-700 bg-zinc-900 p-2 text-white focus:border-emerald-500 focus:outline-none" 
            required
          />
        </div>
      </div>

      {/* The Sets Tracker */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-zinc-200">Tracked Sets</h2>
        
        {sets.map((set, index) => (
          <div key={index} className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 sm:flex-nowrap">
            
            <div className="flex w-full flex-col sm:w-auto sm:flex-1">
              <label className="mb-1 text-xs text-zinc-500">Exercise</label>
              <select 
                value={set.exerciseId}
                onChange={(e) => updateSet(index, 'exerciseId', e.target.value)}
                className="rounded-md border border-zinc-700 bg-zinc-900 p-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
              >
                {exercises.map((ex) => (
                  <option key={ex.id} value={ex.id}>{ex.name}</option>
                ))}
              </select>
            </div>

            <div className="flex w-[30%] flex-col sm:w-24">
              <label className="mb-1 text-xs text-zinc-500">Weight (lbs)</label>
              <input 
                type="number" 
                value={set.weightLbs || ''}
                onChange={(e) => updateSet(index, 'weightLbs', Number(e.target.value))}
                className="rounded-md border border-zinc-700 bg-zinc-900 p-2 text-center text-sm text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div className="flex w-[25%] flex-col sm:w-20">
              <label className="mb-1 text-xs text-zinc-500">Reps</label>
              <input 
                type="number" 
                value={set.reps || ''}
                onChange={(e) => updateSet(index, 'reps', Number(e.target.value))}
                className="rounded-md border border-zinc-700 bg-zinc-900 p-2 text-center text-sm text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div className="flex w-[25%] flex-col sm:w-20">
              <label className="mb-1 text-xs text-zinc-500">RIR</label>
              <input 
                type="number" 
                value={set.rir || ''}
                onChange={(e) => updateSet(index, 'rir', Number(e.target.value))}
                className="rounded-md border border-zinc-700 bg-zinc-900 p-2 text-center text-sm text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <button 
              type="button" 
              onClick={() => removeSet(index)}
              className="flex h-[38px] w-10 items-center justify-center rounded-md border border-red-900/50 bg-red-950/30 text-red-500 hover:bg-red-900/50"
            >
              ✕
            </button>
          </div>
        ))}

        <button 
          type="button" 
          onClick={addSet}
          className="w-full rounded-lg border border-dashed border-zinc-700 py-3 text-sm font-medium text-zinc-400 hover:border-emerald-500 hover:text-emerald-400"
        >
          + Add Set
        </button>
      </div>

      <button 
        type="submit" 
        disabled={isSubmitting}
        className="w-full rounded-md bg-emerald-600 py-3 font-semibold text-white shadow-sm hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600 disabled:opacity-50"
      >
        {isSubmitting ? 'Saving...' : 'Save Workout & Update Macros'}
      </button>

    </form>
  );
}