import Link from 'next/link';

// The SOTG hub. Add a new game by adding an entry here (and its app under its own path).
type Game = {
  href: string;
  title: string;
  season: string;
  blurb: string;
  status: 'live' | 'finished' | 'soon';
};

const GAMES: Game[] = [
  {
    href: '/pl',
    title: 'Premier League Predictor',
    season: '2026/27',
    blurb: 'Champions, top seven, the drop, the cups, the awards and your Team of the Season. Locked in after ten games.',
    status: 'live',
  },
  {
    href: '/wc',
    title: 'World Cup Predictor',
    season: '2026',
    blurb: 'Every scoreline, every banker, every award. The final table and everyone’s receipts live here.',
    status: 'finished',
  },
  {
    href: '/ucl',
    title: 'Champions League Predictor',
    season: '2026/27',
    blurb: 'Winners, finalists, top scorer and the rest. Coming once the knockout picture takes shape.',
    status: 'soon',
  },
];

const STATUS: Record<Game['status'], { label: string; cls: string }> = {
  live: { label: 'Open now', cls: 'text-lime border-lime/30 bg-lime/10' },
  finished: { label: 'Finished', cls: 'text-chalk/70 border-white/15 bg-white/5' },
  soon: { label: 'Coming soon', cls: 'text-chalk/50 border-white/10 bg-transparent' },
};

export default function Hub() {
  return (
    <main className="mx-auto max-w-[1100px] px-5 pb-24 pt-28">
      <img src="/logo.svg" alt="SOTG — Students of the Game" className="mb-8 h-14 w-auto object-contain" />

      <span className="inline-flex items-center gap-2.5 rounded-full border border-lime/25 bg-lime/5 px-3.5 py-1.5 font-display text-sm uppercase tracking-[0.28em] text-lime">
        <span className="h-1.5 w-1.5 rounded-full bg-flame live-ping" />
        Pick your game
      </span>

      <h1 className="mt-5 font-display uppercase text-chalk" style={{ fontSize: 'clamp(36px, 6vw, 72px)', lineHeight: 1.5 }}>
        Talk is cheap.<br />
        <span className="text-lime">Get it on record.</span>
      </h1>
      <p className="mt-3 max-w-[40ch] text-chalk/80">
        Every SOTG prediction game in one place. Make your calls, lock them in, and let the receipts do the talking.
      </p>

      <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
        {GAMES.map((g) => {
          const s = STATUS[g.status];
          const inner = (
            <>
              <div className="flex items-center justify-between gap-3">
                <span className={`rounded-full border px-3 py-1 font-display text-xs uppercase tracking-[0.2em] ${s.cls}`}>{s.label}</span>
                <span className="font-display text-xs uppercase tracking-[0.2em] text-chalk/50">{g.season}</span>
              </div>
              <h2 className="mt-5 font-display text-xl uppercase text-chalk" style={{ lineHeight: 1.6 }}>{g.title}</h2>
              <p className="mt-2 text-base text-chalk/70">{g.blurb}</p>
              {g.status !== 'soon' && (
                <span className="mt-6 inline-flex items-center gap-2 font-display text-sm uppercase tracking-wide text-lime">
                  {g.status === 'live' ? 'Make your picks' : 'See the receipts'} <span>→</span>
                </span>
              )}
            </>
          );
          const base = 'flex flex-col rounded-2xl border bg-pitch-900/60 p-6 shadow-card transition';
          return g.status === 'soon' ? (
            <div key={g.href} className={`${base} border-white/10 opacity-60`} aria-disabled="true">{inner}</div>
          ) : (
            <Link key={g.href} href={g.href} className={`${base} border-white/10 hover:-translate-y-0.5 hover:border-lime/50`}>
              {inner}
            </Link>
          );
        })}
      </div>
    </main>
  );
}
