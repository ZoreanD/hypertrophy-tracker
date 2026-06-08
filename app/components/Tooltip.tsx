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
        <span className="absolute bottom-full left-1/2 z-50 mb-2 w-60 -translate-x-1/2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs leading-relaxed text-zinc-300 shadow-xl">
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