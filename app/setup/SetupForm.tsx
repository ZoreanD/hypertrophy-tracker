'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createProfile } from '../actions/profile';

const currentYear = new Date().getFullYear();
const birthYears = Array.from({ length: currentYear - 1939 - 16 }, (_, i) => currentYear - 16 - i);
const months = [
  { value: '1', label: 'January' }, { value: '2', label: 'February' },
  { value: '3', label: 'March' }, { value: '4', label: 'April' },
  { value: '5', label: 'May' }, { value: '6', label: 'June' },
  { value: '7', label: 'July' }, { value: '8', label: 'August' },
  { value: '9', label: 'September' }, { value: '10', label: 'October' },
  { value: '11', label: 'November' }, { value: '12', label: 'December' },
];

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

export default function SetupForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [form, setForm] = useState({
    heightFt: '5',
    heightIn: '10',
    weightLbs: '180',
    targetWeightLbs: '',
    birthMonth: '1',
    birthYear: String(currentYear - 25),
    gender: 'M',
    goal: 'MAINTAIN',
    weeklyGoalRate: '0',
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
      birthMonth: parseInt(form.birthMonth),
      birthYear: parseInt(form.birthYear),
      gender: form.gender,
      goal: form.goal,
      weeklyGoalRate: parseFloat(form.weeklyGoalRate),
      targetWeightLbs: form.targetWeightLbs ? parseFloat(form.targetWeightLbs) : undefined,
    });

    if (result.success) {
      router.push('/dashboard');
    } else {
      alert('Something went wrong. Please try again.');
      setIsSubmitting(false);
    }
  };

  const currentGoalOption = goalOptions.find(g => g.value === form.goal);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      <div>
        <label className="mb-2 block text-sm font-medium text-zinc-400">Height</label>
        <div className="flex gap-3">
          <div className="flex flex-1 items-center gap-2">
            <input type="number" value={form.heightFt} onChange={e => update('heightFt', e.target.value)}
              min="4" max="7" className="w-full rounded-md border border-zinc-700 bg-zinc-900 p-2 text-white focus:border-emerald-500 focus:outline-none" />
            <span className="text-zinc-400">ft</span>
          </div>
          <div className="flex flex-1 items-center gap-2">
            <input type="number" value={form.heightIn} onChange={e => update('heightIn', e.target.value)}
              min="0" max="11" className="w-full rounded-md border border-zinc-700 bg-zinc-900 p-2 text-white focus:border-emerald-500 focus:outline-none" />
            <span className="text-zinc-400">in</span>
          </div>
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-zinc-400">Current Weight (lbs)</label>
        <input type="number" step="0.1" value={form.weightLbs} onChange={e => update('weightLbs', e.target.value)}
          className="w-full rounded-md border border-zinc-700 bg-zinc-900 p-2 text-white focus:border-emerald-500 focus:outline-none" required />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-zinc-400">Target Weight (lbs) <span className="text-zinc-600">— optional</span></label>
        <input type="number" step="0.1" value={form.targetWeightLbs} onChange={e => update('targetWeightLbs', e.target.value)}
          placeholder="e.g. 175"
          className="w-full rounded-md border border-zinc-700 bg-zinc-900 p-2 text-white focus:border-emerald-500 focus:outline-none" />
        <p className="mt-1 text-xs text-zinc-600">Used to project your goal timeline and scale your calorie deficit.</p>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-zinc-400">Date of Birth</label>
        <div className="grid grid-cols-2 gap-3">
          <select value={form.birthMonth} onChange={e => update('birthMonth', e.target.value)}
            className="w-full rounded-md border border-zinc-700 bg-zinc-900 p-2 text-white focus:border-emerald-500 focus:outline-none">
            {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <select value={form.birthYear} onChange={e => update('birthYear', e.target.value)}
            className="w-full rounded-md border border-zinc-700 bg-zinc-900 p-2 text-white focus:border-emerald-500 focus:outline-none">
            {birthYears.map(year => <option key={year} value={year}>{year}</option>)}
          </select>
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          Age: <span className="text-zinc-300 font-medium">
            {(() => {
              const now = new Date();
              const bMonth = parseInt(form.birthMonth) - 1;
              const bYear = parseInt(form.birthYear);
              return now.getFullYear() - bYear - (now.getMonth() < bMonth ? 1 : 0);
            })()}
          </span> years old — updates live as you change month/year
        </p>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-zinc-400">Sex</label>
        <select value={form.gender} onChange={e => update('gender', e.target.value)}
          className="w-full rounded-md border border-zinc-700 bg-zinc-900 p-2 text-white focus:border-emerald-500 focus:outline-none">
          <option value="M">Male</option>
          <option value="F">Female</option>
          <option value="O">Other — use male constants</option>
        </select>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-zinc-400">Goal</label>
        <select value={form.goal} onChange={e => {
          update('goal', e.target.value);
          const opt = goalOptions.find(g => g.value === e.target.value);
          if (opt) update('weeklyGoalRate', opt.rates[0].value);
        }} className="w-full rounded-md border border-zinc-700 bg-zinc-900 p-2 text-white focus:border-emerald-500 focus:outline-none">
          {goalOptions.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
        </select>
      </div>

      {currentGoalOption && currentGoalOption.rates.length > 1 && (
        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-400">Rate of Change</label>
          <select value={form.weeklyGoalRate} onChange={e => update('weeklyGoalRate', e.target.value)}
            className="w-full rounded-md border border-zinc-700 bg-zinc-900 p-2 text-white focus:border-emerald-500 focus:outline-none">
            {currentGoalOption.rates.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <p className="mt-2 text-xs text-zinc-500">
            {form.goal === 'CUT'
              ? 'Deficits above 0.75kg/week increase muscle loss risk regardless of protein intake.'
              : 'Surpluses above 0.5kg/week result in disproportionate fat gain for most people.'}
          </p>
        </div>
      )}

      <button type="submit" disabled={isSubmitting}
        className="w-full rounded-md bg-emerald-600 py-3 font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">
        {isSubmitting ? 'Saving...' : 'Save Profile & Go to Dashboard'}
      </button>

    </form>
  );
}