'use client';

import { useEffect, useState } from 'react';

type Profile = { id: string; display_name: string; username: string | null };
type Fixture = {
  id: number;
  matchday: number | null;
  kickoff: string;
  home_team: { name: string; tla: string | null } | null;
  away_team: { name: string; tla: string | null } | null;
};
type PredRow = { user_id: string; home_pred: number; away_pred: number };

export default function ManualPredictionsPanel({
  profiles,
  fixtures,
}: {
  profiles: Profile[];
  fixtures: Fixture[];
}) {
  const [fixtureId, setFixtureId] = useState<number | ''>('');
  const [existing, setExisting] = useState<Record<string, PredRow>>({});
  const [draft, setDraft] = useState<Record<string, { home: string; away: string }>>({});
  const [states, setStates] = useState<Record<string, 'idle' | 'saving' | 'saved' | 'error'>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!fixtureId) return;
    setLoading(true);
    fetch(`/api/admin/get-predictions?fixture_id=${fixtureId}`)
      .then((r) => r.json())
      .then((rows: PredRow[]) => {
        const map: Record<string, PredRow> = {};
        for (const r of rows) map[r.user_id] = r;
        setExisting(map);
        const d: Record<string, { home: string; away: string }> = {};
        for (const p of profiles) {
          const ex = map[p.id];
          d[p.id] = { home: ex ? String(ex.home_pred) : '', away: ex ? String(ex.away_pred) : '' };
        }
        setDraft(d);
        setStates({});
      })
      .finally(() => setLoading(false));
  }, [fixtureId, profiles]);

  function setCell(userId: string, side: 'home' | 'away', val: string) {
    setDraft((prev) => ({ ...prev, [userId]: { ...prev[userId], [side]: val.replace(/[^0-9]/g, '').slice(0, 2) } }));
  }

  async function save(userId: string) {
    const d = draft[userId];
    const h = parseInt(d?.home ?? '', 10);
    const a = parseInt(d?.away ?? '', 10);
    if (isNaN(h) || isNaN(a) || !fixtureId) return;
    setStates((s) => ({ ...s, [userId]: 'saving' }));
    const res = await fetch('/api/admin/set-prediction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fixture_id: fixtureId, user_id: userId, home_pred: h, away_pred: a }),
    });
    setStates((s) => ({ ...s, [userId]: res.ok ? 'saved' : 'error' }));
    if (res.ok) setTimeout(() => setStates((s) => ({ ...s, [userId]: 'idle' })), 2000);
  }

  const selectedFixture = fixtures.find((f) => f.id === fixtureId);

  return (
    <div>
      <h2 className="font-display text-2xl uppercase text-chalk">Manual Predictions</h2>
      <p className="mt-1 text-sm text-chalk/50">
        Set predictions on behalf of any user for a past fixture (bypasses the kickoff lock). Use for
        the opening match where predictions were submitted manually.
      </p>

      <div className="mt-4">
        <label className="block font-mono text-sm uppercase tracking-widest text-chalk/50 mb-1.5">
          Select fixture
        </label>
        <select
          value={fixtureId}
          onChange={(e) => setFixtureId(e.target.value ? Number(e.target.value) : '')}
          className="w-full max-w-md rounded-xl border border-white/15 bg-pitch-800 px-3 py-2 font-mono text-sm text-chalk outline-none focus:border-lime/60"
        >
          <option value="">— choose a fixture —</option>
          {fixtures.map((f) => {
            const ko = new Date(f.kickoff).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            const ht = f.home_team?.name ?? '?';
            const at = f.away_team?.name ?? '?';
            return (
              <option key={f.id} value={f.id}>
                MD{f.matchday ?? '?'} · {ht} vs {at} ({ko})
              </option>
            );
          })}
        </select>
      </div>

      {fixtureId && (
        <div className="mt-6">
          {loading ? (
            <p className="font-mono text-sm text-chalk/40">Loading…</p>
          ) : (
            <>
              {selectedFixture && (
                <p className="mb-4 font-display text-sm uppercase tracking-wide text-chalk/60">
                  {selectedFixture.home_team?.name} vs {selectedFixture.away_team?.name} ·{' '}
                  {new Date(selectedFixture.kickoff).toLocaleString(undefined, {
                    weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                  })}
                </p>
              )}
              <div className="space-y-2">
                {profiles.map((p) => {
                  const d = draft[p.id] ?? { home: '', away: '' };
                  const st = states[p.id] ?? 'idle';
                  const hasExisting = !!existing[p.id];
                  return (
                    <div key={p.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-pitch-900/60 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <span className="font-display text-sm uppercase text-chalk">{p.display_name}</span>
                        {hasExisting && (
                          <span className="ml-2 font-mono text-sm text-lime/70">existing</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={0}
                          max={30}
                          value={d.home}
                          onChange={(e) => setCell(p.id, 'home', e.target.value)}
                          placeholder="H"
                          className="h-8 w-10 rounded-lg border border-white/15 bg-pitch-800 text-center font-mono text-sm text-chalk outline-none focus:border-lime/60"
                        />
                        <span className="font-mono text-chalk/30">–</span>
                        <input
                          type="number"
                          min={0}
                          max={30}
                          value={d.away}
                          onChange={(e) => setCell(p.id, 'away', e.target.value)}
                          placeholder="A"
                          className="h-8 w-10 rounded-lg border border-white/15 bg-pitch-800 text-center font-mono text-sm text-chalk outline-none focus:border-lime/60"
                        />
                        <button
                          onClick={() => save(p.id)}
                          disabled={d.home === '' || d.away === '' || st === 'saving'}
                          className="rounded-lg bg-lime/15 px-3 py-1.5 font-display text-sm uppercase tracking-wide text-lime transition hover:bg-lime/25 disabled:opacity-30"
                        >
                          {st === 'saving' ? '…' : st === 'saved' ? '✓' : st === 'error' ? '!' : hasExisting ? 'Update' : 'Set'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-4 font-mono text-sm text-chalk/30">
                After setting all predictions, go to Fixture Scores above and set the final score — this will score everyone automatically.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
