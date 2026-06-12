'use client';

import { useMemo, useState } from 'react';

type Team = { id: number; name: string; tla: string | null };
type Fixture = {
  id: number;
  matchday: number | null;
  stage: string;
  group_label: string | null;
  kickoff: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
  home_team: Team | null;
  away_team: Team | null;
};

const DONE = new Set(['FINISHED']);
const LIVE = new Set(['IN_PLAY', 'PAUSED']);

export default function FixturePanel({ fixtures }: { fixtures: Fixture[] }) {
  const byMatchday = useMemo(() => {
    const groups = new Map<number, Fixture[]>();
    for (const f of fixtures) {
      const md = f.matchday ?? 0;
      if (!groups.has(md)) groups.set(md, []);
      groups.get(md)!.push(f);
    }
    return [...groups.entries()].sort((a, b) => a[0] - b[0]);
  }, [fixtures]);

  const [filter, setFilter] = useState<'all' | 'pending'>('pending');
  const filtered = useMemo(() => {
    if (filter === 'all') return byMatchday;
    return byMatchday
      .map(([md, list]) => [md, list.filter((f) => !DONE.has(f.status))] as [number, Fixture[]])
      .filter(([, list]) => list.length > 0);
  }, [byMatchday, filter]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl uppercase text-chalk">Fixture Scores</h2>
        <div className="flex rounded-xl border border-white/10 bg-pitch-800 p-0.5">
          {(['pending', 'all'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setFilter(v)}
              className={`rounded-lg px-3 py-1 font-mono text-sm uppercase tracking-widest transition ${
                filter === v ? 'bg-lime text-pitch-950' : 'text-chalk/50 hover:text-chalk'
              }`}
            >
              {v === 'pending' ? 'Pending' : 'All'}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-1 text-sm text-chalk/50">
        Override sets status to FINISHED and re-scores all predictions for that game.
      </p>

      {filtered.length === 0 && (
        <p className="mt-6 font-mono text-sm text-chalk/40">
          {filter === 'pending' ? 'All fixtures are finished.' : 'No fixtures found.'}
        </p>
      )}

      {filtered.map(([md, list]) => (
        <section key={md} className="mt-6">
          <div className="mb-2 flex items-center gap-3">
            <h3 className="font-display text-lg uppercase text-lime">Matchday {md}</h3>
            <span className="h-px flex-1 bg-white/10" />
          </div>
          <div className="space-y-1.5">
            {list.map((f) => (
              <FixtureRow key={f.id} fixture={f} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function FixtureRow({ fixture }: { fixture: Fixture }) {
  const [home, setHome] = useState(fixture.home_score != null ? String(fixture.home_score) : '');
  const [away, setAway] = useState(fixture.away_score != null ? String(fixture.away_score) : '');
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const finished = DONE.has(fixture.status);
  const live = LIVE.has(fixture.status);

  async function override() {
    const h = parseInt(home, 10);
    const a = parseInt(away, 10);
    if (isNaN(h) || isNaN(a)) return;
    setState('saving');
    const res = await fetch('/api/admin/set-fixture-score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fixture_id: fixture.id, home_score: h, away_score: a }),
    });
    if (res.ok) {
      setState('saved');
      setTimeout(() => setState('idle'), 2000);
    } else {
      setState('error');
    }
  }

  const ko = new Date(fixture.kickoff);
  const koLabel = ko.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className={`flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 ${
      finished ? 'border-white/5 bg-pitch-900/40' : live ? 'border-lime/20 bg-pitch-900/60' : 'border-white/10 bg-pitch-900/60'
    }`}>
      {/* Teams + score */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="truncate font-display text-sm uppercase text-chalk">
          {fixture.home_team?.name ?? 'TBD'}
        </span>
        <span className="font-mono text-sm text-chalk/40">
          {finished || live
            ? `${fixture.home_score ?? '?'} – ${fixture.away_score ?? '?'}`
            : 'vs'}
        </span>
        <span className="truncate font-display text-sm uppercase text-chalk">
          {fixture.away_team?.name ?? 'TBD'}
        </span>
      </div>

      {/* Status + kickoff */}
      <span className={`font-mono text-sm uppercase tracking-widest ${
        finished ? 'text-chalk/30' : live ? 'text-lime' : 'text-chalk/50'
      }`}>
        {finished ? 'FT' : live ? 'Live' : koLabel}
      </span>

      {/* Score inputs + button */}
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          min={0}
          max={30}
          value={home}
          onChange={(e) => setHome(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
          className="h-8 w-10 rounded-lg border border-white/15 bg-pitch-800 text-center font-mono text-sm text-chalk outline-none focus:border-lime/60"
          placeholder="H"
        />
        <span className="font-mono text-chalk/30">–</span>
        <input
          type="number"
          min={0}
          max={30}
          value={away}
          onChange={(e) => setAway(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
          className="h-8 w-10 rounded-lg border border-white/15 bg-pitch-800 text-center font-mono text-sm text-chalk outline-none focus:border-lime/60"
          placeholder="A"
        />
        <button
          onClick={override}
          disabled={home === '' || away === '' || state === 'saving'}
          className="rounded-lg bg-lime/15 px-3 py-1.5 font-display text-sm uppercase tracking-wide text-lime transition hover:bg-lime/25 disabled:opacity-30"
        >
          {state === 'saving' ? '…' : state === 'saved' ? '✓' : state === 'error' ? '!' : finished ? 'Override' : 'Set'}
        </button>
      </div>
    </div>
  );
}
