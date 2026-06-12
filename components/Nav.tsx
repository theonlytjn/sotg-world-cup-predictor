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

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-pitch-950/90 backdrop-blur">
      <div className="mx-auto flex h-[72px] sm:h-[100px] max-w-[1920px] items-center justify-between px-4 sm:px-8 gap-3">
        {/* Logo */}
        <Link href="/predict" className="shrink-0">
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

        {/* Tab bar — scrollable on mobile, hidden scrollbar */}
        <nav className="flex items-center gap-0.5 sm:gap-1 overflow-x-auto scrollbar-hide min-w-0 flex-1 justify-end">
          {tabs.map((t) => {
            const active = pathname === t.href || pathname.startsWith(t.href + '/');
            return (
              <Link
                key={t.href}
                href={t.href}
                className={[
                  'flex h-9 sm:h-11 shrink-0 items-center gap-1.5 sm:gap-2 rounded-full px-2.5 sm:px-4 font-display text-xs sm:text-sm uppercase transition',
                  active ? 'bg-lime text-pitch-950' : 'text-chalk/60 hover:text-chalk',
                ].join(' ')}
              >
                <HugeiconsIcon icon={t.icon} size={17} color="currentColor" strokeWidth={1.8} />
                <span className="hidden sm:inline">{t.label}</span>
              </Link>
            );
          })}
          {userEmail === ADMIN_EMAIL && (
            <Link
              href="/admin"
              className={[
                'flex h-9 sm:h-11 shrink-0 items-center gap-1.5 sm:gap-2 rounded-full px-2.5 sm:px-4 font-display text-xs sm:text-sm uppercase transition',
                pathname === '/admin' || pathname.startsWith('/admin/')
                  ? 'bg-flame text-chalk'
                  : 'text-flame/70 hover:text-flame',
              ].join(' ')}
            >
              <HugeiconsIcon icon={Settings01Icon} size={17} color="currentColor" strokeWidth={1.8} />
              <span className="hidden sm:inline">Admin</span>
            </Link>
          )}
          <button
            onClick={signOut}
            className="ml-1 flex h-9 sm:h-11 w-9 sm:w-11 shrink-0 items-center justify-center rounded-full text-chalk/40 transition hover:text-flame"
            title="Sign out"
            aria-label="Sign out"
          >
            <HugeiconsIcon icon={Logout01Icon} size={18} color="currentColor" strokeWidth={1.5} />
          </button>
        </nav>
      </div>
    </header>
  );
}
