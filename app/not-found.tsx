import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-pitch-950 px-6 text-center">
      <p className="font-display text-8xl font-black text-lime">404</p>
      <h1 className="mt-3 font-display text-3xl uppercase text-chalk">Page not found</h1>
      <p className="mt-2 text-base text-chalk">
        That page doesn&apos;t exist — you may have followed a stale link.
      </p>
      <Link
        href="/predict"
        className="mt-8 rounded-xl bg-lime px-6 py-3 font-body font-bold text-base uppercase tracking-wide text-pitch-950 transition hover:brightness-110"
      >
        Back to predict
      </Link>
    </main>
  );
}
