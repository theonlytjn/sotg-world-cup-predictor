'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { HugeiconsIcon } from '@hugeicons/react';
import { Medal01Icon, Add01Icon, BarChartIcon } from '@hugeicons-pro/core-stroke-rounded';

type League = {
  id: string;
  name: string;
  invite_code: string;
  created_by: string;
};

type LeagueWithMeta = League & {
  member_count: number;
  my_rank: number | null;
};

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export default function LeaguesPage() {
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [leagues, setLeagues] = useState<LeagueWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [newName, setNewName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [createError, setCreateError] = useState('');
  const [joinError, setJoinError] = useState('');

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    setUserId(u.user.id);

    const { data: memberships } = await supabase
      .from('league_members')
      .select('league_id')
      .eq('user_id', u.user.id);

    if (!memberships?.length) {
      setLeagues([]);
      setLoading(false);
      return;
    }

    const ids = memberships.map((m: { league_id: string }) => m.league_id);

    const [{ data: ls }, { data: allMembers }, { data: lb }] = await Promise.all([
      supabase.from('leagues').select('id, name, invite_code, created_by').in('id', ids).order('created_at'),
      supabase.from('league_members').select('league_id, user_id').in('league_id', ids),
      supabase.from('leaderboard')
        .select('user_id, total_points, exact_scores')
        .order('total_points', { ascending: false })
        .order('exact_scores', { ascending: false }),
    ]);

    const lbRows = (lb ?? []) as { user_id: string; total_points: number; exact_scores: number }[];
    const members = (allMembers ?? []) as { league_id: string; user_id: string }[];

    const result: LeagueWithMeta[] = (ls ?? []).map((league: League) => {
      const leagueMembers = members.filter((m) => m.league_id === league.id);
      const memberIds = new Set(leagueMembers.map((m) => m.user_id));
      const memberRows = lbRows.filter((r) => memberIds.has(r.user_id));
      const myIdx = memberRows.findIndex((r) => r.user_id === u.user!.id);
      return {
        ...league,
        member_count: leagueMembers.length,
        my_rank: myIdx >= 0 ? myIdx + 1 : null,
      };
    });

    setLeagues(result);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  async function createLeague() {
    if (!newName.trim() || !userId) return;
    setCreating(true);
    setCreateError('');
    const code = generateCode();
    const { data: league, error: le } = await supabase
      .from('leagues')
      .insert({ name: newName.trim(), invite_code: code, created_by: userId })
      .select()
      .single();
    if (le || !league) { setCreateError('Could not create — try again'); setCreating(false); return; }
    await supabase.from('league_members').insert({ league_id: league.id, user_id: userId });
    setNewName('');
    setShowCreate(false);
    setCreating(false);
    load();
  }

  async function joinLeague() {
    if (!joinCode.trim() || !userId) return;
    setJoining(true);
    setJoinError('');
    const { data: league, error: le } = await supabase
      .from('leagues')
      .select('id, name')
      .eq('invite_code', joinCode.trim().toUpperCase())
      .maybeSingle();
    if (le || !league) { setJoinError('League not found — check the code'); setJoining(false); return; }
    const { error: me } = await supabase
      .from('league_members')
      .insert({ league_id: league.id, user_id: userId });
    if (me?.code === '23505') { setJoinError('You\'re already in that league'); setJoining(false); return; }
    if (me) { setJoinError('Could not join — try again'); setJoining(false); return; }
    setJoinCode('');
    setShowJoin(false);
    setJoining(false);
    load();
  }

  return (
    <div>
      <div className="mb-1 flex items-center gap-3">
        <span className="text-lime">
          <HugeiconsIcon icon={Medal01Icon} size={18} color="currentColor" strokeWidth={1.5} />
        </span>
        <p className="font-display text-base uppercase tracking-[0.28em] text-lime">Custom Leagues</p>
      </div>
      <h1 className="font-display text-4xl uppercase text-chalk">Leagues</h1>
      <p className="mt-1 text-base text-chalk">
        Private mini-tables for your group — everyone&apos;s live score carries over.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          onClick={() => { setShowCreate((v) => !v); setShowJoin(false); }}
          className="flex items-center gap-2 rounded-xl bg-lime px-4 py-2.5 font-body font-bold text-base text-pitch-950 transition hover:brightness-110 active:scale-95"
        >
          <HugeiconsIcon icon={Add01Icon} size={16} color="currentColor" strokeWidth={2.2} />
          New league
        </button>
        <button
          onClick={() => { setShowJoin((v) => !v); setShowCreate(false); }}
          className="flex items-center gap-2 rounded-xl border-2 border-white/15 px-4 py-2.5 font-body font-bold text-base text-chalk transition hover:border-white/40 active:scale-95"
        >
          Join with code
        </button>
      </div>

      {showCreate && (
        <div className="mt-4 rounded-2xl border-2 border-lime/30 bg-pitch-900/60 p-6">
          <p className="mb-3 font-display text-sm uppercase tracking-widest text-lime">Name your league</p>
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            maxLength={50}
            placeholder="e.g. Pagans Everywhere"
            onKeyDown={(e) => e.key === 'Enter' && createLeague()}
            className="w-full rounded-xl border-2 border-white/15 bg-pitch-800 px-4 py-3 font-body text-chalk outline-none transition focus:border-lime"
          />
          {createError && <p className="mt-2 font-mono text-sm text-flame">{createError}</p>}
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={createLeague}
              disabled={!newName.trim() || creating}
              className="rounded-xl bg-lime px-5 py-2.5 font-body font-bold text-base text-pitch-950 transition hover:brightness-110 disabled:opacity-40"
            >
              {creating ? 'Creating…' : 'Create'}
            </button>
            <button onClick={() => setShowCreate(false)} className="font-mono text-sm text-chalk/50 hover:text-chalk transition">
              Cancel
            </button>
          </div>
        </div>
      )}

      {showJoin && (
        <div className="mt-4 rounded-2xl border-2 border-white/15 bg-pitch-900/60 p-6">
          <p className="mb-3 font-display text-sm uppercase tracking-widest text-chalk">Enter invite code</p>
          <input
            autoFocus
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            maxLength={8}
            placeholder="XXXXXXXX"
            onKeyDown={(e) => e.key === 'Enter' && joinLeague()}
            className="w-full rounded-xl border-2 border-white/15 bg-pitch-800 px-4 py-3 text-center font-mono text-xl tracking-[0.4em] text-chalk outline-none transition focus:border-lime uppercase"
          />
          {joinError && <p className="mt-2 font-mono text-sm text-flame">{joinError}</p>}
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={joinLeague}
              disabled={joinCode.length < 4 || joining}
              className="rounded-xl bg-lime px-5 py-2.5 font-body font-bold text-base text-pitch-950 transition hover:brightness-110 disabled:opacity-40"
            >
              {joining ? 'Joining…' : 'Join league'}
            </button>
            <button onClick={() => setShowJoin(false)} className="font-mono text-sm text-chalk/50 hover:text-chalk transition">
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="mt-10 py-20 text-center font-mono text-base text-chalk">Loading…</p>
      ) : leagues.length === 0 ? (
        <div className="mt-10 rounded-2xl border-2 border-dashed border-white/10 p-12 text-center">
          <HugeiconsIcon icon={Medal01Icon} size={40} color="currentColor" strokeWidth={1.2} className="mx-auto text-chalk/20" />
          <p className="mt-4 font-display text-lg uppercase text-chalk">No leagues yet</p>
          <p className="mt-1 text-base text-chalk">Create one or get an invite code from a friend.</p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {leagues.map((league) => (
            <Link
              key={league.id}
              href={`/leagues/${league.id}`}
              className="group flex flex-col rounded-2xl border-2 border-white/10 bg-pitch-900/60 p-6 transition hover:border-white/30 hover:bg-pitch-800/60"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-display text-xl uppercase text-chalk transition group-hover:text-lime">
                  {league.name}
                </p>
                {league.created_by === userId && (
                  <span className="shrink-0 rounded-full border border-white/10 px-2 py-0.5 font-mono text-xs uppercase tracking-widest text-chalk/30">
                    Creator
                  </span>
                )}
              </div>
              <div className="mt-2 flex items-center gap-4">
                <span className="font-mono text-sm text-chalk/50">
                  {league.member_count} {league.member_count === 1 ? 'member' : 'members'}
                </span>
                {league.my_rank !== null && (
                  <span className="font-mono text-sm text-lime">
                    #{league.my_rank} in league
                  </span>
                )}
              </div>
              <p className="mt-3 font-mono text-xs tracking-[0.3em] text-chalk/25">
                {league.invite_code}
              </p>
            </Link>
          ))}
        </div>
      )}

      <Link
        href="/leaderboard"
        className="mt-6 flex items-center justify-between rounded-2xl border border-white/10 bg-pitch-900/40 px-6 py-4 transition hover:border-white/20 hover:bg-pitch-900/60"
      >
        <div className="flex items-center gap-3">
          <span className="text-chalk/40">
            <HugeiconsIcon icon={BarChartIcon} size={18} color="currentColor" strokeWidth={1.5} />
          </span>
          <div>
            <p className="font-display text-base uppercase text-chalk">Overall Table</p>
            <p className="font-mono text-sm text-chalk/40">All players on SOTG</p>
          </div>
        </div>
        <span className="font-mono text-sm text-chalk/30">→</span>
      </Link>
    </div>
  );
}
