'use client';

import { useState, useEffect } from 'react';
import { CHANGELOG_VERSION, recentChangelog, ChangelogEntry } from '../../lib/changelog';

const DISMISS_KEY = 'zh-whatsnew-dismissed';

const TAG_STYLES: Record<string, string> = {
  new: 'border-emerald-600 bg-emerald-900/40 text-emerald-300',
  fix: 'border-blue-600 bg-blue-900/40 text-blue-300',
  improved: 'border-yellow-600 bg-yellow-900/40 text-yellow-300',
};

function Panel({ entries, onClose }: { entries: ChangelogEntry[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 bg-gradient-to-r from-emerald-900/50 to-zinc-900 px-5 py-4">
          <div>
            <h2 className="text-lg font-black tracking-tight text-white">What&apos;s New</h2>
            <p className="text-xs text-zinc-400">Latest updates to your tracker</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-2xl leading-none text-zinc-500 hover:text-white"
          >
            ×
          </button>
        </div>

        <ul className="max-h-[60vh] divide-y divide-zinc-800 overflow-y-auto">
          {entries.map((e, i) => (
            <li key={`${e.date}-${e.title}`} className="px-5 py-4">
              <div className="flex items-center gap-2">
                {e.tag && (
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${TAG_STYLES[e.tag] ?? ''}`}>
                    {e.tag}
                  </span>
                )}
                <h3 className="font-semibold text-white">{e.title}</h3>
                {i === 0 && (
                  <span className="ml-auto text-[10px] uppercase tracking-widest text-emerald-500">
                    Newest
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{e.body}</p>
            </li>
          ))}
        </ul>

        <div className="border-t border-zinc-800 p-4">
          <button
            onClick={onClose}
            className="w-full rounded-md bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-500"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Auto-surfacing changelog card.
 *
 * Appears only when the deployed CHANGELOG_VERSION differs from the last one
 * this device dismissed — so no deploy means no popup, and dismissing it once
 * keeps it gone until the next release. It stays reachable from Settings via
 * WhatsNewButton.
 */
export default function WhatsNew() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISS_KEY) !== CHANGELOG_VERSION) setOpen(true);
    } catch {
      // Private mode / storage blocked: skip rather than nag on every load.
    }
  }, []);

  function close() {
    setOpen(false);
    try { localStorage.setItem(DISMISS_KEY, CHANGELOG_VERSION); } catch {}
  }

  if (!open) return null;
  return <Panel entries={recentChangelog()} onClose={close} />;
}

/** Settings entry point — re-opens the card on demand, even after dismissal. */
export function WhatsNewButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-lg border border-zinc-700 px-4 py-3 text-left text-sm font-semibold text-zinc-300 hover:border-zinc-500 hover:text-white"
      >
        📣 What&apos;s New
        <span className="block text-xs font-normal text-zinc-500">
          Recent updates to the app
        </span>
      </button>
      {open && <Panel entries={recentChangelog()} onClose={() => setOpen(false)} />}
    </>
  );
}
