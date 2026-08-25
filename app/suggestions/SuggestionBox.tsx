'use client';

import { useState, useTransition, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { submitSuggestion, deleteSuggestion } from '../actions/suggestions';

type Suggestion = {
  id: string;
  body: string;
  status: string;
  createdAt: string;
  username: string;
  isMine: boolean;
};

const STATUS_STYLES: Record<string, string> = {
  NEW: 'border-zinc-600 bg-zinc-800 text-zinc-300',
  PLANNED: 'border-yellow-600 bg-yellow-900/40 text-yellow-300',
  SHIPPED: 'border-emerald-600 bg-emerald-900/40 text-emerald-300',
  DECLINED: 'border-zinc-700 bg-zinc-900 text-zinc-500',
};

const MAX = 2000;

export default function SuggestionBox({ suggestions }: { suggestions: Suggestion[] }) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();
  // `pending` from useTransition isn't set synchronously with the click, so two
  // taps a few ms apart both pass the disabled check and post twice. A ref flips
  // immediately and closes that window.
  const inFlight = useRef(false);

  function submit() {
    if (inFlight.current) return;
    const text = body.trim();
    if (!text) { setError('Write something first.'); return; }
    setError(null);
    inFlight.current = true;
    startTransition(async () => {
      const res = await submitSuggestion(text);
      inFlight.current = false;
      if (res.success) {
        setBody('');
        setSent(true);
        router.refresh();
        setTimeout(() => setSent(false), 3000);
      } else {
        setError(res.error ?? 'Could not save that.');
      }
    });
  }

  function remove(id: string) {
    if (!confirm('Delete this suggestion?')) return;
    startTransition(async () => {
      await deleteSuggestion(id);
      router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3 rounded-xl border border-zinc-700 bg-zinc-900 p-5">
        <label htmlFor="suggestion" className="block text-sm font-semibold text-white">
          Leave a suggestion
        </label>
        <textarea
          id="suggestion"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          maxLength={MAX}
          placeholder="What would make this better?"
          className="w-full resize-y rounded-md border border-zinc-700 bg-zinc-950 p-3 text-sm text-white focus:border-emerald-500 focus:outline-none"
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-600">{body.length}/{MAX}</span>
          <button
            onClick={submit}
            disabled={pending || body.trim().length === 0}
            className="rounded-md bg-emerald-600 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-40"
          >
            {pending ? 'Sending…' : 'Send'}
          </button>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        {sent && <p className="text-xs text-emerald-400">Thanks — logged it.</p>}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">
          Everyone&apos;s ideas
        </h2>
        {suggestions.length === 0 ? (
          <p className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-5 text-sm text-zinc-500">
            Nothing yet. Be the first.
          </p>
        ) : (
          <ul className="space-y-3">
            {suggestions.map((s) => (
              <li key={s.id} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
                <div className="flex items-center gap-2">
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_STYLES[s.status] ?? STATUS_STYLES.NEW}`}>
                    {s.status.toLowerCase()}
                  </span>
                  <span className="text-xs text-zinc-500">
                    @{s.username}
                    {s.isMine && <span className="ml-1 text-emerald-500">(you)</span>}
                  </span>
                  <span className="ml-auto text-xs text-zinc-600">
                    {new Date(s.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-300">{s.body}</p>
                {s.isMine && (
                  <button
                    onClick={() => remove(s.id)}
                    className="mt-2 text-xs text-zinc-600 hover:text-red-400"
                  >
                    Delete
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
