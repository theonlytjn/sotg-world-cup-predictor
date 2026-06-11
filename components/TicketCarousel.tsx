'use client';

import { useEffect, useReducer, useRef } from 'react';

const fixtures = [
  { grp: 'Group D · Matchday 1', hf: '🏴', ht: 'ENG', af: '🇫🇷', at: 'FRA', hs: 2, as: 1, pts: '+5 pts', exact: true },
  { grp: 'Group A · Matchday 2', hf: '🇧🇷', ht: 'BRA', af: '🇰🇷', at: 'KOR', hs: 3, as: 1, pts: '+5 pts', exact: true },
  { grp: 'Group C · Matchday 1', hf: '🇦🇷', ht: 'ARG', af: '🇲🇽', at: 'MEX', hs: 1, as: 1, pts: '+1 pt',  exact: false },
  { grp: 'Group F · Matchday 3', hf: '🇪🇸', ht: 'ESP', af: '🇳🇱', at: 'NED', hs: 2, as: 0, pts: '+5 pts', exact: true },
];

export default function TicketCarousel() {
  const [idx, advance] = useReducer((i: number) => (i + 1) % fixtures.length, 0);
  const flipRef = useRef<HTMLSpanElement[]>([]);
  const ptsRef = useRef<HTMLSpanElement>(null);

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

  return (
    <div
      className="relative rounded-[28px] border border-white/8 p-7"
      style={{ background: 'linear-gradient(160deg, #121a14, #0b110d)', boxShadow: '0 30px 70px -30px rgba(0,0,0,0.8)' }}
    >
      {/* ticket notch cutouts */}
      <span className="absolute -left-3.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-pitch-950" />
      <span className="absolute -right-3.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-pitch-950" />

      <div className="flex justify-between font-display text-[11px] font-semibold uppercase tracking-[0.22em] text-chalk/60">
        <span>{f.grp}</span>
        <span>90 mins</span>
      </div>

      <div className="my-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="flex flex-col items-center gap-2">
          <span className="text-4xl" style={{ filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.4))' }}>{f.hf}</span>
          <span className="font-display text-xl font-black tracking-wide">{f.ht}</span>
        </div>
        <div className="flex items-center gap-3 font-display font-black" style={{ fontSize: 'clamp(40px,6vw,58px)' }}>
          <span ref={(el) => { if (el) flipRef.current[0] = el; }} className="inline-block min-w-[0.7em] text-center">{f.hs}</span>
          <span className="text-[0.6em] text-chalk/25">–</span>
          <span ref={(el) => { if (el) flipRef.current[1] = el; }} className="inline-block min-w-[0.7em] text-center">{f.as}</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <span className="text-4xl" style={{ filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.4))' }}>{f.af}</span>
          <span className="font-display text-xl font-black tracking-wide">{f.at}</span>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-dashed border-white/8 pt-4 mt-4">
        <span className="font-display text-[12px] font-semibold uppercase tracking-[0.16em] text-chalk/60">Your call</span>
        <span
          ref={ptsRef}
          className={`font-display text-[15px] font-black rounded-full px-3.5 py-1.5 ${
            f.exact
              ? 'bg-lime text-pitch-950'
              : 'bg-lime/18 text-lime'
          }`}
        >
          {f.pts}
        </span>
      </div>
    </div>
  );
}
