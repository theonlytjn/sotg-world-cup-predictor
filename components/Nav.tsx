'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  DartIcon,
  AwardIcon,
  UserIcon,
  Calendar1Icon,
  BookOpenIcon,
  BarChartIcon,
  FootballIcon,
  Logout01Icon,
  Settings01Icon,
  Menu01Icon,
  Cancel01Icon,
} from '@hugeicons-pro/core-stroke-rounded';

const ADMIN_EMAIL = 'tony@theonlytjn.com';

const tabs = [
  { href: '/predict',     label: 'Predict',    icon: DartIcon },
  { href: '/awards',      label: 'Awards',     icon: AwardIcon },
  { href: '/tournament',  label: 'World Cup',  icon: FootballIcon },
  { href: '/fixtures',    label: 'Fixtures',   icon: Calendar1Icon },
  { href: '/leaderboard', label: 'Table',      icon: BarChartIcon },
  { href: '/rules',       label: 'Rules',      icon: BookOpenIcon },
  { href: '/me',          label: 'Me',         icon: UserIcon },
];

export default function Nav({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [logoErr, setLogoErr] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setMenuOpen(false);
    router.push('/login');
    router.refresh();
  }

  function closeMenu() { setMenuOpen(false); }

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-white/10 bg-pitch-950/95 backdrop-blur">
        <div className="mx-auto flex h-[72px] sm:h-[100px] max-w-[1920px] items-center justify-between px-4 sm:px-8">
          {/* Logo */}
          <Link href="/predict" className="shrink-0" onClick={closeMenu}>
            {!logoErr ? (
              <img
                src="/logo.svg"
                alt="SOTG '26"
                className="h-10 sm:h-14 w-auto object-contain"
                onError={() => setLogoErr(true)}
              />
            ) : (
              <span className="font-display text-xl sm:text-2xl uppercase text-chalk">
                SOTG <span className="text-lime">&apos;26</span>
              </span>
            )}
          </Link>

          {/* Desktop nav — hidden on mobile */}
          <nav className="hidden sm:flex items-center gap-1">
            {tabs.map((t) => {
              const active = pathname === t.href || pathname.startsWith(t.href + '/');
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className={[
                    'flex items-center gap-2 px-3 py-2 font-display text-base uppercase transition',
                    active ? 'text-lime' : 'text-chalk/55 hover:text-chalk',
                  ].join(' ')}
                >
                  <HugeiconsIcon icon={t.icon} size={18} color="currentColor" strokeWidth={1.8} />
                  {t.label}
                </Link>
              );
            })}
            {userEmail === ADMIN_EMAIL && (
              <Link
                href="/admin"
                className={[
                  'flex items-center gap-2 px-3 py-2 font-display text-base uppercase transition',
                  pathname === '/admin' || pathname.startsWith('/admin/')
                    ? 'text-flame'
                    : 'text-flame/50 hover:text-flame',
                ].join(' ')}
              >
                <HugeiconsIcon icon={Settings01Icon} size={18} color="currentColor" strokeWidth={1.8} />
                Admin
              </Link>
            )}
            <button
              onClick={signOut}
              className="ml-2 flex h-11 w-11 items-center justify-center rounded-full text-chalk/40 transition hover:text-flame"
              title="Sign out"
              aria-label="Sign out"
            >
              <HugeiconsIcon icon={Logout01Icon} size={20} color="currentColor" strokeWidth={1.5} />
            </button>
          </nav>

          {/* Mobile hamburger toggle */}
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="sm:hidden flex h-11 w-11 items-center justify-center rounded-full text-chalk/70 transition hover:text-chalk active:bg-pitch-800"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          >
            <HugeiconsIcon
              icon={menuOpen ? Cancel01Icon : Menu01Icon}
              size={26}
              color="currentColor"
              strokeWidth={1.8}
            />
          </button>
        </div>
      </header>

      {/* Mobile full-screen nav overlay */}
      {menuOpen && (
        <div className="sm:hidden fixed inset-0 top-[72px] z-20 bg-pitch-950 overflow-y-auto">
          <nav className="px-4 pt-4 pb-10">
            {tabs.map((t) => {
              const active = pathname === t.href || pathname.startsWith(t.href + '/');
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  onClick={closeMenu}
                  className={[
                    'flex w-full items-center gap-4 rounded-2xl px-5 py-4 mb-2 bg-pitch-900 font-display text-base uppercase tracking-wide transition hover:bg-pitch-800',
                    active ? 'text-lime' : 'text-chalk/75 hover:text-chalk',
                  ].join(' ')}
                >
                  <HugeiconsIcon icon={t.icon} size={24} color="currentColor" strokeWidth={1.7} />
                  {t.label}
                </Link>
              );
            })}

            {userEmail === ADMIN_EMAIL && (
              <Link
                href="/admin"
                onClick={closeMenu}
                className={[
                  'flex w-full items-center gap-4 rounded-2xl px-5 py-4 mb-2 font-display text-base uppercase tracking-wide transition',
                  pathname === '/admin' || pathname.startsWith('/admin/')
                    ? 'text-flame'
                    : 'text-flame/50 hover:text-flame',
                ].join(' ')}
              >
                <HugeiconsIcon icon={Settings01Icon} size={24} color="currentColor" strokeWidth={1.7} />
                Admin
              </Link>
            )}

            <div className="my-4 h-px bg-white/8" />

            <button
              onClick={signOut}
              className="flex w-full items-center gap-4 rounded-2xl px-5 py-4 bg-pitch-900 font-display text-base uppercase tracking-wide text-chalk/50 hover:text-flame hover:bg-pitch-800 transition"
            >
              <HugeiconsIcon icon={Logout01Icon} size={24} color="currentColor" strokeWidth={1.7} />
              Sign out
            </button>
          </nav>
        </div>
      )}
    </>
  );
}
