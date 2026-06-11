'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Mode = 'signin' | 'signup' | 'sent';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset(next: Mode) {
    setError(null);
    setPassword('');
    setConfirm('');
    setMode(next);
  }

  async function signInWithPassword() {
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    router.push('/predict');
    router.refresh();
  }

  async function sendMagicLink() {
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/predict` },
    });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setMode('sent');
  }

  async function signUp() {
    if (password !== confirm) { setError('Passwords do not match'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    // If email confirmation is off, the session is live — go straight in.
    // If on, Supabase returns a user with no session — show a "check email" message.
    router.push('/predict');
    router.refresh();
  }

  const inputClass =
    'w-full rounded-xl border border-white/15 bg-pitch-900 px-4 py-3 text-chalk outline-none placeholder:text-chalk/30 focus:border-lime/60';

  if (mode === 'sent') {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-16">
        <Back />
        <h1 className="mt-6 font-display text-5xl uppercase leading-none text-chalk">Check your email</h1>
        <div className="mt-8 rounded-2xl border border-lime/30 bg-lime/5 p-6">
          <p className="text-sm text-chalk/70">
            We sent a magic link to <span className="text-chalk">{email}</span>. Tap it on this
            device to sign in.
          </p>
        </div>
        <button onClick={() => reset('signin')} className="mt-4 text-center text-xs text-chalk/40 underline-offset-2 hover:underline">
          Back to sign in
        </button>
      </main>
    );
  }

  if (mode === 'signup') {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-16">
        <Back />
        <h1 className="mt-6 font-display text-5xl uppercase leading-none text-chalk">Create account</h1>

        <div className="mt-8 space-y-4">
          <div>
            <label className="font-mono text-xs uppercase tracking-widest text-chalk/50">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com" className={`mt-2 ${inputClass}`} />
          </div>
          <div>
            <label className="font-mono text-xs uppercase tracking-widest text-chalk/50">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters" className={`mt-2 ${inputClass}`} />
          </div>
          <div>
            <label className="font-mono text-xs uppercase tracking-widest text-chalk/50">Confirm password</label>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && email && password && signUp()}
              placeholder="Same again" className={`mt-2 ${inputClass}`} />
          </div>

          {error && <p className="text-sm text-flame">{error}</p>}

          <button onClick={signUp} disabled={!email || !password || !confirm || loading}
            className="w-full rounded-xl bg-lime py-3 font-display text-lg uppercase tracking-wide text-pitch-950 transition hover:brightness-110 disabled:opacity-40">
            {loading ? 'Creating…' : 'Create account'}
          </button>
        </div>

        <p className="mt-6 text-center text-sm text-chalk/40">
          Already have an account?{' '}
          <button onClick={() => reset('signin')} className="text-lime underline-offset-2 hover:underline">
            Sign in
          </button>
        </p>
      </main>
    );
  }

  // mode === 'signin'
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-16">
      <Back />
      <h1 className="mt-6 font-display text-5xl uppercase leading-none text-chalk">Sign in</h1>

      <div className="mt-8 space-y-4">
        <div>
          <label className="font-mono text-xs uppercase tracking-widest text-chalk/50">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com" className={`mt-2 ${inputClass}`} />
        </div>
        <div>
          <label className="font-mono text-xs uppercase tracking-widest text-chalk/50">Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && email && password && signInWithPassword()}
            placeholder="Your password" className={`mt-2 ${inputClass}`} />
        </div>

        {error && <p className="text-sm text-flame">{error}</p>}

        <button onClick={signInWithPassword} disabled={!email || !password || loading}
          className="w-full rounded-xl bg-lime py-3 font-display text-lg uppercase tracking-wide text-pitch-950 transition hover:brightness-110 disabled:opacity-40">
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </div>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-white/10" />
        <span className="font-mono text-xs uppercase tracking-widest text-chalk/30">or</span>
        <div className="h-px flex-1 bg-white/10" />
      </div>

      <button onClick={sendMagicLink} disabled={!email || loading}
        className="w-full rounded-xl border border-white/15 py-3 font-display uppercase tracking-wide text-chalk/70 transition hover:border-lime/40 hover:text-chalk disabled:opacity-40">
        {loading ? 'Sending…' : 'Send magic link'}
      </button>
      <p className="mt-2 text-center text-xs text-chalk/35">
        We&apos;ll email you a one-tap sign-in link — no password needed.
      </p>

      <p className="mt-8 text-center text-sm text-chalk/40">
        New here?{' '}
        <button onClick={() => reset('signup')} className="text-lime underline-offset-2 hover:underline">
          Create an account
        </button>
      </p>
    </main>
  );
}

function Back() {
  return (
    <Link href="/" className="font-mono text-xs uppercase tracking-[0.35em] text-lime">
      ← SOTG Predictor
    </Link>
  );
}
