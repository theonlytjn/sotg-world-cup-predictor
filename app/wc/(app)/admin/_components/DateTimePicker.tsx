'use client';

import { useEffect, useRef, useState } from 'react';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function daysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function firstWeekday(y: number, m: number) { return new Date(y, m, 1).getDay(); }

function fmtDisplay(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

type Props = {
  value: string | null;
  onChange: (v: string | null) => void;
  placeholder?: string;
};

export default function DateTimePicker({ value, onChange, placeholder = 'Set deadline' }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const now = new Date();
  const initial = value ? new Date(value) : null;

  const [viewYear,  setViewYear]  = useState(initial?.getFullYear() ?? now.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial?.getMonth()    ?? now.getMonth());
  const [selDate,   setSelDate]   = useState<{ y: number; m: number; d: number } | null>(
    initial ? { y: initial.getFullYear(), m: initial.getMonth(), d: initial.getDate() } : null
  );
  const [time, setTime] = useState(initial ? fmtTime(initial.toISOString()) : '12:00');

  // Sync internal state when value changes externally
  useEffect(() => {
    if (value) {
      const d = new Date(value);
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
      setSelDate({ y: d.getFullYear(), m: d.getMonth(), d: d.getDate() });
      setTime(fmtTime(value));
    } else {
      setSelDate(null);
    }
  }, [value]);

  // Close on outside click
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  }

  function apply() {
    if (!selDate) return;
    const [h, mn] = time.split(':').map(Number);
    const d = new Date(selDate.y, selDate.m, selDate.d, h ?? 0, mn ?? 0);
    onChange(d.toISOString());
    setOpen(false);
  }

  function clear() {
    onChange(null);
    setSelDate(null);
    setOpen(false);
  }

  const totalCells = firstWeekday(viewYear, viewMonth) + daysInMonth(viewYear, viewMonth);
  const gridRows = Math.ceil(totalCells / 7);

  return (
    <div ref={containerRef} className="relative inline-block">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={[
          'flex items-center gap-2 rounded-lg border px-3 py-2 font-mono text-sm transition',
          open
            ? 'border-lime/60 bg-pitch-700 text-chalk'
            : 'border-white/15 bg-pitch-800 text-chalk hover:border-white/30',
        ].join(' ')}
      >
        <span className="text-chalk/60">📅</span>
        {value ? fmtDisplay(value) : <span className="text-chalk/50">{placeholder}</span>}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-72 rounded-2xl border border-white/15 bg-pitch-800 p-4 shadow-2xl">
          {/* Month nav */}
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={prevMonth}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-chalk transition hover:bg-white/10 hover:text-lime"
            >
              ←
            </button>
            <span className="font-display text-sm uppercase tracking-wide text-chalk">
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-chalk transition hover:bg-white/10 hover:text-lime"
            >
              →
            </button>
          </div>

          {/* Day headers */}
          <div className="mb-1 grid grid-cols-7">
            {DAYS.map((d) => (
              <span key={d} className="text-center font-mono text-xs text-chalk/40">{d}</span>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7" style={{ gridTemplateRows: `repeat(${gridRows}, minmax(0, 1fr))` }}>
            {Array.from({ length: firstWeekday(viewYear, viewMonth) }, (_, i) => (
              <span key={`pad-${i}`} />
            ))}
            {Array.from({ length: daysInMonth(viewYear, viewMonth) }, (_, i) => {
              const day = i + 1;
              const isSelected =
                selDate?.d === day && selDate?.m === viewMonth && selDate?.y === viewYear;
              const isToday =
                day === now.getDate() && viewMonth === now.getMonth() && viewYear === now.getFullYear();
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => setSelDate({ y: viewYear, m: viewMonth, d: day })}
                  className={[
                    'rounded-lg py-1.5 text-center font-mono text-sm transition',
                    isSelected
                      ? 'bg-lime font-bold text-pitch-950'
                      : isToday
                      ? 'border border-lime/40 text-lime hover:bg-lime/10'
                      : 'text-chalk hover:bg-white/10',
                  ].join(' ')}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Time input */}
          <div className="mt-3 flex items-center gap-3 border-t border-white/10 pt-3">
            <span className="font-mono text-xs uppercase tracking-widest text-chalk/60">Time</span>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="flex-1 rounded-lg border border-white/15 bg-pitch-900 px-2 py-1.5 font-mono text-sm text-chalk outline-none focus:border-lime/60"
            />
          </div>

          {/* Action buttons */}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={apply}
              disabled={!selDate}
              className="flex-1 rounded-lg bg-lime py-2 font-display text-sm uppercase tracking-wide text-pitch-950 transition hover:brightness-110 disabled:opacity-30"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={clear}
              className="rounded-lg border border-flame/30 px-4 py-2 font-mono text-sm text-flame transition hover:bg-flame/10"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
