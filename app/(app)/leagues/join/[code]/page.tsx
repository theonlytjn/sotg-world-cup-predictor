'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { HugeiconsIcon } from '@hugeicons/react';
import { Medal01Icon } from '@hugeicons-pro/core-stroke-rounded';

type LeagueInfo = { id: string; name: string; member_count: number };

export default function JoinLeaguePage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [league, setLeague] = useState<LeagueInfo | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [alreadyMember, setAlreadyMember] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { router.push(`/login?next=/leagues/join/${code}`); return; }
      setUserId(u.user.id);

      const { data: lg } = await supabase
        .from('leagues')
        .select('id, name')
        .eq('invite_code', code.toUpperCase())
        .maybeSingle();

      if (!lg) { setLoading(false); return; }

      const { count: memberCount } = await supabase
        .from('league_members')
        .select('*', { count: 'exact', head: true })
        .eq('league_id', lg.id);

      const { data: myRow } = await supabase
        .from('league_members')
        .select('user_id')
        .eq('league_id', lg.id)
        .eq('user_id', u.user.id)
        .maybeSingle();

      setLeague({ ...lg, member_count: memberCount ?? 0 });
      setAlreadyMember(!!myRow);
      setLoading(false);
    })();
  }, [supabase, code, router]);

  async function join() {
    if (!userId || !league) return;
    setJoining(true);
    setError('');
    const { error: e } = await supabase
      .from('league_members')
      .insert({ league_id: league.id, user_id: userId });
    if (e) { setError('Could not join — try again'); setJoining(false); return; }
    router.push(`/leagues/${league.id}`);
  }

  if (loading) {
    return <p className="py-20 text-center font-mono text-base text-chalk">Loading…</p>;
  }

  if (!league) {
    return (
      <div className="py-20 text-center">
        <p className="font-display text-2xl uppercase text-chalk">Invalid invite code</p>
        <p className="mt-2 text-base text-chalk">This league doesn&apos;t exist or the code is wrong.</p>
        <Link href="/leagues" className="mt-4 inline-block font-mono text-sm text-lime hover:underline">
          Go to your leagues
        </Link>
      </div>
    );
  }

  if (alreadyMember) {
    return (
      <div className="py-20 text-center">
        <span className="text-lime mx-auto block">
          <HugeiconsIcon icon={Medal01Icon} size={48} color="currentColor" strokeWidth={1.2} />
        </span>
        <p className="mt-4 font-display text-2xl uppercase text-chalk">Already a member</p>
        <p className="mt-1 text-base text-chalk">You&apos;re already in <span className="text-lime">{league.name}</span>.</p>
        <Link
          href={`/leagues/${league.id}`}
          className="mt-4 inline-block rounded-xl bg-lime px-6 py-2.5 font-body font-bold text-base text-pitch-950 transition hover:brightness-110"
        >
          View league
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md pt-12 pb-20 text-center">
      <span className="text-lime mx-auto block">
        <HugeiconsIcon icon={Medal01Icon} size={48} color="currentColor" strokeWidth={1.2} />
      </span>
      <p className="mt-4 font-display text-sm uppercase tracking-widest text-lime">You&apos;ve been invited</p>
      <h1 className="mt-2 font-display text-4xl uppercase text-chalk">{league.name}</h1>
      <p className="mt-2 font-mono text-sm text-chalk/50">
        {league.member_count} {league.member_count === 1 ? 'member' : 'members'} already playing
      </p>

      {error && <p className="mt-3 font-mono text-sm text-flame">{error}</p>}

      <div className="mt-8 flex flex-col items-center gap-3">
        <button
          onClick={join}
          disabled={joining}
          className="w-full max-w-xs rounded-xl bg-lime px-6 py-3 font-body font-bold text-base text-pitch-950 transition hover:brightness-110 disabled:opacity-40"
        >
          {joining ? 'Joining…' : `Join ${league.name}`}
        </button>
        <Link href="/leagues" className="font-mono text-sm text-chalk/40 hover:text-chalk transition">
          Back to leagues
        </Link>
      </div>
    </div>
  );
}
