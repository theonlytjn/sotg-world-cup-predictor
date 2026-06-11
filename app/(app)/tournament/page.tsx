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

type Goal = {
  minute: number | null;
  type: string;
  team_id: number | null;
  scorer: string | null;
  assist: string | null;
};

type DBTeam = {
  id: number;
  external_id: number | null;
  name: string;
  tla: string | null;
};

function positionBadge(goal_diff: number) {
  if (goal_diff > 0) return 'text-lime';
  if (goal_diff < 0) return 'text-flame/80';
  return 'text-chalk/55';
}

export default async function TournamentPage() {
  const supabase = await createClient();

  const [{ data: standings }, { data: fixtureGoals }, { data: dbTeams }] = await Promise.all([
    supabase
      .from('group_standings')
      .select('*, teams(name, tla, crest)')
      .order('group_label', { ascending: true })
      .order('position', { ascending: true }),
    supabase
      .from('fixtures')
      .select('goals')
      .not('goals', 'is', null),
    supabase
      .from('teams')
      .select('id, external_id, name, tla'),
  ]);

  // Build external_id → name map for goal team attribution
  const extTeamMap = new Map<number, string>(
    ((dbTeams as DBTeam[]) ?? [])
      .filter((t) => t.external_id != null)
      .map((t) => [t.external_id!, t.tla ?? t.name])
  );

  // Flatten all goals from fixtures
  const allGoals: Goal[] = [];
  for (const row of (fixtureGoals as { goals: Goal[] | null }[]) ?? []) {
    for (const g of row.goals ?? []) allGoals.push(g);
  }

  // Top scorers (exclude own goals)
  const scorerMap = new Map<string, { goals: number; team: string }>();
  for (const g of allGoals) {
    if (!g.scorer || g.type === 'OWN') continue;
    const existing = scorerMap.get(g.scorer);
    const team = g.team_id != null ? (extTeamMap.get(g.team_id) ?? '') : '';
    if (existing) {
      existing.goals++;
    } else {
      scorerMap.set(g.scorer, { goals: 1, team });
    }
  }
  const topScorers = [...scorerMap.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.goals - a.goals)
    .slice(0, 10);

  // Top assisters
  const assistMap = new Map<string, { assists: number; team: string }>();
  for (const g of allGoals) {
    if (!g.assist) continue;
    const existing = assistMap.get(g.assist);
    const team = g.team_id != null ? (extTeamMap.get(g.team_id) ?? '') : '';
    if (existing) {
      existing.assists++;
    } else {
      assistMap.set(g.assist, { assists: 1, team });
    }
  }
  const topAssisters = [...assistMap.entries()]
    .map(([name, v]) => ({ name, ...v }))
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
  const hasGoals = allGoals.length > 0;

  return (
    <div>
      {/* Hero */}
      <h1 className="font-display text-4xl uppercase text-chalk">
        World Cup <span className="text-lime">&apos;26</span>
      </h1>
      <p className="mt-1 text-sm text-chalk/55">
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
            <p className="font-mono text-sm text-chalk/40">
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
                    <p className="font-mono text-[10px] uppercase tracking-widest text-chalk/40">
                      {rows[0]?.played ?? 0} of 3 played
                    </p>
                  </div>

                  {/* Column headers */}
                  <div className="grid grid-cols-[1.5rem_1fr_2rem_2rem_2rem_2rem_2.5rem] gap-x-1 border-b border-white/5 px-3 py-1.5 font-mono text-[9px] uppercase tracking-widest text-chalk/40">
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
                        {/* Qualify indicator */}
                        <span className={[
                          'h-1.5 w-1.5 rounded-full',
                          qualifies ? 'bg-lime/60' : 'bg-transparent',
                        ].join(' ')} />

                        {/* Team */}
                        <div className="flex min-w-0 items-center gap-2">
                          {row.teams?.crest ? (
                            <img
                              src={row.teams.crest}
                              alt=""
                              className="h-4 w-4 shrink-0 object-contain"
                            />
                          ) : (
                            <span className="h-4 w-4 shrink-0 rounded-sm bg-white/10" />
                          )}
                          <span className="truncate font-display text-sm uppercase text-chalk">
                            {row.teams?.tla ?? row.teams?.name ?? `#${row.team_id}`}
                          </span>
                        </div>

                        <span className="text-center font-mono text-xs text-chalk/55">{row.played}</span>
                        <span className="text-center font-mono text-xs text-chalk/55">{row.won}</span>
                        <span className="text-center font-mono text-xs text-chalk/55">{row.drawn}</span>
                        <span className={['text-center font-mono text-xs', positionBadge(row.goal_diff)].join(' ')}>
                          {row.goal_diff > 0 ? `+${row.goal_diff}` : row.goal_diff}
                        </span>
                        <span className="text-right font-display text-base font-bold text-chalk">
                          {row.points}
                        </span>
                      </div>
                    );
                  })}

                  {/* Qualification key */}
                  <div className="flex items-center gap-1.5 border-t border-white/5 px-3 py-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-lime/50" />
                    <span className="font-mono text-[9px] uppercase tracking-widest text-chalk/35">Qualify</span>
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
              <p className="font-display text-sm uppercase tracking-widest text-lime">Top Scorers</p>
            </div>
            {!hasGoals || topScorers.length === 0 ? (
              <div className="flex h-28 items-center justify-center">
                <p className="font-mono text-sm text-chalk/40">No goals scored yet</p>
              </div>
            ) : (
              topScorers.map((s, i) => (
                <div
                  key={`${s.name}-${i}`}
                  className="flex items-center gap-3 border-t border-white/5 px-5 py-3.5"
                >
                  <span className="w-5 shrink-0 font-mono text-xs text-chalk/40">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-sm uppercase text-chalk">{s.name}</p>
                    {s.team && (
                      <p className="font-mono text-[10px] text-chalk/45">{s.team}</p>
                    )}
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="font-display text-2xl text-lime">{s.goals}</span>
                    <span className="font-mono text-[10px] text-chalk/40">
                      {s.goals === 1 ? 'goal' : 'goals'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Top Assisters */}
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-pitch-900/60">
            <div className="border-b border-white/10 px-5 py-3.5">
              <p className="font-display text-sm uppercase tracking-widest text-lime">Top Assisters</p>
            </div>
            {!hasGoals || topAssisters.length === 0 ? (
              <div className="flex h-28 items-center justify-center">
                <p className="font-mono text-sm text-chalk/40">No assists recorded yet</p>
              </div>
            ) : (
              topAssisters.map((a, i) => (
                <div
                  key={`${a.name}-${i}`}
                  className="flex items-center gap-3 border-t border-white/5 px-5 py-3.5"
                >
                  <span className="w-5 shrink-0 font-mono text-xs text-chalk/40">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-sm uppercase text-chalk">{a.name}</p>
                    {a.team && (
                      <p className="font-mono text-[10px] text-chalk/45">{a.team}</p>
                    )}
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="font-display text-2xl text-lime">{a.assists}</span>
                    <span className="font-mono text-[10px] text-chalk/40">
                      {a.assists === 1 ? 'assist' : 'assists'}
                    </span>
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
