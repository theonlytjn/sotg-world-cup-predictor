'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { scorePrediction } from '@/lib/scoring';
import { HugeiconsIcon } from '@hugeicons/react';
import { BarChartIcon, CrownIcon } from '@hugeicons-pro/core-stroke-rounded';

type Row = {
  user_id: string;
  display_name: string;
  total_points: number;
  exact_scores: number;
  correct_results: number;
  award_points: number;
};

type LiveFixture = {
  id: number;
  home_score: number | null;
  away_score: number | null;
};

type RawPred = {
  user_id: string;
  fixture_id: number;
  home_pred: number;
  away_pred: number;
};

type HistoryPred = {
  user_id: string;
  fixture_id: number;
  points: number;
};

type FixtureMd = { id: number; matchday: number | null };

type ChartPlayer = {
  userId: string;
  displayName: string;
  pts: Record<number, number>; // matchday → cumulative pts
};

const RANK_STYLES = [
  { text: 'text-gold',      crown: 'text-gold' },
  { text: 'text-[#cfd6da]', crown: 'text-[#cfd6da]' },
  { text: 'text-[#e0a86b]', crown: 'text-[#e0a86b]' },
];

const LINE_COLORS = [
  '#9fcc2f', '#ffd24a', '#ff5c38', '#60a5fa', '#a78bfa',
  '#34d399', '#f472b6', '#fb923c', '#22d3ee', '#facc15',
];

