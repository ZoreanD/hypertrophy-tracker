'use client';

import Tooltip from '../components/Tooltip';
import { GLOSSARY } from '../components/glossary';

type VolumeDataPoint = {
  muscle: string;
  label: string;
  sets: number;
  mev: number;
  mav: number;
  status: string;
};

export default function VolumeChart({ data }: { data: VolumeDataPoint[] }) {
  const maxSets = Math.max(...data.map((d) => Math.max(d.sets, d.mav)), 1);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="space-y-3">
        {data.map((d) => (
          <div key={d.muscle} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400 w-24 shrink-0">{d.label}</span>
              <div className="flex-1 mx-3 relative h-5">
                {/* Background track */}
                <div className="absolute inset-0 rounded-full bg-zinc-800" />

                {/* MEV marker */}
                {d.mev > 0 && (
                  <div
                    className="absolute top-0 bottom-0 w-px bg-yellow-600/60"
                    style={{ left: `${(d.mev / maxSets) * 100}%` }}
                  />
                )}

                {/* MAV marker */}
                <div
                  className="absolute top-0 bottom-0 w-px bg-emerald-600/60"
                  style={{ left: `${(d.mav / maxSets) * 100}%` }}
                />

                {/* Actual sets bar */}
                {d.sets > 0 && (
                  <div
                    className={`absolute inset-y-0 left-0 rounded-full transition-all ${
                      d.status === 'none' ? 'bg-zinc-700'
                      : d.status === 'below_mev' ? 'bg-yellow-500'
                      : d.status === 'in_mav' ? 'bg-emerald-500'
                      : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min((d.sets / maxSets) * 100, 100)}%` }}
                  />
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`font-medium ${
                  d.status === 'none' ? 'text-zinc-600'
                  : d.status === 'below_mev' ? 'text-yellow-400'
                  : d.status === 'in_mav' ? 'text-emerald-400'
                  : 'text-red-400'
                }`}>
                  {d.sets}
                </span>
                <span className="text-zinc-700 text-xs">/ {d.mav}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-4 text-xs text-zinc-600">
        <div className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-yellow-500" />
          <span>Below MEV</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-emerald-500" />
          <span>In MAV (optimal)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-red-500" />
          <span><Tooltip definition={GLOSSARY.MRV}>Near MRV</Tooltip></span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-1">
            <div className="h-3 w-px bg-yellow-600/60" />
            <span><Tooltip definition={GLOSSARY.MEV}>MEV</Tooltip></span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-3 w-px bg-emerald-600/60" />
            <span><Tooltip definition={GLOSSARY.MAV}>MAV</Tooltip></span>
          </div>
        </div>
      </div>
    </div>
  );
}