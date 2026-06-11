'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

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
      <h1 className="font-display text-4xl uppercase text-chalk">You</h1>

      <div className="mt-6 grid grid-cols-3 gap-3">
        <Stat big label="Points" value={stats?.total ?? 0} accent />
        <Stat label="Exact (5pt)" value={stats?.exact ?? 0} />
        <Stat label="Results (1pt)" value={stats?.results ?? 0} />
      </div>
      <p className="mt-3 font-mono text-xs uppercase tracking-widest text-chalk/40">
        {picks} picks made · {stats?.settled ?? 0} settled
      </p>

      <div className="mt-8 rounded-2xl border border-white/10 bg-pitch-900/60 p-5">
        <label className="font-mono text-xs uppercase tracking-widest text-chalk/50">
          Display name (shown on the table)
        </label>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={24}
          className="mt-2 w-full rounded-xl border border-white/15 bg-pitch-800 px-4 py-3 text-chalk outline-none focus:border-lime/60"
        />
        <button
          onClick={saveName}
          disabled={saving || !displayName.trim()}
          className="mt-3 rounded-xl bg-lime px-5 py-2.5 font-display uppercase tracking-wide text-pitch-950 transition hover:brightness-110 disabled:opacity-40"
        >
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}
        </button>
        <p className="mt-4 font-mono text-xs text-chalk/30">Signed in as {email}</p>
      </div>
    </div>
  );
}

function Stat({ label, value, big, accent }: { label: string; value: number; big?: boolean; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-pitch-900/60 p-4">
      <div className={`font-display ${big ? 'text-5xl' : 'text-4xl'} ${accent ? 'text-lime' : 'text-chalk'}`}>
        {value}
      </div>
      <div className="mt-1 font-mono text-[10px] uppercase tracking-widest text-chalk/40">{label}</div>
    </div>
  );
}
