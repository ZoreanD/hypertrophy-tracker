'use client';

import { useState, useTransition } from 'react';
import { setRoutineVisibility } from '../../actions/social';

type Visibility = 'PRIVATE' | 'FOLLOWERS' | 'LINK';

export default function RoutineShareControl({
  routineId,
  initialVisibility,
}: {
  routineId: string;
  initialVisibility: Visibility;
}) {
  // Phase 1 surfaces Private vs Followers; LINK sharing comes later.
  const [visibility, setVisibility] = useState<Visibility>(
    initialVisibility === 'LINK' ? 'FOLLOWERS' : initialVisibility
  );
  const [pending, startTransition] = useTransition();
  const shared = visibility === 'FOLLOWERS';

  function setTo(next: 'PRIVATE' | 'FOLLOWERS') {
    const prev = visibility;
    setVisibility(next); // optimistic
    startTransition(async () => {
      const res = await setRoutineVisibility(routineId, next);
      if (!res.success) { setVisibility(prev); alert(res.error || 'Failed to update sharing'); }
    });
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-white">Sharing</p>
          <p className="mt-0.5 text-xs text-zinc-500">
            {shared
              ? 'Followers can see this routine and your latest numbers, and trial it.'
              : 'Only you can see this routine.'}
          </p>
        </div>
        <button
          role="switch"
          aria-checked={shared}
          disabled={pending}
          onClick={() => setTo(shared ? 'PRIVATE' : 'FOLLOWERS')}
          className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50 ${
            shared ? 'bg-emerald-600' : 'bg-zinc-700'
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
              shared ? 'left-[1.375rem]' : 'left-0.5'
            }`}
          />
        </button>
      </div>
    </div>
  );
}
