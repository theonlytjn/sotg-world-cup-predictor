'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { AwardCategory, AwardPrediction } from '@/lib/types';
import SearchableSelect, { type SelectGroup } from '@/components/SearchableSelect';

type Team = { id: number; name: string; tla: string | null; confederation: string | null };
type Player = { id: number; name: string; position: string | null; team_id: number | null };
type TeamGroup = { team: Team; players: Player[] };

const CONF_ORDER = ['UEFA', 'CONMEBOL', 'CONCACAF', 'CAF', 'AFC', 'OFC'];

const POS_ORDER: Record<string, number> = {
  Goalkeeper: 0, Defence: 1, Midfield: 2, Offence: 3,
};
const POS_ABBR: Record<string, string> = {
  Goalkeeper: 'GK', Defence: 'DEF', Midfield: 'MID', Offence: 'FWD',
};

const SECTIONS: { key: AwardCategory['section']; label: string; description?: string }[] = [
  { key: 'main',     label: 'FIFA Awards', description: 'The five official post-tournament awards from the FIFA Technical Study Group.' },
  { key: 'specials', label: 'SOTG Specials' },
  { key: 'xtra',     label: 'SOTG Xtra' },
];

export default function AwardsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId]         = useState<string | null>(null);
  const [categories, setCategories] = useState<AwardCategory[]>([]);
  const [teams, setTeams]           = useState<Team[]>([]);
  const [players, setPlayers]       = useState<Player[]>([]);
  const [preds, setPreds]           = useState<Record<number, AwardPrediction>>({});
  const [loading, setLoading]       = useState(true);

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    setUserId(u.user.id);

    const [{ data: cats }, { data: ts }, { data: ps }, { data: ap }] = await Promise.all([
      supabase.from('award_categories').select('*').order('sort_order', { ascending: true }),
      supabase.from('teams').select('id, name, tla, confederation').order('name', { ascending: true }),
      supabase.from('players').select('id, name, position, team_id')
        .order('team_id', { ascending: true }).order('name', { ascending: true }),
      supabase.from('award_predictions').select('*').eq('user_id', u.user.id),
    ]);

    setCategories((cats as AwardCategory[]) ?? []);
    setTeams((ts as Team[]) ?? []);
    setPlayers((ps as Player[]) ?? []);
    const map: Record<number, AwardPrediction> = {};
    for (const p of (ap as AwardPrediction[]) ?? []) map[p.category_id] = p;
    setPreds(map);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  // Players sorted by position, grouped by team
  const playersByTeam = useMemo((): TeamGroup[] => {
    const teamMap = new Map(teams.map((t) => [t.id, t]));
    const groups = new Map<number, TeamGroup>();
    for (const p of players) {
      if (p.team_id == null) continue;
      if (!groups.has(p.team_id)) {
        const team = teamMap.get(p.team_id);
        if (!team) continue;
        groups.set(p.team_id, { team, players: [] });
      }
      groups.get(p.team_id)!.players.push(p);
    }
    for (const g of groups.values()) {
      g.players.sort((a, b) => {
        const pa = POS_ORDER[a.position ?? ''] ?? 99;
        const pb = POS_ORDER[b.position ?? ''] ?? 99;
        return pa !== pb ? pa - pb : a.name.localeCompare(b.name);
      });
    }
    return [...groups.values()].sort((a, b) => {
      const ca = CONF_ORDER.indexOf(a.team.confederation ?? '');
      const cb = CONF_ORDER.indexOf(b.team.confederation ?? '');
      if (ca !== cb) return (ca === -1 ? 99 : ca) - (cb === -1 ? 99 : cb);
      return (a.team.tla ?? a.team.name).localeCompare(b.team.tla ?? b.team.name);
    });
  }, [players, teams]);

  // Team select groups: confederation → teams
  const teamGroups = useMemo((): SelectGroup[] => {
    const byConf = new Map<string, Team[]>();
    for (const t of teams) {
      const conf = t.confederation ?? 'Other';
      if (!byConf.has(conf)) byConf.set(conf, []);
      byConf.get(conf)!.push(t);
    }
    const order = [...CONF_ORDER, 'Other'];
    return order
      .filter((c) => byConf.has(c))
      .map((conf) => ({
        label: conf,
        options: byConf.get(conf)!.map((t) => ({
          value: String(t.id),
          label: t.name,
          sublabel: t.tla ?? undefined,
        })),
      }));
  }, [teams]);

  // Player select groups: confederation · team → players
  const playerGroups = useMemo((): SelectGroup[] => {
    return playersByTeam.map(({ team, players: ps }) => ({
      label: team.confederation
        ? `${team.confederation} · ${team.tla ?? team.name}`
        : (team.tla ?? team.name),
      options: ps.map((p) => ({
        value: String(p.id),
        label: p.name,
        sublabel: p.position ? (POS_ABBR[p.position] ?? p.position) : undefined,
      })),
    }));
  }, [playersByTeam]);

  const bySection = useMemo(() => {
    const map = new Map<string, AwardCategory[]>();
    for (const cat of categories) {
      if (!map.has(cat.section)) map.set(cat.section, []);
      map.get(cat.section)!.push(cat);
    }
    return map;
  }, [categories]);

  if (loading) {
    return <p className="py-20 text-center font-mono text-sm text-chalk/40">Loading…</p>;
  }

  return (
    <div>
      <h1 className="font-display text-4xl uppercase text-chalk">Awards picks</h1>
      <p className="mt-1 text-sm text-chalk/55">
        Two picks per category — your first choice scores more. Locks at tournament start.
      </p>

      {SECTIONS.map(({ key, label, description }) => {
        const cats = bySection.get(key);
        if (!cats?.length) return null;
        const isMain = key === 'main';
        return (
          <section key={key} className="mt-8">
            <div className="mb-1 flex items-center gap-3">
              <h2 className="font-display text-2xl uppercase text-lime">{label}</h2>
              <span className="h-px flex-1 bg-white/10" />
            </div>
            {description && <p className="mb-4 text-sm text-chalk/55">{description}</p>}
            <div className={isMain ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3' : 'space-y-3'}>
              {cats.map((cat) => (
                <CategoryRow
                  key={cat.id}
                  category={cat}
                  teams={teams}
                  teamGroups={teamGroups}
                  playerGroups={playerGroups}
                  pred={preds[cat.id]}
                  userId={userId!}
                  supabase={supabase}
                  onSaved={(p) => setPreds((prev) => ({ ...prev, [cat.id]: p }))}
                />
              ))}
            </div>
          </section>
        );
      })}

      <div className="mt-10 rounded-2xl border border-white/10 bg-pitch-900/60 p-5">
        <p className="font-display text-sm uppercase tracking-wide text-chalk/50">Points breakdown</p>
        <div className="mt-3 space-y-3">
          {SECTIONS.map(({ key, label }) => {
            const cats = bySection.get(key);
            if (!cats?.length) return null;
            return (
              <div key={key}>
                <p className="mb-1.5 font-mono text-[10px] uppercase tracking-widest text-chalk/30">{label}</p>
                <div className="grid gap-1">
                  {cats.map((cat) => (
                    <div key={cat.id} className="flex items-center justify-between font-mono text-xs text-chalk/60">
                      <span>{cat.label}</span>
                      <span className="text-lime">
                        {cat.pts_pick_1}<span className="text-chalk/30"> / </span>{cat.pts_pick_2}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CategoryRow({
  category,
  teams,
  teamGroups,
  playerGroups,
  pred,
  userId,
  supabase,
  onSaved,
}: {
  category: AwardCategory;
  teams: Team[];
  teamGroups: SelectGroup[];
  playerGroups: SelectGroup[];
  pred?: AwardPrediction;
  userId: string;
  supabase: ReturnType<typeof createClient>;
  onSaved: (p: AwardPrediction) => void;
}) {
  const locked = category.deadline !== null && new Date(category.deadline).getTime() <= Date.now();
  const [pick1, setPick1] = useState(pred?.pick_1 ?? '');
  const [pick2, setPick2] = useState(pred?.pick_2 ?? '');
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // For confederation-filtered team questions, narrow down to just that conf's group
  const filteredTeamGroups = useMemo((): SelectGroup[] => {
    const conf = category.meta?.confederation as string | undefined;
    if (!conf) return teamGroups;
    // Show only the one matching confederation group
    const match = teamGroups.find((g) => g.label === conf);
    if (!match) {
      // confederation not yet set on any team — fall back to all teams with no group labels
      const flat = teams.filter(() => true).map((t) => ({
        value: String(t.id),
        label: t.name,
        sublabel: t.tla ?? undefined,
      }));
      return [{ label: '', options: flat }];
    }
    return [{ label: conf, options: match.options }];
  }, [category.meta, teamGroups, teams]);

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
  const confLabel = (category.meta?.confederation as string | undefined);

  return (
    <div className="flex flex-col rounded-2xl border border-white/10 bg-pitch-900/60 p-5 shadow-card">
      <div className="mb-4">
        <div className="mb-2 flex items-start justify-between gap-2">
          <p className="font-display text-xl uppercase text-chalk leading-tight">{category.label}</p>
          {settled && (
            <span className="shrink-0 rounded-full bg-lime/20 px-3 py-1 font-display text-sm uppercase text-lime">
              +{pred!.points}
            </span>
          )}
          {locked && !settled && (
            <span className="shrink-0 font-mono text-xs uppercase tracking-widest text-chalk/40">Locked</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <p className="font-mono text-[11px] uppercase tracking-widest text-chalk/40">
            {category.pts_pick_1}pts · {category.pts_pick_2}pts
          </p>
          {confLabel && (
            <span className="rounded-full border border-white/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-chalk/40">
              {confLabel} only
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <PickInput
          label="1st choice"
          value={pick1}
          onChange={setPick1}
          disabled={locked}
          kind={category.pick_kind}
          teamGroups={filteredTeamGroups}
          playerGroups={playerGroups}
        />
        <PickInput
          label="2nd choice"
          value={pick2}
          onChange={setPick2}
          disabled={locked}
          kind={category.pick_kind}
          teamGroups={filteredTeamGroups}
          playerGroups={playerGroups}
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
  label, value, onChange, disabled, kind, teamGroups, playerGroups,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  kind: AwardCategory['pick_kind'];
  teamGroups: SelectGroup[];
  playerGroups: SelectGroup[];
}) {
  const CONFEDERATIONS = ['UEFA', 'CONMEBOL', 'CONCACAF', 'CAF', 'AFC', 'OFC'];

  return (
    <div>
      <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-chalk/40">{label}</p>

      {kind === 'team' && (
        <SearchableSelect
          value={value}
          onChange={onChange}
          disabled={disabled}
          placeholder="— pick a team —"
          groups={teamGroups}
        />
      )}

      {kind === 'player' && (
        <SearchableSelect
          value={value}
          onChange={onChange}
          disabled={disabled}
          placeholder="— pick a player —"
          groups={playerGroups}
        />
      )}

      {kind === 'confederation' && (
        <SearchableSelect
          value={value}
          onChange={onChange}
          disabled={disabled}
          placeholder="— pick a confederation —"
          groups={[{
            label: '',
            options: CONFEDERATIONS.map((c) => ({ value: c, label: c })),
          }]}
        />
      )}
    </div>
  );
}
