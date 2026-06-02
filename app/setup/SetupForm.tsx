'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createProfile } from '../actions/profile';

export default function SetupForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [form, setForm] = useState({
    heightFt: '5',
    heightIn: '10',
    weightLbs: '180',
    age: '25',
    gender: 'M',
    goal: 'MAINTAIN',
    weeklyGoalRate: 'maintain',
  });

  const update = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const result = await createProfile({
      heightCm: (parseInt(form.heightFt) * 12 + parseInt(form.heightIn)) * 2.54,
      weightLbs: parseFloat(form.weightLbs),
      age: parseInt(form.age),
      gender: form.gender,
      goal: form.goal,
      weeklyGoalRate: parseFloat(form.weeklyGoalRate),
    });

    if (result.success) {
      router.push('/dashboard');
    } else {
      alert('Something went wrong. Please try again.');
      setIsSubmitting(false);
    }
  };

  const goalOptions = [
    { value: 'CUT', label: 'Cut — Lose fat', rates: [
      { value: '0.25', label: 'Slow (-0.25kg/week) — Maximum muscle retention' },
      { value: '0.5', label: 'Moderate (-0.5kg/week) — Recommended' },
      { value: '0.75', label: 'Aggressive (-0.75kg/week) — Some muscle loss risk' },
    ]},
    { value: 'MAINTAIN', label: 'Maintain — Body recomposition', rates: [
      { value: '0', label: 'Maintenance calories' },
    ]},
    { value: 'BULK', label: 'Bulk — Build muscle', rates: [
      { value: '0.25', label: 'Lean (+0.25kg/week) — Recommended for most' },
      { value: '0.5', label: 'Moderate (+0.5kg/week) — Faster gains, some fat' },
    ]},
  ];

  const currentGoalOption = goalOptions.find(g => g.value === form.goal);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* Height */}
      <div>
        <label className="mb-2 block text-sm font-medium text-zinc-400">Height</label>
        <div className="flex gap-3">
          <div className="flex flex-1 items-center gap-2">
            <input
              type="number"
              value={form.heightFt}
              onChange={e => update('heightFt', e.target.value)}
              min="4" max="7"
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 p-2 text-white focus:border-emerald-500 focus:outline-none"
            />
            <span className="text-zinc-400">ft</span>
          </div>
          <div className="flex flex-1 items-center gap-2">
            <input
              type="number"
              value={form.heightIn}
              onChange={e => update('heightIn', e.target.value)}
              min="0" max="11"
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 p-2 text-white focus:border-emerald-500 focus:outline-none"
            />
            <span className="text-zinc-400">in</span>
          </div>
        </div>
      </div>

      {/* Current Weight */}
      <div>
        <label className="mb-2 block text-sm font-medium text-zinc-400">Current Weight (lbs)</label>
        <input
          type="number"
          step="0.1"
          value={form.weightLbs}
          onChange={e => update('weightLbs', e.target.value)}
          className="w-full rounded-md border border-zinc-700 bg-zinc-900 p-2 text-white focus:border-emerald-500 focus:outline-none"
          required
        />
      </div>

      {/* Age */}
      <div>
        <label className="mb-2 block text-sm font-medium text-zinc-400">Age</label>
        <input
          type="number"
          value={form.age}
          onChange={e => update('age', e.target.value)}
          min="16" max="99"
          className="w-full rounded-md border border-zinc-700 bg-zinc-900 p-2 text-white focus:border-emerald-500 focus:outline-none"
          required
        />
      </div>

      {/* Sex */}
      <div>
        <label className="mb-2 block text-sm font-medium text-zinc-400">Sex</label>
        <select
          value={form.gender}
          onChange={e => update('gender', e.target.value)}
          className="w-full rounded-md border border-zinc-700 bg-zinc-900 p-2 text-white focus:border-emerald-500 focus:outline-none"
        >
          <option value="M">Male</option>
          <option value="F">Female</option>
          <option value="O">Other — use male constants</option>
        </select>
      </div>

      {/* Goal */}
      <div>
        <label className="mb-2 block text-sm font-medium text-zinc-400">Goal</label>
        <select
          value={form.goal}
          onChange={e => {
            update('goal', e.target.value);
            const opt = goalOptions.find(g => g.value === e.target.value);
            if (opt) update('weeklyGoalRate', opt.rates[0].value);
          }}
          className="w-full rounded-md border border-zinc-700 bg-zinc-900 p-2 text-white focus:border-emerald-500 focus:outline-none"
        >
          {goalOptions.map(g => (
            <option key={g.value} value={g.value}>{g.label}</option>
          ))}
        </select>
      </div>

      {/* Rate of Change */}
      {currentGoalOption && currentGoalOption.rates.length > 1 && (
        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-400">Rate of Change</label>
          <select
            value={form.weeklyGoalRate}
            onChange={e => update('weeklyGoalRate', e.target.value)}
            className="w-full rounded-md border border-zinc-700 bg-zinc-900 p-2 text-white focus:border-emerald-500 focus:outline-none"
          >
            {currentGoalOption.rates.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          <p className="mt-2 text-xs text-zinc-500">
            {form.goal === 'CUT'
              ? 'Deficits above 0.75kg/week increase muscle loss risk regardless of protein intake.'
              : 'Surpluses above 0.5kg/week result in disproportionate fat gain for most people.'}
          </p>
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-md bg-emerald-600 py-3 font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
      >
        {isSubmitting ? 'Saving...' : 'Save Profile & Go to Dashboard'}
      </button>

    </form>
  );
}