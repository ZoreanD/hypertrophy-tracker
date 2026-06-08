'use client';

import { useState, useRef, useEffect } from 'react';

export default function Tooltip({
  definition,
  children,
}: {
  definition: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (!open || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const tooltipWidth = Math.min(240, window.innerWidth - 16);
    const centered = rect.left + rect.width / 2 - tooltipWidth / 2;
    // Clamp to viewport with 8px margin each side
    const clamped = Math.max(8, Math.min(centered, window.innerWidth - tooltipWidth - 8));
    // offset relative to element's left edge
    setOffset(clamped - rect.left);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handle);
    document.addEventListener('touchstart', handle);
    return () => {
      document.removeEventListener('mousedown', handle);
      document.removeEventListener('touchstart', handle);
    };
  }, [open]);

  return (
    <span ref={ref} className="relative inline-flex items-center">
      <span
        onClick={() => setOpen((v) => !v)}
        className="cursor-help border-b border-dotted border-zinc-600 text-inherit"
      >
        {children}
      </span>
      {open && (
        <span
          className="absolute bottom-full z-50 mb-2 w-60 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs leading-relaxed text-zinc-300 shadow-xl"
          style={{ left: offset, maxWidth: 'calc(100vw - 16px)' }}
        >
          {definition}
          <span
            onClick={() => setOpen(false)}
            className="ml-2 cursor-pointer text-zinc-600 hover:text-zinc-400"
          >
            ✕
          </span>
        </span>
      )}
    </span>
  );
}