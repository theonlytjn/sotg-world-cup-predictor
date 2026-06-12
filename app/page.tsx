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
          <img
            src="/logo.svg"
            alt="SOTG '26"
            className="h-16 w-auto object-contain mb-6"
          />
          <span className="inline-flex items-center gap-2.5 font-display font-semibold text-base tracking-[0.28em] uppercase text-lime border border-lime/25 rounded-full px-3.5 py-1.5 bg-lime/5">
            <span className="w-1.5 h-1.5 rounded-full bg-flame live-ping" />
            Group stage · live now
          </span>

          <h1
            className="mt-5 font-display uppercase text-chalk"
            style={{ fontSize: 'clamp(44px, 7vw, 88px)', lineHeight: 1.5 }}
          >
            Champions<br />predict.<br />
            <span className="text-lime">Everyone else guesses.</span>
          </h1>

          <p className="mt-5 text-chalk max-w-[30ch]" style={{ fontSize: 'clamp(16px, 1.5vw, 19px)' }}>
            Make your calls. Climb the table. Earn the bragging rights.<br /><br />
            Anyone can talk football. The table decides who actually knows it.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={loggedIn ? '/predict' : '/login'}
              className="inline-flex items-center gap-2 font-display font-bold uppercase tracking-wide text-base rounded-full bg-lime text-pitch-950 px-6 py-3.5 transition hover:brightness-110 hover:-translate-y-0.5"
            >
              Start Predicting
              <span>→</span>
            </Link>
            <Link
              href="/leaderboard"
              className="inline-flex items-center font-display font-bold uppercase tracking-wide text-base rounded-full border border-pitch-700 text-chalk px-6 py-3.5 transition hover:border-lime/60"
            >
              View the Table
            </Link>
          </div>
        </div>

        {/* Right column — WC logo + animated ticket */}
        <div className="flex flex-col items-center gap-5" data-aos="fade-up" data-aos-duration="700" data-aos-delay="150">
          <img
            src="/wc-logo-white.png"
            alt="FIFA World Cup 2026"
            className="mx-auto h-24 w-auto object-contain"
          />
          <div className="w-full max-w-sm">
            <TicketCarousel exactPts={exactPts} resultPts={resultPts} />
          </div>
        </div>
      </header>

      {/* ── FLAG MARQUEE ─────────────────────────────────── */}
      <div
        className="marquee-wrap border-t border-b border-pitch-700 bg-white/1 overflow-hidden py-3.5"
        style={{ maskImage: 'linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)' }}
      >
        <div className="marquee-track flex gap-8 w-max">
          {[...NATIONS, ...NATIONS].map(([flag, tla], i) => (
            <span key={i} className="inline-flex items-center gap-2.5 font-display font-semibold text-base tracking-[0.12em] uppercase text-chalk whitespace-nowrap">
              <span className="text-xl">{flag}</span>
              {tla}
            </span>
          ))}
        </div>
      </div>

      {/* ── HOW IT WORKS ─────────────────────────────────── */}
      <section className="px-6 sm:px-10 lg:px-16 xl:px-24 py-16" data-aos="fade-up">
        <p className="font-display font-bold text-base tracking-[0.3em] uppercase text-lime mb-3.5">How it works</p>
        <h2 className="font-display uppercase text-chalk" style={{ fontSize: 'clamp(30px, 4vw, 46px)' }}>
          Three taps to glory.
        </h2>
        <div className="mt-9 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              n: '1',
              title: 'Call your shot',
              body: 'Back every scoreline before kick-off. Change your mind right up until the whistle.',
              icon: <HugeiconsIcon icon={PencilEdit01Icon} size={42} color="currentColor" strokeWidth={1.4} />,
              delay: '0',
            },
            {
              n: '2',
              title: 'Whistle means locked',
              body: 'Kick-off arrives. Predictions freeze. No edits. No second chances.',
              icon: <HugeiconsIcon icon={LockIcon} size={42} color="currentColor" strokeWidth={1.4} />,
              delay: '100',
            },
            {
              n: '3',
              title: 'Rise through the ranks',
              body: 'Points land automatically. Watch your mates disappear below you.',
              icon: <HugeiconsIcon icon={BarChartIcon} size={42} color="currentColor" strokeWidth={1.4} />,
              delay: '200',
            },
          ].map(({ n, title, body, icon, delay }) => (
            <div key={n} data-aos="fade-up" data-aos-delay={delay} className="bg-pitch-900 border border-pitch-700 rounded-[22px] p-7 sm:p-8">
              <div className="flex justify-between items-start mb-6">
                <div className="w-20 h-20 rounded-[20px] bg-lime/12 flex items-center justify-center text-lime">
                  {icon}
                </div>
                <span className="font-display font-black text-[52px] leading-none text-chalk">{n}</span>
              </div>
              <h3 className="font-display text-xl uppercase text-chalk mb-2.5">{title}</h3>
              <p className="text-chalk text-[15px] leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── SCORING ──────────────────────────────────────── */}
      <section className="px-6 sm:px-10 lg:px-16 xl:px-24 py-16" data-aos="fade-up">
        <p className="font-display font-bold text-base tracking-[0.3em] uppercase text-lime mb-3.5">The points</p>
        <h2 className="font-display uppercase text-chalk" style={{ fontSize: 'clamp(30px, 4vw, 46px)' }}>
          Simple. Brutal. Fair.
        </h2>
        <div className="mt-9 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div data-aos="fade-up" data-aos-delay="0" className="rounded-[22px] p-8 sm:p-10 border border-lime/30 bg-gradient-to-br from-lime/14 to-pitch-900">
            <div className="font-display font-black text-lime" style={{ fontSize: 64, lineHeight: 1 }}>
              {exactPts}<span className="text-[18px] text-chalk font-semibold ml-1"> pts</span>
            </div>
            <h3 className="font-display text-xl uppercase text-chalk mt-3.5 mb-1.5">
              {rulesMap['match_exact']?.label ?? 'Exact score'}
            </h3>
            <p className="text-chalk text-base">
              Hat-trick territory. Call it exactly — both goals, both sides. Take all three points.
            </p>
          </div>
          <div data-aos="fade-up" data-aos-delay="100" className="rounded-[22px] p-8 sm:p-10 border border-pitch-700 bg-pitch-900">
            <div className="font-display font-black text-lime" style={{ fontSize: 64, lineHeight: 1 }}>
              {resultPts}<span className="text-[18px] text-chalk font-semibold ml-1"> {resultPts === 1 ? 'pt' : 'pts'}</span>
            </div>
            <h3 className="font-display text-xl uppercase text-chalk mt-3.5 mb-1.5">
              {rulesMap['match_result']?.label ?? 'Correct result'}
            </h3>
            <p className="text-chalk text-base">
              You saw it coming. Right result, wrong score. It still counts.
            </p>
          </div>
          <div data-aos="fade-up" data-aos-delay="200" className="rounded-[22px] p-8 sm:p-10 border border-pitch-700 bg-pitch-900">
            <div className="font-display font-black text-flame" style={{ fontSize: 64, lineHeight: 1 }}>
              0<span className="text-[18px] text-chalk font-semibold ml-1"> pts</span>
            </div>
            <h3 className="font-display text-xl uppercase text-chalk mt-3.5 mb-1.5">Sent to the stands</h3>
            <p className="text-chalk text-base">Wrong result. No points. There&apos;s always the next fixture.</p>
          </div>
        </div>
        <p className="mt-6 text-base text-chalk">
          Point values are set by the admin and may change. See the{' '}
          <Link href="/rules" className="text-lime hover:text-lime transition">full rules page</Link>{' '}
          for all categories.
        </p>
      </section>

      {/* ── BANKER PICK ──────────────────────────────────── */}
      <section className="px-6 sm:px-10 lg:px-16 xl:px-24 py-16" data-aos="fade-up">
        <div className="rounded-[26px] border border-gold/30 bg-gradient-to-br from-gold/8 to-pitch-900 p-8 sm:p-10 lg:p-12">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-8 items-center">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">⭐</span>
                <p className="font-display font-bold text-base tracking-[0.3em] uppercase text-gold">The Banker Pick</p>
              </div>
              <h2 className="font-display uppercase text-chalk" style={{ fontSize: 'clamp(26px, 3.5vw, 40px)' }}>
                One match. Double the points.
              </h2>
              <p className="mt-4 text-chalk max-w-[52ch]" style={{ fontSize: 'clamp(15px, 1.4vw, 17px)' }}>
                Once per matchday you can star one of your predictions as your <span className="text-gold font-semibold">Banker</span>.
                If it lands, your points for that game double — exact score becomes <span className="text-lime font-semibold">{exactPts * 2} pts</span>, correct result becomes <span className="text-lime font-semibold">{resultPts * 2} pts</span>.
                Miss? The banker burns with it. Zero points, no backup.
              </p>
              <p className="mt-3 text-chalk" style={{ fontSize: 'clamp(14px, 1.2vw, 16px)' }}>
                You can switch your banker right up until the whistle — but you only get one per matchday, so pick your most confident call.
              </p>
            </div>
            <div className="flex flex-col gap-3 lg:min-w-[200px]">
              <div className="rounded-2xl border border-gold/25 bg-pitch-900/70 p-5 text-center">
                <p className="font-mono text-xs uppercase tracking-widest text-gold mb-1">Exact + Banker</p>
                <p className="font-display font-black text-lime" style={{ fontSize: 48, lineHeight: 1 }}>
                  {exactPts * 2}
                  <span className="text-lg text-chalk ml-1"> pts</span>
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-pitch-900/70 p-5 text-center">
                <p className="font-mono text-xs uppercase tracking-widest text-chalk mb-1">Result + Banker</p>
                <p className="font-display font-black text-lime" style={{ fontSize: 48, lineHeight: 1 }}>
                  {resultPts * 2}
                  <span className="text-lg text-chalk ml-1"> pts</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── LEAGUES ──────────────────────────────────────── */}
      <section className="px-6 sm:px-10 lg:px-16 xl:px-24 py-16" data-aos="fade-up">
        <p className="font-display font-bold text-base tracking-[0.3em] uppercase text-lime mb-3.5">Private leagues</p>
        <h2 className="font-display uppercase text-chalk" style={{ fontSize: 'clamp(30px, 4vw, 46px)' }}>
          Take the bragging rights private.
        </h2>
        <p className="mt-4 text-chalk max-w-[52ch]" style={{ fontSize: 'clamp(16px, 1.5vw, 19px)' }}>
          The global table is one battle. Your league is personal. Create one, drop the code in the group chat, and run your own title race from matchday one to the final whistle.
        </p>

        <div className="mt-9 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              icon: '⚽',
              title: 'Create your league',
              body: 'Name it. Own it. Your league, your rules. Set it up in seconds and you\'re top of the table before a ball is kicked.',
            },
            {
              icon: '🔗',
              title: 'Share the code',
              body: 'One invite code. Drop it in the group chat. Your mates join instantly — no sign-up drama, no faff.',
            },
            {
              icon: '🏆',
              title: 'Settle the debate',
              body: 'Your own private table tracks every matchday. No hiding. The final standings decide who actually knows their football.',
            },
          ].map(({ icon, title, body }, i) => (
            <div
              key={title}
              data-aos="fade-up"
              data-aos-delay={String(i * 100)}
              className="bg-pitch-900 border border-pitch-700 rounded-[22px] p-7 sm:p-8"
            >
              <div className="w-16 h-16 rounded-[18px] bg-lime/12 flex items-center justify-center text-3xl mb-6">
                {icon}
              </div>
              <h3 className="font-display text-xl uppercase text-chalk mb-2.5">{title}</h3>
              <p className="text-chalk text-[15px] leading-relaxed">{body}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={loggedIn ? '/leagues' : '/login'}
            className="inline-flex items-center gap-2 font-display font-bold uppercase tracking-wide text-base rounded-full bg-lime text-pitch-950 px-6 py-3.5 transition hover:brightness-110 hover:-translate-y-0.5"
          >
            Create a League →
          </Link>
          <Link
            href={loggedIn ? '/leagues' : '/login'}
            className="inline-flex items-center font-display font-bold uppercase tracking-wide text-base rounded-full border border-pitch-700 text-chalk px-6 py-3.5 transition hover:border-lime/60"
          >
            Join with a Code
          </Link>
        </div>
      </section>

      {/* ── LEADERBOARD TEASER ───────────────────────────── */}
      <section className="px-6 sm:px-10 lg:px-16 xl:px-24 py-16" data-aos="fade-up">
        <p className="font-display font-bold text-base tracking-[0.3em] uppercase text-lime mb-3.5">The race</p>
        <h2 className="font-display uppercase text-chalk" style={{ fontSize: 'clamp(30px, 4vw, 46px)' }}>
          The table doesn&apos;t lie.
        </h2>
        <div className="mt-9">
          {/* Full-width table — top 3 with fade below */}
          <div className="relative overflow-hidden rounded-[26px] border border-pitch-700 bg-pitch-900">
            {/* Column header row */}
            <div className="grid grid-cols-[48px_1fr_auto] items-center gap-3 px-7 py-2.5 bg-pitch-800/80 border-b border-pitch-700">
              <span className="font-mono text-[9px] uppercase tracking-widest text-chalk">#</span>
              <span className="font-mono text-[9px] uppercase tracking-widest text-chalk">Player</span>
              <span className="font-mono text-[9px] uppercase tracking-widest text-chalk">Pts</span>
            </div>
            {leaders && leaders.length > 0 ? (
              leaders.slice(0, 3).map((p, i) => (
                <div
                  key={p.user_id}
                  className={`grid grid-cols-[48px_1fr_auto] items-center gap-3 px-7 py-5 ${i > 0 ? 'border-t border-pitch-700' : ''}`}
                >
                  <span className={`font-display font-black text-[22px] leading-none ${RANK_COLOURS[i] ?? 'text-chalk'}`}>{i + 1}</span>
                  <span className="font-display font-bold text-[17px] uppercase tracking-wide text-chalk">{p.display_name}</span>
                  <span className="font-display font-black text-2xl text-chalk">{p.total_points}</span>
                </div>
              ))
            ) : (
              <div className="px-7 py-8">
                <p className="text-chalk text-base">No predictions yet — be the first!</p>
              </div>
            )}
            {/* Fade overlay hinting at more rows below */}
            <div
              className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none fade-to-bg"
            />
          </div>

          {/* Claim-it CTA */}
          <div className="mt-4 flex items-center justify-between rounded-2xl border border-dashed border-lime/40 px-6 py-4">
            <span className="text-base text-chalk">
              {loggedIn ? 'Every fixture moves you up or down.' : "You're either chasing first place or defending it."}
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
          <img
            src="/wc-logo-black.png"
            alt="FIFA World Cup 2026"
            className="relative mx-auto h-20 w-auto object-contain mb-4 opacity-70"
          />
          <h2
            className="relative font-display uppercase text-pitch-950"
            style={{ fontSize: 'clamp(32px, 5vw, 60px)' }}
          >
            Kick-off is coming.<br />Get your picks in.
          </h2>
          <p className="relative mt-3.5 mb-7 mx-auto max-w-[42ch] font-semibold text-pitch-950/65">
            One scoreline could be the difference between lifting the trophy and finishing mid-table.
          </p>
          <Link
            href={loggedIn ? '/predict' : '/login'}
            className="relative inline-flex items-center gap-2 font-display uppercase text-base rounded-full bg-pitch-950 text-lime px-7 py-3.5 transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            Start Predicting →
          </Link>
        </div>
      </div>

      {/* ── FOOTER ───────────────────────────────────────── */}
      <footer className="text-center pb-14 pt-6 border-t border-pitch-700">
        <p className="text-chalk font-display font-semibold text-base tracking-[0.18em] uppercase">
          All rights reserved Students of the Game
        </p>
        <p className="mt-1.5 text-chalk font-display text-base tracking-[0.15em] uppercase">
          Crafted by{' '}
          <a
            href="https://www.theonlytjn.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-lime hover:text-lime transition-colors"
          >
            TJN
          </a>
        </p>
      </footer>
    </div>
  );
}
