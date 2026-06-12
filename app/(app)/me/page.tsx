'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { HugeiconsIcon } from '@hugeicons/react';
import { UserCircleIcon, AnalyticsIcon, DartIcon, CheckmarkBadge01Icon, BarChartIcon } from '@hugeicons-pro/core-stroke-rounded';

type Stats = {
  total: number;
  exact: number;
  results: number;
  settled: number;
  awards: number;
};

export default function MePage() {
  const supabase = useMemo(() => createClient(), []);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [stats, setStats] = useState<Stats | null>(null);
  const [picks, setPicks] = useState(0);
  const [rank, setRank] = useState<number | null>(null);
  const [totalUsers, setTotalUsers] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [exactPts, setExactPts] = useState(3);
  const [resultPts, setResultPts] = useState(1);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [resetState, setResetState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [shareState, setShareState] = useState<'idle' | 'copied'>('idle');

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      setEmail(u.user.email ?? '');

      const [{ data: profile }, { data: allLb }, { count }, { data: rules }, { data: predHistory }] = await Promise.all([
        supabase.from('profiles').select('display_name').eq('id', u.user.id).single(),
        supabase
          .from('leaderboard')
          .select('user_id, total_points, exact_scores, correct_results, settled_predictions, award_points')
          .order('total_points', { ascending: false })
          .order('exact_scores', { ascending: false }),
        supabase
          .from('match_predictions')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', u.user.id),
        supabase.from('scoring_rules').select('key, points'),
        supabase
          .from('match_predictions')
          .select('points, fixtures!inner(kickoff)')
          .eq('user_id', u.user.id)
          .not('points', 'is', null),
      ]);

      if (profile) setDisplayName(profile.display_name ?? '');

      const rulesMap = Object.fromEntries((rules ?? []).map((r: { key: string; points: number }) => [r.key, r.points]));
      setExactPts(rulesMap['match_exact'] ?? 3);
      setResultPts(rulesMap['match_result'] ?? 1);

      const rows = (allLb ?? []) as Array<{
        user_id: string;
        total_points: number;
        exact_scores: number;
        correct_results: number;
        settled_predictions: number;
        award_points: number;
      }>;
      setTotalUsers(rows.length);
      const myIdx = rows.findIndex((r) => r.user_id === u.user!.id);
      if (myIdx !== -1) {
        const r = rows[myIdx];
        setStats({ total: r.total_points, exact: r.exact_scores, results: r.correct_results, settled: r.settled_predictions, awards: r.award_points });
        setRank(myIdx + 1);
      }

      setPicks(count ?? 0);

      // Calculate streaks from settled predictions sorted by kickoff
      type PH = { points: number; fixtures: { kickoff: string } | { kickoff: string }[] };
      const sorted = ((predHistory ?? []) as PH[])
        .map((p) => ({
          points: p.points,
          kickoff: Array.isArray(p.fixtures) ? p.fixtures[0]?.kickoff : p.fixtures?.kickoff,
        }))
        .filter((p) => p.kickoff)
        .sort((a, b) => a.kickoff!.localeCompare(b.kickoff!));

      let running = 0;
      let longest = 0;
      for (const p of sorted) {
        if (p.points > 0) { running++; longest = Math.max(longest, running); }
        else { running = 0; }
      }
      setCurrentStreak(running);
      setLongestStreak(longest);
    })();
  }, [supabase]);

  async function saveName() {
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    if (u.user) {
      await supabase.from('profiles').update({ display_name: displayName.trim() }).eq('id', u.user.id);
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  async function shareStats() {
    const hitRate = stats && stats.settled > 0
      ? `${Math.round(((stats.exact + stats.results) / stats.settled) * 100)}%`
      : '—';
    const grid = Array.from({ length: Math.min(stats?.settled ?? 0, 20) }, (_, i) => {
      if (i < (stats?.exact ?? 0)) return '🟩';
      if (i < (stats?.exact ?? 0) + (stats?.results ?? 0)) return '🟨';
      return '🟥';
    }).join('');
    const text = [
      `📊 SOTG World Cup 2026`,
      `${displayName} · ${rank !== null ? `#${rank} of ${totalUsers}` : 'unranked'}`,
      ``,
      grid || '—',
      ``,
      `${stats?.total ?? 0}pts total · ${hitRate} hit rate`,
      `🎯 ${stats?.exact ?? 0} exact  ✅ ${stats?.results ?? 0} correct`,
      ``,
      `Think you can beat me? ${typeof window !== 'undefined' ? window.location.origin : ''}`,
    ].join('\n');

    if (typeof navigator !== 'undefined' && navigator.share) {
      try { await navigator.share({ text }); return; } catch {}
    }
    await navigator.clipboard.writeText(text);
    setShareState('copied');
    setTimeout(() => setShareState('idle'), 2000);
  }

  async function sendReset() {
    if (!email) return;
    setResetState('sending');
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://sotg.app/auth/callback',
    });
    setResetState(error ? 'error' : 'sent');
    if (!error) setTimeout(() => setResetState('idle'), 4000);
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <span className="text-lime"><HugeiconsIcon icon={UserCircleIcon} size={18} color="currentColor" strokeWidth={1.5} /></span>
        <p className="font-display font-bold text-base tracking-[0.28em] uppercase text-lime">Profile</p>
      </div>
      <h1 className="font-display text-4xl uppercase text-chalk">You</h1>

      {/* stats grid — row 1 */}
      <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard
          icon={<HugeiconsIcon icon={AnalyticsIcon} size={18} color="currentColor" strokeWidth={1.5} />}
          label="Total pts"
          value={stats?.total ?? 0}
          accent
        />
        <StatCard
          icon={<HugeiconsIcon icon={DartIcon} size={18} color="currentColor" strokeWidth={1.5} />}
          label={`Exact (${exactPts}pt)`}
          value={stats?.exact ?? 0}
        />
        <StatCard
          icon={<HugeiconsIcon icon={CheckmarkBadge01Icon} size={18} color="currentColor" strokeWidth={1.5} />}
          label={`Result (${resultPts}pt)`}
          value={stats?.results ?? 0}
        />
      </div>

      {/* stats grid — row 2 */}
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
        {/* Rank */}
        <div className="rounded-2xl border-2 border-white/10 bg-pitch-900/60 p-6">
          <span className="text-chalk">
            <HugeiconsIcon icon={BarChartIcon} size={18} color="currentColor" strokeWidth={1.5} />
          </span>
          <div className="mt-2 font-display text-4xl font-black text-chalk">
            {rank !== null ? `#${rank}` : '—'}
          </div>
          <div className="mt-1 font-display text-sm font-bold uppercase tracking-widest text-chalk">
            {totalUsers > 0 ? `of ${totalUsers}` : 'Rank'}
          </div>
        </div>

        {/* Accuracy */}
        <div className="rounded-2xl border-2 border-white/10 bg-pitch-900/60 p-6">
          <span className="text-chalk">
            <HugeiconsIcon icon={DartIcon} size={18} color="currentColor" strokeWidth={1.5} />
          </span>
          <div className="mt-2 font-display text-4xl font-black text-chalk">
            {stats && stats.settled > 0
              ? `${Math.round(((stats.exact + stats.results) / stats.settled) * 100)}%`
              : '—'}
          </div>
          <div className="mt-1 font-display text-sm font-bold uppercase tracking-widest text-chalk">Hit rate</div>
        </div>

        {/* Award pts */}
        <StatCard
          icon={<HugeiconsIcon icon={CheckmarkBadge01Icon} size={18} color="currentColor" strokeWidth={1.5} />}
          label="Award pts"
          value={stats?.awards ?? 0}
        />
      </div>

      {/* Streak row */}
      {longestStreak > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border-2 border-white/10 bg-pitch-900/60 p-6">
            <div className="mt-0 font-display text-4xl font-black text-chalk">
              {currentStreak > 0 ? `🔥 ${currentStreak}` : '—'}
            </div>
            <div className="mt-1 font-display text-sm font-bold uppercase tracking-widest text-chalk">Current streak</div>
          </div>
          <div className="rounded-2xl border-2 border-white/10 bg-pitch-900/60 p-6">
            <div className="mt-0 font-display text-4xl font-black text-chalk">{longestStreak}</div>
            <div className="mt-1 font-display text-sm font-bold uppercase tracking-widest text-chalk">Longest streak</div>
          </div>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <p className="font-mono text-base uppercase tracking-widest text-chalk">
          {picks} picks made · {stats?.settled ?? 0} settled
        </p>
        {stats && stats.settled > 0 && (
          <button
            onClick={shareStats}
            className="rounded-full border border-lime/30 bg-lime/10 px-4 py-1.5 font-display text-sm uppercase tracking-wide text-lime transition hover:bg-lime/20"
          >
            {shareState === 'copied' ? 'Copied ✓' : 'Share my stats'}
          </button>
        )}
      </div>

      {/* display name form */}
      <div className="mt-8 rounded-2xl border-2 border-white/10 bg-pitch-900/60 p-10 focus-within:border-gold/60 transition-colors">
        <label className="block font-display text-sm font-bold uppercase tracking-widest text-chalk mb-2">
          Display name
        </label>
        <p className="mb-3 text-base text-chalk">Shown on the leaderboard.</p>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={24}
          className="w-full rounded-xl border-2 border-white/15 bg-pitch-800 px-4 py-3 font-body text-chalk outline-none transition focus:border-gold"
        />
        <div className="mt-3 flex items-center justify-between">
          <button
            onClick={saveName}
            disabled={saving || !displayName.trim()}
            className="rounded-xl bg-lime px-5 py-2.5 font-body font-bold text-base uppercase tracking-wide text-pitch-950 transition hover:brightness-110 disabled:opacity-40"
          >
            {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}
          </button>
          <p className="font-mono text-base text-chalk">{email}</p>
        </div>
      </div>

      {/* password reset */}
      <div className="mt-4 rounded-2xl border-2 border-white/10 bg-pitch-900/60 p-10">
        <label className="block font-display text-sm font-bold uppercase tracking-widest text-chalk mb-2">
          Password
        </label>
        <p className="mb-4 text-base text-chalk">
          We'll send a reset link to <span className="text-lime">{email}</span>.
        </p>
        <button
          onClick={sendReset}
          disabled={resetState === 'sending' || resetState === 'sent'}
          className="rounded-xl border-2 border-white/15 px-5 py-2.5 font-body font-bold text-base uppercase tracking-wide text-chalk transition hover:border-white/40 hover:text-lime disabled:opacity-50"
        >
          {resetState === 'sending' ? 'Sending…'
            : resetState === 'sent' ? 'Link sent — check your email ✓'
            : resetState === 'error' ? 'Error — try again'
            : 'Send reset link'}
        </button>
      </div>
    </div>
  );
}

function StatCard({
  icon, label, value, accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className={`rounded-2xl border-2 p-6 ${accent ? 'border-gold/50 bg-gradient-to-br from-lime/10 to-pitch-900' : 'border-white/10 bg-pitch-900/60'}`}>
      <span className={accent ? 'text-lime' : 'text-chalk'}>{icon}</span>
      <div className={`mt-2 font-display text-4xl font-black ${accent ? 'text-lime' : 'text-chalk'}`}>
        {value}
      </div>
      <div className="mt-1 font-display text-sm font-bold uppercase tracking-widest text-chalk">{label}</div>
    </div>
  );
}
