'use client';

import { useEffect, useReducer, useRef } from 'react';

const fixtures = [
  { grp: 'Group D · Matchday 1', hf: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', ht: 'ENG', af: '🇫🇷', at: 'FRA', hs: 2, as: 1, pts: '+5 pts', exact: true },
  { grp: 'Group A · Matchday 2', hf: '🇧🇷', ht: 'BRA', af: '🇰🇷', at: 'KOR', hs: 3, as: 1, pts: '+5 pts', exact: true },
  { grp: 'Group C · Matchday 1', hf: '🇦🇷', ht: 'ARG', af: '🇲🇽', at: 'MEX', hs: 1, as: 1, pts: '+1 pt',  exact: false },
  { grp: 'Group F · Matchday 3', hf: '🇪🇸', ht: 'ESP', af: '🇳🇱', at: 'NED', hs: 2, as: 0, pts: '+5 pts', exact: true },
];

export default function TicketCarousel() {
  const [idx, advance] = useReducer((i: number) => (i + 1) % fixtures.length, 0);
  const flipRef = useRef<HTMLSpanElement[]>([]);
  const ptsRef  = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;
    const id = setInterval(() => {
      advance();
      flipRef.current.forEach((el) => {
        if (!el) return;
        el.classList.remove('flip-anim');
        void el.offsetWidth;
        el.classList.add('flip-anim');
      });
      if (ptsRef.current) {
        ptsRef.current.classList.remove('pop-anim');
        void ptsRef.current.offsetWidth;
        ptsRef.current.classList.add('pop-anim');
      }
    }, 3200);
    return () => clearInterval(id);
  }, []);

  const f = fixtures[idx];
  const BORDER = '#272727';
  const BG_BODY = 'linear-gradient(160deg, #121a14 0%, #0b110d 100%)';
  const BG_STUB = 'linear-gradient(160deg, #0d130f 0%, #080c09 100%)';

  return (
    /* overflow-visible so the notch circles can poke outside */
    <div className="relative overflow-visible" style={{ filter: 'drop-shadow(0 24px 48px rgba(0,0,0,0.7))' }}>

      {/* ── Ticket body ───────────────────────────────────── */}
      <div
        className="rounded-t-[26px] px-7 pt-5 pb-6"
        style={{ background: BG_BODY, border: `1px solid ${BORDER}`, borderBottom: 'none' }}
      >
        {/* Header row */}
        <div className="flex items-center justify-between">
          <span
            ref={(el) => { if (el) flipRef.current[2] = el; }}
            className="font-display text-[11px] font-semibold uppercase tracking-[0.22em] text-chalk/55"
          >
            {f.grp}
          </span>
          <span className="rounded-full border border-[#272727] px-2.5 py-1 font-mono text-[9px] uppercase tracking-widest text-chalk/40">
            FT
          </span>
        </div>

        {/* Score row */}
        <div className="my-6 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <div className="flex flex-col items-center gap-2">
            <span className="text-[44px] leading-none" style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))' }}>
              {f.hf}
            </span>
            <span className="font-display text-xl font-black uppercase tracking-wide text-chalk">{f.ht}</span>
          </div>

          <div
            className="flex items-center gap-3 font-display font-black text-chalk"
            style={{ fontSize: 'clamp(42px,6vw,60px)' }}
          >
            <span ref={(el) => { if (el) flipRef.current[0] = el; }} className="inline-block min-w-[0.7em] text-center">
              {f.hs}
            </span>
            <span className="text-[0.55em] text-chalk/25">–</span>
            <span ref={(el) => { if (el) flipRef.current[1] = el; }} className="inline-block min-w-[0.7em] text-center">
              {f.as}
            </span>
          </div>

          <div className="flex flex-col items-center gap-2">
            <span className="text-[44px] leading-none" style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))' }}>
              {f.af}
            </span>
            <span className="font-display text-xl font-black uppercase tracking-wide text-chalk">{f.at}</span>
          </div>
        </div>
      </div>

      {/* ── Perforation line with notch circles ──────────── */}
      <div
        className="relative h-px"
        style={{ background: BORDER }}
      >
        {/* Dashed overlay on top of solid line */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent 6px, #0b110d 6px, #0b110d 10px)`,
          }}
        />
        {/* Left notch */}
        <span
          className="absolute top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-pitch-950"
          style={{ left: -14, boxShadow: `0 0 0 1px ${BORDER}` }}
        />
        {/* Right notch */}
        <span
          className="absolute top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-pitch-950"
          style={{ right: -14, boxShadow: `0 0 0 1px ${BORDER}` }}
        />
      </div>

      {/* ── Ticket stub ───────────────────────────────────── */}
      <div
        className="rounded-b-[26px] px-7 py-4 flex items-center justify-between"
        style={{ background: BG_STUB, border: `1px solid ${BORDER}`, borderTop: 'none' }}
      >
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-chalk/35">Your prediction</p>
          <p className="mt-0.5 font-display text-sm font-semibold uppercase tracking-wide text-chalk/70">
            {f.ht} {f.hs} – {f.as} {f.at}
          </p>
        </div>
        <span
          ref={ptsRef}
          className={[
            'font-display text-[15px] font-black rounded-full px-4 py-1.5',
            f.exact ? 'bg-lime text-pitch-950' : 'bg-lime/15 text-lime',
          ].join(' ')}
        >
          {f.pts}
        </span>
      </div>
    </div>
  );
}
