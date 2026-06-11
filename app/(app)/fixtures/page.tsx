import { createClient } from '@/lib/supabase/server';
import { HugeiconsIcon } from '@hugeicons/react';
import { Calendar1Icon } from '@hugeicons-pro/core-stroke-rounded';

type Team = { name: string; tla: string | null; crest: string | null };
type GoalEvent = {
  minute: number | null;
  injury_time: number | null;
  type: string;
  team_id: number | null;
  scorer: string | null;
  assist: string | null;
};
type Fixture = {
  id: number;
  matchday: number | null;
  group_label: string | null;
  kickoff: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
  goals: GoalEvent[] | null;
  home_team: Team | null;
  away_team: Team | null;
  home_team_id: number | null;
  away_team_id: number | null;
};

type StandingRow = {
  group_label: string;
  position: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_diff: number;
  points: number;
  team: { name: string; tla: string | null; crest: string | null } | null;
};

export const dynamic = 'force-dynamic';

export default async function FixturesPage() {
  const supabase = await createClient();

  const [{ data: fixtureData }, { data: standingData }] = await Promise.all([
    supabase
      .from('fixtures')
      .select(
        `id, matchday, group_label, kickoff, status, home_score, away_score, goals,
         home_team_id,
         away_team_id,
         home_team:teams!fixtures_home_team_id_fkey (name, tla, crest),
         away_team:teams!fixtures_away_team_id_fkey (name, tla, crest)`
      )
      .eq('stage', 'GROUP_STAGE')
      .order('kickoff', { ascending: true }),
    supabase
      .from('group_standings')
      .select(`
        group_label, position, played, won, drawn, lost,
        goals_for, goals_against, goal_diff, points,
        team:teams(name, tla, crest)
      `)
      .order('group_label', { ascending: true })
      .order('position', { ascending: true }),
  ]);

  const fixtures = (fixtureData as unknown as Fixture[]) ?? [];
  const standings = (standingData as unknown as StandingRow[]) ?? [];

  // Group fixtures by matchday
  const byMatchday = new Map<number, Fixture[]>();
  for (const f of fixtures) {
    const md = f.matchday ?? 0;
    if (!byMatchday.has(md)) byMatchday.set(md, []);
    byMatchday.get(md)!.push(f);
  }
  const orderedMatchdays = [...byMatchday.entries()].sort((a, b) => a[0] - b[0]);

  // Group standings by group label
  const byGroup = new Map<string, StandingRow[]>();
  for (const s of standings) {
    if (!byGroup.has(s.group_label)) byGroup.set(s.group_label, []);
    byGroup.get(s.group_label)!.push(s);
  }
  const orderedGroups = [...byGroup.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <span className="text-lime"><HugeiconsIcon icon={Calendar1Icon} size={18} color="currentColor" strokeWidth={1.5} /></span>
        <p className="font-display text-xs tracking-[0.28em] uppercase text-lime">Group stage</p>
      </div>
      <h1 className="font-display text-4xl uppercase text-chalk">Fixtures</h1>
      <p className="mt-1 text-sm text-chalk/55">Scores and standings update automatically.</p>

      {/* ── GROUP STANDINGS ──────────────────────────────────────── */}
      {orderedGroups.length > 0 && (
        <section className="mt-8">
          <div className="mb-4 flex items-center gap-3">
            <h2 className="font-display text-xl uppercase text-lime">Group Tables</h2>
            <span className="h-px flex-1 bg-white/8" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {orderedGroups.map(([label, rows]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-pitch-900/60 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-white/8 bg-pitch-800/60">
                  <span className="font-display text-xs uppercase tracking-widest text-lime">Group {label}</span>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/6">
                      <th className="px-3 py-1.5 text-left font-mono text-[9px] uppercase tracking-widest text-chalk/30 w-6">#</th>
                      <th className="px-1 py-1.5 text-left font-mono text-[9px] uppercase tracking-widest text-chalk/30">Team</th>
                      <th className="px-1 py-1.5 text-center font-mono text-[9px] uppercase tracking-widest text-chalk/30">P</th>
                      <th className="px-1 py-1.5 text-center font-mono text-[9px] uppercase tracking-widest text-chalk/30">W</th>
                      <th className="px-1 py-1.5 text-center font-mono text-[9px] uppercase tracking-widest text-chalk/30">D</th>
                      <th className="px-1 py-1.5 text-center font-mono text-[9px] uppercase tracking-widest text-chalk/30">L</th>
                      <th className="px-1 py-1.5 text-center font-mono text-[9px] uppercase tracking-widest text-chalk/30">GD</th>
                      <th className="pr-3 py-1.5 text-center font-mono text-[9px] uppercase tracking-widest text-chalk/30">Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={r.position} className={`border-t border-white/5 ${i < 2 ? 'bg-lime/3' : ''}`}>
                        <td className="px-3 py-2 font-mono text-xs text-chalk/40">{r.position}</td>
                        <td className="px-1 py-2">
                          <div className="flex items-center gap-1.5">
                            {r.team?.crest && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={r.team.crest} alt="" className="h-4 w-4 object-contain shrink-0" />
                            )}
                            <span className="font-display text-xs uppercase text-chalk truncate">
                              {r.team?.tla ?? r.team?.name ?? '—'}
                            </span>
                          </div>
                        </td>
                        <td className="px-1 py-2 text-center font-mono text-xs text-chalk/60">{r.played}</td>
                        <td className="px-1 py-2 text-center font-mono text-xs text-chalk/60">{r.won}</td>
                        <td className="px-1 py-2 text-center font-mono text-xs text-chalk/60">{r.drawn}</td>
                        <td className="px-1 py-2 text-center font-mono text-xs text-chalk/60">{r.lost}</td>
                        <td className="px-1 py-2 text-center font-mono text-xs text-chalk/60">
                          {r.goal_diff > 0 ? `+${r.goal_diff}` : r.goal_diff}
                        </td>
                        <td className="pr-3 py-2 text-center font-display text-sm text-chalk font-bold">{r.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-chalk/25">
            Top 2 from each group advance · shaded rows qualify
          </p>
        </section>
      )}

      {/* ── FIXTURES BY MATCHDAY ─────────────────────────────────── */}
      {orderedMatchdays.length === 0 && (
        <p className="mt-8 font-mono text-sm text-chalk/40">No fixtures imported yet — run the seed script.</p>
      )}

      {orderedMatchdays.map(([md, list]) => (
        <section key={md} className="mt-10">
          <div className="mb-3 flex items-center gap-3">
            <h2 className="font-display text-xl uppercase text-lime">Matchday {md}</h2>
            <span className="h-px flex-1 bg-white/8" />
          </div>
          <div className="space-y-2">
            {list.map((f) => (
              <FixtureRow key={f.id} f={f} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function FixtureRow({ f }: { f: Fixture }) {
  const finished = f.status === 'FINISHED';
  const live = f.status === 'IN_PLAY' || f.status === 'PAUSED';
  const ko = new Date(f.kickoff).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const homeGoals = (f.goals ?? []).filter((g) => g.team_id === f.home_team_id);
  const awayGoals = (f.goals ?? []).filter((g) => g.team_id === f.away_team_id);

  return (
    <div className={`rounded-2xl border px-4 py-3 transition-colors ${
      live ? 'border-lime/25 bg-pitch-900/80' : finished ? 'border-white/6 bg-pitch-900/40' : 'border-white/10 bg-pitch-900/60'
    }`}>
      {/* Main row */}
      <div className="flex items-center gap-3">
        <span className="w-8 shrink-0 font-display text-[11px] uppercase tracking-widest text-chalk/35">
          {f.group_label ?? '—'}
        </span>

        <Side t={f.home_team} />

        <div className="w-20 shrink-0 text-center">
          {finished || live ? (
            <span className="font-display text-lg text-chalk">
              {f.home_score ?? 0}–{f.away_score ?? 0}
            </span>
          ) : (
            <span className="font-mono text-[11px] text-chalk/40">{ko}</span>
          )}
        </div>

        <Side t={f.away_team} reverse />

        <span className="w-10 shrink-0 text-right font-display text-[10px] uppercase tracking-widest">
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

      {/* Goal scorers — only show when there are goals */}
      {(homeGoals.length > 0 || awayGoals.length > 0) && (
        <div className="mt-2.5 flex gap-3 border-t border-white/6 pt-2.5">
          <span className="w-8 shrink-0" />
          {/* Home scorers */}
          <div className="flex-1 space-y-0.5">
            {homeGoals.map((g, i) => (
              <GoalLine key={i} g={g} />
            ))}
          </div>
          <div className="w-20 shrink-0" />
          {/* Away scorers */}
          <div className="flex-1 space-y-0.5 text-right">
            {awayGoals.map((g, i) => (
              <GoalLine key={i} g={g} reverse />
            ))}
          </div>
          <span className="w-10 shrink-0" />
        </div>
      )}
    </div>
  );
}

function GoalLine({ g, reverse }: { g: GoalEvent; reverse?: boolean }) {
  const min = g.minute != null
    ? g.injury_time ? `${g.minute}+${g.injury_time}'` : `${g.minute}'`
    : '';
  const icon = g.type === 'OWN_GOAL' ? '(og)' : g.type === 'PENALTY' ? '(p)' : '';
  return (
    <p className={`font-mono text-[10px] text-chalk/50 ${reverse ? 'text-right' : ''}`}>
      {reverse
        ? <>{icon && <span className="text-chalk/30 mr-1">{icon}</span>}{g.scorer ?? '—'}{min && <span className="text-chalk/30 ml-1">{min}</span>}</>
        : <>{min && <span className="text-chalk/30 mr-1">{min}</span>}{g.scorer ?? '—'}{icon && <span className="text-chalk/30 ml-1">{icon}</span>}</>
      }
    </p>
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
      <span className="truncate font-display text-sm uppercase text-chalk">
        {t?.tla ?? t?.name ?? 'TBD'}
      </span>
    </div>
  );
}
