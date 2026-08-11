'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { WrappedData } from '../../../lib/wrapped';

// Each slide is a full-screen card. Tap the right half to advance, the left
// half to go back — the pattern people already know from Stories/Rewind.
type Slide = { key: string; render: () => React.ReactNode };

function fmt(n: number): string {
  return n.toLocaleString('en-US');
}

// Count-up that runs once when its slide becomes active. Big numbers are the
// whole point of a Wrapped, so they should land rather than just appear.
function useCountUp(target: number, active: boolean, ms = 900) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!active) { setV(0); return; }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / ms);
      // ease-out cubic
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, active, ms]);
  return v;
}

export default function WrappedStory({
  data, username, isLive,
}: {
  data: WrappedData;
  username: string;
  isLive: boolean;
}) {
  const router = useRouter();
  const [i, setI] = useState(0);
  const [saved, setSaved] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const Big = ({ value, suffix }: { value: number; suffix?: string }) => {
    const n = useCountUp(value, true);
    return (
      <span className="block text-6xl font-black tracking-tight text-white sm:text-7xl">
        {fmt(n)}{suffix}
      </span>
    );
  };

  const slides: Slide[] = [
    {
      key: 'intro',
      render: () => (
        <div className="space-y-4 text-center">
          <p className="text-sm uppercase tracking-[0.3em] text-emerald-400">Year in Review</p>
          <h1 className="text-5xl font-black text-white sm:text-6xl">{data.year}</h1>
          <p className="text-lg text-zinc-300">@{username}, here&apos;s your training year.</p>
          <p className="pt-6 text-xs text-zinc-500">Tap to begin →</p>
        </div>
      ),
    },
    {
      key: 'workouts',
      render: () => (
        <div className="space-y-3 text-center">
          <p className="text-zinc-400">You showed up</p>
          <Big value={data.totalWorkouts} />
          <p className="text-xl text-zinc-300">times</p>
          <p className="pt-4 text-sm text-zinc-500">
            across {data.activeDays} active days · {fmt(data.totalMinutes)} minutes under the iron
          </p>
        </div>
      ),
    },
    {
      key: 'tonnage',
      render: () => (
        <div className="space-y-3 text-center">
          <p className="text-zinc-400">You moved</p>
          <Big value={data.totalTonnageLbs} />
          <p className="text-xl text-zinc-300">pounds of total volume</p>
          <p className="pt-4 text-sm text-zinc-500">
            {fmt(data.totalReps)} reps over {fmt(data.totalWorkingSets)} working sets
          </p>
        </div>
      ),
    },
    {
      key: 'muscle',
      render: () => (
        <div className="w-full space-y-5">
          <div className="text-center">
            <p className="text-zinc-400">Your most-trained muscle</p>
            <p className="pt-1 text-4xl font-black text-emerald-400">
              {data.topMuscleGroup?.label ?? '—'}
            </p>
          </div>
          <div className="space-y-2">
            {data.muscleBreakdown.map((m) => {
              const max = data.muscleBreakdown[0]?.sets || 1;
              return (
                <div key={m.key} className="flex items-center gap-3">
                  <span className="w-32 shrink-0 text-right text-xs text-zinc-400">{m.label}</span>
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                      style={{ width: `${(m.sets / max) * 100}%` }}
                    />
                  </div>
                  <span className="w-10 text-xs text-zinc-500">{m.sets}</span>
                </div>
              );
            })}
          </div>
          <p className="text-center text-xs text-zinc-600">sets per muscle group</p>
        </div>
      ),
    },
    {
      key: 'exercises',
      render: () => (
        <div className="w-full space-y-5">
          <p className="text-center text-zinc-400">Your top 5 exercises</p>
          <ol className="space-y-3">
            {data.topExercises.map((e, idx) => (
              <li key={e.exerciseId} className="flex items-center gap-4">
                <span className="text-2xl font-black text-zinc-700">{idx + 1}</span>
                <span className="flex-1 font-semibold text-white">{e.name}</span>
                <span className="text-sm text-emerald-400">{e.sets} sets</span>
              </li>
            ))}
          </ol>
        </div>
      ),
    },
    {
      key: 'gain',
      render: () => (
        <div className="w-full space-y-5 text-center">
          <p className="text-zinc-400">Your biggest strength jump</p>
          {data.biggestGain ? (
            <>
              <p className="text-3xl font-black text-white">{data.biggestGain.name}</p>
              <p className="text-5xl font-black text-emerald-400">
                +{data.biggestGain.gainLbs} lbs
              </p>
              <p className="text-sm text-zinc-400">
                estimated 1RM {data.biggestGain.firstE1RM} → {data.biggestGain.bestE1RM} lbs
                <br />over {data.biggestGain.sessions} sessions
              </p>
            </>
          ) : (
            <p className="text-zinc-400">Not enough repeat sessions to measure a jump yet.</p>
          )}
          {data.progression.length > 1 && (
            <div className="space-y-1 pt-4 text-left">
              {data.progression.slice(1, 4).map((p) => (
                <div key={p.exerciseId} className="flex justify-between text-sm">
                  <span className="text-zinc-400">{p.name}</span>
                  <span className="text-zinc-300">+{p.gainLbs} lbs</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'habits',
      render: () => (
        <div className="w-full space-y-6 text-center">
          <p className="text-zinc-400">Your training personality</p>
          <div className="space-y-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-zinc-500">Busiest day</p>
              <p className="text-3xl font-black text-white">{data.busiestWeekday?.day ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-zinc-500">Biggest month</p>
              <p className="text-3xl font-black text-white">
                {data.busiestMonth?.month ?? '—'}
                <span className="ml-2 text-base font-normal text-zinc-400">
                  {data.busiestMonth ? `${data.busiestMonth.count} sessions` : ''}
                </span>
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-zinc-500">Longest streak</p>
              <p className="text-3xl font-black text-white">{data.longestStreakDays} days</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-zinc-500">Main character lift</p>
              <p className="text-2xl font-black text-emerald-400">
                {data.mainCharacterLift?.name ?? '—'}
              </p>
              {data.mainCharacterLift && (
                <p className="text-sm text-zinc-500">
                  {fmt(data.mainCharacterLift.tonnageLbs)} lbs moved
                </p>
              )}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'title',
      render: () => (
        <div className="space-y-4 text-center">
          <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">Your {data.year} title</p>
          <p className="text-5xl font-black text-emerald-400 sm:text-6xl">{data.title}</p>
          <p className="text-lg text-zinc-300">{data.titleBlurb}</p>
        </div>
      ),
    },
    {
      key: 'card',
      render: () => (
        <div className="w-full space-y-5 text-center">
          <p className="text-zinc-400">Save your card</p>
          <canvas ref={canvasRef} className="mx-auto w-full max-w-xs rounded-xl border border-zinc-700" />
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={downloadCard}
              className="rounded-md bg-emerald-600 px-6 py-3 text-sm font-bold text-white hover:bg-emerald-500"
            >
              ⤓ Save image
            </button>
            {saved && <p className="text-xs text-emerald-400">{saved}</p>}
            <button
              onClick={() => router.push('/dashboard')}
              className="mt-2 text-xs text-zinc-500 hover:text-zinc-300"
            >
              Back to dashboard
            </button>
          </div>
          {isLive && (
            <p className="pt-2 text-xs text-zinc-600">
              Wrapped closes on Jan 7 — save the card to keep it.
            </p>
          )}
        </div>
      ),
    },
  ];

  const last = slides.length - 1;

  // Paint the share card whenever its slide is shown. Plain canvas — no
  // external renderer, so the image is generated entirely on-device.
  const drawCard = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const W = 1080, H = 1350; // 4:5, the friendliest aspect for sharing
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    if (!g) return;

    const bg = g.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#09090b');
    bg.addColorStop(1, '#052e23');
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);

    g.fillStyle = '#10b981';
    g.font = 'bold 34px system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillText(`${data.year} YEAR IN REVIEW`, W / 2, 130);

    g.fillStyle = '#ffffff';
    g.font = 'bold 92px system-ui, sans-serif';
    g.fillText(data.title, W / 2, 250);

    g.fillStyle = '#a1a1aa';
    g.font = '34px system-ui, sans-serif';
    g.fillText(`@${username}`, W / 2, 310);

    const stats: [string, string][] = [
      ['WORKOUTS', fmt(data.totalWorkouts)],
      ['WORKING SETS', fmt(data.totalWorkingSets)],
      ['TOTAL REPS', fmt(data.totalReps)],
      ['POUNDS MOVED', fmt(data.totalTonnageLbs)],
      ['TOP MUSCLE', data.topMuscleGroup?.label ?? '—'],
      ['LONGEST STREAK', `${data.longestStreakDays} days`],
    ];

    let y = 440;
    for (const [label, value] of stats) {
      g.fillStyle = '#71717a';
      g.font = 'bold 28px system-ui, sans-serif';
      g.textAlign = 'left';
      g.fillText(label, 110, y);

      g.fillStyle = '#ffffff';
      g.font = 'bold 54px system-ui, sans-serif';
      g.textAlign = 'right';
      g.fillText(value, W - 110, y + 6);

      g.strokeStyle = 'rgba(255,255,255,0.08)';
      g.beginPath();
      g.moveTo(110, y + 38);
      g.lineTo(W - 110, y + 38);
      g.stroke();
      y += 120;
    }

    if (data.biggestGain) {
      g.textAlign = 'center';
      g.fillStyle = '#10b981';
      g.font = 'bold 32px system-ui, sans-serif';
      g.fillText('BIGGEST JUMP', W / 2, y + 30);
      g.fillStyle = '#ffffff';
      g.font = 'bold 44px system-ui, sans-serif';
      g.fillText(`${data.biggestGain.name}  +${data.biggestGain.gainLbs} lbs`, W / 2, y + 90);
    }

    g.textAlign = 'center';
    g.fillStyle = '#52525b';
    g.font = '28px system-ui, sans-serif';
    g.fillText('Zorean Hypertrophy', W / 2, H - 60);
  }, [data, username]);

  useEffect(() => {
    if (slides[i]?.key === 'card') drawCard();
  }, [i, drawCard, slides]);

  function downloadCard() {
    const c = canvasRef.current;
    if (!c) return;
    try {
      const url = c.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `zorean-wrapped-${data.year}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setSaved('Saved to your downloads.');
    } catch {
      setSaved('Could not save — long-press the image to save it instead.');
    }
  }

  const next = useCallback(() => setI((v) => Math.min(last, v + 1)), [last]);
  const prev = useCallback(() => setI((v) => Math.max(0, v - 1)), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight' || e.key === ' ') next();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'Escape') router.push('/dashboard');
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, router]);

  return (
    <main className="relative flex min-h-screen flex-col bg-gradient-to-b from-zinc-950 to-emerald-950/40 text-zinc-100">
      {/* Progress bars */}
      <div className="flex gap-1 p-3">
        {slides.map((s, idx) => (
          <div key={s.key} className="h-1 flex-1 overflow-hidden rounded-full bg-zinc-800">
            <div className={`h-full rounded-full bg-emerald-500 transition-all duration-300 ${idx <= i ? 'w-full' : 'w-0'}`} />
          </div>
        ))}
      </div>

      <button
        onClick={() => router.push('/dashboard')}
        aria-label="Close"
        className="absolute right-3 top-8 z-20 text-2xl leading-none text-zinc-500 hover:text-white"
      >
        ×
      </button>

      {/* Slide body */}
      <div className="flex flex-1 items-center justify-center px-8 pb-16">
        <div key={slides[i].key} className="w-full max-w-md animate-[fadeIn_0.4s_ease-out]">
          {slides[i].render()}
        </div>
      </div>

      {/* Tap zones — left half back, right half forward. The final slide is
          interactive (save button), so its zones are disabled. */}
      {i < last && (
        <>
          <button aria-label="Previous" onClick={prev}
            className="absolute inset-y-0 left-0 z-10 w-1/3 cursor-default focus:outline-none" />
          <button aria-label="Next" onClick={next}
            className="absolute inset-y-0 right-0 z-10 w-2/3 cursor-pointer focus:outline-none" />
        </>
      )}

      <div className="pointer-events-none absolute bottom-4 left-0 right-0 text-center text-xs text-zinc-600">
        {i + 1} / {slides.length}
      </div>

      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}`}</style>
    </main>
  );
}
