'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendLink() {
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/predict` },
    });
    setLoading(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-16">
      <Link href="/" className="font-mono text-xs uppercase tracking-[0.35em] text-lime">
        ← SOTG Predictor
      </Link>
      <h1 className="mt-6 font-display text-5xl uppercase leading-none text-chalk">
        Sign in
      </h1>

      {sent ? (
        <div className="mt-8 rounded-2xl border border-lime/30 bg-lime/5 p-6">
          <p className="font-display text-xl uppercase text-lime">Check your email</p>
          <p className="mt-2 text-sm text-chalk/70">
            We sent a magic link to <span className="text-chalk">{email}</span>. Tap it on this
            device to get into the predictor.
          </p>
        </div>
      ) : (
        <div className="mt-8">
          <label className="font-mono text-xs uppercase tracking-widest text-chalk/50">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && email && sendLink()}
            placeholder="you@email.com"
            className="mt-2 w-full rounded-xl border border-white/15 bg-pitch-900 px-4 py-3 text-chalk outline-none placeholder:text-chalk/30 focus:border-lime/60"
          />
          {error && <p className="mt-2 text-sm text-flame">{error}</p>}
          <button
            onClick={sendLink}
            disabled={!email || loading}
            className="mt-4 w-full rounded-xl bg-lime py-3 font-display text-lg uppercase tracking-wide text-pitch-950 transition hover:brightness-110 disabled:opacity-40"
          >
            {loading ? 'Sending…' : 'Send magic link'}
          </button>
          <p className="mt-4 text-center text-xs text-chalk/40">
            No password. We email you a one-tap sign-in link.
          </p>
        </div>
      )}
    </main>
  );
}
