'use client';

import { useState } from 'react';

type Rule = { key: string; label: string; description: string; points: number };

export default function ScoringPanel({ rules }: { rules: Rule[] }) {
  return (
    <div>
      <h2 className="font-display text-2xl uppercase text-chalk">Scoring Rules</h2>
      <p className="mt-1 text-sm text-chalk/50">
        Changes take effect on the next cron run or manual fixture score override.
      </p>
      <div className="mt-4 space-y-2">
        {rules.map((r) => (
          <RuleRow key={r.key} rule={r} />
        ))}
      </div>
    </div>
  );
}

function RuleRow({ rule }: { rule: Rule }) {
  const [points, setPoints] = useState(String(rule.points));
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  async function save() {
    const pts = parseInt(points, 10);
    if (isNaN(pts) || pts < 0) return;
    setState('saving');
    const res = await fetch('/api/admin/set-scoring-rule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: rule.key, points: pts }),
    });
    setState(res.ok ? 'saved' : 'error');
    if (res.ok) setTimeout(() => setState('idle'), 1500);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-pitch-900/60 px-4 py-3">
      <div className="flex-1 min-w-0">
        <p className="font-display text-base uppercase tracking-wide text-chalk">{rule.label}</p>
        <p className="font-mono text-xs text-chalk/40">{rule.description}</p>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={0}
          value={points}
          onChange={(e) => { setPoints(e.target.value); setState('idle'); }}
          className="w-16 rounded-lg border border-white/15 bg-pitch-800 px-2 py-1.5 text-center font-mono text-xs text-chalk outline-none focus:border-lime/60"
        />
        <span className="font-mono text-xs text-chalk/40">pts</span>
        <button
          onClick={save}
          disabled={state === 'saving' || parseInt(points, 10) === rule.points}
          className="rounded-lg bg-lime/15 px-3 py-1.5 font-mono text-xs uppercase tracking-widest text-lime transition hover:bg-lime/25 disabled:opacity-40"
        >
          {state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved ✓' : state === 'error' ? 'Error' : 'Save'}
        </button>
      </div>
    </div>
  );
}
