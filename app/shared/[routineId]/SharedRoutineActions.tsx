'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { cloneRoutine } from '../../actions/social';

export default function SharedRoutineActions({ routineId }: { routineId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | 'trial' | 'copy'>(null);

  async function run(asTrial: boolean) {
    setBusy(asTrial ? 'trial' : 'copy');
    const res = await cloneRoutine(routineId, { asTrial });
    setBusy(null);
    if (!res.success) { alert(res.error || 'Could not copy routine'); return; }
    router.push('/routines');
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={() => run(true)}
        disabled={busy !== null}
        className="flex-1 rounded-md bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
      >
        {busy === 'trial' ? 'Adding…' : 'Trial this routine'}
      </button>
      <button
        onClick={() => run(false)}
        disabled={busy !== null}
        className="rounded-md border border-zinc-700 px-4 py-2.5 text-sm text-zinc-300 hover:border-zinc-500 disabled:opacity-50"
      >
        {busy === 'copy' ? 'Saving…' : 'Save a copy'}
      </button>
    </div>
  );
}
