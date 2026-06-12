import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Standing = {
  group_label: string;
  team_id: number;
  position: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_diff: number;
  points: number;
  teams: { name: string; tla: string | null; crest: string | null } | null;
};

type Scorer = {
  player_external_id: number;
  player_name: string;
  team_tla: string | null;
  team_name: string | null;
  team_crest: string | null;
  goals: number;
  assists: number;
  penalties: number;
};

function gdColor(goal_diff: number) {
  if (goal_diff > 0) return 'text-lime';
  if (goal_diff < 0) return 'text-flame/80';
  return 'text-chalk/55';
}

export default async function TournamentPage() {
  const supabase = await createClient();

  const [{ data: standings }, { data: scorersRaw }] = await Promise.all([
    supabase
      .from('group_standings')
      .select('*, teams(name, tla, crest)')
      .order('group_label', { ascending: true })
      .order('position', { ascending: true }),
    supabase
      .from('competition_scorers')
      .select('player_external_id, player_name, team_tla, team_name, team_crest, goals, assists, penalties')
      .order('goals', { ascending: false })
      .order('assists', { ascending: false }),
  ]);

  const scorers = (scorersRaw as Scorer[] | null) ?? [];
  const topScorers  = scorers.filter((s) => s.goals > 0).slice(0, 10);
  const topAssisters = scorers.filter((s) => s.assists > 0)
    .sort((a, b) => b.assists - a.assists)
    .slice(0, 10);

  // Group standings by group label
  const groups = new Map<string, Standing[]>();
  for (const s of (standings as Standing[]) ?? []) {
    if (!groups.has(s.group_label)) groups.set(s.group_label, []);
    groups.get(s.group_label)!.push(s);
  }
  const groupKeys = [...groups.keys()].sort((a, b) => a.localeCompare(b));
  const hasStandings = groupKeys.length > 0;

  return (
    <div>
      {/* Hero */}
      <h1 className="font-display text-4xl uppercase text-chalk">
        World Cup <span className="text-lime">&apos;26</span>
      </h1>
      <p className="mt-1 text-base text-chalk/55">
        Live group standings, top scorers, and assists — updated every 5 minutes.
      </p>

      {/* ── Group Standings ─────────────────────────────────────────── */}
      <section className="mt-8">
        <div className="mb-4 flex items-center gap-3">
          <h2 className="font-display text-2xl uppercase text-lime">Group Standings</h2>
          <span className="h-px flex-1 bg-white/10" />
        </div>

        {!hasStandings ? (
          <div className="flex h-44 items-center justify-center rounded-2xl border border-white/10 bg-pitch-900/60">
            <p className="font-mono text-base text-chalk/40">
              Standings appear once the tournament begins.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {groupKeys.map((label) => {
              const rows = groups.get(label)!;
              return (
                <div key={label} className="overflow-hidden rounded-2xl border border-white/10 bg-pitch-900/60">
                  {/* Group header */}
                  <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                    <p className="font-display text-base uppercase tracking-widest text-lime">
                      Group {label}
                    </p>
                    <p className="font-mono text-base uppercase tracking-widest text-chalk/40">
                      {rows[0]?.played ?? 0} of 3 played
                    </p>
                  </div>

                  {/* Column headers */}
                  <div className="grid grid-cols-[1.5rem_1fr_2rem_2rem_2rem_2rem_2.5rem] gap-x-1 border-b border-white/5 px-3 py-1.5 font-mono text-sm uppercase tracking-widest text-chalk/40">
                    <span />
                    <span>Team</span>
                    <span className="text-center">P</span>
                    <span className="text-center">W</span>
                    <span className="text-center">D</span>
                    <span className="text-center">GD</span>
                    <span className="text-right">Pts</span>
                  </div>

                  {rows.map((row, i) => {
                    const qualifies = i < 2;
                    return (
                      <div
                        key={row.team_id}
                        className={[
                          'grid grid-cols-[1.5rem_1fr_2rem_2rem_2rem_2rem_2.5rem] items-center gap-x-1 border-t border-white/5 px-3 py-2.5',
                          qualifies ? 'bg-lime/5' : '',
                        ].join(' ')}
                      >
                        <span className={['h-1.5 w-1.5 rounded-full', qualifies ? 'bg-lime/60' : 'bg-transparent'].join(' ')} />

                        <div className="flex min-w-0 items-center gap-2">
                          {row.teams?.crest ? (
                            <img src={row.teams.crest} alt="" className="h-4 w-4 shrink-0 object-contain" />
                          ) : (
                            <span className="h-4 w-4 shrink-0 rounded-sm bg-white/10" />
                          )}
                          <span className="truncate font-display text-base uppercase text-chalk">
                            {row.teams?.tla ?? row.teams?.name ?? `#${row.team_id}`}
                          </span>
                        </div>

                        <span className="text-center font-mono text-base text-chalk/55">{row.played}</span>
                        <span className="text-center font-mono text-base text-chalk/55">{row.won}</span>
                        <span className="text-center font-mono text-base text-chalk/55">{row.drawn}</span>
                        <span className={['text-center font-mono text-base', gdColor(row.goal_diff)].join(' ')}>
                          {row.goal_diff > 0 ? `+${row.goal_diff}` : row.goal_diff}
                        </span>
                        <span className="text-right font-display text-base font-bold text-chalk">
                          {row.points}
                        </span>
                      </div>
                    );
                  })}

                  <div className="flex items-center gap-1.5 border-t border-white/5 px-3 py-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-lime/50" />
                    <span className="font-mono text-sm uppercase tracking-widest text-chalk/35">Qualify</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Stats ─────────────────────────────────────────────────── */}
      <section className="mt-10">
        <div className="mb-4 flex items-center gap-3">
          <h2 className="font-display text-2xl uppercase text-lime">Tournament Stats</h2>
          <span className="h-px flex-1 bg-white/10" />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Top Scorers */}
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-pitch-900/60">
            <div className="border-b border-white/10 px-5 py-3.5">
              <p className="font-display text-base uppercase tracking-widest text-lime">Top Scorers</p>
            </div>
            {topScorers.length === 0 ? (
              <div className="flex h-28 items-center justify-center">
                <p className="font-mono text-base text-chalk/40">No goals scored yet</p>
              </div>
            ) : (
              topScorers.map((s, i) => (
                <div
                  key={s.player_external_id}
                  className="flex items-center gap-3 border-t border-white/5 px-5 py-3.5"
                >
                  <span className="w-6 shrink-0 font-display font-black text-base text-chalk/40">{i + 1}</span>
                  {s.team_crest && (
                    <img src={s.team_crest} alt="" className="h-5 w-5 shrink-0 object-contain" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-base uppercase text-chalk">{s.player_name}</p>
                    {s.team_tla && (
                      <p className="font-mono text-base text-chalk/45">{s.team_tla}</p>
                    )}
                  </div>
                  <div className="flex items-baseline gap-1 shrink-0">
                    <span className="font-display font-black text-2xl text-lime">{s.goals}</span>
                    <span className="font-mono text-base text-chalk/40">{s.goals === 1 ? 'goal' : 'goals'}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Top Assisters */}
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-pitch-900/60">
            <div className="border-b border-white/10 px-5 py-3.5">
              <p className="font-display text-base uppercase tracking-widest text-lime">Top Assisters</p>
            </div>
            {topAssisters.length === 0 ? (
              <div className="flex h-28 items-center justify-center">
                <p className="font-mono text-base text-chalk/40">
                  Assist data will appear as it becomes available
                </p>
              </div>
            ) : (
              topAssisters.map((a, i) => (
                <div
                  key={a.player_external_id}
                  className="flex items-center gap-3 border-t border-white/5 px-5 py-3.5"
                >
                  <span className="w-6 shrink-0 font-display font-black text-base text-chalk/40">{i + 1}</span>
                  {a.team_crest && (
                    <img src={a.team_crest} alt="" className="h-5 w-5 shrink-0 object-contain" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-base uppercase text-chalk">{a.player_name}</p>
                    {a.team_tla && (
                      <p className="font-mono text-base text-chalk/45">{a.team_tla}</p>
                    )}
                  </div>
                  <div className="flex items-baseline gap-1 shrink-0">
                    <span className="font-display font-black text-2xl text-lime">{a.assists}</span>
                    <span className="font-mono text-base text-chalk/40">{a.assists === 1 ? 'assist' : 'assists'}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
