import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import TicketCarousel from '@/components/TicketCarousel';
import { HugeiconsIcon } from '@hugeicons/react';
import { PencilEdit01Icon, LockIcon, BarChartIcon } from '@hugeicons-pro/core-stroke-rounded';

const NATIONS = [
  ['🇧🇷','BRA'],['🇦🇷','ARG'],['🇫🇷','FRA'],['🇪🇸','ESP'],['🇩🇪','GER'],['🇵🇹','POR'],
  ['🇲🇽','MEX'],['🇺🇸','USA'],['🇨🇦','CAN'],['🇳🇱','NED'],['🇧🇪','BEL'],['🇭🇷','CRO'],
  ['🇯🇵','JPN'],['🇰🇷','KOR'],['🇳🇬','NGA'],['🇲🇦','MAR'],['🇺🇾','URU'],['🇨🇴','COL'],
  ['🇸🇳','SEN'],['🇨🇭','SUI'],['🇩🇰','DEN'],['🇷🇸','SRB'],
];

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const loggedIn = !!user;

  const [{ data: leaders }, { data: scoringRules }] = await Promise.all([
    supabase
      .from('leaderboard')
      .select('user_id, display_name, total_points')
      .order('total_points', { ascending: false })
      .limit(3),
    supabase
      .from('scoring_rules')
      .select('key, label, description, points')
      .order('points', { ascending: false }),
  ]);

  const rulesMap = Object.fromEntries((scoringRules ?? []).map((r) => [r.key, r]));
  const exactPts  = rulesMap['match_exact']?.points  ?? 5;
  const resultPts = rulesMap['match_result']?.points ?? 1;

  const RANK_COLOURS = ['text-gold', 'text-[#cfd6da]', 'text-[#e0a86b]'];

  return (
    <div className="max-w-[1920px] mx-auto overflow-x-hidden">

      {/* ── HERO ─────────────────────────────────────────── */}
      <header className="px-6 sm:px-10 lg:px-16 xl:px-24 pt-16 pb-12 grid grid-cols-1 md:grid-cols-[1.05fr_0.95fr] gap-12 items-center">
        <div data-aos="fade-up" data-aos-duration="700">
          <span className="inline-flex items-center gap-2.5 font-display font-semibold text-xs tracking-[0.28em] uppercase text-lime border border-lime/25 rounded-full px-3.5 py-1.5 bg-lime/5">
            <span className="w-1.5 h-1.5 rounded-full bg-flame live-ping" />
            Group stage · live now
          </span>

          <h1
            className="mt-5 font-display uppercase text-chalk"
            style={{ fontSize: 'clamp(44px, 7vw, 88px)', lineHeight: 1.5 }}
          >
            Predict<br />every game.<br />
            <span className="text-lime">Own the table.</span>
          </h1>

          <p className="mt-5 text-chalk/62 max-w-[30ch]" style={{ fontSize: 'clamp(16px, 1.5vw, 19px)' }}>
            Call the score on all 72 group games, bank the points, and settle who
            actually knows their football. The SOTG table doesn&apos;t lie.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={loggedIn ? '/predict' : '/login'}
              className="inline-flex items-center gap-2 font-display font-bold uppercase tracking-wide text-base rounded-full bg-lime text-pitch-950 px-6 py-3.5 transition hover:brightness-110 hover:-translate-y-0.5"
            >
              Make your picks
              <span>→</span>
            </Link>
            <Link
              href="/leaderboard"
              className="inline-flex items-center font-display font-bold uppercase tracking-wide text-base rounded-full border border-[#272727] text-chalk px-6 py-3.5 transition hover:border-lime/60"
            >
              See the table
            </Link>
          </div>
        </div>

        {/* Right column — WC logo + animated ticket */}
        <div className="flex flex-col items-center gap-6" data-aos="fade-up" data-aos-duration="700" data-aos-delay="150">
          <div className="text-center">
            <img
              src="/logo.svg"
              alt="SOTG '26"
              className="mx-auto h-20 w-auto object-contain"
            />
            <p className="mt-2 font-display text-[11px] uppercase tracking-[0.3em] text-chalk/50">
              FIFA World Cup 2026
            </p>
          </div>
          <div className="w-full max-w-sm">
            <TicketCarousel />
          </div>
        </div>
      </header>

      {/* ── FLAG MARQUEE ─────────────────────────────────── */}
      <div
        className="marquee-wrap border-t border-b border-[#272727] bg-white/1 overflow-hidden py-3.5"
        style={{ maskImage: 'linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)' }}
      >
        <div className="marquee-track flex gap-8 w-max">
          {[...NATIONS, ...NATIONS].map(([flag, tla], i) => (
            <span key={i} className="inline-flex items-center gap-2.5 font-display font-semibold text-sm tracking-[0.12em] uppercase text-chalk/60 whitespace-nowrap">
              <span className="text-xl">{flag}</span>
              {tla}
            </span>
          ))}
        </div>
      </div>

      {/* ── HOW IT WORKS ─────────────────────────────────── */}
      <section className="px-6 sm:px-10 lg:px-16 xl:px-24 py-16" data-aos="fade-up">
        <p className="font-display font-bold text-xs tracking-[0.3em] uppercase text-lime mb-3.5">How it works</p>
        <h2 className="font-display uppercase text-chalk" style={{ fontSize: 'clamp(30px, 4vw, 46px)' }}>
          Three taps to glory
        </h2>
        <div className="mt-9 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              n: '1',
              title: 'Predict the score',
              body: 'Pick the exact scoreline for every group fixture. Change your mind right up until kickoff.',
              icon: <HugeiconsIcon icon={PencilEdit01Icon} size={24} color="currentColor" strokeWidth={1.5} />,
              delay: '0',
            },
            {
              n: '2',
              title: 'Locks at kickoff',
              body: 'The whistle blows, picks freeze. No sneaky edits, no excuses. Fair game for everyone.',
              icon: <HugeiconsIcon icon={LockIcon} size={24} color="currentColor" strokeWidth={1.5} />,
              delay: '100',
            },
            {
              n: '3',
              title: 'Climb the table',
              body: 'Results update automatically. Watch the points land and your name rise — or fall.',
              icon: <HugeiconsIcon icon={BarChartIcon} size={24} color="currentColor" strokeWidth={1.5} />,
              delay: '200',
            },
          ].map(({ n, title, body, icon, delay }) => (
            <div key={n} data-aos="fade-up" data-aos-delay={delay} className="bg-pitch-900 border border-[#272727] rounded-[22px] p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 rounded-[14px] bg-lime/12 flex items-center justify-center text-lime">
                  {icon}
                </div>
                <span className="font-display font-black text-[46px] leading-none text-chalk/12">{n}</span>
              </div>
              <h3 className="font-display text-xl uppercase text-chalk mb-2">{title}</h3>
              <p className="text-chalk/60 text-[15px]">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── SCORING ──────────────────────────────────────── */}
      <section className="px-6 sm:px-10 lg:px-16 xl:px-24 py-16" data-aos="fade-up">
        <p className="font-display font-bold text-xs tracking-[0.3em] uppercase text-lime mb-3.5">The points</p>
        <h2 className="font-display uppercase text-chalk" style={{ fontSize: 'clamp(30px, 4vw, 46px)' }}>
          Simple, brutal scoring
        </h2>
        <div className="mt-9 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div data-aos="fade-up" data-aos-delay="0" className="rounded-[22px] p-7 border border-lime/30 bg-gradient-to-br from-lime/14 to-pitch-900">
            <div className="font-display font-black text-lime" style={{ fontSize: 64, lineHeight: 1 }}>
              {exactPts}<span className="text-[18px] text-chalk/60 font-semibold ml-1"> pts</span>
            </div>
            <h3 className="font-display text-xl uppercase text-chalk mt-3.5 mb-1.5">
              {rulesMap['match_exact']?.label ?? 'Exact score'}
            </h3>
            <p className="text-chalk/60 text-sm">
              {rulesMap['match_exact']?.description ?? 'Nail the scoreline in 90 minutes — both teams correct.'}
            </p>
          </div>
          <div data-aos="fade-up" data-aos-delay="100" className="rounded-[22px] p-7 border border-[#272727] bg-pitch-900">
            <div className="font-display font-black text-lime" style={{ fontSize: 64, lineHeight: 1 }}>
              {resultPts}<span className="text-[18px] text-chalk/60 font-semibold ml-1"> {resultPts === 1 ? 'pt' : 'pts'}</span>
            </div>
            <h3 className="font-display text-xl uppercase text-chalk mt-3.5 mb-1.5">
              {rulesMap['match_result']?.label ?? 'Correct result'}
            </h3>
            <p className="text-chalk/60 text-sm">
              {rulesMap['match_result']?.description ?? "Right winner or a draw, but the scoreline's off."}
            </p>
          </div>
          <div data-aos="fade-up" data-aos-delay="200" className="rounded-[22px] p-7 border border-[#272727] bg-pitch-900">
            <div className="font-display font-black text-flame" style={{ fontSize: 64, lineHeight: 1 }}>
              0<span className="text-[18px] text-chalk/60 font-semibold ml-1"> pts</span>
            </div>
            <h3 className="font-display text-xl uppercase text-chalk mt-3.5 mb-1.5">Miss</h3>
            <p className="text-chalk/60 text-sm">Wrong result. There&apos;s always the next matchday.</p>
          </div>
        </div>
        <p className="mt-6 text-sm text-chalk/40">
          Point values are set by the admin and may change. See the{' '}
          <Link href="/rules" className="text-lime/70 hover:text-lime transition">full rules page</Link>{' '}
          for all categories.
        </p>
      </section>

      {/* ── LEADERBOARD TEASER ───────────────────────────── */}
      <section className="px-6 sm:px-10 lg:px-16 xl:px-24 py-16" data-aos="fade-up">
        <p className="font-display font-bold text-xs tracking-[0.3em] uppercase text-lime mb-3.5">The race</p>
        <h2 className="font-display uppercase text-chalk" style={{ fontSize: 'clamp(30px, 4vw, 46px)' }}>
          Where will you land?
        </h2>
        <div className="mt-9">
          {/* Full-width table — top 3 with fade below */}
          <div className="relative overflow-hidden rounded-[26px] border border-[#272727] bg-pitch-900">
            {/* Column header row */}
            <div className="grid grid-cols-[48px_1fr_auto] items-center gap-3 px-7 py-2.5 bg-pitch-800/80 border-b border-[#272727]">
              <span className="font-mono text-[9px] uppercase tracking-widest text-chalk/40">#</span>
              <span className="font-mono text-[9px] uppercase tracking-widest text-chalk/40">Player</span>
              <span className="font-mono text-[9px] uppercase tracking-widest text-chalk/40">Pts</span>
            </div>
            {leaders && leaders.length > 0 ? (
              leaders.slice(0, 3).map((p, i) => (
                <div
                  key={p.user_id}
                  className={`grid grid-cols-[48px_1fr_auto] items-center gap-3 px-7 py-5 ${i > 0 ? 'border-t border-[#272727]' : ''}`}
                >
                  <span className={`font-display font-black text-[22px] leading-none ${RANK_COLOURS[i] ?? 'text-chalk/55'}`}>{i + 1}</span>
                  <span className="font-display font-bold text-[17px] uppercase tracking-wide text-chalk">{p.display_name}</span>
                  <span className="font-display font-black text-2xl text-chalk">{p.total_points}</span>
                </div>
              ))
            ) : (
              <div className="px-7 py-8">
                <p className="text-chalk/55 text-sm">No predictions yet — be the first!</p>
              </div>
            )}
            {/* Fade overlay hinting at more rows below */}
            <div
              className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
              style={{ background: 'linear-gradient(to bottom, transparent, #0b110d)' }}
            />
          </div>

          {/* Claim-it CTA */}
          <div className="mt-4 flex items-center justify-between rounded-2xl border border-dashed border-lime/40 px-6 py-4">
            <span className="text-sm text-chalk/65">
              {loggedIn ? 'Your picks are being scored…' : 'Your name should be up there.'}
            </span>
            <Link
              href={loggedIn ? '/leaderboard' : '/login'}
              className="font-display font-black text-lime hover:brightness-110 transition"
            >
              {loggedIn ? 'Full table →' : 'Claim your spot →'}
            </Link>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ────────────────────────────────────── */}
      <div className="px-6 sm:px-10 lg:px-16 xl:px-24 mb-16" data-aos="fade-up">
        <div
          className="rounded-[32px] overflow-hidden relative text-center py-16 px-7"
          style={{
            background: 'radial-gradient(ellipse 80% 120% at 50% 110%, #c9991a 0%, #ffd24a 50%, #ffe37a 100%)',
          }}
        >
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-10 -right-10 w-52 h-52 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -bottom-10 -left-10 w-52 h-52 rounded-full bg-pitch-950/20 blur-3xl" />
          </div>
          <h2
            className="relative font-display uppercase text-pitch-950"
            style={{ fontSize: 'clamp(32px, 5vw, 60px)' }}
          >
            The whistle&apos;s gone.<br />Get your picks in.
          </h2>
          <p className="relative mt-3.5 mb-7 mx-auto max-w-[42ch] font-semibold text-pitch-950/65">
            Group stage is live. Sign in, set your nickname, and make your first call before the next kickoff.
          </p>
          <Link
            href={loggedIn ? '/predict' : '/login'}
            className="relative inline-flex items-center gap-2 font-display uppercase text-base rounded-full bg-pitch-950 text-lime px-7 py-3.5 transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            Start predicting →
          </Link>
        </div>
      </div>

      {/* ── FOOTER ───────────────────────────────────────── */}
      <footer className="text-center pb-14 pt-6 border-t border-[#272727]">
        <p className="text-chalk/40 font-display font-semibold text-xs tracking-[0.18em] uppercase">
          All rights reserved Students of the Game
        </p>
        <p className="mt-1.5 text-chalk/30 font-display text-xs tracking-[0.15em] uppercase">
          Crafted by{' '}
          <a
            href="https://www.theonlytjn.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-lime/65 hover:text-lime transition-colors"
          >
            TJN
          </a>
        </p>
      </footer>
    </div>
  );
}
