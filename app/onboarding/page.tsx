'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function OnboardingPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [nickname, setNickname] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/login'); return; }

      const { data: profile } = await supabase
        .from('profiles')
        .select('nickname_set')
        .eq('id', user.id)
        .single();

      if (profile?.nickname_set) { router.replace('/predict'); return; }

      setUserId(user.id);
      setReady(true);
    })();
  }, [router]);

  async function save() {
    const name = nickname.trim();
    if (!name || !userId) return;
    setError(null);
    setChecking(true);

    const supabase = createClient();

    // Uniqueness check
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .ilike('display_name', name)
      .neq('id', userId)
      .maybeSingle();

    if (existing) {
      setError('That nickname is already taken — pick another.');
      setChecking(false);
      return;
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ display_name: name, nickname_set: true })
      .eq('id', userId);

    setChecking(false);

    if (updateError) {
      // Unique constraint violation (race condition)
      if (updateError.code === '23505') {
        setError('That nickname is already taken — pick another.');
      } else {
        setError(updateError.message);
      }
      return;
    }

    setSaved(true);
    router.replace('/predict');
  }

  if (!ready) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <p className="font-mono text-sm text-chalk/40">Loading…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-16">
      <p className="font-mono text-sm uppercase tracking-[0.35em] text-lime">Welcome</p>
      <h1 className="mt-4 font-display text-5xl uppercase leading-none text-chalk">
        Choose your nickname
      </h1>
      <p className="mt-3 text-sm text-chalk/55">
        This is how you&apos;ll appear on the leaderboard. Pick something good — you can&apos;t
        change it later without asking the admin.
      </p>

      <div className="mt-8">
        <label className="font-mono text-sm uppercase tracking-widest text-chalk/50">Nickname</label>
        <input
          type="text"
          value={nickname}
          onChange={(e) => { setNickname(e.target.value); setError(null); }}
          onKeyDown={(e) => e.key === 'Enter' && nickname.trim() && save()}
          placeholder="e.g. GoalMachine"
          maxLength={24}
          autoFocus
          className="mt-2 w-full rounded-xl border border-white/15 bg-pitch-900 px-4 py-3 text-chalk outline-none placeholder:text-chalk/30 focus:border-lime/60"
        />
        {error && <p className="mt-2 text-sm text-flame">{error}</p>}
        <p className="mt-1 font-mono text-sm text-chalk/30">Max 24 characters · must be unique</p>

        <button
          onClick={save}
          disabled={!nickname.trim() || checking || saved}
          className="mt-5 w-full rounded-xl bg-lime py-3 font-display text-lg uppercase tracking-wide text-pitch-950 transition hover:brightness-110 disabled:opacity-40"
        >
          {checking ? 'Checking…' : saved ? 'Done ✓' : "Let's go"}
        </button>
      </div>
    </main>
  );
}
