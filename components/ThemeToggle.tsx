'use client';

import { useEffect, useState } from 'react';

export default function ThemeToggle({ mobile = false }: { mobile?: boolean }) {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const stored = localStorage.getItem('sotg-theme') as 'dark' | 'light' | null;
    setTheme(stored ?? 'dark');
  }, []);

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('sotg-theme', next);
    document.documentElement.classList.toggle('light', next === 'light');
  }

  const isDark = theme === 'dark';

  if (mobile) {
    return (
      <button
        onClick={toggle}
        className="flex w-full items-center gap-4 rounded-2xl px-5 py-4 bg-pitch-900 font-display text-base uppercase tracking-wide text-chalk transition hover:bg-pitch-800"
      >
        <ThemeIcon dark={isDark} size={24} />
        {isDark ? 'Light mode' : 'Dark mode'}
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="flex h-9 w-9 items-center justify-center rounded-full text-chalk transition hover:text-lime"
    >
      <ThemeIcon dark={isDark} size={18} />
    </button>
  );
}

function ThemeIcon({ dark, size }: { dark: boolean; size: number }) {
  if (dark) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <line x1="12" y1="2"  x2="12" y2="4" />
        <line x1="12" y1="20" x2="12" y2="22" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="2"  y1="12" x2="4"  y2="12" />
        <line x1="20" y1="12" x2="22" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}