export default function LeaderboardPage() {
  const supabase   = useMemo(() => createClient(), []);
  const [myId, setMyId]           = useState<string | null>(null);
  const [rows, setRows]           = useState<Row[]>([]);
  const [liveBonus, setLiveBonus] = useState<Record<string, number>>({});
  const [isLive, setIsLive]       = useState(false);
  const [chartPlayers, setChartPlayers]   = useState<ChartPlayer[]>([]);
  const [allMatchdays, setAllMatchdays]   = useState<number[]>([]);
  const [loading, setLoading]     = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async () => {
    const [
      { data: u },
      { data: lb },
      { data: lf },
      { data: histPreds },
      { data: fixtureMds },
    ] = await Promise.all([
      supabase.auth.getUser(),
      supabase
        .from('leaderboard')
        .select('*')
        .order('total_points', { ascending: false })
        .order('exact_scores', { ascending: false }),
      supabase
        .from('fixtures')
        .select('id, home_score, away_score')
        .eq('status', 'IN_PLAY'),
      supabase
        .from('match_predictions')
        .select('user_id, fixture_id, points')
        .not('points', 'is', null),
      supabase
        .from('fixtures')
        .select('id, matchday')
        .not('matchday', 'is', null),
    ]);

    if (u.user) setMyId(u.user.id);

    const rowData = (lb as Row[]) ?? [];
    setRows(rowData);

    // ── Live projected bonus ──────────────────────────────────────
    const liveFixtures = (lf as LiveFixture[]) ?? [];
    const hasLive = liveFixtures.length > 0;
    setIsLive(hasLive);

    if (hasLive) {
      const liveIds = liveFixtures.map((f) => f.id);
      const { data: livePreds } = await supabase
        .from('match_predictions')
        .select('user_id, fixture_id, home_pred, away_pred')
        .in('fixture_id', liveIds);

      const bonus: Record<string, number> = {};
      for (const p of (livePreds as RawPred[]) ?? []) {
        const fix = liveFixtures.find((f) => f.id === p.fixture_id);
        if (!fix || fix.home_score == null || fix.away_score == null) continue;
        const pts = scorePrediction(p.home_pred, p.away_pred, fix.home_score, fix.away_score);
        bonus[p.user_id] = (bonus[p.user_id] ?? 0) + pts;
      }
      setLiveBonus(bonus);
    } else {
      setLiveBonus({});
    }

    // ── Standings chart ───────────────────────────────────────────
    const mdMap = new Map(
      ((fixtureMds as FixtureMd[]) ?? [])
        .filter((f) => f.matchday != null)
        .map((f) => [f.id, f.matchday!])
    );

    const nameMap = new Map(rowData.map((r) => [r.user_id, r.display_name]));

    // Group settled points by user + matchday
    const byUser = new Map<string, Record<number, number>>();
    for (const p of (histPreds as HistoryPred[]) ?? []) {
      const md = mdMap.get(p.fixture_id);
      if (!md) continue;
      if (!byUser.has(p.user_id)) byUser.set(p.user_id, {});
      byUser.get(p.user_id)![md] = (byUser.get(p.user_id)![md] ?? 0) + p.points;
    }

    // Matchdays with at least one settled prediction
    const settledDays = new Set<number>();
    for (const dayPts of byUser.values()) {
      for (const day of Object.keys(dayPts)) settledDays.add(Number(day));
    }
    const days = [...settledDays].sort((a, b) => a - b);

    // Compute cumulative per player
    const players: ChartPlayer[] = [];
    for (const [userId, dayPts] of byUser.entries()) {
      let cum = 0;
      const pts: Record<number, number> = {};
      for (const day of days) {
        cum += dayPts[day] ?? 0;
        pts[day] = cum;
      }
      players.push({ userId, displayName: nameMap.get(userId) ?? 'Unknown', pts });
    }
    // Sort by final cumulative desc
    players.sort((a, b) => {
      const last = days[days.length - 1];
      return (b.pts[last] ?? 0) - (a.pts[last] ?? 0);
    });

    setChartPlayers(players);
    setAllMatchdays(days);
    setLastUpdated(new Date());
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  // Sort rows with live bonus when live
  const displayRows = useMemo(() => {
    if (!isLive || !Object.keys(liveBonus).length) return rows;
    return [...rows].sort((a, b) => {
      const totalA = a.total_points + (liveBonus[a.user_id] ?? 0);
      const totalB = b.total_points + (liveBonus[b.user_id] ?? 0);
      if (totalB !== totalA) return totalB - totalA;
      return b.exact_scores - a.exact_scores;
    });
  }, [rows, liveBonus, isLive]);

  if (loading) {
    return <p className="py-20 text-center font-mono text-base text-chalk">Loading…</p>;
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-1 flex items-center gap-3">
        <span className="text-lime">
          <HugeiconsIcon icon={BarChartIcon} size={18} color="currentColor" strokeWidth={1.5} />
        </span>
        <p className="font-display text-base uppercase tracking-[0.28em] text-lime">
          {isLive ? 'Live standings' : 'Standings'}
        </p>
        {isLive && (
          <span className="flex items-center gap-1.5 rounded-full bg-flame/15 px-2.5 py-0.5">
            <span className="live-dot h-1.5 w-1.5 rounded-full bg-flame" />
            <span className="font-mono text-sm uppercase tracking-widest text-flame">Live</span>
          </span>
        )}
        {lastUpdated && !isLive && (
          <span className="ml-auto font-mono text-sm text-chalk">
            Refreshes every 30s
          </span>
        )}
      </div>
      <h1 className="font-display text-4xl uppercase text-chalk">The Table</h1>
      {isLive && (
        <p className="mt-1 text-base text-chalk">
          Live projected scores shown in orange — updates every 30 seconds.
        </p>
      )}

      {/* Table */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-white/20">
        <div className="grid grid-cols-[2.5rem_1fr_3.5rem_3.5rem_3.5rem_5.5rem] items-center gap-2 border-b border-white/20 bg-pitch-800 px-5 py-3.5 font-display text-sm font-bold uppercase tracking-widest text-chalk">
          <span>#</span>
          <span>Player</span>
          <span className="text-center">5pt</span>
          <span className="text-center">1pt</span>
          <span className="text-center">Awds</span>
          <span className="text-right">Total</span>
        </div>

        {displayRows.length === 0 && (
          <p className="px-5 py-10 text-center text-base text-chalk">
            No players yet — be the first to make a pick.
          </p>
        )}

        {displayRows.map((r, i) => {
          const isMe = r.user_id === myId;
          const rankStyle = RANK_STYLES[i];
          const bonus = liveBonus[r.user_id] ?? 0;
          const liveTotal = r.total_points + bonus;

          return (
            <div
              key={r.user_id}
              className={[
                'grid grid-cols-[2.5rem_1fr_3.5rem_3.5rem_3.5rem_5.5rem] items-center gap-2 border-t border-white/15 px-5 py-4 transition-colors',
                isMe ? 'bg-lime/5' : i < 3 ? 'bg-pitch-900/40' : '',
              ].join(' ')}
            >
              {/* Rank */}
              <div className="flex items-center">
                {i < 3 ? (
                  <span className={rankStyle.crown}>
                    <HugeiconsIcon icon={CrownIcon} size={18} color="currentColor" strokeWidth={1.5} />
                  </span>
                ) : (
                  <span className="font-display text-lg font-black text-chalk">{i + 1}</span>
                )}
              </div>

              {/* Name — Boldonse, slightly smaller */}
              <span className={[
                'truncate font-display text-sm font-bold uppercase tracking-wide',
                rankStyle ? rankStyle.text : 'text-chalk',
              ].join(' ')}>
                {r.display_name}
                {isMe && (
                  <span className="ml-2 rounded-full bg-lime/20 px-2 py-0.5 font-display text-xs font-bold uppercase tracking-widest text-lime">
                    you
                  </span>
                )}
              </span>

              <span className="text-center font-display font-black text-base text-chalk">{r.exact_scores}</span>
              <span className="text-center font-display font-black text-base text-chalk">{r.correct_results}</span>
              <span className="text-center font-display font-black text-base text-chalk">{r.award_points}</span>

              {/* Total + live bonus */}
              <div className="flex flex-col items-end">
                <span className={[
                  'font-display text-2xl font-black',
                  rankStyle ? rankStyle.text : 'text-chalk',
                ].join(' ')}>
                  {isLive ? liveTotal : r.total_points}
                </span>
                {isLive && bonus !== 0 && (
                  <span className={[
                    'font-mono text-sm font-semibold',
                    bonus > 0 ? 'text-flame' : 'text-chalk',
                  ].join(' ')}>
                    {bonus > 0 ? `+${bonus}` : bonus} live
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Standings chart */}
      <section className="mt-8">
        <div className="mb-3 flex items-center gap-3">
          <h2 className="font-display text-2xl uppercase text-lime">Standings over time</h2>
          <span className="h-px flex-1 bg-white/10" />
        </div>
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-pitch-900/60 p-5">
          <StandingsChart players={chartPlayers} matchdays={allMatchdays} />
        </div>
      </section>
    </div>
  );
}

function StandingsChart({
  players,
  matchdays,
}: {
  players: ChartPlayer[];
  matchdays: number[];
}) {
  if (!matchdays.length || !players.length) {
    return (
      <div className="flex h-44 items-center justify-center">
        <p className="font-mono text-base text-chalk">Chart available once the first matchday is settled</p>
      </div>
    );
  }

  const W = 800, H = 260;
  const PAD = { top: 20, right: 120, bottom: 32, left: 40 };
  const iW = W - PAD.left - PAD.right;
  const iH = H - PAD.top - PAD.bottom;

  const maxPts = Math.max(...players.flatMap((p) => Object.values(p.pts)), 1);
  const mFirst = matchdays[0];
  const mLast  = matchdays[matchdays.length - 1];
  const xRange = Math.max(1, mLast - mFirst);

  const X = (day: number) => PAD.left + ((day - mFirst) / xRange) * iW;
  const Y = (pts: number) => PAD.top + iH - (pts / maxPts) * iH;

  // 5 horizontal grid lines
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(maxPts * f));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      {/* Grid lines + Y labels */}
      {yTicks.map((v) => (
        <g key={v}>
          <line
            x1={PAD.left} y1={Y(v)} x2={PAD.left + iW} y2={Y(v)}
            stroke="rgba(255,255,255,0.07)" strokeWidth={1}
          />
          <text x={PAD.left - 6} y={Y(v) + 4} textAnchor="end" fill="rgba(255,255,255,0.25)" fontSize="9">
            {v}
          </text>
        </g>
      ))}

      {/* X-axis labels */}
      {matchdays.map((day) => (
        <text
          key={day} x={X(day)} y={H - 6}
          textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="9"
        >
          MD{day}
        </text>
      ))}

      {/* Player lines */}
      {players.map((player, i) => {
        const color = LINE_COLORS[i % LINE_COLORS.length];
        const line  = matchdays.map((day) => ({ day, y: Y(player.pts[day] ?? 0) }));
        const d = line.reduce(
          (acc, { day, y }, j) => `${acc}${j === 0 ? 'M' : 'L'}${X(day).toFixed(1)},${y.toFixed(1)} `,
          ''
        );
        const last = line[line.length - 1];

        return (
          <g key={player.userId}>
            <path d={d} stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.9} />
            {line.map(({ day, y }) => (
              <circle key={day} cx={X(day)} cy={y} r={3} fill={color} />
            ))}
            {last && (
              <text
                x={X(last.day) + 8} y={last.y + 4}
                fill={color} fontSize="10"
              >
                {player.displayName}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
