import { createClient } from '@/lib/supabase/server';

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
      <h1 className="font-display text-4xl uppercase text-chalk">Fixtures</h1>
      <p className="mt-1 text-sm text-chalk/55">Group stage · scores update automatically.</p>

      {ordered.length === 0 && (
        <p className="mt-8 font-mono text-sm text-chalk/40">No fixtures imported yet — run the seed script.</p>
      )}

      {ordered.map(([md, list]) => (
        <section key={md} className="mt-8">
          <div className="mb-3 flex items-center gap-3">
            <h2 className="font-display text-2xl uppercase text-lime">Matchday {md}</h2>
            <span className="h-px flex-1 bg-white/10" />
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
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-pitch-900/50 px-4 py-3">
      <span className="w-10 shrink-0 font-mono text-[11px] uppercase tracking-widest text-chalk/35">
        {f.group_label ?? '—'}
      </span>
      <Side t={f.home_team} />
      <div className="w-16 shrink-0 text-center">
        {finished || live ? (
          <span className="font-mono text-lg text-chalk">
            {f.home_score ?? 0}–{f.away_score ?? 0}
          </span>
        ) : (
          <span className="font-mono text-[11px] text-chalk/40">{ko}</span>
        )}
      </div>
      <Side t={f.away_team} reverse />
      <span className="w-12 shrink-0 text-right font-mono text-[10px] uppercase tracking-widest">
        {live ? <span className="text-flame">live</span> : finished ? <span className="text-chalk/35">FT</span> : ''}
      </span>
    </div>
  );
}

function Side({ t, reverse }: { t: Team | null; reverse?: boolean }) {
  return (
    <div className={`flex flex-1 items-center gap-2 ${reverse ? 'flex-row-reverse text-right' : ''}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {t?.crest ? (
        <img src={t.crest} alt="" className="h-5 w-5 shrink-0 object-contain" />
      ) : (
        <span className="h-5 w-5 shrink-0 rounded-full bg-pitch-700" />
      )}
      <span className="truncate font-display text-sm uppercase tracking-wide text-chalk">
        {t?.name ?? 'TBD'}
      </span>
    </div>
  );
}
