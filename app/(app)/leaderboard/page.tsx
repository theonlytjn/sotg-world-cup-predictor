'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { scorePrediction } from '@/lib/scoring';
import { HugeiconsIcon } from '@hugeicons/react';
import { BarChartIcon, CrownIcon, Medal01Icon } from '@hugeicons-pro/core-stroke-rounded';
import Link from 'next/link';

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

// Mobile: tight fixed columns so all 6 fit. Desktop: wider to hold full column labels.
const GRID = 'grid grid-cols-[1.25rem_1fr_2.25rem_2.25rem_2.25rem_2.75rem] gap-1 sm:grid-cols-[2rem_1fr_8rem_8.5rem_5.5rem_4rem] sm:gap-3';

function ColTip({ label, fullLabel, tip, className = 'justify-center' }: {
  label: string; fullLabel?: string; tip: string; className?: string;
}) {
  return (
    <span className={`relative flex items-center group cursor-default ${className}`}>
      <span className="font-display text-xs font-bold uppercase tracking-widest">
        {/* Mobile: short label with tooltip */}
        <span className="sm:hidden">{label}</span>
        {/* Desktop: full label, no tooltip needed */}
        <span className="hidden sm:inline">{fullLabel ?? label}</span>
      </span>
      <span className="sm:hidden pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[180px] rounded-xl border border-white/20 bg-pitch-800 px-3 py-2 font-mono text-[11px] leading-snug text-chalk opacity-0 shadow-xl transition-opacity group-hover:opacity-100 z-20 text-center whitespace-nowrap">
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
      { data: rules },
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
        .from('scoring_rules')
        .select('key, points'),
    ]);

    if (u.user) setMyId(u.user.id);

    const rulesMap = Object.fromEntries(
      ((rules ?? []) as { key: string; points: number }[]).map((r) => [r.key, r.points])
    );
    const exactPts  = rulesMap['match_exact']  ?? 3;
    const resultPts = rulesMap['match_result'] ?? 1;

    const rowData = (lb as Row[]) ?? [];
    setRows(rowData);

    const liveFixtures = (lf as LiveFixture[]) ?? [];
    const hasLive = liveFixtures.length > 0;
    setIsLive(hasLive);

    if (hasLive) {
      const liveIds = liveFixtures.map((f) => f.id);
      const { data: livePreds } = await supabase
        .from('match_predictions')
        .select('user_id, fixture_id, home_pred, away_pred, is_banker')
        .in('fixture_id', liveIds);

      const bonus: Record<string, number> = {};
      for (const p of (livePreds as (RawPred & { is_banker?: boolean })[]) ?? []) {
        const fix = liveFixtures.find((f) => f.id === p.fixture_id);
        if (!fix || fix.home_score == null || fix.away_score == null) continue;
        const pts = scorePrediction(p.home_pred, p.away_pred, fix.home_score, fix.away_score, exactPts, resultPts, p.is_banker ?? false);
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

      {/* Leagues promo */}
      <Link
        href="/leagues"
        className="mt-3 group flex items-center gap-4 rounded-2xl border-2 border-lime/20 bg-lime/5 px-5 py-4 transition hover:border-lime/40 hover:bg-lime/10"
      >
        <span className="shrink-0 text-lime">
          <HugeiconsIcon icon={Medal01Icon} size={28} color="currentColor" strokeWidth={1.4} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-base uppercase tracking-wide text-lime">
            Create a private league
          </p>
          <p className="mt-0.5 text-sm text-chalk">
            Who&apos;s really top of the football knowledge tree? Set up a league for your group, share an invite link, and find out exactly where you rank against the people who matter — no hiding behind the full table.
          </p>
        </div>
        <span className="shrink-0 font-mono text-sm text-lime/50 transition group-hover:text-lime">→</span>
      </Link>

      {/* Table */}
      <div className="mt-6 overflow-hidden rounded-2xl border-2 border-white/20">
        {/* Header */}
        <div className={`${GRID} items-center border-b border-white/20 bg-pitch-800 px-3 py-3 sm:px-5 sm:py-3.5 font-display text-[10px] sm:text-xs font-bold uppercase tracking-widest text-chalk`}>
          <span>#</span>
          <span>Player</span>
          <ColTip label="CS"   fullLabel="Correct Score"  tip="Correct Score — exact scoreline" />
          <ColTip label="CR"   fullLabel="Correct Result" tip="Correct Result — right outcome, wrong score" />
          <ColTip label="Awds" fullLabel="Award Pts"      tip="Award prediction points" />
          <ColTip label="Total" tip="Total points" className="text-right justify-end" />
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
                `${GRID} items-center border-t border-white/15 px-3 py-2.5 sm:px-5 sm:py-4 transition-colors`,
                isMe ? 'bg-lime/5' : i < 3 ? 'bg-pitch-900/40' : '',
              ].join(' ')}
            >
              {/* Rank */}
              <div className="flex items-center justify-center">
                {i < 3 ? (
                  <span className={rankStyle.crown}>
                    <HugeiconsIcon icon={CrownIcon} size={12} color="currentColor" strokeWidth={1.5} />
                  </span>
                ) : (
                  <span className="font-display text-[10px] sm:text-sm font-black text-chalk">{i + 1}</span>
                )}
              </div>

              {/* Name */}
              <span className={[
                'truncate font-display text-[11px] sm:text-sm font-bold uppercase tracking-wide',
                rankStyle ? rankStyle.text : 'text-chalk',
              ].join(' ')}>
                {r.display_name}
                {isMe && (
                  <span className="ml-1 hidden sm:inline rounded-full bg-lime/20 px-1.5 py-0.5 font-display text-[9px] font-bold uppercase tracking-widest text-lime">
                    you
                  </span>
                )}
              </span>

              <span className="text-center font-display font-black text-[11px] sm:text-sm text-chalk">{r.exact_scores}</span>
              <span className="text-center font-display font-black text-[11px] sm:text-sm text-chalk">{r.correct_results}</span>
              <span className="text-center font-display font-black text-[11px] sm:text-sm text-chalk">{r.award_points}</span>

              {/* Total + live bonus */}
              <div className="flex items-baseline justify-end gap-1">
                <span className={[
                  'font-display font-black text-[11px] sm:text-sm',
                  rankStyle ? rankStyle.text : 'text-chalk',
                ].join(' ')}>
                  {isLive ? liveTotal : r.total_points}
                </span>
                {isLive && bonus !== 0 && (
                  <span className="font-display font-black text-[10px] sm:text-xs text-lime">
                    {bonus > 0 ? `+${bonus}` : bonus}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
