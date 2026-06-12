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
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState<'nickname' | 'league'>('nickname');

  // League step state
  const [leagueCode, setLeagueCode] = useState('');
  const [leagueJoining, setLeagueJoining] = useState(false);
  const [leagueError, setLeagueError] = useState<string | null>(null);

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

  async function saveNickname() {
    const name = nickname.trim();
    if (!name || !userId) return;
    setError(null);
    setChecking(true);

    const supabase = createClient();

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
      if (updateError.code === '23505') {
        setError('That nickname is already taken — pick another.');
      } else {
        setError(updateError.message);
      }
      return;
    }

    setStep('league');
  }

  async function joinLeague() {
    const code = leagueCode.trim().toUpperCase();
    if (!code || !userId) return;
    setLeagueJoining(true);
    setLeagueError(null);

    const supabase = createClient();

    const { data: league } = await supabase
      .from('leagues')
      .select('id, name')
      .eq('invite_code', code)
      .maybeSingle();

    if (!league) {
      setLeagueError('No league found with that code. Double-check and try again.');
      setLeagueJoining(false);
      return;
    }

    const { error: joinError } = await supabase
      .from('league_members')
      .upsert({ league_id: league.id, user_id: userId }, { onConflict: 'league_id,user_id', ignoreDuplicates: true });

    setLeagueJoining(false);

    if (joinError) {
      setLeagueError(joinError.message);
      return;
    }

    router.replace('/predict');
  }

  if (!ready) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <p className="font-mono text-base text-chalk">Loading…</p>
      </main>
    );
  }

  if (step === 'league') {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-16">
        <p className="font-mono text-base uppercase tracking-[0.35em] text-lime">Step 2 of 2</p>
        <h1 className="mt-4 font-display text-5xl uppercase leading-none text-chalk">
          Got an invite code?
        </h1>
        <p className="mt-3 text-base text-chalk">
          If someone sent you a league code, enter it now to join their private table. You can always join later from the Leagues page.
        </p>

        <div className="mt-8">
          <label className="font-mono text-base uppercase tracking-widest text-chalk">League code</label>
          <input
            type="text"
            value={leagueCode}
            onChange={(e) => { setLeagueCode(e.target.value.toUpperCase()); setLeagueError(null); }}
            onKeyDown={(e) => e.key === 'Enter' && leagueCode.trim() && joinLeague()}
            placeholder="e.g. ABC123"
            maxLength={12}
            autoFocus
            className="mt-2 w-full rounded-xl border border-white/15 bg-pitch-900 px-4 py-3 font-mono text-base text-chalk outline-none placeholder:text-chalk/40 focus:border-gold tracking-widest uppercase"
          />
          {leagueError && <p className="mt-2 text-base text-flame">{leagueError}</p>}

          <button
            onClick={joinLeague}
            disabled={!leagueCode.trim() || leagueJoining}
            className="mt-5 w-full rounded-xl bg-lime py-3 font-body font-bold text-lg uppercase tracking-wide text-pitch-950 transition hover:brightness-110 disabled:opacity-40"
          >
            {leagueJoining ? 'Joining…' : 'Join league'}
          </button>

          <button
            onClick={() => router.replace('/predict')}
            className="mt-3 w-full rounded-xl border border-white/15 py-3 font-body font-bold text-base uppercase tracking-wide text-chalk transition hover:border-white/40"
          >
            Skip — take me to predictions
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-16">
      <p className="font-mono text-base uppercase tracking-[0.35em] text-lime">Step 1 of 2</p>
      <h1 className="mt-4 font-display text-5xl uppercase leading-none text-chalk">
        Choose your nickname
      </h1>
      <p className="mt-3 text-base text-chalk">
        This is how you&apos;ll appear on the leaderboard. Pick something good — you can&apos;t
        change it later without asking the admin.
      </p>

      <div className="mt-8">
        <label className="font-mono text-base uppercase tracking-widest text-chalk">Nickname</label>
        <input
          type="text"
          value={nickname}
          onChange={(e) => { setNickname(e.target.value); setError(null); }}
          onKeyDown={(e) => e.key === 'Enter' && nickname.trim() && saveNickname()}
          placeholder="e.g. GoalMachine"
          maxLength={24}
          autoFocus
          className="mt-2 w-full rounded-xl border border-white/15 bg-pitch-900 px-4 py-3 text-base text-chalk outline-none placeholder:text-chalk focus:border-gold"
        />
        {error && <p className="mt-2 text-base text-flame">{error}</p>}
        <p className="mt-1 font-mono text-base text-chalk">Max 24 characters · must be unique</p>

        <button
          onClick={saveNickname}
          disabled={!nickname.trim() || checking}
          className="mt-5 w-full rounded-xl bg-lime py-3 font-body font-bold text-lg uppercase tracking-wide text-pitch-950 transition hover:brightness-110 disabled:opacity-40"
        >
          {checking ? 'Checking…' : 'Next →'}
        </button>
      </div>
    </main>
  );
}
