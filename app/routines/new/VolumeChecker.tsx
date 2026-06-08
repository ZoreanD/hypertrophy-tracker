'use client';

import Tooltip from '../../components/Tooltip';
import { GLOSSARY } from '../../components/glossary';

import { useState } from 'react';

type VolumeCheckItem = {
  muscle: string;
  label: string;
  sets: number;
  indirect: number;
  heads: { key: string; label: string; sets: number }[];
  minSets: number;
  mev: number;
  mav: number;
  met: boolean;
  status: string;
};

export default function VolumeChecker({
  volumeCheck,
  focus,
}: {
  volumeCheck: VolumeCheckItem[];
  focus: string;
}) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  function toggle(muscle: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(muscle) ? next.delete(muscle) : next.add(muscle);
      return next;
    });
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <p className="mb-3 text-sm font-medium text-zinc-400">
        Volume Check — {focus}
      </p>
      <div className="space-y-1">
        {volumeCheck.map((v) => {
          const hasHeads = v.heads.length > 0;
          const isExpanded = expandedGroups.has(v.muscle);

          return (
            <div key={v.muscle}>
              <div
                className={`flex items-center justify-between rounded-lg px-2 py-1.5 ${
                  hasHeads ? 'cursor-pointer hover:bg-zinc-800/50' : ''
                }`}
                onClick={() => hasHeads && toggle(v.muscle)}
              >
                <div className="flex items-center gap-2">
                  {hasHeads && (
                    <span className="w-3 text-xs text-zinc-600">
                      {isExpanded ? '▼' : '▶'}
                    </span>
                  )}
                  {!hasHeads && <span className="w-3" />}
                  <span className={`text-sm ${v.met ? 'text-zinc-200' : 'text-zinc-500'}`}>
                    {v.label}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-600">{v.sets} direct</span>
                  {v.indirect > 0 && (
                    <span className="text-xs text-zinc-500">+{v.indirect} indirect</span>
                  )}
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    v.status === 'none' ? 'bg-zinc-800 text-zinc-500'
                    : v.status === 'below_mev' ? 'bg-yellow-900/50 text-yellow-400'
                    : v.status === 'in_mav' ? 'bg-emerald-900/50 text-emerald-400'
                    : 'bg-red-900/50 text-red-400'
                  }`}>
                    {v.status === 'none' ? '○ Missing'
                    : v.status === 'below_mev' ? <Tooltip definition={GLOSSARY.MEV}>⚠ Below MEV</Tooltip>
                    : v.status === 'in_mav' ? <Tooltip definition={GLOSSARY.MAV}>✓ In MAV</Tooltip>
                    : <Tooltip definition={GLOSSARY.MRV}>↑ Near MRV</Tooltip>}
                  </span>
                </div>
              </div>

              {isExpanded && hasHeads && (
                <div className="ml-5 mb-1 space-y-0.5 border-l border-zinc-800 pl-3">
                  {v.heads.map((h) => (
                    <div key={h.key} className="flex items-center justify-between py-0.5">
                      <span className={`text-xs ${h.sets > 0 ? 'text-zinc-400' : 'text-zinc-600'}`}>
                        {h.label}
                      </span>
                      <span className={`text-xs ${h.sets > 0 ? 'text-zinc-400' : 'text-zinc-700'}`}>
                        {h.sets > 0 ? `${h.sets} sets` : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-zinc-600">
        <Tooltip definition={GLOSSARY.MEV}>MEV</Tooltip> = minimum for growth · <Tooltip definition={GLOSSARY.MAV}>MAV</Tooltip> = optimal range · <Tooltip definition={GLOSSARY.MRV}>MRV</Tooltip> = recovery limit · tap a group to drill down
      </p>
    </div>
  );
}