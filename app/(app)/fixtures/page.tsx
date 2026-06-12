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
  const [activeTab, setActiveTab] = useState<number | null>(null);
  const [activeDay, setActiveDay] = useState<string | null>(null);
  const [showStandings, setShowStandings] = useState(false);

  const load = useCallback(async () => {
    const [{ data: fx }, { data: st }] = await Promise.all([
      supabase
        .from('fixtures')
        .select(
          `id, matchday, group_label, kickoff, status, home_score, away_score, goals,
           home_team_id, away_team_id,
           home_team:teams!fixtures_home_team_id_fkey (name, tla, crest),
           away_team:teams!fixtures_away_team_id_fkey (name, tla, crest)`
        )
        .eq('stage', 'GROUP_STAGE')
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

  const matchdayGroups = useMemo((): MatchdayGroup[] => {
    const byMd = new Map<number, Map<string, Fixture[]>>();
    for (const f of fixtures) {
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
  }, [fixtures]);

  // Auto-select matchday: nearest with live/upcoming game
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

  if (loading) return <p className="py-20 text-center font-mono text-sm text-chalk/40">Loading…</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-3">
          <span className="text-lime"><HugeiconsIcon icon={Calendar1Icon} size={18} color="currentColor" strokeWidth={1.5} /></span>
          <p className="font-display text-sm tracking-[0.28em] uppercase text-lime">Group stage</p>
        </div>
        {byGroup.length > 0 && (
          <button
            onClick={() => setShowStandings((v) => !v)}
            className="font-mono text-sm uppercase tracking-widest text-chalk/40 hover:text-lime transition"
          >
            {showStandings ? 'Hide tables' : 'Show tables'}
          </button>
        )}
      </div>
      <h1 className="font-display text-4xl uppercase text-chalk">Fixtures</h1>
      <p className="mt-1 text-chalk/75">Scores update automatically as results come in.</p>

      {/* Group standings (toggleable) */}
      {showStandings && byGroup.length > 0 && (
        <section className="mt-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {byGroup.map(([label, rows]) => (
              <div key={label} className="overflow-hidden rounded-2xl border border-white/10 bg-pitch-900/60">
                <div className="border-b border-white/8 bg-pitch-800/60 px-4 py-2.5">
                  <span className="font-display text-sm uppercase tracking-widest text-lime">Group {label}</span>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/6">
                      {['#','Team','P','W','D','L','GD','Pts'].map((h) => (
                        <th key={h} className={`py-1.5 font-mono text-[9px] uppercase tracking-widest text-chalk/30 ${h === 'Team' ? 'px-1 text-left' : h === '#' ? 'pl-3 text-left' : h === 'Pts' ? 'pr-3 text-center' : 'px-1 text-center'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={r.position} className={`border-t border-white/5 ${i < 2 ? 'bg-lime/[0.03]' : ''}`}>
                        <td className="pl-3 py-2 font-mono text-sm text-chalk/40">{r.position}</td>
                        <td className="px-1 py-2">
                          <div className="flex items-center gap-1.5">
                            {r.team?.crest && <img src={r.team.crest} alt="" className="h-4 w-4 shrink-0 object-contain" />}
                            <span className="font-display text-sm uppercase text-chalk truncate">{r.team?.tla ?? '—'}</span>
                          </div>
                        </td>
                        {[r.played, r.won, r.drawn, r.lost].map((v, j) => (
                          <td key={j} className="px-1 py-2 text-center font-mono text-sm text-chalk/60">{v}</td>
                        ))}
                        <td className="px-1 py-2 text-center font-mono text-sm text-chalk/60">{r.goal_diff > 0 ? `+${r.goal_diff}` : r.goal_diff}</td>
                        <td className="pr-3 py-2 text-center font-display text-sm text-chalk">{r.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-chalk/25">
            Top 2 from each group advance
          </p>
        </section>
      )}

      {/* Matchday tabs */}
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
              className={['flex flex-1 flex-col items-center pb-4 pt-3 relative transition-colors', active ? 'text-lime' : 'text-chalk/50 hover:text-chalk'].join(' ')}
            >
              <span className="font-display text-[10px] uppercase tracking-[0.2em]">Matchday</span>
              <span className="font-display text-3xl">{mg.matchday}</span>
              <span className="mt-1 font-mono text-[10px]">
                {liveCount > 0 ? (
                  <span className="flex items-center gap-1 text-flame">
                    <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-flame" />{liveCount} live
                  </span>
                ) : allDone ? <span className="text-chalk/25">Done</span>
                  : <span className="text-chalk/35">{upcoming} left</span>}
              </span>
              {active && <span className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full bg-lime" />}
            </button>
          );
        })}
      </div>

      {/* Day cycler */}
      {activeGroup && (
        <div className="mt-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => activeDayIdx > 0 && setActiveDay(activeGroup.dateGroups[activeDayIdx - 1].dateKey)}
              disabled={activeDayIdx <= 0}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-chalk/50 transition hover:border-white/30 hover:text-chalk disabled:opacity-20"
            >←</button>
            <div className="flex-1 text-center">
              <p className="font-display text-base uppercase tracking-widest text-chalk">{activeDayGroup?.label ?? '—'}</p>
              <p className="font-mono text-sm text-chalk/35">
                {activeDayGroup?.fixtures.length ?? 0} matches
                {totalDays > 1 && <span className="ml-2 text-chalk/25">Day {activeDayIdx + 1} of {totalDays}</span>}
              </p>
            </div>
            <button
              onClick={() => activeDayIdx < totalDays - 1 && setActiveDay(activeGroup.dateGroups[activeDayIdx + 1].dateKey)}
              disabled={activeDayIdx >= totalDays - 1}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-chalk/50 transition hover:border-white/30 hover:text-chalk disabled:opacity-20"
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
    <div className={`rounded-2xl border px-4 py-3 transition-colors ${live ? 'border-lime/25 bg-pitch-900/80' : finished ? 'border-white/6 bg-pitch-900/40' : 'border-white/10 bg-pitch-900/60'}`}>
      <div className="flex items-center gap-3">
        <span className="w-8 shrink-0 font-display text-sm uppercase tracking-widest text-chalk/40">{f.group_label ?? '—'}</span>
        <Side t={f.home_team} />
        <div className="w-20 shrink-0 text-center">
          {finished || live
            ? <span className="font-display font-black text-2xl text-chalk">{f.home_score ?? 0}–{f.away_score ?? 0}</span>
            : <span className="font-mono text-sm text-chalk/40">{koTime}</span>}
        </div>
        <Side t={f.away_team} reverse />
        <span className="w-10 shrink-0 text-right font-display text-[10px] uppercase tracking-widest">
          {live ? (
            <span className="flex items-center justify-end gap-1 text-flame">
              <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-flame" />Live
            </span>
          ) : finished ? <span className="text-chalk/30">FT</span> : ''}
        </span>
      </div>

      {(homeGoals.length > 0 || awayGoals.length > 0) && (
        <div className="mt-2.5 flex gap-3 border-t border-white/6 pt-2.5">
          <span className="w-8 shrink-0" />
          <div className="flex-1 space-y-0.5">
            {homeGoals.map((g, i) => <GoalLine key={i} g={g} />)}
          </div>
          <div className="w-20 shrink-0" />
          <div className="flex-1 space-y-0.5 text-right">
            {awayGoals.map((g, i) => <GoalLine key={i} g={g} reverse />)}
          </div>
          <span className="w-10 shrink-0" />
        </div>
      )}
    </div>
  );
}

function GoalLine({ g, reverse }: { g: GoalEvent; reverse?: boolean }) {
  const min = g.minute != null ? (g.injury_time ? `${g.minute}+${g.injury_time}'` : `${g.minute}'`) : '';
  const tag = g.type === 'OWN_GOAL' ? '(og)' : g.type === 'PENALTY' ? '(p)' : '';
  return (
    <p className={`font-mono text-sm text-chalk/55 ${reverse ? 'text-right' : ''}`}>
      {reverse
        ? <>{tag && <span className="text-chalk/30 mr-1">{tag}</span>}{g.scorer ?? '—'}{min && <span className="text-chalk/30 ml-1">{min}</span>}</>
        : <>{min && <span className="text-chalk/30 mr-1">{min}</span>}{g.scorer ?? '—'}{tag && <span className="text-chalk/30 ml-1">{tag}</span>}</>}
    </p>
  );
}

function Side({ t, reverse }: { t: Team | null; reverse?: boolean }) {
  return (
    <div className={`flex flex-1 items-center gap-2 ${reverse ? 'flex-row-reverse text-right' : ''}`}>
      {t?.crest
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={t.crest} alt="" className="h-6 w-6 shrink-0 object-contain" />
        : <span className="h-6 w-6 shrink-0 rounded-full bg-pitch-700" />}
      <span className="truncate font-display text-base font-bold uppercase text-chalk">{t?.tla ?? t?.name ?? 'TBD'}</span>
    </div>
  );
}
