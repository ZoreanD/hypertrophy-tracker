'use client';

import { useEffect, useState } from 'react';

type ThemeId = 'default' | 'ffxiv-dark' | 'ffxiv-blue' | 'ffxiv-light' | 'ffxiv-white';

const THEMES: { id: ThemeId; label: string; swatch: [string, string, string] }[] = [
  { id: 'default',     label: 'Default',    swatch: ['#09090b', '#27272a', '#34d399'] },
  { id: 'ffxiv-dark',  label: 'Charcoal',   swatch: ['#14110c', '#2c2519', '#e0b35c'] },
  { id: 'ffxiv-blue',  label: 'Slate Blue', swatch: ['#0a1622', '#1b3551', '#e0b35c'] },
  { id: 'ffxiv-light', label: 'Parchment',  swatch: ['#f4ecd8', '#ddcaa3', '#8a5e22'] },
  { id: 'ffxiv-white', label: 'White',      swatch: ['#f5f6f8', '#d8dce1', '#dc2626'] },
];

function applyTheme(id: ThemeId) {
  if (id === 'default') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = id;
}

export default function ThemeSwitcher() {
  const [active, setActive] = useState<ThemeId>('default');

  useEffect(() => {
    const saved = (localStorage.getItem('theme') as ThemeId) || 'default';
    setActive(saved);
  }, []);

  function pick(id: ThemeId) {
    setActive(id);
    applyTheme(id);
    try {
      if (id === 'default') localStorage.removeItem('theme');
      else localStorage.setItem('theme', id);
    } catch { /* storage unavailable */ }
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <h2 className="text-lg font-bold text-white">Theme</h2>
      <p className="mt-1 text-sm text-zinc-400">Change the look of the app. Saved on this device.</p>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {THEMES.map((t) => (
          <button
            key={t.id}
            onClick={() => pick(t.id)}
            className={`rounded-lg border p-3 text-left transition ${
              active === t.id ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-zinc-700 hover:border-zinc-500'
            }`}
          >
            <div className="flex gap-1">
              {t.swatch.map((c, i) => (
                <span key={i} className="h-6 w-full rounded" style={{ backgroundColor: c }} />
              ))}
            </div>
            <p className="mt-2 text-sm font-medium text-zinc-200">{t.label}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
