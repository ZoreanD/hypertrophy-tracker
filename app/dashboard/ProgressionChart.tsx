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

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <select
          value={selectedId}
          onChange={(e) => handleExerciseChange(e.target.value)}
          className="rounded-md border border-zinc-700 bg-zinc-950 p-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
        >
          {exercises.map((ex) => (
            <option key={ex.id} value={ex.id}>{ex.name}</option>
          ))}
        </select>
        <span className="text-xs text-zinc-500">Estimated 1RM (Epley formula)</span>
      </div>

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
                formatter={(value: any) => [`${value}lbs`, 'e1RM']}
                labelFormatter={(label) => new Date(label).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              />
              <Line
                type="monotone"
                dataKey="e1RM"
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