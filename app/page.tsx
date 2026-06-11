import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const loggedIn = !!data.user;

  return (
    <main className="mx-auto max-w-3xl px-5 py-16 sm:py-24">
      <p className="font-mono text-xs uppercase tracking-[0.35em] text-lime">
        USA · Canada · Mexico · 2026
      </p>
      <h1 className="mt-4 font-display text-6xl uppercase leading-[0.92] text-chalk sm:text-8xl">
        Predict the
        <br />
        <span className="text-lime">World Cup.</span>
      </h1>
      <p className="mt-6 max-w-xl text-lg text-chalk/70">
        Call every group game, rack up points, and settle once and for all who
        actually knows their football. The SOTG league table doesn&apos;t lie.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href={loggedIn ? '/predict' : '/login'}
          className="rounded-full bg-lime px-7 py-3 font-display text-lg uppercase tracking-wide text-pitch-950 transition hover:brightness-110"
        >
          {loggedIn ? 'Make your picks' : 'Get started'}
        </Link>
        <Link
          href="/leaderboard"
          className="rounded-full border border-white/15 px-7 py-3 font-display text-lg uppercase tracking-wide text-chalk transition hover:border-lime/60"
        >
          Table
        </Link>
      </div>

      <section className="mt-16 grid gap-4 sm:grid-cols-3">
        <Rule pts="5" label="Exact score" detail="Nail the scoreline (90 mins) — both teams correct." />
        <Rule pts="1" label="Correct result" detail="Right winner or a draw, wrong scoreline." />
        <Rule pts="0" label="Miss" detail="Wrong result. Better luck on matchday two." />
      </section>

      <p className="mt-10 font-mono text-xs uppercase tracking-widest text-chalk/40">
        72 group games · picks lock at kickoff · results auto-update
      </p>
    </main>
  );
}

function Rule({ pts, label, detail }: { pts: string; label: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-pitch-900/60 p-5 shadow-card">
      <div className="font-display text-5xl text-lime">{pts}<span className="ml-1 text-xl text-chalk/50">pts</span></div>
      <div className="mt-2 font-display text-lg uppercase tracking-wide text-chalk">{label}</div>
      <p className="mt-1 text-sm text-chalk/55">{detail}</p>
    </div>
  );
}
