'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const tabs = [
  { href: '/predict', label: 'Predict' },
  { href: '/awards', label: 'Awards' },
  { href: '/fixtures', label: 'Fixtures' },
  { href: '/leaderboard', label: 'Table' },
  { href: '/me', label: 'Me' },
];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-pitch-950/85 backdrop-blur">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
        <Link href="/predict" className="font-display text-lg uppercase tracking-wide text-chalk">
          SOTG <span className="text-lime">’26</span>
        </Link>
        <nav className="flex items-center gap-1">
          {tabs.map((t) => {
            const active = pathname === t.href || pathname.startsWith(t.href + '/');
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`rounded-full px-3 py-1.5 font-display text-sm uppercase tracking-wide transition ${
                  active ? 'bg-lime text-pitch-950' : 'text-chalk/60 hover:text-chalk'
                }`}
              >
                {t.label}
              </Link>
            );
          })}
          <button
            onClick={signOut}
            className="ml-1 rounded-full px-2 py-1.5 text-chalk/40 transition hover:text-flame"
            title="Sign out"
            aria-label="Sign out"
          >
            ⏏
          </button>
        </nav>
      </div>
    </header>
  );
}
