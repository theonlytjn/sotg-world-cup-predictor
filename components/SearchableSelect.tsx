'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

export type SelectOption = {
  value: string;
  label: string;
  sublabel?: string;
};

export type SelectGroup = {
  label: string;
  options: SelectOption[];
};

interface Props {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  groups: SelectGroup[];
  compact?: boolean;
}

export default function SearchableSelect({
  value,
  onChange,
  disabled,
  placeholder = '— select —',
  groups,
  compact = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  const selectedLabel = useMemo(() => {
    for (const g of groups) {
      const opt = g.options.find((o) => o.value === value);
      if (opt) return { label: opt.label, sublabel: opt.sublabel };
    }
    return null;
  }, [value, groups]);

  const filteredGroups = useMemo(() => {
    if (!query.trim()) return groups;
    const q = query.toLowerCase();
    return groups
      .map((g) => ({
        ...g,
        options: g.options.filter(
          (o) =>
            o.label.toLowerCase().includes(q) ||
            (o.sublabel?.toLowerCase().includes(q) ?? false)
        ),
      }))
      .filter((g) => g.options.length > 0);
  }, [groups, query]);

  const totalVisible = filteredGroups.reduce((s, g) => s + g.options.length, 0);

  function select(val: string) {
    onChange(val);
    setOpen(false);
    setQuery('');
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={`w-full rounded-xl border text-left font-mono transition
          ${compact ? 'pl-2.5 pr-8 py-2 text-sm' : 'pl-3 pr-9 py-2.5 text-base'}
          ${open ? 'border-lime/70' : 'border-white/15'}
          bg-pitch-800 text-chalk
          ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-white/30'}`}
      >
        {selectedLabel ? (
          <span className="flex items-center justify-between gap-1">
            <span className="truncate">{compact ? (selectedLabel.label.split(' ')[0]) : selectedLabel.label}</span>
            {!compact && selectedLabel.sublabel && (
              <span className="shrink-0 text-sm text-chalk">{selectedLabel.sublabel}</span>
            )}
          </span>
        ) : (
          <span className="text-chalk/50">{placeholder}</span>
        )}
        <span
          className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-chalk transition-transform text-base ${
            open ? 'rotate-180' : ''
          }`}
        >
          ▾
        </span>
      </button>

      {open && (
        <div className="absolute z-50 mt-1.5 w-full overflow-hidden rounded-xl border border-white/15 bg-pitch-800 shadow-2xl">
          <div className="border-b border-white/10 p-2">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { setOpen(false); setQuery(''); }
              }}
              placeholder="Search…"
              className="w-full rounded-lg bg-pitch-700 px-3 py-2 font-mono text-base text-chalk outline-none placeholder:text-chalk"
            />
          </div>

          <div className="max-h-64 overflow-y-auto overscroll-contain">
            {totalVisible === 0 && (
              <p className="px-3 py-4 text-center font-mono text-base text-chalk">
                No results for &ldquo;{query}&rdquo;
              </p>
            )}

            {value && (
              <button
                type="button"
                onClick={() => select('')}
                className="w-full px-3 py-2 text-left font-mono text-base text-chalk hover:bg-white/5"
              >
                — clear selection —
              </button>
            )}

            {filteredGroups.map((g, gi) => (
              <div key={gi}>
                {g.label && (
                  <div className="sticky top-0 border-b border-white/5 bg-pitch-750 px-3 py-1.5 font-display text-sm uppercase tracking-widest text-chalk">
                    {g.label}
                  </div>
                )}
                {g.options.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => select(opt.value)}
                    className={`flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors hover:bg-white/5 ${
                      opt.value === value ? 'bg-lime/10 text-lime' : 'text-chalk'
                    }`}
                  >
                    <span className="font-mono text-base">{opt.label}</span>
                    {opt.sublabel && (
                      <span className="ml-2 shrink-0 font-mono text-sm text-chalk">
                        {opt.sublabel}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
