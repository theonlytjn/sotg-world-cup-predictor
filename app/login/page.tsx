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

  async function signInWithGoogle() {
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/predict`,
      },
    });
    setLoading(false);
    if (error) setError(error.message);
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
    router.push('/predict');
    router.refresh();
  }

  const inputClass =
    'w-full rounded-xl border border-white/15 bg-pitch-900 px-4 py-3.5 text-chalk text-base outline-none placeholder:text-chalk/30 focus:border-lime/60';

  if (mode === 'sent') {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-16">
        <Back />
        <h1 className="mt-6 font-display text-5xl uppercase leading-none text-chalk">Check your email</h1>
        <div className="mt-8 rounded-2xl border border-lime/30 bg-lime/5 p-6">
          <p className="text-base text-chalk/70">
            We sent a magic link to <span className="text-chalk">{email}</span>. Tap it on this
            device to sign in.
          </p>
        </div>
        <button onClick={() => reset('signin')} className="mt-4 text-center text-base text-chalk/40 underline-offset-2 hover:underline">
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

        {/* Google sign-up */}
        <div className="mt-8">
          <GoogleButton onClick={signInWithGoogle} loading={loading} />
        </div>

        <Divider />

        <div className="space-y-4">
          <div>
            <label className="font-mono text-base uppercase tracking-widest text-chalk/50">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com" className={`mt-2 ${inputClass}`} />
          </div>
          <div>
            <label className="font-mono text-base uppercase tracking-widest text-chalk/50">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters" className={`mt-2 ${inputClass}`} />
          </div>
          <div>
            <label className="font-mono text-base uppercase tracking-widest text-chalk/50">Confirm password</label>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && email && password && signUp()}
              placeholder="Same again" className={`mt-2 ${inputClass}`} />
          </div>

          {error && <p className="text-base text-flame">{error}</p>}

          <button onClick={signUp} disabled={!email || !password || !confirm || loading}
            className="w-full rounded-xl bg-lime py-3.5 font-display text-lg uppercase tracking-wide text-pitch-950 transition hover:brightness-110 disabled:opacity-40">
            {loading ? 'Creating…' : 'Create account'}
          </button>
        </div>

        <p className="mt-6 text-center text-base text-chalk/40">
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

      {/* Google OAuth — primary option */}
      <div className="mt-8">
        <GoogleButton onClick={signInWithGoogle} loading={loading} />
      </div>

      <Divider />

      <div className="space-y-4">
        <div>
          <label className="font-mono text-base uppercase tracking-widest text-chalk/50">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com" className={`mt-2 ${inputClass}`} />
        </div>
        <div>
          <label className="font-mono text-base uppercase tracking-widest text-chalk/50">Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && email && password && signInWithPassword()}
            placeholder="Your password" className={`mt-2 ${inputClass}`} />
        </div>

        {error && <p className="text-base text-flame">{error}</p>}

        <button onClick={signInWithPassword} disabled={!email || !password || loading}
          className="w-full rounded-xl bg-lime py-3.5 font-display text-lg uppercase tracking-wide text-pitch-950 transition hover:brightness-110 disabled:opacity-40">
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </div>

      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-white/10" />
        <span className="font-mono text-base uppercase tracking-widest text-chalk/30">or</span>
        <div className="h-px flex-1 bg-white/10" />
      </div>

      <button onClick={sendMagicLink} disabled={!email || loading}
        className="w-full rounded-xl border border-white/15 py-3.5 font-display text-base uppercase tracking-wide text-chalk/70 transition hover:border-lime/40 hover:text-chalk disabled:opacity-40">
        {loading ? 'Sending…' : 'Send magic link'}
      </button>
      <p className="mt-2 text-center text-base text-chalk/35">
        We&apos;ll email you a one-tap sign-in link — no password needed.
      </p>

      <p className="mt-8 text-center text-base text-chalk/40">
        New here?{' '}
        <button onClick={() => reset('signup')} className="text-lime underline-offset-2 hover:underline">
          Create an account
        </button>
      </p>
    </main>
  );
}

function GoogleButton({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="w-full flex items-center justify-center gap-3 rounded-xl border border-white/15 bg-white py-3.5 font-display text-base uppercase tracking-wide text-[#1f1f1f] transition hover:bg-white/90 active:scale-[0.99] disabled:opacity-50"
    >
      {/* Google 'G' logo */}
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
      Continue with Google
    </button>
  );
}

function Divider() {
  return (
    <div className="my-6 flex items-center gap-3">
      <div className="h-px flex-1 bg-white/10" />
      <span className="font-mono text-base uppercase tracking-widest text-chalk/30">or</span>
      <div className="h-px flex-1 bg-white/10" />
    </div>
  );
}

function Back() {
  return (
    <Link href="/" className="font-mono text-base uppercase tracking-[0.35em] text-lime">
      ← SOTG Predictor
    </Link>
  );
}
