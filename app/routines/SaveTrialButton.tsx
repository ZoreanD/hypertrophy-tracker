'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveTrialAsRoutine } from '../actions/social';

export default function SaveTrialButton({ routineId }: { routineId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const res = await saveTrialAsRoutine(routineId);
      if (!res.success) { alert(res.error || 'Failed to save'); return; }
      router.refresh();
    });
  }

  return (
    <button
      onClick={save}
      disabled={pending}
      className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
    >
      {pending ? 'Saving…' : 'Save as my routine'}
    </button>
  );
}
