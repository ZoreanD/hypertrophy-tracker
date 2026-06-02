// app/dashboard/ProgressChart.tsx
'use client';

import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getExerciseHistory } from '../actions/charts';

export default function ProgressChart({ profileId, exerciseId, exerciseName }: { profileId: string, exerciseId: string, exerciseName: string }) {
  const [data, setData] = useState<any[]>([]);
  const [metric, setMetric] = useState<'maxE1RM' | 'totalVolume'>('maxE1RM');

  useEffect(() => {
    async function loadData() {
      const history = await getExerciseHistory(profileId, exerciseId);
      setData(history);
    }
    loadData();
  }, [profileId, exerciseId]);

  if (data.length === 0) return <div className="text-zinc-500">Log more sets to see your progression trend.</div>;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-lg font-bold text-white">{exerciseName} Trend</h3>
        <select 
          value={metric} 
          onChange={(e) => setMetric(e.target.value as any)}
          className="rounded-md border border-zinc-700 bg-zinc-950 p-1 text-sm text-zinc-300"
        >
          <option value="maxE1RM">Est. 1 Rep Max</option>
          <option value="totalVolume">Volume Load</option>
        </select>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
            <XAxis dataKey="date" stroke="#71717a" fontSize={12} tickMargin={10} />
            <YAxis stroke="#71717a" fontSize={12} tickMargin={10} domain={['auto', 'auto']} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', color: '#fff' }}
              itemStyle={{ color: '#10b981' }}
            />
            <Line 
              type="monotone" 
              dataKey={metric} 
              stroke="#10b981" 
              strokeWidth={3} 
              dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#18181b' }} 
              activeDot={{ r: 6 }} 
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}