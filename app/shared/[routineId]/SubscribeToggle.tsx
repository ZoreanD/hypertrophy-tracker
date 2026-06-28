'use client';

import { useState, useTransition } from 'react';
import { setRoutineSubscription } from '../../actions/social';
import { ensurePushSubscription } from '../../../lib/pushClient';

export default function SubscribeToggle({
  routineId,
  username,
  initialSubscribed,
}: {
  routineId: string;
  username: string;
  initialSubscribed: boolean;
}) {
  const [subscribed, setSubscribed] = useState(initialSubscribed);
  const [pending, startTransition] = useTransition();

  async function toggle() {
    const next = !subscribed;
    setSubscribed(next); // optimistic
    // Enabling: request notification permission + register this device now
    // (this click is the user gesture browsers require for the prompt).
    if (next) {
      const result = await ensurePushSubscription({ prompt: true });
      if (result === 'denied') {
        alert("You're subscribed, but notifications are blocked. Enable them in your browser settings to get live updates.");
      }
    }
    startTransition(async () => {
      const res = await setRoutineSubscription(routineId, next);
      if (!res.success) { setSubscribed(!next); alert(res.error || 'Failed'); }
    });
  }

  return (
    <button
      onClick={toggle}
      disabled={pending}
      className={`flex w-full items-center justify-between rounded-xl border p-4 text-left transition disabled:opacity-50 ${
        subscribed ? 'border-emerald-800 bg-emerald-950/30' : 'border-zinc-800 bg-zinc-900/40'
      }`}
    >
      <div>
        <p className="text-sm font-semibold text-white">
          {subscribed ? 'Getting live updates' : 'Get live updates'}
        </p>
        <p className="mt-0.5 text-xs text-zinc-500">
          Notify me each time @{username} completes this routine.
        </p>
      </div>
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${subscribed ? 'bg-emerald-600' : 'bg-zinc-700'}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${subscribed ? 'left-[1.375rem]' : 'left-0.5'}`} />
      </span>
    </button>
  );
}
