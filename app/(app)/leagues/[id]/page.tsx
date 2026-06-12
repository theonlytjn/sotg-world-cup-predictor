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

const RANK_STYLES = [
  { text: 'text-gold',      crown: 'text-gold' },
  { text: 'text-[#cfd6da]', crown: 'text-[#cfd6da]' },
  { text: 'text-[#e0a86b]', crown: 'text-[#e0a86b]' },
];

const GRID = 'grid grid-cols-[1.25rem_1fr_2.25rem_2.25rem_2.25rem_2.75rem] gap-1 sm:grid-cols-[2rem_1fr_3.5rem_3.5rem_3.5rem_3.5rem] sm:gap-2';

export default function LeaguePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [userId, setUserId] = useState<string | null>(null);
  const [league, setLeague] = useState<LeagueRow | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [leaveConfirm, setLeaveConfirm] = useState(false);

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    setUserId(u.user.id);

    const { data: lg, error: le } = await supabase
      .from('leagues')
      .select('id, name, invite_code, created_by')
      .eq('id', id)
      .maybeSingle();

    if (le || !lg) { setNotFound(true); setLoading(false); return; }
    setLeague(lg as LeagueRow);

    // Check membership
    const { data: myMembership } = await supabase
      .from('league_members')
      .select('user_id')
      .eq('league_id', id)
      .eq('user_id', u.user.id)
      .maybeSingle();

    if (!myMembership) { setNotFound(true); setLoading(false); return; }

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

  function copyCode() {
    if (!league) return;
    navigator.clipboard.writeText(league.invite_code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function copyLink() {
    if (!league) return;
    const url = `${window.location.origin}/leagues/join/${league.invite_code}`;
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
  const inviteUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/leagues/join/${league.invite_code}`
    : `sotg.app/leagues/join/${league.invite_code}`;

  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <Link href="/leagues" className="font-mono text-xs uppercase tracking-widest text-chalk/40 hover:text-chalk transition">
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
          <p className="mt-1 font-mono text-sm text-chalk/40">
            {members.length} {members.length === 1 ? 'member' : 'members'}
          </p>
        </div>
        {isCreator && (
          <span className="shrink-0 rounded-full bg-flame/20 px-3 py-1 font-mono text-xs uppercase tracking-widest text-flame">
            Creator
          </span>
        )}
      </div>

      {/* Invite section */}
      <div className="mt-5 rounded-2xl border-2 border-white/10 bg-pitch-900/60 p-5">
        <p className="mb-3 font-display text-sm uppercase tracking-widest text-chalk">Invite friends</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-3 rounded-xl border border-white/10 bg-pitch-800 px-4 py-2.5">
            <span className="font-mono text-sm tracking-[0.3em] text-chalk/60 select-all">
              {league.invite_code}
            </span>
            <span className="mx-1 h-4 w-px bg-white/10" />
            <span className="truncate font-mono text-xs text-chalk/30 select-all">
              {inviteUrl}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={copyCode}
              className="flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2.5 font-mono text-xs uppercase tracking-widest text-chalk transition hover:border-white/40 hover:text-lime active:scale-95"
            >
              <HugeiconsIcon icon={ClipboardCopyIcon} size={14} color="currentColor" strokeWidth={1.5} />
              {copied ? 'Copied!' : 'Code'}
            </button>
            <button
              onClick={copyLink}
              className="flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2.5 font-mono text-xs uppercase tracking-widest text-chalk transition hover:border-white/40 hover:text-lime active:scale-95"
            >
              <HugeiconsIcon icon={ClipboardCopyIcon} size={14} color="currentColor" strokeWidth={1.5} />
              {copiedLink ? 'Copied!' : 'Link'}
            </button>
          </div>
        </div>
        <p className="mt-2 font-mono text-xs text-chalk/30">
          Share the code or the link — anyone with a SOTG account can join
        </p>
      </div>

      {/* Leaderboard table */}
      <div className="mt-6 overflow-hidden rounded-2xl border-2 border-white/20">
        <div className={`${GRID} items-center border-b border-white/20 bg-pitch-800 px-3 py-3 sm:px-5 sm:py-3.5 font-display text-[10px] sm:text-xs font-bold uppercase tracking-widest text-chalk`}>
          <span>#</span>
          <span>Player</span>
          <span className="text-center">CS</span>
          <span className="text-center">CR</span>
          <span className="text-center">Awds</span>
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

          return (
            <div
              key={m.user_id}
              className={[
                `${GRID} items-center border-t border-white/15 px-3 py-2.5 sm:px-5 sm:py-4`,
                isMe ? 'bg-lime/5' : i < 3 ? 'bg-pitch-900/40' : '',
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

      {/* Leave / delete */}
      <div className="mt-6 flex items-center gap-4">
        {!isCreator && !leaveConfirm && (
          <button
            onClick={() => setLeaveConfirm(true)}
            className="font-mono text-sm text-chalk/40 hover:text-flame transition"
          >
            Leave league
          </button>
        )}
        {!isCreator && leaveConfirm && (
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
              className="font-mono text-sm text-chalk/40 hover:text-chalk transition"
            >
              Cancel
            </button>
          </div>
        )}
        {isCreator && (
          <p className="font-mono text-xs text-chalk/25">
            Creator — you can&apos;t leave, but members can
          </p>
        )}
      </div>
    </div>
  );
}
