'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { HugeiconsIcon } from '@hugeicons/react';
import { LockIcon, DartIcon } from '@hugeicons-pro/core-stroke-rounded';

type Team = { id: number; name: string; tla: string | null; crest: string | null };
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
type Pred = { fixture_id: number; home_pred: number; away_pred: number; points: number | null };

const LIVE = new Set(['IN_PLAY', 'PAUSED']);
const LOCK_BEFORE_MS = 15 * 60_000; // predictions lock 15 min before kickoff

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
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<number | null>(null);
  const [activeDay, setActiveDay] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    setUserId(u.user.id);

    const { data: fx } = await supabase
      .from('fixtures')
      .select(
        `id, matchday, group_label, kickoff, status, home_score, away_score,
         home_team:teams!fixtures_home_team_id_fkey (id, name, tla, crest),
         away_team:teams!fixtures_away_team_id_fkey (id, name, tla, crest)`
      )
      .eq('stage', 'GROUP_STAGE')
      .order('kickoff', { ascending: true });

    const { data: mp } = await supabase
      .from('match_predictions')
      .select('fixture_id, home_pred, away_pred, points')
      .eq('user_id', u.user.id);

    setFixtures((fx as unknown as Fixture[]) ?? []);
    const map: Record<number, Pred> = {};
    for (const p of (mp as Pred[]) ?? []) map[p.fixture_id] = p;
    setPreds(map);
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
  }, [fixtures]);

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

  // Reset active day whenever matchday changes
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

  if (loading) {
    return <p className="py-20 text-center font-mono text-base text-chalk/40">Loading fixtures…</p>;
  }

  if (fixtures.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-pitch-900/60 p-6 text-chalk/70">
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
      <p className="mt-1 text-base text-chalk/55">
        Call the scoreline for every group game. Locks at kickoff — no edits after.
      </p>

      {/* Evenly-spaced matchday tabs */}
      <div className="mt-6 flex w-full border-b border-white/10">
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
                active ? 'text-lime' : 'text-chalk/50 hover:text-chalk',
              ].join(' ')}
            >
              <span className="font-display text-[10px] uppercase tracking-[0.2em]">Matchday</span>
              <span className="font-display text-3xl">{mg.matchday}</span>
              <span className="mt-1 font-mono text-[10px]">
                {mg.liveCount > 0 ? (
                  <span className="flex items-center gap-1 text-flame">
                    <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-flame" />
                    {mg.liveCount} live
                  </span>
                ) : done ? (
                  <span className="text-chalk/25">Done</span>
                ) : (
                  <span className="text-chalk/35">{upcoming} left</span>
                )}
              </span>
              {active && (
                <span className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full bg-lime" />
              )}
            </button>
          );
        })}
      </div>

      {/* Day cycler */}
      {activeGroup && (
        <div className="mt-6">
          <div className="flex items-center gap-4">
            <button
              onClick={prevDay}
              disabled={activeDayIdx <= 0}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-chalk/50 transition hover:border-white/30 hover:text-chalk disabled:opacity-20"
              aria-label="Previous day"
            >
              ←
            </button>
            <div className="flex-1 text-center">
              <p className="font-display text-base uppercase tracking-widest text-chalk">
                {activeDayGroup?.label ?? '—'}
              </p>
              <p className="font-mono text-base text-chalk/35">
                {activeDayGroup?.fixtures.length ?? 0} matches
                {totalDays > 1 && (
                  <span className="ml-2 text-chalk/25">
                    Day {activeDayIdx + 1} of {totalDays}
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={nextDay}
              disabled={activeDayIdx >= totalDays - 1}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-chalk/50 transition hover:border-white/30 hover:text-chalk disabled:opacity-20"
              aria-label="Next day"
            >
              →
            </button>
          </div>

          {/* Dot indicators */}
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

          {/* Fixtures for the active day */}
          <div className="mt-6 space-y-2.5">
            {activeDayGroup?.fixtures.map((f) => (
              <FixtureRow
                key={f.id}
                fixture={f}
                pred={preds[f.id]}
                userId={userId!}
                supabase={supabase}
                onSaved={(p) => setPreds((prev) => ({ ...prev, [f.id]: p }))}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FixtureRow({
  fixture, pred, userId, supabase, onSaved,
}: {
  fixture: Fixture;
  pred?: Pred;
  userId: string;
  supabase: ReturnType<typeof createClient>;
  onSaved: (p: Pred) => void;
}) {
  const { locked, locksInMin } = getLockStatus(fixture.kickoff);
  const finished = fixture.status === 'FINISHED';
  const live = LIVE.has(fixture.status);
  const closingWarning = !locked && locksInMin !== null && locksInMin <= 30;

  const [home, setHome] = useState<string>(pred ? String(pred.home_pred) : '');
  const [away, setAway] = useState<string>(pred ? String(pred.away_pred) : '');
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
    <div className={`rounded-2xl border p-4 transition-colors ${
      live
        ? 'border-lime/25 bg-pitch-900/80'
        : finished
        ? 'border-white/6 bg-pitch-900/30'
        : 'border-white/10 bg-pitch-900/60'
    }`}>
      {/* Top bar: group + status/time */}
      <div className="mb-3 flex items-center justify-between">
        <span className="font-display text-[11px] uppercase tracking-[0.22em] text-chalk/40">
          {fixture.group_label ? `Group ${fixture.group_label}` : ''}
        </span>
        <span className="flex items-center gap-1.5 font-display text-[11px] uppercase tracking-widest text-chalk/40">
          {live && <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-flame" />}
          {live ? (
            <span className="text-flame">Live</span>
          ) : finished ? (
            <span className="text-chalk/30">Full time</span>
          ) : (
            koTime
          )}
        </span>
      </div>

      {/* Teams + score inputs */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <TeamSide team={fixture.home_team} align="left" />
        <div className="flex items-center gap-2">
          <ScoreBox value={home} setValue={setHome} disabled={locked} onCommit={save} />
          <span className="font-display text-lg text-chalk/25">–</span>
          <ScoreBox value={away} setValue={setAway} disabled={locked} onCommit={save} />
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
              className="flex h-8 items-center rounded-full bg-lime/15 px-4 font-display text-base uppercase tracking-wide text-lime transition hover:bg-lime/25 disabled:opacity-30"
            >
              {state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved ✓' : pred ? 'Update' : 'Save pick'}
            </button>
          ) : (
            <span className="flex items-center gap-1.5 font-display text-base uppercase tracking-widest text-chalk/30">
              <HugeiconsIcon icon={LockIcon} size={12} color="currentColor" strokeWidth={2} />
              Locked
            </span>
          )}
          {closingWarning && (
            <span className="flex items-center gap-1 rounded-full border border-gold/30 bg-gold/10 px-2.5 py-0.5 font-mono text-[10px] text-gold">
              <HugeiconsIcon icon={LockIcon} size={10} color="currentColor" strokeWidth={2} />
              Locks in {locksInMin}m
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 font-mono text-base">
          {finished && (
            <span className="text-chalk/40">
              {fixture.home_score}–{fixture.away_score}
            </span>
          )}
          {finished && <PointsBadge points={pred?.points ?? null} hasPick={!!pred} />}
          {state === 'error' && <span className="text-flame">Couldn&apos;t save</span>}
        </div>
      </div>
    </div>
  );
}

function TeamSide({ team, align }: { team: Team | null; align: 'left' | 'right' }) {
  return (
    <div className={`flex min-w-0 items-center gap-2.5 ${align === 'right' ? 'flex-row-reverse text-right' : ''}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {team?.crest ? (
        <img src={team.crest} alt="" className="h-8 w-8 shrink-0 object-contain" />
      ) : (
        <span className="h-8 w-8 shrink-0 rounded-full bg-pitch-700" />
      )}
      <span className="truncate font-display text-base uppercase text-chalk">
        {team?.tla || team?.name || 'TBD'}
      </span>
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
      className="h-12 w-12 rounded-xl border border-white/15 bg-pitch-800 text-center font-mono text-xl text-chalk outline-none transition focus:border-lime/70 disabled:opacity-50"
      placeholder="–"
    />
  );
}

function PointsBadge({ points, hasPick }: { points: number | null; hasPick: boolean }) {
  if (!hasPick) return <span className="rounded-full bg-pitch-700/80 px-2.5 py-0.5 text-chalk/30">No pick</span>;
  if (points === null) return <span className="rounded-full bg-pitch-700/80 px-2.5 py-0.5 text-chalk/40">Pending</span>;
  const tone =
    points === 5 ? 'bg-lime text-pitch-950 font-bold'
    : points === 1 ? 'bg-lime/20 text-lime'
    : 'bg-flame/20 text-flame';
  return <span className={`rounded-full px-2.5 py-0.5 font-display ${tone}`}>+{points}</span>;
}
