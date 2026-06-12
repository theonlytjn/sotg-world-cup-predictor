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

const RANK_STYLES = [
  { text: 'text-gold',      crown: 'text-gold' },
  { text: 'text-[#cfd6da]', crown: 'text-[#cfd6da]' },
  { text: 'text-[#e0a86b]', crown: 'text-[#e0a86b]' },
];

// Single grid — table always has all 6 cols; container scrolls horizontally on small screens
const GRID = 'grid grid-cols-[2rem_1fr_3.5rem_3.5rem_3.5rem_3.5rem] gap-2';

function ColTip({ label, tip, className = 'justify-center' }: { label: string; tip: string; className?: string }) {
  return (
    <span className={`relative flex items-center group cursor-default ${className}`}>
      <span className="font-display text-xs font-bold uppercase tracking-widest">{label}</span>
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[180px] rounded-xl border border-white/20 bg-pitch-800 px-3 py-2 font-mono text-[11px] leading-snug text-chalk opacity-0 shadow-xl transition-opacity group-hover:opacity-100 z-20 text-center whitespace-nowrap">
        {tip}
      </span>
    </span>
  );
}

export default function LeaderboardPage() {
  const supabase = useMemo(() => createClient(), []);
  const [myId, setMyId]           = useState<string | null>(null);
  const [rows, setRows]           = useState<Row[]>([]);
  const [liveBonus, setLiveBonus] = useState<Record<string, number>>({});
  const [isLive, setIsLive]       = useState(false);
  const [loading, setLoading]     = useState(true);
  const [copied, setCopied]       = useState(false);

  function copyInvite() {
    navigator.clipboard.writeText('https://sotg.app').then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const load = useCallback(async () => {
    const [
      { data: u },
      { data: lb },
      { data: lf },
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
    ]);

    if (u.user) setMyId(u.user.id);

    const rowData = (lb as Row[]) ?? [];
    setRows(rowData);

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

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

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
        {!isLive && (
          <span className="ml-auto font-mono text-sm text-chalk">Refreshes every 30s</span>
        )}
      </div>
      <h1 className="font-display text-4xl uppercase text-chalk">The Table</h1>
      {isLive && (
        <p className="mt-1 text-base text-chalk">
          Live projected scores shown in orange — updates every 30 seconds.
        </p>
      )}

      {/* Invite banner */}
      <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl border-2 border-white/10 bg-pitch-900/60 px-5 py-4">
        <div>
          <p className="font-display text-base uppercase tracking-wide text-chalk">Challenge your crew</p>
          <p className="text-sm text-chalk mt-0.5">
            Share <span className="text-lime">sotg.app</span> and get them picking before kickoff
          </p>
        </div>
        <button
          onClick={copyInvite}
          className="shrink-0 rounded-xl bg-lime px-4 py-2.5 font-body font-bold text-base text-pitch-950 transition hover:brightness-110 active:scale-95"
        >
          {copied ? 'Copied!' : 'Copy link'}
        </button>
      </div>

      {/* Table */}
      <div className="mt-6 overflow-hidden rounded-2xl border-2 border-white/20">
        <div className="overflow-x-auto">
        {/* Header */}
        <div className={`${GRID} items-center border-b border-white/20 bg-pitch-800 px-5 py-3.5 font-display text-xs font-bold uppercase tracking-widest text-chalk`} style={{ minWidth: '420px' }}>
          <span>#</span>
          <span>Player</span>
          <ColTip label="CS" tip="Correct Score — exact scoreline" />
          <ColTip label="CR" tip="Correct Result — right outcome, wrong score" />
          <ColTip label="Awds" tip="Award prediction points" />
          <ColTip label="Total" tip="Total points" className="text-right justify-end" />
        </div>

        {displayRows.length === 0 && (
          <p className="px-5 py-10 text-center text-base text-chalk" style={{ minWidth: '420px' }}>
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
                `${GRID} items-center border-t border-white/15 px-5 py-4 transition-colors`,
                isMe ? 'bg-lime/5' : i < 3 ? 'bg-pitch-900/40' : '',
              ].join(' ')}
              style={{ minWidth: '420px' }}
            >
              {/* Rank */}
              <div className="flex items-center">
                {i < 3 ? (
                  <span className={rankStyle.crown}>
                    <HugeiconsIcon icon={CrownIcon} size={16} color="currentColor" strokeWidth={1.5} />
                  </span>
                ) : (
                  <span className="font-display text-sm font-black text-chalk">{i + 1}</span>
                )}
              </div>

              {/* Name */}
              <span className={[
                'truncate font-display text-sm font-bold uppercase tracking-wide',
                rankStyle ? rankStyle.text : 'text-chalk',
              ].join(' ')}>
                {r.display_name}
                {isMe && (
                  <span className="ml-1.5 rounded-full bg-lime/20 px-1.5 py-0.5 font-display text-[10px] font-bold uppercase tracking-widest text-lime">
                    you
                  </span>
                )}
              </span>

              <span className="text-center font-display font-black text-sm text-chalk">{r.exact_scores}</span>
              <span className="text-center font-display font-black text-sm text-chalk">{r.correct_results}</span>
              <span className="text-center font-display font-black text-sm text-chalk">{r.award_points}</span>

              {/* Total + live bonus */}
              <div className="flex flex-col items-end">
                <span className={[
                  'font-display font-black text-sm',
                  rankStyle ? rankStyle.text : 'text-chalk',
                ].join(' ')}>
                  {isLive ? liveTotal : r.total_points}
                </span>
                {isLive && bonus !== 0 && (
                  <span className={[
                    'font-mono text-[10px] font-semibold',
                    bonus > 0 ? 'text-flame' : 'text-chalk',
                  ].join(' ')}>
                    {bonus > 0 ? `+${bonus}` : bonus}
                  </span>
                )}
              </div>
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}
