'use client';

import { useState, useTransition } from 'react';
import { setRoutineVisibility } from '../../actions/social';

type Visibility = 'PRIVATE' | 'FOLLOWERS' | 'LINK';

const OPTIONS: { value: Visibility; label: string; hint: string }[] = [
  { value: 'PRIVATE', label: 'Private', hint: 'Only you can see this routine.' },
  { value: 'FOLLOWERS', label: 'Followers', hint: 'Your followers can view, trial, and see your numbers.' },
  { value: 'LINK', label: 'Anyone with link', hint: 'Anyone with the link can view and trial it (numbers still require following you).' },
];

export default function RoutineShareControl({
  routineId,
  initialVisibility,
  initialShareToken,
}: {
  routineId: string;
  initialVisibility: Visibility;
  initialShareToken: string | null;
}) {
  const [visibility, setVisibility] = useState<Visibility>(initialVisibility);
  const [shareToken, setShareToken] = useState<string | null>(initialShareToken);
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  const shareUrl =
    shareToken && typeof window !== 'undefined' ? `${window.location.origin}/r/${shareToken}` : '';

  function select(next: Visibility) {
    if (next === visibility) return;
    const prev = visibility;
    setVisibility(next); // optimistic
    startTransition(async () => {
      const res = await setRoutineVisibility(routineId, next);
      if (!res.success) { setVisibility(prev); alert(res.error || 'Failed to update sharing'); return; }
      if (next === 'LINK' && res.shareToken) setShareToken(res.shareToken);
    });
  }

  async function copy() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard unavailable */ }
  }

  const activeHint = OPTIONS.find((o) => o.value === visibility)?.hint;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <p className="text-sm font-semibold text-white">Sharing</p>
      <div className="mt-3 flex gap-2">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            onClick={() => select(o.value)}
            disabled={pending}
            className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
              visibility === o.value
                ? 'bg-emerald-600 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-zinc-500">{activeHint}</p>

      {visibility === 'LINK' && shareUrl && (
        <div className="mt-3 flex gap-2">
          <input
            readOnly
            value={shareUrl}
            className="flex-1 truncate rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-300"
          />
          <button
            onClick={copy}
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:border-zinc-500"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      )}
    </div>
  );
}
