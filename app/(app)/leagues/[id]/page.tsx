'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { HugeiconsIcon } from '@hugeicons/react';
import { CrownIcon, ClipboardCopyIcon, Medal01Icon } from '@hugeicons-pro/core-stroke-rounded';

type LeagueRow = {
  id: string;
  name: string;
  invite_code: string;
  created_by: string;
};

type Member = {
  user_id: string;
  display_name: string;
  total_points: number;
  exact_scores: number;
  correct_results: number;
  award_points: number;
};

type H2HFixture = {
  fixtureName: string;
  myPick: string;
  theirPick: string;
  myPoints: number;
  theirPoints: number;
};

type H2HData = {
  myWins: number;
  theirWins: number;
  ties: number;
  shared: number;
  fixtures: H2HFixture[];
};

const RANK_STYLES = [
  { text: 'text-gold',      crown: 'text-gold' },
  { text: 'text-[#cfd6da]', crown: 'text-[#cfd6da]' },
  { text: 'text-[#e0a86b]', crown: 'text-[#e0a86b]' },
];

const GRID = 'grid grid-cols-[1.25rem_1fr_2.25rem_2.25rem_2.25rem_2.75rem] gap-1 sm:grid-cols-[2rem_1fr_8rem_8.5rem_5.5rem_4rem] sm:gap-3';

