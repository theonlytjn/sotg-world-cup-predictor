'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
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
  stage: string;
  matchday: number | null;
  group_label: string | null;
  kickoff: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
  goals: GoalEvent[] | null;
  home_team_id: number | null;
  away_team_id: number | null;
  home_team: Team | null;
  away_team: Team | null;
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

type DateGroup = { dateKey: string; label: string; fixtures: Fixture[] };
type MatchdayGroup = { matchday: number; dateGroups: DateGroup[] };
type StageGroup = { stage: string; fixtures: Fixture[] };

const STAGE_ORDER = ['GROUP_STAGE', 'LAST_32', 'LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'FINAL'];
const STAGE_LABELS: Record<string, string> = {
  GROUP_STAGE:    'Groups',
  LAST_32:        'Rd 32',
  LAST_16:        'Rd 16',
  QUARTER_FINALS: 'QF',
  SEMI_FINALS:    'SF',
  FINAL:          'Final',
};

function formatDateLabel(dateKey: string): string {
  return new Date(dateKey + 'T12:00:00Z').toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
  });
}

export default function FixturesPage() {
  const supabase = useMemo(() => createClient(), []);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStage, setActiveStage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<number | null>(null);
  const [activeDay, setActiveDay] = useState<string | null>(null);
  const [showStandings, setShowStandings] = useState(false);

  const load = useCallback(async () => {
    const [{ data: fx }, { data: st }] = await Promise.all([
      supabase
        .from('fixtures')
        .select(
          `id, stage, matchday, group_label, kickoff, status, home_score, away_score, goals,
           home_team_id, away_team_id,
           home_team:teams!fixtures_home_team_id_fkey (name, tla, crest),
           away_team:teams!fixtures_away_team_id_fkey (name, tla, crest)`
        )
        .order('kickoff', { ascending: true }),
      supabase
        .from('group_standings')
        .select(`group_label, position, played, won, drawn, lost, goals_for, goals_against, goal_diff, points, team:teams(name, tla, crest)`)
        .order('group_label', { ascending: true })
        .order('position', { ascending: true }),
    ]);
    setFixtures((fx as unknown as Fixture[]) ?? []);
    setStandings((st as unknown as StandingRow[]) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  // Group fixtures by stage
  const stageGroups = useMemo((): StageGroup[] => {
    const byStage = new Map<string, Fixture[]>();
    for (const f of fixtures) {
      if (!byStage.has(f.stage)) byStage.set(f.stage, []);
      byStage.get(f.stage)!.push(f);
    }
    return STAGE_ORDER.filter((s) => byStage.has(s)).map((s) => ({ stage: s, fixtures: byStage.get(s)! }));
  }, [fixtures]);

  // Auto-select stage
  useEffect(() => {
    if (activeStage !== null || stageGroups.length === 0) return;
    const live = stageGroups.find((sg) => sg.fixtures.some((f) => f.status === 'IN_PLAY' || f.status === 'PAUSED'));
    if (live) { setActiveStage(live.stage); return; }
    const gs = stageGroups.find((sg) => sg.stage === 'GROUP_STAGE');
    setActiveStage(gs ? 'GROUP_STAGE' : stageGroups[0].stage);
  }, [stageGroups, activeStage]);

  // Reset tabs when stage changes
  useEffect(() => {
    setActiveTab(null);
    setActiveDay(null);
  }, [activeStage]);

  const isGroupStage = activeStage === 'GROUP_STAGE';
  const activeStageFixtures = useMemo(
    () => stageGroups.find((sg) => sg.stage === activeStage)?.fixtures ?? [],
    [stageGroups, activeStage]
  );

  const matchdayGroups = useMemo((): MatchdayGroup[] => {
    if (!isGroupStage) return [];
    const byMd = new Map<number, Map<string, Fixture[]>>();
    for (const f of activeStageFixtures) {
      const md = f.matchday ?? 0;
      const day = f.kickoff.slice(0, 10);
      if (!byMd.has(md)) byMd.set(md, new Map());
      if (!byMd.get(md)!.has(day)) byMd.get(md)!.set(day, []);
      byMd.get(md)!.get(day)!.push(f);
    }
    return [...byMd.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([md, dayMap]) => ({
        matchday: md,
        dateGroups: [...dayMap.entries()]
          .sort()
          .map(([dateKey, fxs]) => ({
            dateKey,
            label: formatDateLabel(dateKey),
            fixtures: [...fxs].sort((a, b) => a.kickoff.localeCompare(b.kickoff)),
          })),
      }));
  }, [activeStageFixtures, isGroupStage]);

  const knockoutFixtures = useMemo(() => {
    if (isGroupStage) return [];
    return [...activeStageFixtures].sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  }, [activeStageFixtures, isGroupStage]);

  // Auto-select matchday within group stage
  useEffect(() => {
    if (activeTab !== null || !matchdayGroups.length) return;
    const now = Date.now();
    for (const mg of matchdayGroups) {
      if (mg.dateGroups.some((dg) => dg.fixtures.some((f) => f.status === 'IN_PLAY' || f.status === 'PAUSED'))) {
        setActiveTab(mg.matchday); return;
      }
    }
    for (const mg of matchdayGroups) {
      if (mg.dateGroups.some((dg) => dg.fixtures.some((f) => new Date(f.kickoff).getTime() > now))) {
        setActiveTab(mg.matchday); return;
      }
    }
    setActiveTab(matchdayGroups.at(-1)!.matchday);
  }, [matchdayGroups, activeTab]);

  const activeGroup = matchdayGroups.find((mg) => mg.matchday === activeTab);

  // Reset day on matchday change
  useEffect(() => {
    if (!activeGroup) return;
    const days = activeGroup.dateGroups;
    if (!days.length) return;
    const today = new Date().toISOString().slice(0, 10);
    const todayHere = days.find((d) => d.dateKey === today);
    if (todayHere) { setActiveDay(today); return; }
    const upcoming = days.find((d) => d.dateKey >= today);
    setActiveDay(upcoming ? upcoming.dateKey : days.at(-1)!.dateKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const activeDayGroup = activeGroup?.dateGroups.find((d) => d.dateKey === activeDay);
  const activeDayIdx = activeGroup?.dateGroups.findIndex((d) => d.dateKey === activeDay) ?? 0;
  const totalDays = activeGroup?.dateGroups.length ?? 0;

  // Group standings by group label
  const byGroup = useMemo(() => {
    const m = new Map<string, StandingRow[]>();
    for (const s of standings) {
      if (!m.has(s.group_label)) m.set(s.group_label, []);
      m.get(s.group_label)!.push(s);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [standings]);

  if (loading) return <p className="py-20 text-center font-mono text-base text-chalk">Loading…</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-3">
          <span className="text-lime"><HugeiconsIcon icon={Calendar1Icon} size={18} color="currentColor" strokeWidth={1.5} /></span>
          <p className="font-display text-base tracking-[0.28em] uppercase text-lime">
            {STAGE_LABELS[activeStage ?? ''] ?? 'Fixtures'}
          </p>
        </div>
        {isGroupStage && byGroup.length > 0 && (
          <button
            onClick={() => setShowStandings((v) => !v)}
            className="font-mono text-base uppercase tracking-widest text-chalk hover:text-lime transition"
          >
            {showStandings ? 'Hide tables' : 'Show tables'}
          </button>
        )}
      </div>
      <h1 className="font-display text-4xl uppercase text-chalk">Fixtures</h1>
      <p className="mt-1 text-chalk">Scores update automatically as results come in.</p>

      {/* Stage tabs — only shown when multiple stages have fixtures */}
      {stageGroups.length > 1 && (
        <div className="mt-6 flex w-full border-b border-white/10">
          {stageGroups.map((sg) => {
            const active = sg.stage === activeStage;
            const liveCount = sg.fixtures.filter((f) => f.status === 'IN_PLAY' || f.status === 'PAUSED').length;
            const doneCount = sg.fixtures.filter((f) => f.status === 'FINISHED').length;
            const remaining = sg.fixtures.length - liveCount - doneCount;
            return (
              <button
                key={sg.stage}
                onClick={() => setActiveStage(sg.stage)}
                className={['flex flex-1 flex-col items-center pb-3 pt-2 relative transition-colors', active ? 'text-lime' : 'text-chalk hover:text-lime'].join(' ')}
              >
                <span className="font-display text-base uppercase tracking-wide">{STAGE_LABELS[sg.stage] ?? sg.stage}</span>
                <span className="mt-0.5 font-mono text-sm">
                  {liveCount > 0 ? (
                    <span className="flex items-center gap-1 text-flame">
                      <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-flame" />{liveCount} live
                    </span>
                  ) : remaining === 0 ? <span className="text-chalk">Done</span>
                    : <span className="text-chalk">{remaining} left</span>}
                </span>
                {active && <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-lime" />}
              </button>
            );
          })}
        </div>
      )}

      {/* Group standings (toggleable, group stage only) */}
      {isGroupStage && showStandings && byGroup.length > 0 && (
        <section className="mt-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {byGroup.map(([label, rows]) => (
              <div key={label} className="overflow-hidden rounded-2xl border border-white/10 bg-pitch-900/60">
                <div className="border-b border-white/8 bg-pitch-800/60 px-4 py-2.5">
                  <span className="font-display text-base uppercase tracking-widest text-lime">Group {label}</span>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/6">
                      {['#','Team','P','W','D','L','GD','Pts'].map((h) => (
                        <th key={h} className={`py-1.5 font-mono text-[9px] uppercase tracking-widest text-chalk ${h === 'Team' ? 'px-1 text-left' : h === '#' ? 'pl-3 text-left' : h === 'Pts' ? 'pr-3 text-center' : 'px-1 text-center'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={r.position} className={`border-t border-white/5 ${i < 2 ? 'bg-lime/[0.03]' : ''}`}>
                        <td className="pl-3 py-2 font-mono text-base text-chalk">{r.position}</td>
                        <td className="px-1 py-2">
                          <div className="flex items-center gap-1.5">
                            {r.team?.crest && <img src={r.team.crest} alt="" className="h-4 w-4 shrink-0 object-contain" />}
                            <span className="font-display text-sm uppercase leading-snug text-chalk">{r.team?.name ?? '—'}</span>
                          </div>
                        </td>
                        {[r.played, r.won, r.drawn, r.lost].map((v, j) => (
                          <td key={j} className="px-1 py-2 text-center font-mono text-base text-chalk">{v}</td>
                        ))}
                        <td className="px-1 py-2 text-center font-mono text-base text-chalk">{r.goal_diff > 0 ? `+${r.goal_diff}` : r.goal_diff}</td>
                        <td className="pr-3 py-2 text-center font-display text-base text-chalk">{r.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
          <p className="mt-2 font-mono text-sm uppercase tracking-widest text-chalk">
            Top 2 from each group advance
          </p>
        </section>
      )}

      {/* GROUP STAGE: matchday tabs + day cycler */}
      {isGroupStage && (
        <div className="mt-6 flex w-full border-b border-white/10">
          {matchdayGroups.map((mg) => {
            const active = mg.matchday === activeTab;
            const allDone = mg.dateGroups.flatMap((d) => d.fixtures).every((f) => f.status === 'FINISHED');
            const liveCount = mg.dateGroups.flatMap((d) => d.fixtures).filter((f) => f.status === 'IN_PLAY' || f.status === 'PAUSED').length;
            const total = mg.dateGroups.flatMap((d) => d.fixtures).length;
            const finished = mg.dateGroups.flatMap((d) => d.fixtures).filter((f) => f.status === 'FINISHED').length;
            const upcoming = total - liveCount - finished;
            return (
              <button
                key={mg.matchday}
                onClick={() => setActiveTab(mg.matchday)}
                className={['flex flex-1 flex-col items-center pb-4 pt-3 relative transition-colors', active ? 'text-lime' : 'text-chalk hover:text-chalk'].join(' ')}
              >
                <span className="font-display text-sm uppercase tracking-[0.2em]">Matchday</span>
                <span className="font-display text-3xl">{mg.matchday}</span>
                <span className="mt-1 font-mono text-sm">
                  {liveCount > 0 ? (
                    <span className="flex items-center gap-1 text-flame">
                      <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-flame" />{liveCount} live
                    </span>
                  ) : allDone ? <span className="text-chalk">Done</span>
                    : <span className="text-chalk">{upcoming} left</span>}
                </span>
                {active && <span className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full bg-lime" />}
              </button>
            );
          })}
        </div>
      )}

      {/* Day cycler — group stage only */}
      {isGroupStage && activeGroup && (
        <div className="mt-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => activeDayIdx > 0 && setActiveDay(activeGroup.dateGroups[activeDayIdx - 1].dateKey)}
              disabled={activeDayIdx <= 0}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-chalk transition hover:border-white/30 hover:text-chalk disabled:opacity-20"
            >←</button>
            <div className="flex-1 text-center">
              <p className="font-display text-base uppercase tracking-widest text-chalk">{activeDayGroup?.label ?? '—'}</p>
              <p className="font-mono text-base text-chalk">
                {activeDayGroup?.fixtures.length ?? 0} matches
                {totalDays > 1 && <span className="ml-2 text-chalk">Day {activeDayIdx + 1} of {totalDays}</span>}
              </p>
            </div>
            <button
              onClick={() => activeDayIdx < totalDays - 1 && setActiveDay(activeGroup.dateGroups[activeDayIdx + 1].dateKey)}
              disabled={activeDayIdx >= totalDays - 1}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-chalk transition hover:border-white/30 hover:text-chalk disabled:opacity-20"
            >→</button>
          </div>
          {totalDays > 1 && (
            <div className="mt-3 flex justify-center gap-1.5">
              {activeGroup.dateGroups.map((dg, i) => (
                <button key={dg.dateKey} onClick={() => setActiveDay(dg.dateKey)}
                  className={['h-1.5 rounded-full transition-all', i === activeDayIdx ? 'w-6 bg-lime' : 'w-1.5 bg-white/20 hover:bg-white/40'].join(' ')}
                />
              ))}
            </div>
          )}
          <div className="mt-6 space-y-2">
            {activeDayGroup?.fixtures.map((f) => <FixtureRow key={f.id} f={f} />)}
          </div>
        </div>
      )}

      {/* KNOCKOUT STAGE: flat list */}
      {!isGroupStage && (
        <div className="mt-6">
          {knockoutFixtures.length === 0 ? (
            <p className="py-10 text-center text-base text-chalk">
              Fixtures for this round will appear once the previous round is complete.
            </p>
          ) : (
            <div className="space-y-2">
              {knockoutFixtures.map((f) => <FixtureRow key={f.id} f={f} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FixtureRow({ f }: { f: Fixture }) {
  const finished = f.status === 'FINISHED';
  const live = f.status === 'IN_PLAY' || f.status === 'PAUSED';
  const koTime = new Date(f.kickoff).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const homeGoals = (f.goals ?? []).filter((g) => g.team_id === f.home_team_id);
  const awayGoals = (f.goals ?? []).filter((g) => g.team_id === f.away_team_id);

  return (
    <div className={`rounded-2xl border px-3 py-3 transition-colors ${live ? 'border-lime/25 bg-pitch-900/80' : finished ? 'border-white/6 bg-pitch-900/40' : 'border-white/10 bg-pitch-900/60'}`}>
      <div className="flex items-center gap-2">
        {/* Group label */}
        <span className="w-5 shrink-0 font-display text-xs uppercase tracking-widest text-chalk">{f.group_label ?? '—'}</span>

        {/* Home team */}
        <Side t={f.home_team} align="left" />

        {/* Centre: status above score */}
        <div className="w-16 shrink-0 flex flex-col items-center gap-0.5">
          <span className={`font-display text-[0.6rem] uppercase tracking-widest ${live ? 'text-flame' : 'text-chalk'}`}>
            {live ? (
              <span className="flex items-center gap-1">
                <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-flame" />
                Live
              </span>
            ) : finished ? 'FT' : koTime}
          </span>
          {(finished || live) && (
            <span className="font-display font-black text-2xl text-chalk leading-none">
              {f.home_score ?? 0}–{f.away_score ?? 0}
            </span>
          )}
        </div>

        {/* Away team */}
        <Side t={f.away_team} align="right" />
      </div>

      {(homeGoals.length > 0 || awayGoals.length > 0) && (
        <div className="mt-2 flex gap-2 border-t border-white/6 pt-2">
          <span className="w-5 shrink-0" />
          <div className="flex-1 space-y-0.5">
            {homeGoals.map((g, i) => <GoalLine key={i} g={g} />)}
          </div>
          <div className="w-16 shrink-0" />
          <div className="flex-1 space-y-0.5 text-right">
            {awayGoals.map((g, i) => <GoalLine key={i} g={g} reverse />)}
          </div>
        </div>
      )}
    </div>
  );
}

function GoalLine({ g, reverse }: { g: GoalEvent; reverse?: boolean }) {
  const min = g.minute != null ? (g.injury_time ? `${g.minute}+${g.injury_time}'` : `${g.minute}'`) : '';
  const tag = g.type === 'OWN_GOAL' ? '(og)' : g.type === 'PENALTY' ? '(p)' : '';
  return (
    <p className={`font-mono text-base text-chalk ${reverse ? 'text-right' : ''}`}>
      {reverse
        ? <>{tag && <span className="text-chalk mr-1">{tag}</span>}{g.scorer ?? '—'}{min && <span className="text-chalk ml-1">{min}</span>}</>
        : <>{min && <span className="text-chalk mr-1">{min}</span>}{g.scorer ?? '—'}{tag && <span className="text-chalk ml-1">{tag}</span>}</>}
    </p>
  );
}

function Side({ t, align }: { t: Team | null; align: 'left' | 'right' }) {
  return (
    <div className={`flex flex-1 flex-col gap-1 ${align === 'right' ? 'items-end' : 'items-start'}`}>
      {t?.crest
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={t.crest} alt="" className="h-7 w-7 object-contain" />
        : <span className="h-7 w-7 rounded-full bg-pitch-700" />}
      <span className={`font-display text-[0.55rem] uppercase leading-tight text-chalk ${align === 'right' ? 'text-right' : ''}`}>
        {t?.name ?? 'TBD'}
      </span>
    </div>
  );
}
