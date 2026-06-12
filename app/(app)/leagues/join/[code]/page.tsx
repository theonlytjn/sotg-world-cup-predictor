'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { HugeiconsIcon } from '@hugeicons/react';
import { Medal01Icon } from '@hugeicons-pro/core-stroke-rounded';

export default function JoinLeaguePage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [status, setStatus] = useState<'loading' | 'joining' | 'joined' | 'already' | 'not_found' | 'error'>('loading');
  const [leagueName, setLeagueName] = useState('');
  const [leagueId, setLeagueId] = useState('');

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        // Not logged in — redirect to login, which will bounce back here after auth
        router.push(`/login?next=/leagues/join/${code}`);
        return;
      }

      const { data: lg } = await supabase
        .from('leagues')
        .select('id, name')
        .eq('invite_code', code.toUpperCase())
        .maybeSingle();

      if (!lg) { setStatus('not_found'); return; }
      setLeagueName(lg.name);
      setLeagueId(lg.id);

      // Check if already a member
      const { data: existing } = await supabase
        .from('league_members')
        .select('user_id')
        .eq('league_id', lg.id)
        .eq('user_id', u.user.id)
        .maybeSingle();

      if (existing) {
        // Already in — go straight to the league
        router.replace(`/leagues/${lg.id}`);
        return;
      }

      // Auto-join
      setStatus('joining');
      const { error } = await supabase
        .from('league_members')
        .insert({ league_id: lg.id, user_id: u.user.id });

      if (error) { setStatus('error'); return; }

      setStatus('joined');
      // Brief "joined" flash then redirect
      setTimeout(() => router.replace(`/leagues/${lg.id}`), 1200);
    })();
  }, [supabase, code, router]);

  if (status === 'loading' || status === 'joining') {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <span className="text-lime animate-pulse">
          <HugeiconsIcon icon={Medal01Icon} size={48} color="currentColor" strokeWidth={1.2} />
        </span>
        <p className="font-mono text-base text-chalk">
          {status === 'joining' ? 'Joining league…' : 'Loading…'}
        </p>
      </div>
    );
  }

  if (status === 'joined') {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
        <span className="text-lime">
          <HugeiconsIcon icon={Medal01Icon} size={48} color="currentColor" strokeWidth={1.2} />
        </span>
        <p className="font-display text-2xl uppercase text-chalk">You&apos;re in!</p>
        <p className="font-mono text-base text-lime">{leagueName}</p>
        <p className="font-mono text-sm text-chalk/40">Taking you there now…</p>
      </div>
    );
  }

  if (status === 'not_found') {
    return (
      <div className="py-20 text-center">
        <p className="font-display text-2xl uppercase text-chalk">Invalid invite link</p>
        <p className="mt-2 text-base text-chalk">This league doesn&apos;t exist or the link has expired.</p>
        <Link href="/leagues" className="mt-4 inline-block font-mono text-sm text-lime hover:underline">
          Back to leagues
        </Link>
      </div>
    );
  }

  // error
  return (
    <div className="py-20 text-center">
      <p className="font-display text-2xl uppercase text-chalk">Something went wrong</p>
      <p className="mt-2 text-base text-chalk">Couldn&apos;t join the league — try the link again.</p>
      <Link href="/leagues" className="mt-4 inline-block font-mono text-sm text-lime hover:underline">
        Back to leagues
      </Link>
    </div>
  );
}
