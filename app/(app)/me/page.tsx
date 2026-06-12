'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { HugeiconsIcon } from '@hugeicons/react';
import { UserCircleIcon, AnalyticsIcon, DartIcon, CheckmarkBadge01Icon } from '@hugeicons-pro/core-stroke-rounded';

export default function MePage() {
  const supabase = useMemo(() => createClient(), []);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [stats, setStats] = useState<{ total: number; exact: number; results: number; settled: number } | null>(null);
  const [picks, setPicks] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      setEmail(u.user.email ?? '');

      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', u.user.id)
        .single();
      if (profile) setDisplayName(profile.display_name ?? '');

      const { data: lb } = await supabase
        .from('leaderboard')
        .select('total_points, exact_scores, correct_results, settled_predictions')
        .eq('user_id', u.user.id)
        .single();
      if (lb)
        setStats({
          total: lb.total_points,
          exact: lb.exact_scores,
          results: lb.correct_results,
          settled: lb.settled_predictions,
        });

      const { count } = await supabase
        .from('match_predictions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', u.user.id);
      setPicks(count ?? 0);
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

  return (
    <div className="max-w-lg">
      <div className="flex items-center gap-3 mb-1">
        <span className="text-lime"><HugeiconsIcon icon={UserCircleIcon} size={18} color="currentColor" strokeWidth={1.5} /></span>
        <p className="font-display font-bold text-base tracking-[0.28em] uppercase text-lime">Profile</p>
      </div>
      <h1 className="font-display text-4xl uppercase text-chalk">You</h1>

      {/* stats grid */}
      <div className="mt-6 grid grid-cols-3 gap-3">
        <StatCard
          icon={<HugeiconsIcon icon={AnalyticsIcon} size={18} color="currentColor" strokeWidth={1.5} />}
          label="Total points"
          value={stats?.total ?? 0}
          accent
        />
        <StatCard
          icon={<HugeiconsIcon icon={DartIcon} size={18} color="currentColor" strokeWidth={1.5} />}
          label="Exact (5pt)"
          value={stats?.exact ?? 0}
        />
        <StatCard
          icon={<HugeiconsIcon icon={CheckmarkBadge01Icon} size={18} color="currentColor" strokeWidth={1.5} />}
          label="Result (1pt)"
          value={stats?.results ?? 0}
        />
      </div>

      <p className="mt-3 font-mono text-base uppercase tracking-widest text-chalk/35">
        {picks} picks made · {stats?.settled ?? 0} settled
      </p>

      {/* display name form */}
      <div className="mt-8 rounded-2xl border border-white/10 bg-pitch-900/60 p-5">
        <label className="block font-display text-sm font-bold uppercase tracking-widest text-chalk/50 mb-2">
          Display name
        </label>
        <p className="mb-3 text-base text-chalk/40">Shown on the leaderboard.</p>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={24}
          className="w-full rounded-xl border border-white/15 bg-pitch-800 px-4 py-3 font-body text-chalk outline-none transition focus:border-lime/60"
        />
        <div className="mt-3 flex items-center justify-between">
          <button
            onClick={saveName}
            disabled={saving || !displayName.trim()}
            className="rounded-xl bg-lime px-5 py-2.5 font-display text-base font-bold uppercase tracking-wide text-pitch-950 transition hover:brightness-110 disabled:opacity-40"
          >
            {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}
          </button>
          <p className="font-mono text-base text-chalk/30">{email}</p>
        </div>
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
    <div className={`rounded-2xl border p-4 ${accent ? 'border-lime/25 bg-gradient-to-br from-lime/10 to-pitch-900' : 'border-white/10 bg-pitch-900/60'}`}>
      <span className={accent ? 'text-lime' : 'text-chalk/40'}>{icon}</span>
      <div className={`mt-2 font-display text-4xl font-black ${accent ? 'text-lime' : 'text-chalk'}`}>
        {value}
      </div>
      <div className="mt-1 font-display text-sm font-bold uppercase tracking-widest text-chalk/40">{label}</div>
    </div>
  );
}
