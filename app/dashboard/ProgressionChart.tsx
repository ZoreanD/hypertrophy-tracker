'use client';

import { useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';

type DataPoint = {
  date: string;
  e1RM: number;
  weight: number;
  reps: number;
};

type Exercise = {
  id: string;
  name: string;
};

type Metric = 'weight' | 'e1RM';

export default function ProgressionChart({
  exercises,
  defaultExerciseId,
  initialData,
  profileId,
}: {
  exercises: Exercise[];
  defaultExerciseId: string;
  initialData: DataPoint[];
  profileId: string;
}) {
  const [selectedId, setSelectedId] = useState(defaultExerciseId);
  const [data, setData] = useState<DataPoint[]>(initialData);
  const [loading, setLoading] = useState(false);
  const [metric, setMetric] = useState<Metric>('weight');

  async function handleExerciseChange(exerciseId: string) {
    setSelectedId(exerciseId);
    setLoading(true);
    const res = await fetch(`/api/progression?exerciseId=${exerciseId}&profileId=${profileId}`);
    if (res.ok) {
      const json = await res.json();
      setData(json.data);
    }
    setLoading(false);
  }

  // "How long have I been at this weight?" — count the trailing sessions whose
  // top-set weight equals the most recent one.
  const latest = data.length ? data[data.length - 1] : null;
  let streak = 0;
  let streakStart = latest?.date ?? '';
  if (latest) {
    for (let i = data.length - 1; i >= 0; i--) {
      if (data[i].weight === latest.weight) { streak++; streakStart = data[i].date; }
      else break;
    }
  }
  const fmtDate = (d: string) =>
    new Date(d.slice(0, 10) + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const metricLabel = metric === 'weight' ? 'Top set' : 'e1RM';

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <select
          value={selectedId}
          onChange={(e) => handleExerciseChange(e.target.value)}
          className="rounded-md border border-zinc-700 bg-zinc-950 p-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
        >
          {exercises.map((ex) => (
            <option key={ex.id} value={ex.id}>{ex.name}</option>
          ))}
        </select>
        <div className="flex gap-1">
          {(['weight', 'e1RM'] as Metric[]).map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                metric === m ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              {m === 'weight' ? 'Top set' : 'e1RM'}
            </button>
          ))}
        </div>
      </div>

      {latest && (
        <p className="text-xs text-zinc-500">
          Latest top set: <span className="font-semibold text-white">{latest.weight} lbs × {latest.reps}</span>
          {streak >= 2 && (
            <> · held this weight <span className="font-semibold text-emerald-400">{streak} sessions</span> since {fmtDate(streakStart)}</>
          )}
        </p>
      )}

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <p className="text-sm text-zinc-500">Loading...</p>
        </div>
      ) : data.length < 2 ? (
        <div className="flex h-48 items-center justify-center">
          <p className="text-sm text-zinc-500">Log at least 2 sessions to see a trend.</p>
        </div>
      ) : (
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis
                dataKey="date"
                stroke="#52525b"
                fontSize={10}
                tickMargin={8}
                tickFormatter={(v) => {
                  const d = new Date(v);
                  return `${d.getMonth() + 1}/${d.getDate()}`;
                }}
              />
              <YAxis
                stroke="#52525b"
                fontSize={10}
                tickMargin={8}
                domain={['auto', 'auto']}
                tickFormatter={(v) => `${v}lb`}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', color: '#fff', fontSize: 12 }}
                formatter={(value: any) => [`${value}lbs`, metricLabel]}
                labelFormatter={(label) => new Date(label).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              />
              <Line
                type="monotone"
                dataKey={metric}
                stroke="#10b981"
                strokeWidth={2}
                dot={{ r: 3, fill: '#10b981', strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
