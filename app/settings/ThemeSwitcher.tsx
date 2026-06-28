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
  const [navIcons, setNavIcons] = useState(false);

  useEffect(() => {
    const saved = (localStorage.getItem('theme') as ThemeId) || 'default';
    setActive(saved);
    setNavIcons(localStorage.getItem('navIcons') === '1');
  }, []);

  function pick(id: ThemeId) {
    setActive(id);
    applyTheme(id);
    try {
      if (id === 'default') localStorage.removeItem('theme');
      else localStorage.setItem('theme', id);
    } catch { /* storage unavailable */ }
  }

  function toggleNavIcons() {
    const next = !navIcons;
    setNavIcons(next);
    if (next) document.documentElement.dataset.navIcons = '1';
    else delete document.documentElement.dataset.navIcons;
    try {
      if (next) localStorage.setItem('navIcons', '1');
      else localStorage.removeItem('navIcons');
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

      <div className="mt-5 flex items-center justify-between border-t border-zinc-800 pt-4">
        <div>
          <p className="text-sm font-medium text-zinc-200">Icon navigation</p>
          <p className="mt-0.5 text-xs text-zinc-500">Compact the top nav into FFXIV-style icon buttons.</p>
        </div>
        <button
          role="switch"
          aria-checked={navIcons}
          onClick={toggleNavIcons}
          className={`relative h-6 w-11 shrink-0 rounded-full transition ${navIcons ? 'bg-emerald-600' : 'bg-zinc-700'}`}
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${navIcons ? 'left-[1.375rem]' : 'left-0.5'}`} />
        </button>
      </div>
    </div>
  );
}
