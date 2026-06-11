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
  Logout01Icon,
  Settings01Icon,
} from '@hugeicons-pro/core-stroke-rounded';

const ADMIN_EMAIL = 'tony@theonlytjn.com';

const tabs = [
  { href: '/predict',     label: 'Predict',  icon: DartIcon },
  { href: '/awards',      label: 'Awards',   icon: AwardIcon },
  { href: '/poll',        label: 'Poll',     icon: UserIcon },
  { href: '/fixtures',    label: 'Fixtures', icon: Calendar1Icon },
  { href: '/rules',       label: 'Rules',    icon: BookOpenIcon },
  { href: '/leaderboard', label: 'Table',    icon: BarChartIcon },
  { href: '/me',          label: 'Me',       icon: UserIcon },
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
    <header className="sticky top-0 z-20 h-[100px] border-b border-white/10 bg-pitch-950/90 backdrop-blur">
      <div className="mx-auto flex h-full max-w-[1920px] items-center justify-between px-8">
        {/* Logo — drop public/logo.svg (or logo.png) to activate */}
        <Link href="/predict" className="shrink-0">
          {!logoErr ? (
            <img
              src="/logo.svg"
              alt="SOTG '26"
              className="h-14 w-auto object-contain"
              onError={() => setLogoErr(true)}
            />
          ) : (
            <span className="font-display text-2xl uppercase text-chalk">
              SOTG <span className="text-lime">&apos;26</span>
            </span>
          )}
        </Link>

        <nav className="flex items-center gap-1">
          {tabs.map((t) => {
            const active = pathname === t.href || pathname.startsWith(t.href + '/');
            return (
              <Link
                key={t.href}
                href={t.href}
                className={[
                  'flex h-11 items-center gap-2 rounded-full px-4 font-display text-sm uppercase transition',
                  active ? 'bg-lime text-pitch-950' : 'text-chalk/60 hover:text-chalk',
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
                'flex h-11 items-center gap-2 rounded-full px-4 font-display text-sm uppercase transition',
                pathname === '/admin' || pathname.startsWith('/admin/')
                  ? 'bg-flame text-chalk'
                  : 'text-flame/70 hover:text-flame',
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
      </div>
    </header>
  );
}
