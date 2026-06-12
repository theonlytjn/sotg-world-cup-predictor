'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { HugeiconsIcon } from '@hugeicons/react';
import { LockIcon, DartIcon } from '@hugeicons-pro/core-stroke-rounded';

type Team = { id: number; name: string; tla: string | null; crest: string | null };
type Fixture = {
  id: number;
  stage: string;
  matchday: number | null;
  group_label: string | null;
  kickoff: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
  home_team: Team | null;
  away_team: Team | null;
};
type Pred = { fixture_id: number; home_pred: number; away_pred: number; points: number | null };

const LIVE = new Set(['IN_PLAY', 'PAUSED']);
const LOCK_BEFORE_MS = 15 * 60_000;

const STAGE_ORDER = ['GROUP_STAGE', 'ROUND_OF_32', 'ROUND_OF_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'THIRD_PLACE', 'FINAL'];
const STAGE_LABELS: Record<string, string> = {
  GROUP_STAGE:    'Groups',
  ROUND_OF_32:    'Rd 32',
  ROUND_OF_16:    'Rd 16',
  QUARTER_FINALS: 'QF',
  SEMI_FINALS:    'SF',
  THIRD_PLACE:    '3rd Place',
  FINAL:          'Final',
};

function getLockStatus(kickoff: string): { locked: boolean; locksInMin: number | null } {
  const lockAt = new Date(kickoff).getTime() - LOCK_BEFORE_MS;
  const now = Date.now();
  if (lockAt <= now) return { locked: true, locksInMin: null };
  return { locked: false, locksInMin: Math.ceil((lockAt - now) / 60_000) };
}

type DateGroup = { dateKey: string; label: string; fixtures: Fixture[] };
type MatchdayGroup = {
  matchday: number;
  dateGroups: DateGroup[];
  liveCount: number;
  finishedCount: number;
  totalCount: number;
};
type StageGroup = { stage: string; fixtures: Fixture[] };

function formatDateLabel(dateKey: string): string {
  const d = new Date(dateKey + 'T12:00:00Z');
  return d.toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
  });
}

