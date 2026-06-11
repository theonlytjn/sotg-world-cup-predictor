'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { AwardCategory, AwardPrediction } from '@/lib/types';

type Team = { id: number; name: string; tla: string | null };

const CONFEDERATIONS = ['UEFA', 'CONMEBOL', 'CONCACAF', 'CAF', 'AFC', 'OFC'];

export default function AwardsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [categories, setCategories] = useState<AwardCategory[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [preds, setPreds] = useState<Record<number, AwardPrediction>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    setUserId(u.user.id);

    const [{ data: cats }, { data: ts }, { data: ap }] = await Promise.all([
      supabase
        .from('award_categories')
        .select('*')
        .order('sort_order', { ascending: true }),
      supabase
        .from('teams')
        .select('id, name, tla')
        .order('name', { ascending: true }),
      supabase
        .from('award_predictions')
        .select('*')
        .eq('user_id', u.user.id),
    ]);

    setCategories((cats as AwardCategory[]) ?? []);
    setTeams((ts as Team[]) ?? []);
    const map: Record<number, AwardPrediction> = {};
    for (const p of (ap as AwardPrediction[]) ?? []) map[p.category_id] = p;
    setPreds(map);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <p className="py-20 text-center font-mono text-sm text-chalk/40">Loading…</p>;
  }

  return (
    <div>
      <h1 className="font-display text-4xl uppercase text-chalk">Awards picks</h1>
      <p className="mt-1 text-sm text-chalk/55">
        Two picks per category — your first choice scores more. Locks at tournament start.
      </p>

      <div className="mt-6 space-y-3">
        {categories.map((cat) => (
          <CategoryRow
            key={cat.id}
            category={cat}
            teams={teams}
            pred={preds[cat.id]}
            userId={userId!}
            supabase={supabase}
            onSaved={(p) => setPreds((prev) => ({ ...prev, [cat.id]: p }))}
          />
        ))}
      </div>

      <div className="mt-8 rounded-2xl border border-white/10 bg-pitch-900/60 p-5">
        <p className="font-display text-sm uppercase tracking-wide text-chalk/50">Points breakdown</p>
        <div className="mt-3 grid gap-1.5">
          {categories.map((cat) => (
            <div key={cat.id} className="flex items-center justify-between font-mono text-xs text-chalk/60">
              <span>{cat.label}</span>
              <span className="text-lime">
                {cat.pts_pick_1}<span className="text-chalk/30"> / </span>{cat.pts_pick_2}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CategoryRow({
  category,
  teams,
  pred,
  userId,
  supabase,
  onSaved,
}: {
  category: AwardCategory;
  teams: Team[];
  pred?: AwardPrediction;
  userId: string;
  supabase: ReturnType<typeof createClient>;
  onSaved: (p: AwardPrediction) => void;
}) {
  const locked =
    category.deadline !== null && new Date(category.deadline).getTime() <= Date.now();

  const [pick1, setPick1] = useState(pred?.pick_1 ?? '');
  const [pick2, setPick2] = useState(pred?.pick_2 ?? '');
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  async function save() {
    if (!pick1 && !pick2) return;
    setState('saving');
    const row = {
      user_id: userId,
      category_id: category.id,
      pick_1: pick1 || null,
      pick_2: pick2 || null,
    };
    const { error } = await supabase
      .from('award_predictions')
      .upsert(row, { onConflict: 'user_id,category_id' });
    if (error) {
      setState('error');
    } else {
      setState('saved');
      onSaved({ ...(pred ?? { id: 0, points: null }), ...row });
      setTimeout(() => setState('idle'), 1500);
    }
  }

  const settled = pred?.points !== undefined && pred.points !== null;

  return (
    <div className="rounded-2xl border border-white/10 bg-pitch-900/60 p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="font-display text-lg uppercase tracking-wide text-chalk">{category.label}</p>
          <p className="font-mono text-[11px] uppercase tracking-widest text-chalk/40">
            {category.pts_pick_1}pts 1st · {category.pts_pick_2}pts 2nd
          </p>
        </div>
        {settled && (
          <span className="rounded-full bg-lime/20 px-3 py-1 font-display text-sm uppercase text-lime">
            +{pred!.points}
          </span>
        )}
        {locked && !settled && (
          <span className="font-mono text-xs uppercase tracking-widest text-chalk/40">Locked</span>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <PickInput
          label="1st choice"
          value={pick1}
          onChange={setPick1}
          disabled={locked}
          kind={category.pick_kind}
          teams={teams}
        />
        <PickInput
          label="2nd choice"
          value={pick2}
          onChange={setPick2}
          disabled={locked}
          kind={category.pick_kind}
          teams={teams}
        />
      </div>

      {!locked && (
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={save}
            disabled={(!pick1 && !pick2) || state === 'saving'}
            className="rounded-full bg-lime/15 px-4 py-1.5 font-display text-sm uppercase tracking-wide text-lime transition hover:bg-lime/25 disabled:opacity-30"
          >
            {state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved ✓' : pred ? 'Update' : 'Save picks'}
          </button>
          {state === 'error' && <span className="font-mono text-xs text-flame">Couldn&apos;t save</span>}
        </div>
      )}
    </div>
  );
}

function PickInput({
  label,
  value,
  onChange,
  disabled,
  kind,
  teams,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  kind: AwardCategory['pick_kind'];
  teams: Team[];
}) {
  const base =
    'w-full rounded-xl border border-white/15 bg-pitch-800 px-3 py-2.5 font-mono text-sm text-chalk outline-none focus:border-lime/70 disabled:opacity-60';

  return (
    <div>
      <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-chalk/40">{label}</p>
      {kind === 'team' && (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={base}
        >
          <option value="">— pick a team —</option>
          {teams.map((t) => (
            <option key={t.id} value={String(t.id)}>
              {t.tla ? `${t.tla} — ${t.name}` : t.name}
            </option>
          ))}
        </select>
      )}
      {kind === 'confederation' && (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={base}
        >
          <option value="">— pick a confederation —</option>
          {CONFEDERATIONS.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      )}
      {kind === 'player' && (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => { /* save handled by button */ }}
          disabled={disabled}
          placeholder="Player name"
          className={base}
        />
      )}
    </div>
  );
}
