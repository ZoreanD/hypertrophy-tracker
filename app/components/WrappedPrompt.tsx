'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

/**
 * Dashboard entry point for Year in Review.
 *
 * Only rendered while Wrapped is in its window (the server decides that, in the
 * lifter's timezone, and passes `year`). Dismissing hides it for that year only,
 * so next December's Wrapped surfaces again on its own.
 */
export default function WrappedPrompt({ year }: { year: number }) {
  const key = `zh-wrapped-dismissed-${year}`;
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(key) !== '1') setShow(true);
    } catch {
      setShow(true);
    }
  }, [key]);

  if (!show) return null;

  return (
    <div className="relative overflow-hidden rounded-xl border border-emerald-700 bg-gradient-to-r from-emerald-950 via-zinc-900 to-zinc-900 p-5">
      <button
        aria-label="Dismiss"
        onClick={() => {
          setShow(false);
          try { localStorage.setItem(key, '1'); } catch {}
        }}
        className="absolute right-3 top-2 text-xl leading-none text-zinc-500 hover:text-white"
      >
        ×
      </button>
      <p className="text-xs uppercase tracking-[0.25em] text-emerald-400">Year in Review</p>
      <h2 className="mt-1 text-2xl font-black text-white">Your {year} Wrapped is ready</h2>
      <p className="mt-1 text-sm text-zinc-400">
        Every set, every PR, and your title for the year.
      </p>
      <Link
        href={`/wrapped/${year}`}
        className="mt-3 inline-block rounded-md bg-emerald-600 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-500"
      >
        See your {year} →
      </Link>
      <p className="mt-2 text-xs text-zinc-600">Available for a limited time — save your card to keep it.</p>
    </div>
  );
}