export default function PredictPage() {
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [preds, setPreds] = useState<Record<number, Pred>>({});
  const [localEdits, setLocalEdits] = useState<Record<number, {home: string; away: string}>>({});
  const [saveAllState, setSaveAllState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [loading, setLoading] = useState(true);
  const [activeStage, setActiveStage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<number | null>(null);
  const [activeDay, setActiveDay] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    setUserId(u.user.id);

    const { data: fx } = await supabase
      .from('fixtures')
      .select(
        `id, stage, matchday, group_label, kickoff, status, home_score, away_score,
         home_team:teams!fixtures_home_team_id_fkey (id, name, tla, crest),
         away_team:teams!fixtures_away_team_id_fkey (id, name, tla, crest)`
      )
      .order('kickoff', { ascending: true });

    const { data: mp } = await supabase
      .from('match_predictions')
      .select('fixture_id, home_pred, away_pred, points')
      .eq('user_id', u.user.id);

    setFixtures((fx as unknown as Fixture[]) ?? []);
    const map: Record<number, Pred> = {};
    for (const p of (mp as Pred[]) ?? []) map[p.fixture_id] = p;
    setPreds(map);
    const initEdits: Record<number, {home: string; away: string}> = {};
    for (const p of (mp as Pred[]) ?? []) {
      initEdits[p.fixture_id] = { home: String(p.home_pred), away: String(p.away_pred) };
    }
    setLocalEdits(initEdits);
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
    return STAGE_ORDER
      .filter((s) => byStage.has(s))
      .map((s) => ({ stage: s, fixtures: byStage.get(s)! }));
  }, [fixtures]);

  // Auto-select stage: default GROUP_STAGE, or first stage with live games
  useEffect(() => {
    if (activeStage !== null || stageGroups.length === 0) return;
    for (const sg of stageGroups) {
      if (sg.fixtures.some((f) => LIVE.has(f.status))) { setActiveStage(sg.stage); return; }
    }
    const gs = stageGroups.find((sg) => sg.stage === 'GROUP_STAGE');
    setActiveStage(gs ? 'GROUP_STAGE' : stageGroups[0].stage);
  }, [stageGroups, activeStage]);

  // Reset matchday/day tabs when stage changes
  useEffect(() => {
    setActiveTab(null);
    setActiveDay(null);
  }, [activeStage]);

  const isGroupStage = activeStage === 'GROUP_STAGE';
  const activeStageFixtures = useMemo(
    () => stageGroups.find((sg) => sg.stage === activeStage)?.fixtures ?? [],
    [stageGroups, activeStage]
  );

  // Group stage: group by matchday → date
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
      .map(([md, dayMap]) => {
        const all = [...dayMap.values()].flat();
        return {
          matchday: md,
          liveCount: all.filter((f) => LIVE.has(f.status)).length,
          finishedCount: all.filter((f) => f.status === 'FINISHED').length,
          totalCount: all.length,
          dateGroups: [...dayMap.entries()]
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([dateKey, fxs]) => ({
              dateKey,
              label: formatDateLabel(dateKey),
              fixtures: [...fxs].sort((a, b) => a.kickoff.localeCompare(b.kickoff)),
            })),
        };
      });
  }, [activeStageFixtures, isGroupStage]);

  // Knockout: just sorted by kickoff
  const knockoutFixtures = useMemo(() => {
    if (isGroupStage) return [];
    return [...activeStageFixtures].sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  }, [activeStageFixtures, isGroupStage]);

  // Auto-select matchday: live → nearest upcoming → last
  useEffect(() => {
    if (activeTab !== null || matchdayGroups.length === 0) return;
    const now = Date.now();
    for (const mg of matchdayGroups) {
      if (mg.liveCount > 0) { setActiveTab(mg.matchday); return; }
    }
    for (const mg of matchdayGroups) {
      if (mg.dateGroups.some((dg) => dg.fixtures.some((f) => new Date(f.kickoff).getTime() > now))) {
        setActiveTab(mg.matchday); return;
      }
    }
    setActiveTab(matchdayGroups.at(-1)!.matchday);
  }, [matchdayGroups, activeTab]);

  const activeGroup = matchdayGroups.find((mg) => mg.matchday === activeTab);

  // Reset active day when matchday changes
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

  function prevDay() {
    if (!activeGroup || activeDayIdx <= 0) return;
    setActiveDay(activeGroup.dateGroups[activeDayIdx - 1].dateKey);
  }
  function nextDay() {
    if (!activeGroup || activeDayIdx >= totalDays - 1) return;
    setActiveDay(activeGroup.dateGroups[activeDayIdx + 1].dateKey);
  }

  async function saveAll(fixtureList: Fixture[]) {
    const rows: { user_id: string; fixture_id: number; home_pred: number; away_pred: number }[] = [];
    for (const f of fixtureList) {
      if (getLockStatus(f.kickoff).locked) continue;
      const edit = localEdits[f.id];
      const existing = preds[f.id];
      const h = edit?.home ?? (existing ? String(existing.home_pred) : '');
      const a = edit?.away ?? (existing ? String(existing.away_pred) : '');
      if (h === '' || a === '') continue;
      const hp = parseInt(h, 10);
      const ap = parseInt(a, 10);
      if (isNaN(hp) || isNaN(ap)) continue;
      rows.push({ user_id: userId!, fixture_id: f.id, home_pred: hp, away_pred: ap });
    }
    if (rows.length === 0) return;
    setSaveAllState('saving');
    const { error } = await supabase
      .from('match_predictions')
      .upsert(rows, { onConflict: 'user_id,fixture_id' });
    if (error) { setSaveAllState('error'); return; }
    setSaveAllState('saved');
    setPreds((prev) => {
      const next = { ...prev };
      for (const row of rows) {
        next[row.fixture_id] = {
          fixture_id: row.fixture_id,
          home_pred: row.home_pred,
          away_pred: row.away_pred,
          points: prev[row.fixture_id]?.points ?? null,
        };
      }
      return next;
    });
    setTimeout(() => setSaveAllState('idle'), 2000);
  }

  // Unpredicted upcoming fixtures (not locked, no prediction yet)
  const unpredictedCount = useMemo(() => {
    return fixtures.filter((f) => {
      if (getLockStatus(f.kickoff).locked) return false;
      if (f.status === 'FINISHED') return false;
      return !preds[f.id];
    }).length;
  }, [fixtures, preds]);

  if (loading) {
    return <p className="py-20 text-center font-mono text-base text-chalk">Loading fixtures…</p>;
  }

  if (fixtures.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-white/10 bg-pitch-900/60 p-10 text-chalk">
        <p className="font-display text-xl uppercase text-chalk">No fixtures yet</p>
        <p className="mt-2 text-base">
          Run <code className="rounded bg-pitch-700 px-1.5 py-0.5 font-mono text-lime">npm run seed</code>{' '}
          to import the World Cup schedule.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center gap-3 mb-1">
        <span className="text-lime">
          <HugeiconsIcon icon={DartIcon} size={18} color="currentColor" strokeWidth={1.5} />
        </span>
        <p className="font-display text-base tracking-[0.28em] uppercase text-lime">Your picks</p>
      </div>
      <h1 className="font-display text-4xl uppercase text-chalk">Predict</h1>
      <p className="mt-1 text-base text-chalk">
        Call the scoreline for every game. Locks at kickoff — no edits after.
      </p>

      {/* Unpredicted fixtures warning */}
      {unpredictedCount > 0 && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-flame/30 bg-flame/10 px-4 py-3">
          <span className="text-xl">⚠️</span>
          <p className="font-display text-base uppercase tracking-wide text-flame">
            {unpredictedCount} fixture{unpredictedCount !== 1 ? 's' : ''} without a prediction
            {unpredictedCount === 1 ? ' — get your call in before the whistle.' : ' — get your calls in before kick-off.'}
          </p>
        </div>
      )}

      {/* Stage tabs — only shown when multiple stages have fixtures */}
      {stageGroups.length > 1 && (
        <div className="mt-6 flex w-full border-b border-white/10">
          {stageGroups.map((sg) => {
            const active = sg.stage === activeStage;
            const liveCount = sg.fixtures.filter((f) => LIVE.has(f.status)).length;
            const doneCount = sg.fixtures.filter((f) => f.status === 'FINISHED').length;
            const remaining = sg.fixtures.length - liveCount - doneCount;
            return (
              <button
                key={sg.stage}
                onClick={() => setActiveStage(sg.stage)}
                className={[
                  'flex flex-1 flex-col items-center pb-3 pt-2 relative transition-colors',
                  active ? 'text-lime' : 'text-chalk hover:text-lime',
                ].join(' ')}
              >
                <span className="font-display text-base uppercase tracking-wide">
                  {STAGE_LABELS[sg.stage] ?? sg.stage}
                </span>
                <span className="mt-0.5 font-mono text-sm">
                  {liveCount > 0 ? (
                    <span className="flex items-center gap-1 text-flame">
                      <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-flame" />
                      {liveCount} live
                    </span>
                  ) : remaining === 0 ? (
                    <span className="text-chalk">Done</span>
                  ) : (
                    <span className="text-chalk">{remaining} left</span>
                  )}
                </span>
                {active && (
                  <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-lime" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* GROUP STAGE: matchday tabs + day cycler */}
      {isGroupStage && (
        <>
          <div className={`flex w-full border-b border-white/10 ${stageGroups.length > 1 ? 'mt-4' : 'mt-6'}`}>
            {matchdayGroups.map((mg) => {
              const active = mg.matchday === activeTab;
              const done = mg.finishedCount === mg.totalCount;
              const upcoming = mg.totalCount - mg.liveCount - mg.finishedCount;
              return (
                <button
                  key={mg.matchday}
                  onClick={() => setActiveTab(mg.matchday)}
                  className={[
                    'flex flex-1 flex-col items-center pb-4 pt-3 transition-colors relative',
                    active ? 'text-lime' : 'text-chalk hover:text-chalk',
                  ].join(' ')}
                >
                  <span className="font-display text-sm uppercase tracking-[0.2em]">Matchday</span>
                  <span className="font-display text-3xl">{mg.matchday}</span>
                  <span className="mt-1 font-mono text-sm">
                    {mg.liveCount > 0 ? (
                      <span className="flex items-center gap-1 text-flame">
                        <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-flame" />
                        {mg.liveCount} live
                      </span>
                    ) : done ? (
                      <span className="text-chalk">Done</span>
                    ) : (
                      <span className="text-chalk">{upcoming} left</span>
                    )}
                  </span>
                  {active && (
                    <span className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full bg-lime" />
                  )}
                </button>
              );
            })}
          </div>

          {activeGroup && (
            <div className="mt-6">
              <div className="flex items-center gap-4">
                <button
                  onClick={prevDay}
                  disabled={activeDayIdx <= 0}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-chalk transition hover:border-white/30 disabled:opacity-20"
                  aria-label="Previous day"
                >
                  ←
                </button>
                <div className="flex-1 text-center">
                  <p className="font-display text-base uppercase tracking-widest text-chalk">
                    {activeDayGroup?.label ?? '—'}
                  </p>
                  <p className="font-mono text-base text-chalk">
                    {activeDayGroup?.fixtures.length ?? 0} matches
                    {totalDays > 1 && (
                      <span className="ml-2 text-chalk">
                        Day {activeDayIdx + 1} of {totalDays}
                      </span>
                    )}
                  </p>
                </div>
                <button
                  onClick={nextDay}
                  disabled={activeDayIdx >= totalDays - 1}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-chalk transition hover:border-white/30 disabled:opacity-20"
                  aria-label="Next day"
                >
                  →
                </button>
              </div>

              {totalDays > 1 && (
                <div className="mt-3 flex justify-center gap-1.5">
                  {activeGroup.dateGroups.map((dg, i) => (
                    <button
                      key={dg.dateKey}
                      onClick={() => setActiveDay(dg.dateKey)}
                      className={[
                        'h-1.5 rounded-full transition-all',
                        i === activeDayIdx ? 'w-6 bg-lime' : 'w-1.5 bg-white/20 hover:bg-white/40',
                      ].join(' ')}
                      aria-label={dg.label}
                    />
                  ))}
                </div>
              )}

              <div className="mt-6 space-y-2.5">
                {activeDayGroup?.fixtures.map((f) => (
                  <FixtureRow
                    key={f.id}
                    fixture={f}
                    pred={preds[f.id]}
                    userId={userId!}
                    supabase={supabase}
                    onSaved={(p) => setPreds((prev) => ({ ...prev, [f.id]: p }))}
                    onEdit={(id, h, a) => setLocalEdits((prev) => ({ ...prev, [id]: { home: h, away: a } }))}
                  />
                ))}
              </div>
              {(activeDayGroup?.fixtures.length ?? 0) > 1 && (
                <SaveAllBar
                  fixtures={activeDayGroup?.fixtures ?? []}
                  state={saveAllState}
                  onSaveAll={saveAll}
                />
              )}
            </div>
          )}
        </>
      )}

      {/* KNOCKOUT STAGE: flat list */}
      {!isGroupStage && (
        <div className="mt-6">
          {knockoutFixtures.length === 0 ? (
            <p className="py-10 text-center text-base text-chalk">
              Fixtures for this round will appear once the previous round is complete.
            </p>
          ) : (
            <>
              <div className="space-y-2.5">
                {knockoutFixtures.map((f) => (
                  <FixtureRow
                    key={f.id}
                    fixture={f}
                    pred={preds[f.id]}
                    userId={userId!}
                    supabase={supabase}
                    onSaved={(p) => setPreds((prev) => ({ ...prev, [f.id]: p }))}
                    onEdit={(id, h, a) => setLocalEdits((prev) => ({ ...prev, [id]: { home: h, away: a } }))}
                  />
                ))}
              </div>
              {knockoutFixtures.length > 1 && (
                <SaveAllBar
                  fixtures={knockoutFixtures}
                  state={saveAllState}
                  onSaveAll={saveAll}
                />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function FixtureRow({
  fixture, pred, userId, supabase, onSaved, onEdit,
}: {
  fixture: Fixture;
  pred?: Pred;
  userId: string;
  supabase: ReturnType<typeof createClient>;
  onSaved: (p: Pred) => void;
  onEdit?: (fixtureId: number, home: string, away: string) => void;
}) {
  const { locked, locksInMin } = getLockStatus(fixture.kickoff);
  const finished = fixture.status === 'FINISHED';
  const live = LIVE.has(fixture.status);
  const closingWarning = !locked && locksInMin !== null && locksInMin <= 30;

  const [home, setHome] = useState<string>(pred ? String(pred.home_pred) : '');
  const [away, setAway] = useState<string>(pred ? String(pred.away_pred) : '');

  function handleHomeChange(v: string) { setHome(v); onEdit?.(fixture.id, v, away); }
  function handleAwayChange(v: string) { setAway(v); onEdit?.(fixture.id, home, v); }
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  async function save() {
    if (home === '' || away === '') return;
    setState('saving');
    const row = {
      user_id: userId,
      fixture_id: fixture.id,
      home_pred: Math.max(0, Math.min(30, parseInt(home, 10))),
      away_pred: Math.max(0, Math.min(30, parseInt(away, 10))),
    };
    const { error } = await supabase
      .from('match_predictions')
      .upsert(row, { onConflict: 'user_id,fixture_id' });
    if (error) {
      setState('error');
    } else {
      setState('saved');
      onSaved({ ...row, points: pred?.points ?? null });
      setTimeout(() => setState('idle'), 1500);
    }
  }

  const ko = new Date(fixture.kickoff);
  const koTime = ko.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={`rounded-2xl border-2 p-10 transition-colors focus-within:border-gold/60 ${
      live
        ? 'border-lime/25 bg-pitch-900/80'
        : finished
        ? 'border-white/8 bg-pitch-900/30'
        : 'border-white/10 bg-pitch-900/60'
    }`}>
      {/* Top bar: group + status/time */}
      <div className="mb-3 flex items-center justify-between">
        <span className="font-display text-sm uppercase tracking-[0.22em] text-chalk">
          {fixture.group_label ? `Group ${fixture.group_label}` : ''}
        </span>
        <span className="flex items-center gap-1.5 font-display text-sm uppercase tracking-widest text-chalk">
          {live && <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-flame" />}
          {live ? (
            <span className="text-flame">Live</span>
          ) : finished ? (
            <span className="text-chalk">Full time</span>
          ) : (
            koTime
          )}
        </span>
      </div>

      {/* Teams + score inputs */}
      {/* Mobile: full team names on top row, score inputs below */}
      <div className="mt-2 sm:hidden space-y-3">
        <div className="flex items-center justify-between gap-2">
          <TeamSide team={fixture.home_team} align="left" compact />
          <TeamSide team={fixture.away_team} align="right" compact />
        </div>
        <div className="flex items-center justify-center gap-2">
          <ScoreBox value={home} setValue={handleHomeChange} disabled={locked} onCommit={save} />
          <span className="font-display text-lg text-chalk">–</span>
          <ScoreBox value={away} setValue={handleAwayChange} disabled={locked} onCommit={save} />
        </div>
      </div>
      {/* Desktop: 3-column with TLA */}
      <div className="mt-2 hidden sm:grid sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-4">
        <TeamSide team={fixture.home_team} align="left" />
        <div className="flex items-center gap-2">
          <ScoreBox value={home} setValue={handleHomeChange} disabled={locked} onCommit={save} />
          <span className="font-display text-lg text-chalk">–</span>
          <ScoreBox value={away} setValue={handleAwayChange} disabled={locked} onCommit={save} />
        </div>
        <TeamSide team={fixture.away_team} align="right" />
      </div>

      {/* Bottom bar: action + result */}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {!locked ? (
            <button
              onClick={save}
              disabled={home === '' || away === '' || state === 'saving'}
              className="flex h-8 items-center rounded-full bg-lime/15 px-4 font-body text-base tracking-wide text-lime transition hover:bg-lime/25 disabled:opacity-30"
            >
              {state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved ✓' : pred ? 'Update' : 'Save pick'}
            </button>
          ) : (
            <span className="flex items-center gap-1.5 font-display text-base uppercase tracking-widest text-chalk">
              <HugeiconsIcon icon={LockIcon} size={12} color="currentColor" strokeWidth={2} />
              Locked
            </span>
          )}
          {closingWarning && (
            <span className="flex items-center gap-1 rounded-full border border-gold/30 bg-gold/10 px-2.5 py-0.5 font-mono text-sm text-gold">
              <HugeiconsIcon icon={LockIcon} size={10} color="currentColor" strokeWidth={2} />
              Locks in {locksInMin}m
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 font-mono text-base">
          {finished && (
            <span className="text-chalk">
              {fixture.home_score}–{fixture.away_score}
            </span>
          )}
          {finished && <PointsBadge points={pred?.points ?? null} hasPick={!!pred} />}
          {state === 'error' && <span className="text-flame">Couldn&apos;t save</span>}
        </div>
      </div>

      {locked && <CommunityPicks fixtureId={fixture.id} supabase={supabase} />}
    </div>
  );
}

function TeamSide({ team, align, compact = false }: { team: Team | null; align: 'left' | 'right'; compact?: boolean }) {
  return (
    <div className={`flex min-w-0 items-center gap-2 ${align === 'right' ? 'flex-row-reverse text-right' : ''} ${compact ? 'flex-1' : ''}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {team?.crest ? (
        <img src={team.crest} alt="" className={`shrink-0 object-contain ${compact ? 'h-6 w-6' : 'h-8 w-8'}`} />
      ) : (
        <span className={`shrink-0 rounded-full bg-pitch-700 ${compact ? 'h-6 w-6' : 'h-8 w-8'}`} />
      )}
      <span className={`font-display uppercase leading-snug text-chalk ${compact ? 'text-sm' : 'text-base'}`}>
        {team?.name || 'TBD'}
      </span>
    </div>
  );
}

function SaveAllBar({
  fixtures, state, onSaveAll,
}: {
  fixtures: Fixture[];
  state: 'idle' | 'saving' | 'saved' | 'error';
  onSaveAll: (fixtures: Fixture[]) => void;
}) {
  const unlocked = fixtures.filter((f) => !getLockStatus(f.kickoff).locked);
  if (unlocked.length < 2) return null;
  return (
    <div className="mt-4 flex items-center justify-center gap-3">
      <button
        onClick={() => onSaveAll(fixtures)}
        disabled={state === 'saving'}
        className="rounded-full border-2 border-lime/30 bg-lime/10 px-8 py-2.5 font-body font-bold text-base uppercase tracking-wide text-lime transition hover:bg-lime/20 disabled:opacity-40"
      >
        {state === 'saving' ? 'Saving all…' : state === 'saved' ? 'All saved ✓' : 'Save all picks'}
      </button>
      {state === 'error' && <span className="font-mono text-sm text-flame">Couldn&apos;t save</span>}
    </div>
  );
}

function ScoreBox({ value, setValue, disabled, onCommit }: {
  value: string; setValue: (v: string) => void; disabled: boolean; onCommit: () => void;
}) {
  return (
    <input
      type="number"
      inputMode="numeric"
      min={0}
      max={30}
      value={value}
      disabled={disabled}
      onChange={(e) => setValue(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
      onBlur={onCommit}
      className="h-12 w-12 rounded-xl border-2 border-white/15 bg-pitch-800 text-center font-display text-xl text-chalk outline-none transition focus:border-gold disabled:opacity-50"
      placeholder="–"
    />
  );
}

function CommunityPicks({
  fixtureId,
  supabase,
}: {
  fixtureId: number;
  supabase: ReturnType<typeof createClient>;
}) {
  const [picks, setPicks] = useState<{ label: string; count: number; pct: number }[] | null>(null);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    supabase
      .from('match_predictions')
      .select('home_pred, away_pred')
      .eq('fixture_id', fixtureId)
      .then(({ data }) => {
        if (!data?.length) { setPicks([]); return; }
        const counts: Record<string, number> = {};
        for (const p of data) {
          const key = `${p.home_pred}–${p.away_pred}`;
          counts[key] = (counts[key] ?? 0) + 1;
        }
        const tot = data.length;
        setTotal(tot);
        setPicks(
          Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([label, count]) => ({ label, count, pct: Math.round((count / tot) * 100) }))
        );
      });
  }, [fixtureId, supabase]);

  if (picks === null) return (
    <div className="mt-4 border-t border-white/10 pt-3">
      <p className="font-mono text-sm text-chalk">Loading community picks…</p>
    </div>
  );
  if (picks.length === 0) return null;

  return (
    <div className="mt-4 border-t border-white/10 pt-3">
      <p className="mb-2.5 font-mono text-sm uppercase tracking-widest text-chalk">
        Community picks <span className="text-chalk">· {total} prediction{total !== 1 ? 's' : ''}</span>
      </p>
      <div className="space-y-2">
        {picks.map(({ label, pct }, i) => (
          <div key={label} className="flex items-center gap-3">
            <span className={`w-10 shrink-0 font-display text-base uppercase ${i === 0 ? 'text-lime' : 'text-chalk'}`}>
              {label}
            </span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full rounded-full transition-all ${i === 0 ? 'bg-lime' : 'bg-white/30'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className={`w-9 shrink-0 text-right font-mono text-sm ${i === 0 ? 'text-lime' : 'text-chalk'}`}>
              {pct}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PointsBadge({ points, hasPick }: { points: number | null; hasPick: boolean }) {
  if (!hasPick) return <span className="rounded-full bg-pitch-700/80 px-2.5 py-0.5 text-chalk">No pick</span>;
  if (points === null) return <span className="rounded-full bg-pitch-700/80 px-2.5 py-0.5 text-chalk">Pending</span>;
  const tone =
    points === 5 ? 'bg-lime text-pitch-950 font-bold'
    : points === 1 ? 'bg-lime/20 text-lime'
    : 'bg-flame/20 text-flame';
  return <span className={`rounded-full px-2.5 py-0.5 font-display ${tone}`}>+{points}</span>;
}
