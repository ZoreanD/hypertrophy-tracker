'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function InProgressWorkoutCard({
  workoutId,
  focus,
  isAdHoc,
}: {
  workoutId: string;
  focus: string;
  isAdHoc: boolean;
}) {
  const [activeRestRemaining, setActiveRestRemaining] = useState<number | null>(null);

  useEffect(() => {
    function checkRest() {
      try {
        const raw = localStorage.getItem('zh-active-rest-timer');
        if (raw) {
          const saved = JSON.parse(raw);
          if (saved && saved.workoutId === workoutId && typeof saved.endTime === 'number') {
            const left = Math.max(0, Math.ceil((saved.endTime - Date.now()) / 1000));
            setActiveRestRemaining(left > 0 ? left : null);
            return;
          }
        }
      } catch {}
      setActiveRestRemaining(null);
    }

    checkRest();
    const interval = setInterval(checkRest, 1000);
    return () => clearInterval(interval);
  }, [workoutId]);

  return (
    <div className="flex items-center justify-between rounded-xl border border-yellow-800/60 bg-yellow-950/10 p-4">
      <div>
        <p className="font-semibold text-white">{focus}</p>
        <p className="text-xs text-yellow-400">
          {activeRestRemaining !== null
            ? `⏳ In progress · Rest: ${Math.floor(activeRestRemaining / 60)}:${(activeRestRemaining % 60).toString().padStart(2, '0')}`
            : `⏳ In progress${isAdHoc ? ' · ad-hoc' : ''}`}
        </p>
      </div>
      <Link
        href={`/workout/${workoutId}`}
        className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
      >
        Resume
      </Link>
    </div>
  );
}

