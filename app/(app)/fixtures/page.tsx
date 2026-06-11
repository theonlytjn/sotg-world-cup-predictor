import { createClient } from '@/lib/supabase/server';
import { HugeiconsIcon } from '@hugeicons/react';
import { Calendar1Icon } from '@hugeicons-pro/core-stroke-rounded';

type Team = { name: string; tla: string | null; crest: string | null };
type Fixture = {
  id: number;
  matchday: number | null;
  group_label: string | null;
  kickoff: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
  home_team: Team | null;
  away_team: Team | null;
};

export const dynamic = 'force-dynamic';

export default async function FixturesPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('fixtures')
    .select(
      `id, matchday, group_label, kickoff, status, home_score, away_score,
       home_team:teams!fixtures_home_team_id_fkey (name, tla, crest),
       away_team:teams!fixtures_away_team_id_fkey (name, tla, crest)`
    )
    .eq('stage', 'GROUP_STAGE')
    .order('kickoff', { ascending: true });

  const fixtures = (data as unknown as Fixture[]) ?? [];
  const groups = new Map<number, Fixture[]>();
  for (const f of fixtures) {
    const md = f.matchday ?? 0;
    if (!groups.has(md)) groups.set(md, []);
    groups.get(md)!.push(f);
  }
  const ordered = [...groups.entries()].sort((a, b) => a[0] - b[0]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <span className="text-lime"><HugeiconsIcon icon={Calendar1Icon} size={18} color="currentColor" strokeWidth={1.5} /></span>
        <p className="font-display font-bold text-xs tracking-[0.28em] uppercase text-lime">Group stage</p>
      </div>
      <h1 className="font-display text-4xl uppercase text-chalk">Fixtures</h1>
      <p className="mt-1 text-sm text-chalk/55">Scores update automatically as results come in.</p>

      {ordered.length === 0 && (
        <p className="mt-8 font-mono text-sm text-chalk/40">No fixtures imported yet — run the seed script.</p>
      )}

      {ordered.map(([md, list]) => (
        <section key={md} className="mt-10">
          <div className="mb-3 flex items-center gap-3">
            <h2 className="font-display text-xl font-bold uppercase text-lime">Matchday {md}</h2>
            <span className="h-px flex-1 bg-white/8" />
          </div>
          <div className="space-y-2">
            {list.map((f) => (
              <Row key={f.id} f={f} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function Row({ f }: { f: Fixture }) {
  const finished = f.status === 'FINISHED';
  const live = f.status === 'IN_PLAY' || f.status === 'PAUSED';
  const ko = new Date(f.kickoff).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 transition-colors ${
      live ? 'border-lime/25 bg-pitch-900/80' : finished ? 'border-white/6 bg-pitch-900/40' : 'border-white/10 bg-pitch-900/60'
    }`}>
      <span className="w-8 shrink-0 font-display text-[11px] font-semibold uppercase tracking-widest text-chalk/35">
        {f.group_label ?? '—'}
      </span>

      <Side t={f.home_team} />

      <div className="w-20 shrink-0 text-center">
        {finished || live ? (
          <span className="font-display text-lg font-black text-chalk">
            {f.home_score ?? 0}–{f.away_score ?? 0}
          </span>
        ) : (
          <span className="font-mono text-[11px] text-chalk/40">{ko}</span>
        )}
      </div>

      <Side t={f.away_team} reverse />

      <span className="w-10 shrink-0 text-right font-display text-[10px] font-bold uppercase tracking-widest">
        {live ? (
          <span className="flex items-center justify-end gap-1 text-flame">
            <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-flame" />
            Live
          </span>
        ) : finished ? (
          <span className="text-chalk/30">FT</span>
        ) : ''}
      </span>
    </div>
  );
}

function Side({ t, reverse }: { t: Team | null; reverse?: boolean }) {
  return (
    <div className={`flex flex-1 items-center gap-2 ${reverse ? 'flex-row-reverse text-right' : ''}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {t?.crest ? (
        <img src={t.crest} alt="" className="h-6 w-6 shrink-0 object-contain" />
      ) : (
        <span className="h-6 w-6 shrink-0 rounded-full bg-pitch-700" />
      )}
      <span className="truncate font-display text-sm font-bold uppercase tracking-wide text-chalk">
        {t?.tla ?? t?.name ?? 'TBD'}
      </span>
    </div>
  );
}