export default function LeaguePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [league, setLeague] = useState<LeagueRow | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [isMember, setIsMember] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  const [h2hTarget, setH2hTarget] = useState<Member | null>(null);
  const [h2hData, setH2hData] = useState<H2HData | null>(null);
  const [h2hLoading, setH2hLoading] = useState(false);

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    setUserId(u.user.id);

    // Check admin status and fetch league in parallel
    const [{ data: lg, error: le }, adminRes] = await Promise.all([
      supabase
        .from('leagues')
        .select('id, name, invite_code, created_by')
        .eq('id', id)
        .maybeSingle(),
      fetch('/api/admin/check').then((r) => r.json() as Promise<{ isAdmin: boolean }>),
    ]);

    const admin = adminRes.isAdmin ?? false;
    setIsAdmin(admin);

    if (le || !lg) { setNotFound(true); setLoading(false); return; }
    setLeague(lg as LeagueRow);

    // Check membership — admins can view any league without being a member
    const { data: myMembership } = await supabase
      .from('league_members')
      .select('user_id')
      .eq('league_id', id)
      .eq('user_id', u.user.id)
      .maybeSingle();

    if (!myMembership && !admin) { setNotFound(true); setLoading(false); return; }
    setIsMember(!!myMembership);

    // Get all members + their leaderboard data
    const { data: memberList } = await supabase
      .from('league_members')
      .select('user_id')
      .eq('league_id', id);

    const memberIds = (memberList ?? []).map((m: { user_id: string }) => m.user_id);

    const [{ data: lb }, { data: profiles }] = await Promise.all([
      supabase
        .from('leaderboard')
        .select('user_id, total_points, exact_scores, correct_results, award_points')
        .in('user_id', memberIds),
      supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', memberIds),
    ]);

    const nameMap = new Map(
      (profiles ?? []).map((p: { id: string; display_name: string | null }) => [p.id, p.display_name ?? 'Unknown'])
    );

    const rows: Member[] = (lb ?? []).map((r: {
      user_id: string; total_points: number; exact_scores: number;
      correct_results: number; award_points: number;
    }) => ({
      user_id: r.user_id,
      display_name: nameMap.get(r.user_id) ?? 'Unknown',
      total_points: r.total_points,
      exact_scores: r.exact_scores,
      correct_results: r.correct_results,
      award_points: r.award_points,
    }));

    rows.sort((a, b) => {
      if (b.total_points !== a.total_points) return b.total_points - a.total_points;
      return b.exact_scores - a.exact_scores;
    });

    setMembers(rows);
    setLoading(false);
  }, [supabase, id]);

  useEffect(() => { load(); }, [load]);

  async function loadH2H(target: Member) {
    setH2hTarget(target);
    setH2hData(null);
    setH2hLoading(true);

    const [{ data: myPreds }, { data: theirPreds }] = await Promise.all([
      supabase.from('match_predictions').select('fixture_id, home_pred, away_pred, points')
        .eq('user_id', userId).not('points', 'is', null),
      supabase.from('match_predictions').select('fixture_id, home_pred, away_pred, points')
        .eq('user_id', target.user_id).not('points', 'is', null),
    ]);

    type PredRow = { fixture_id: number; home_pred: number; away_pred: number; points: number };
    const myMap = new Map<number, PredRow>(
      ((myPreds ?? []) as PredRow[]).map((p) => [p.fixture_id, p])
    );
    const theirMap = new Map<number, PredRow>(
      ((theirPreds ?? []) as PredRow[]).map((p) => [p.fixture_id, p])
    );

    const sharedIds = [...myMap.keys()].filter((id) => theirMap.has(id));
    let myWins = 0, theirWins = 0, ties = 0;
    for (const id of sharedIds) {
      const mp = myMap.get(id)!.points;
      const tp = theirMap.get(id)!.points;
      if (mp > tp) myWins++;
      else if (tp > mp) theirWins++;
      else ties++;
    }

    const recentIds = sharedIds.slice(-10).reverse();
    const { data: fxData } = await supabase
      .from('fixtures')
      .select('id, kickoff, home_team:teams!fixtures_home_team_id_fkey(name), away_team:teams!fixtures_away_team_id_fkey(name)')
      .in('id', recentIds)
      .order('kickoff', { ascending: false });

    type FxRow = { id: number; kickoff: string; home_team: { name: string }[] | { name: string } | null; away_team: { name: string }[] | { name: string } | null };
    const fxMap = new Map<number, FxRow>(
      ((fxData ?? []) as unknown as FxRow[]).map((f) => [f.id, f])
    );

    const fixtures: H2HFixture[] = recentIds
      .map((id) => {
        const f = fxMap.get(id);
        const mp = myMap.get(id)!;
        const tp = theirMap.get(id)!;
        if (!f) return null;
        const homeName = Array.isArray(f.home_team) ? f.home_team[0]?.name : (f.home_team as { name: string } | null)?.name;
        const awayName = Array.isArray(f.away_team) ? f.away_team[0]?.name : (f.away_team as { name: string } | null)?.name;
        return {
          fixtureName: `${homeName ?? '?'} vs ${awayName ?? '?'}`,
          myPick: `${mp.home_pred}–${mp.away_pred}`,
          theirPick: `${tp.home_pred}–${tp.away_pred}`,
          myPoints: mp.points,
          theirPoints: tp.points,
        };
      })
      .filter((x): x is H2HFixture => x !== null);

    setH2hData({ myWins, theirWins, ties, shared: sharedIds.length, fixtures });
    setH2hLoading(false);
  }

  function copyCode() {
    if (!league) return;
    navigator.clipboard.writeText(league.invite_code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function copyLink() {
    if (!league) return;
    const url = `${window.location.origin}/leagues/join/${league.invite_code}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${league.name} on SOTG`,
          text: `Join my World Cup 2026 prediction league — ${league.name}`,
          url,
        });
        return;
      } catch {}
    }
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  }

  async function leaveLeague() {
    if (!userId || !league) return;
    setLeaving(true);
    await supabase
      .from('league_members')
      .delete()
      .eq('league_id', league.id)
      .eq('user_id', userId);
    router.push('/leagues');
  }

  if (loading) {
    return <p className="py-20 text-center font-mono text-base text-chalk">Loading…</p>;
  }

  if (notFound || !league) {
    return (
      <div className="py-20 text-center">
        <p className="font-display text-2xl uppercase text-chalk">League not found</p>
        <p className="mt-2 text-base text-chalk">You may not be a member or the league was deleted.</p>
        <Link href="/leagues" className="mt-4 inline-block font-mono text-sm text-lime hover:underline">
          ← Back to leagues
        </Link>
      </div>
    );
  }

  const isCreator = league.created_by === userId;
  const canInteract = isMember; // H2H, leave etc only for actual members
  const inviteUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/leagues/join/${league.invite_code}`
    : `sotg.app/leagues/join/${league.invite_code}`;

  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <Link href="/leagues" className="font-mono text-sm uppercase tracking-widest text-chalk hover:text-chalk transition">
          ← Leagues
        </Link>
      </div>

      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-lime">
              <HugeiconsIcon icon={Medal01Icon} size={18} color="currentColor" strokeWidth={1.5} />
            </span>
            <p className="font-display text-base uppercase tracking-[0.28em] text-lime">Private League</p>
          </div>
          <h1 className="font-display text-4xl uppercase text-chalk">{league.name}</h1>
          <p className="mt-1 font-mono text-sm text-chalk">
            {members.length} {members.length === 1 ? 'member' : 'members'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isCreator && (
            <span className="rounded-full bg-flame/20 px-3 py-1 font-mono text-xs uppercase tracking-widest text-flame">
              Creator
            </span>
          )}
          {isAdmin && !isMember && (
            <span className="rounded-full bg-gold/20 px-3 py-1 font-mono text-xs uppercase tracking-widest text-gold">
              Admin view
            </span>
          )}
        </div>
      </div>

      {/* Invite section */}
      <div className="mt-5 rounded-2xl border-2 border-white/10 bg-pitch-900/60 p-5">
        <p className="mb-3 font-display text-sm uppercase tracking-widest text-chalk">Invite friends</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-3 rounded-xl border border-white/10 bg-pitch-800 px-4 py-2.5">
            <span className="font-mono text-sm tracking-[0.3em] text-chalk select-all">
              {league.invite_code}
            </span>
            <span className="mx-1 h-4 w-px bg-white/10" />
            <span className="truncate font-mono text-sm text-chalk select-all">
              {inviteUrl}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={copyCode}
              className="flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2.5 font-mono text-sm uppercase tracking-widest text-chalk transition hover:border-white/40 hover:text-lime active:scale-95"
            >
              <HugeiconsIcon icon={ClipboardCopyIcon} size={14} color="currentColor" strokeWidth={1.5} />
              {copied ? 'Copied!' : 'Code'}
            </button>
            <button
              onClick={copyLink}
              className="flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2.5 font-mono text-sm uppercase tracking-widest text-chalk transition hover:border-white/40 hover:text-lime active:scale-95"
            >
              <HugeiconsIcon icon={ClipboardCopyIcon} size={14} color="currentColor" strokeWidth={1.5} />
              {copiedLink ? 'Copied!' : 'Share'}
            </button>
          </div>
        </div>
        <p className="mt-2 font-mono text-sm text-chalk">
          Share the code or the link — anyone with a SOTG account can join
        </p>
      </div>

      {/* Leaderboard table */}
      <div className="mt-6 overflow-hidden rounded-2xl border-2 border-white/20">
        <div className={`${GRID} items-center border-b border-white/20 bg-pitch-800 px-3 py-3 sm:px-5 sm:py-3.5 font-display text-[10px] sm:text-xs font-bold uppercase tracking-widest text-chalk`}>
          <span>#</span>
          <span>Player</span>
          {/* CS — tiebreaker column; full label on desktop */}
          <span className="flex items-center justify-center gap-1">
            <span className="sm:hidden">CS</span>
            <span className="hidden sm:inline">Correct Score</span>
            <span className="text-gold leading-none" title="Tiebreaker">·</span>
          </span>
          <span className="flex items-center justify-center">
            <span className="sm:hidden">CR</span>
            <span className="hidden sm:inline">Correct Result</span>
          </span>
          <span className="flex items-center justify-center">
            <span className="sm:hidden">Awds</span>
            <span className="hidden sm:inline">Award Pts</span>
          </span>
          <span className="text-right">Total</span>
        </div>

        {members.length === 0 && (
          <p className="px-5 py-10 text-center text-base text-chalk">
            No scores yet — check back once games have been played.
          </p>
        )}

        {members.map((m, i) => {
          const isMe = m.user_id === userId;
          const rankStyle = RANK_STYLES[i];
          const isH2hActive = h2hTarget?.user_id === m.user_id;

          return (
            <div
              key={m.user_id}
              onClick={() => !isMe && canInteract && loadH2H(m)}
              className={[
                `${GRID} items-center border-t border-white/15 px-3 py-2.5 sm:px-5 sm:py-4`,
                isMe ? 'bg-lime/5' : canInteract && !isMe ? 'cursor-pointer hover:bg-white/5 transition-colors' : '',
                isH2hActive ? 'bg-lime/10' : i < 3 && !isMe ? 'bg-pitch-900/40' : '',
              ].join(' ')}
            >
              <div className="flex items-center justify-center">
                {i < 3 ? (
                  <span className={rankStyle.crown}>
                    <HugeiconsIcon icon={CrownIcon} size={12} color="currentColor" strokeWidth={1.5} />
                  </span>
                ) : (
                  <span className="font-display text-[10px] sm:text-sm font-black text-chalk">{i + 1}</span>
                )}
              </div>

              <span className={[
                'truncate font-display text-[11px] sm:text-sm font-bold uppercase tracking-wide',
                rankStyle ? rankStyle.text : 'text-chalk',
              ].join(' ')}>
                {m.display_name}
                {isMe && (
                  <span className="ml-1 hidden sm:inline rounded-full bg-lime/20 px-1.5 py-0.5 font-display text-[9px] font-bold uppercase tracking-widest text-lime">
                    you
                  </span>
                )}
              </span>

              <span className="text-center font-display font-black text-[11px] sm:text-sm text-chalk">{m.exact_scores}</span>
              <span className="text-center font-display font-black text-[11px] sm:text-sm text-chalk">{m.correct_results}</span>
              <span className="text-center font-display font-black text-[11px] sm:text-sm text-chalk">{m.award_points}</span>
              <span className={[
                'text-right font-display font-black text-[11px] sm:text-sm',
                rankStyle ? rankStyle.text : 'text-chalk',
              ].join(' ')}>
                {m.total_points}
              </span>
            </div>
          );
        })}
      </div>

      <p className="mt-2 text-center font-mono text-sm text-chalk">
        Tied on points<span className="text-gold">·</span> Correct Scores (CS) decides the order
      </p>

      {members.length > 1 && !h2hTarget && canInteract && (
        <p className="mt-2 font-mono text-sm uppercase tracking-widest text-chalk text-center">
          Tap a rival to see head-to-head
        </p>
      )}

      {/* H2H panel */}
      {h2hTarget && (
        <div className="mt-6 rounded-2xl border-2 border-white/15 bg-pitch-900/60 p-6">
          <div className="mb-5 flex items-center justify-between">
            <p className="font-display text-sm uppercase tracking-widest text-lime">
              Head-to-head
            </p>
            <button
              onClick={() => { setH2hTarget(null); setH2hData(null); }}
              className="font-mono text-sm text-chalk hover:text-chalk transition"
            >
              ✕ Close
            </button>
          </div>

          {/* Name plates */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 mb-5">
            <div className="text-left">
              <p className="font-display text-base uppercase tracking-wide text-lime">You</p>
              <p className="font-display text-3xl font-black text-chalk">{members.find(m => m.user_id === userId)?.total_points ?? 0}</p>
              <p className="font-mono text-base text-chalk">total pts</p>
            </div>
            <span className="font-display text-xl text-chalk">vs</span>
            <div className="text-right">
              <p className="font-display text-base uppercase tracking-wide text-chalk">{h2hTarget.display_name}</p>
              <p className="font-display text-3xl font-black text-chalk">{h2hTarget.total_points}</p>
              <p className="font-mono text-base text-chalk">total pts</p>
            </div>
          </div>

          {h2hLoading && (
            <p className="py-4 text-center font-mono text-base text-chalk">Loading matchup…</p>
          )}

          {!h2hLoading && h2hData && (
            <>
              {/* W/D/L record */}
              <div className="grid grid-cols-3 gap-2 rounded-xl border border-white/10 bg-pitch-800/60 p-4 mb-5">
                <div className="text-center">
                  <p className="font-display text-3xl font-black text-lime">{h2hData.myWins}</p>
                  <p className="font-mono text-sm uppercase tracking-widest text-chalk">Your wins</p>
                </div>
                <div className="text-center">
                  <p className="font-display text-3xl font-black text-chalk">{h2hData.ties}</p>
                  <p className="font-mono text-sm uppercase tracking-widest text-chalk">Tied</p>
                </div>
                <div className="text-center">
                  <p className="font-display text-3xl font-black text-flame">{h2hData.theirWins}</p>
                  <p className="font-mono text-sm uppercase tracking-widest text-chalk">Their wins</p>
                </div>
              </div>
              <p className="mb-4 text-center font-mono text-sm uppercase tracking-widest text-chalk">
                {h2hData.shared} shared {h2hData.shared === 1 ? 'fixture' : 'fixtures'} · per-fixture points compared
              </p>

              {/* Recent fixtures */}
              {h2hData.fixtures.length > 0 && (
                <div className="space-y-2">
                  <p className="font-mono text-sm uppercase tracking-widest text-chalk mb-2">Recent fixtures</p>
                  {h2hData.fixtures.map((f, i) => {
                    const youWon = f.myPoints > f.theirPoints;
                    const tied   = f.myPoints === f.theirPoints;
                    return (
                      <div key={i} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-xl border border-white/8 bg-pitch-900/40 px-3 py-2.5">
                        <div className="text-left">
                          <span className={`font-display text-sm uppercase ${youWon ? 'text-lime' : tied ? 'text-chalk' : 'text-chalk'}`}>
                            {f.myPick}
                          </span>
                          <span className={`ml-1.5 font-mono text-sm ${youWon ? 'text-lime' : 'text-chalk'}`}>
                            +{f.myPoints}
                          </span>
                        </div>
                        <p className="truncate text-center font-mono text-sm text-chalk px-1">{f.fixtureName}</p>
                        <div className="text-right">
                          <span className={`font-mono text-sm ${f.theirPoints > f.myPoints ? 'text-flame' : 'text-chalk'}`}>
                            +{f.theirPoints}
                          </span>
                          <span className={`ml-1.5 font-display text-sm uppercase ${f.theirPoints > f.myPoints ? 'text-flame' : tied ? 'text-chalk' : 'text-chalk'}`}>
                            {f.theirPick}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {h2hData.shared === 0 && (
                <p className="py-4 text-center font-mono text-base text-chalk">
                  No shared settled fixtures yet — check back once games are played.
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* Leave / delete — only shown to actual members */}
      <div className="mt-6 flex items-center gap-4">
        {canInteract && !isCreator && !leaveConfirm && (
          <button
            onClick={() => setLeaveConfirm(true)}
            className="font-mono text-sm text-chalk hover:text-flame transition"
          >
            Leave league
          </button>
        )}
        {canInteract && !isCreator && leaveConfirm && (
          <div className="flex items-center gap-3">
            <p className="font-mono text-sm text-chalk">Leave {league.name}?</p>
            <button
              onClick={leaveLeague}
              disabled={leaving}
              className="rounded-lg bg-flame/15 px-3 py-1.5 font-mono text-sm text-flame transition hover:bg-flame/25 disabled:opacity-40"
            >
              {leaving ? 'Leaving…' : 'Yes, leave'}
            </button>
            <button
              onClick={() => setLeaveConfirm(false)}
              className="font-mono text-sm text-chalk hover:text-chalk transition"
            >
              Cancel
            </button>
          </div>
        )}
        {canInteract && isCreator && (
          <p className="font-mono text-sm text-chalk">
            Creator — you can&apos;t leave, but members can
          </p>
        )}
      </div>
    </div>
  );
}
