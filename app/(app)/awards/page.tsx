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

const STAGE_GROUPS: SelectGroup[] = [{
  label: '',
  options: [
    { value: 'group-stage',   label: 'Group Stage',   sublabel: 'Exit in group stage' },
    { value: 'round-of-16',   label: 'Round of 16' },
    { value: 'quarter-final', label: 'Quarter-Final' },
    { value: 'semi-final',    label: 'Semi-Final' },
    { value: 'final',         label: 'Final',          sublabel: 'Runners-up' },
    { value: 'champion',      label: 'Champions',      sublabel: 'Win the tournament' },
  ],
}];
const STAGE_LABEL: Record<string, string> = Object.fromEntries(
  STAGE_GROUPS[0].options.map((o) => [o.value, o.label])
);

const SECTIONS: { key: AwardCategory['section']; label: string; description?: string }[] = [
  { key: 'main',     label: 'FIFA Awards', description: 'The five official post-tournament awards from the FIFA Technical Study Group.' },
  { key: 'specials', label: 'SOTG Specials' },
  { key: 'xtra',     label: 'SOTG Xtra' },
  { key: 'opinion',  label: 'Opinion Poll', description: 'No points — just your gut feeling. Votes are tallied when the tournament ends.' },
  { key: 'tott',     label: 'Team of the Tournament XI', description: 'Pick your 4-3-3 XI — 5pts per correct player (1st choice), 3pts (2nd pick per slot).' },
];

// Formation rows: top → bottom = attack → defence
const TOTT_ROWS: { pos: string; slugs: string[] }[] = [
  { pos: 'FWD', slugs: ['tott_fwd1', 'tott_fwd2', 'tott_fwd3'] },
  { pos: 'MID', slugs: ['tott_mid1', 'tott_mid2', 'tott_mid3'] },
  { pos: 'DEF', slugs: ['tott_def1', 'tott_def2', 'tott_def3', 'tott_def4'] },
  { pos: 'GK',  slugs: ['tott_gk'] },
];

export default function AwardsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId]         = useState<string | null>(null);
  const [categories, setCategories] = useState<AwardCategory[]>([]);
  const [teams, setTeams]           = useState<Team[]>([]);
  const [players, setPlayers]       = useState<Player[]>([]);
  const [preds, setPreds]           = useState<Record<number, AwardPrediction>>({});
  const [tallies, setTallies]       = useState<Record<number, Record<string, number>>>({});
  const [loading, setLoading]       = useState(true);

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    setUserId(u.user.id);

    const [{ data: cats }, { data: ts }, { data: ps1 }, { data: ps2 }, { data: ap }] = await Promise.all([
      supabase.from('award_categories').select('*').order('sort_order', { ascending: true }),
      supabase.from('teams').select('id, name, tla, confederation').order('name', { ascending: true }),
      supabase.from('players').select('id, name, position, team_id')
        .order('team_id', { ascending: true }).order('name', { ascending: true }).range(0, 999),
      supabase.from('players').select('id, name, position, team_id')
        .order('team_id', { ascending: true }).order('name', { ascending: true }).range(1000, 1999),
      supabase.from('award_predictions').select('*').eq('user_id', u.user.id),
    ]);
    const ps = [...(ps1 ?? []), ...(ps2 ?? [])];

    const catList = (cats as AwardCategory[]) ?? [];
    setCategories(catList);
    setTeams((ts as Team[]) ?? []);
    setPlayers((ps as Player[]) ?? []);

    const map: Record<number, AwardPrediction> = {};
    for (const p of (ap as AwardPrediction[]) ?? []) map[p.category_id] = p;
    setPreds(map);

    // Fetch opinion tallies for any categories where results are revealed
    const visibleIds = catList
      .filter((c) => c.section === 'opinion' && c.results_visible)
      .map((c) => c.id);

    if (visibleIds.length > 0) {
      const { data: tallyData } = await supabase
        .from('award_predictions')
        .select('category_id, pick_1')
        .in('category_id', visibleIds)
        .not('pick_1', 'is', null);

      const t: Record<number, Record<string, number>> = {};
      for (const row of (tallyData ?? []) as { category_id: number; pick_1: string }[]) {
        if (!t[row.category_id]) t[row.category_id] = {};
        t[row.category_id][row.pick_1] = (t[row.category_id][row.pick_1] ?? 0) + 1;
      }
      setTallies(t);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

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
    return <p className="py-20 text-center font-mono text-base text-chalk">Loading…</p>;
  }

  return (
    <div>
      <h1 className="font-display text-4xl uppercase text-chalk">Awards picks</h1>
      <p className="mt-1 text-base text-chalk">
        Two picks per category — your first choice scores more. Locks at tournament start.
      </p>

      {SECTIONS.map(({ key, label, description }) => {
        const cats = bySection.get(key);
        if (!cats?.length) return null;
        const isOpinion = key === 'opinion';
        const isTott    = key === 'tott';

        return (
          <section key={key} className="mt-8">
            <div className="mb-1 flex items-center gap-3">
              <h2 className={['font-display text-2xl uppercase', isOpinion ? 'text-gold' : isTott ? 'text-lime' : 'text-lime'].join(' ')}>
                {label}
              </h2>
              <span className="h-px flex-1 bg-white/10" />
            </div>
            {description && <p className="mb-4 text-base text-chalk">{description}</p>}

            {isTott ? (
              /* ---- 4-3-3 formation picker ---- */
              <div className="rounded-2xl border-2 border-white/10 overflow-hidden"
                style={{ background: 'linear-gradient(to top, #0d2410 0%, #153318 50%, #0d2410 100%)' }}>
                {/* Pitch centre line */}
                <div className="mx-auto my-0 h-px w-3/4 bg-white/10" />
                <div className="px-4 py-6 space-y-4">
                  {TOTT_ROWS.map(({ pos, slugs }) => {
                    const rowCats = slugs
                      .map((slug) => cats.find((c) => c.slug === slug))
                      .filter(Boolean) as AwardCategory[];
                    return (
                      <div key={pos} className="flex items-start justify-center gap-2 sm:gap-4">
                        {rowCats.map((cat) => (
                          <TottSlot
                            key={cat.id}
                            category={cat}
                            pos={pos}
                            playerGroups={playerGroups}
                            pred={preds[cat.id]}
                            userId={userId!}
                            supabase={supabase}
                            onSaved={(p) => setPreds((prev) => ({ ...prev, [cat.id]: p }))}
                          />
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                    isOpinion={isOpinion}
                    tally={isOpinion && cat.results_visible ? tallies[cat.id] : undefined}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}

      {/* Points breakdown — opinion section excluded (0 pts) */}
      <div className="mt-10 rounded-2xl border-2 border-white/10 bg-pitch-900/60 p-10">
        <p className="font-display text-base uppercase tracking-wide text-chalk">Points breakdown</p>
        <div className="mt-3 space-y-3">
          {SECTIONS.filter((s) => s.key !== 'opinion').map(({ key, label }) => {
            const cats = bySection.get(key);
            if (!cats?.length) return null;
            return (
              <div key={key}>
                <p className="mb-1.5 font-mono text-sm uppercase tracking-widest text-chalk">{label}</p>
                <div className="grid gap-1">
                  {cats.map((cat) => (
                    <div key={cat.id} className="flex items-center justify-between font-mono text-base text-chalk">
                      <span>{cat.label}</span>
                      <span className="text-lime">
                        {cat.pts_pick_1}<span className="text-chalk"> / </span>{cat.pts_pick_2}
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
  isOpinion = false,
  tally,
}: {
  category: AwardCategory;
  teams: Team[];
  teamGroups: SelectGroup[];
  playerGroups: SelectGroup[];
  pred?: AwardPrediction;
  userId: string;
  supabase: ReturnType<typeof createClient>;
  onSaved: (p: AwardPrediction) => void;
  isOpinion?: boolean;
  tally?: Record<string, number>;
}) {
  const locked = !isOpinion && category.deadline !== null && new Date(category.deadline).getTime() <= Date.now();
  const isSinglePick = isOpinion || category.meta?.single === true;
  const pickCount = category.meta?.picks ?? 2;
  const [pick1, setPick1] = useState(pred?.pick_1 ?? '');
  const [pick2, setPick2] = useState(pred?.pick_2 ?? '');
  const [pick3, setPick3] = useState(pred?.pick_3 ?? '');
  const [pick4, setPick4] = useState(pred?.pick_4 ?? '');
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const filteredTeamGroups = useMemo((): SelectGroup[] => {
    const conf = category.meta?.confederation as string | undefined;
    if (!conf) return teamGroups;
    const match = teamGroups.find((g) => g.label === conf);
    if (!match) {
      return [{ label: '', options: teams.map((t) => ({ value: String(t.id), label: t.name, sublabel: t.tla ?? undefined })) }];
    }
    return [{ label: conf, options: match.options }];
  }, [category.meta, teamGroups, teams]);

  // Label lookup for vote tally display
  const teamLabelMap = useMemo(() => new Map(teams.map((t) => [String(t.id), t.name])), [teams]);
  const playerLabelMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const g of playerGroups) for (const o of g.options) m.set(o.value, o.label);
    return m;
  }, [playerGroups]);

  function getPickLabel(pick: string): string {
    if (category.pick_kind === 'stage')  return STAGE_LABEL[pick] ?? pick;
    if (category.pick_kind === 'team')   return teamLabelMap.get(pick) ?? pick;
    if (category.pick_kind === 'player') return playerLabelMap.get(pick) ?? pick;
    return pick;
  }

  async function save() {
    if (isSinglePick ? !pick1 : (!pick1 && !pick2)) return;
    setState('saving');
    const row: {
      user_id: string; category_id: number;
      pick_1: string | null; pick_2: string | null;
      pick_3?: string | null; pick_4?: string | null;
    } = {
      user_id: userId,
      category_id: category.id,
      pick_1: pick1 || null,
      pick_2: isSinglePick ? null : (pick2 || null),
    };
    if (pickCount >= 3) row.pick_3 = pick3 || null;
    if (pickCount >= 4) row.pick_4 = pick4 || null;
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

  const settled = !isOpinion && pred?.points !== undefined && pred.points !== null;
  const confLabel = category.meta?.confederation as string | undefined;

  // ---- Opinion Poll card ----
  if (isOpinion) {
    const totalVotes = tally ? Object.values(tally).reduce((a, b) => a + b, 0) : 0;
    return (
      <div className="flex flex-col rounded-2xl border-2 border-gold/60 bg-pitch-900/60 p-10 shadow-card">
        <div className="mb-4">
          <div className="mb-2 flex items-start justify-between gap-2">
            <p className="font-display text-xl uppercase text-chalk leading-tight">{category.label}</p>
            <span className="shrink-0 rounded-full border border-gold/30 px-3 py-1 font-display text-base uppercase text-gold">
              Poll
            </span>
          </div>
          <p className="font-mono text-sm uppercase tracking-widest text-chalk">
            Opinion · No points
          </p>
        </div>

        {tally ? (
          // Results revealed — show vote bars
          <div className="space-y-2.5">
            {Object.entries(tally)
              .sort(([, a], [, b]) => b - a)
              .map(([pick, count]) => {
                const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                const isMyVote = pred?.pick_1 === pick;
                return (
                  <div key={pick}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className={['text-base', isMyVote ? 'text-gold' : 'text-chalk'].join(' ')}>
                        {getPickLabel(pick)}{isMyVote ? ' ✓' : ''}
                      </span>
                      <span className="font-mono text-base text-chalk">{count} · {pct}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                      <div
                        className="h-full rounded-full bg-gold/60 transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        ) : (
          // Voting open — show single pick input
          <>
            <PickInput
              label="Your vote"
              value={pick1}
              onChange={setPick1}
              disabled={false}
              kind={category.pick_kind}
              teamGroups={filteredTeamGroups}
              playerGroups={playerGroups}
            />
            <div className="mt-3 flex items-center gap-3">
              <button
                onClick={save}
                disabled={!pick1 || state === 'saving'}
                className="rounded-full bg-gold/15 px-4 py-1.5 font-body font-bold text-base uppercase tracking-wide text-gold transition hover:bg-gold/25 disabled:opacity-30"
              >
                {state === 'saving' ? 'Saving…' : state === 'saved' ? 'Voted ✓' : pred?.pick_1 ? 'Update vote' : 'Submit vote'}
              </button>
              {state === 'error' && <span className="font-mono text-base text-flame">Couldn&apos;t save</span>}
            </div>
          </>
        )}
      </div>
    );
  }

  // ---- Regular Award / Prediction card ----
  const pts3 = category.meta?.pts_pick_3;
  const pts4 = category.meta?.pts_pick_4;

  const ptsLabel = isSinglePick
    ? `${category.pts_pick_1}pts`
    : pickCount >= 4
      ? `${category.pts_pick_1} / ${category.pts_pick_2} / ${pts3 ?? '?'} / ${pts4 ?? '?'} pts`
      : `${category.pts_pick_1}pts · ${category.pts_pick_2}pts`;

  return (
    <div className="flex flex-col rounded-2xl border-2 border-white/10 bg-pitch-900/60 p-10 shadow-card focus-within:border-gold/60 transition-colors">
      <div className="mb-4">
        <div className="mb-2 flex items-start justify-between gap-2">
          <p className="font-display text-xl uppercase text-chalk leading-tight">{category.label}</p>
          {settled && (
            <span className="shrink-0 rounded-full bg-lime/20 px-3 py-1 font-display text-base uppercase text-lime">
              +{pred!.points}
            </span>
          )}
          {locked && !settled && (
            <span className="shrink-0 font-mono text-base uppercase tracking-widest text-chalk">Locked</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <p className="font-mono text-sm uppercase tracking-widest text-chalk">{ptsLabel}</p>
          {confLabel && (
            <span className="rounded-full border border-white/10 px-2 py-0.5 font-mono text-sm uppercase tracking-widest text-chalk">
              {confLabel} only
            </span>
          )}
        </div>
      </div>

      {isSinglePick ? (
        <PickInput
          label="Your pick"
          value={pick1}
          onChange={setPick1}
          disabled={locked}
          kind={category.pick_kind}
          teamGroups={filteredTeamGroups}
          playerGroups={playerGroups}
        />
      ) : pickCount >= 4 ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <PickInput label={`1st (${category.pts_pick_1}pts)`} value={pick1} onChange={setPick1} disabled={locked} kind={category.pick_kind} teamGroups={filteredTeamGroups} playerGroups={playerGroups} />
          <PickInput label={`2nd (${category.pts_pick_2}pts)`} value={pick2} onChange={setPick2} disabled={locked} kind={category.pick_kind} teamGroups={filteredTeamGroups} playerGroups={playerGroups} />
          <PickInput label={`3rd (${pts3 ?? '?'}pts)`} value={pick3} onChange={setPick3} disabled={locked} kind={category.pick_kind} teamGroups={filteredTeamGroups} playerGroups={playerGroups} />
          <PickInput label={`4th (${pts4 ?? '?'}pts)`} value={pick4} onChange={setPick4} disabled={locked} kind={category.pick_kind} teamGroups={filteredTeamGroups} playerGroups={playerGroups} />
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          <PickInput label="1st choice" value={pick1} onChange={setPick1} disabled={locked} kind={category.pick_kind} teamGroups={filteredTeamGroups} playerGroups={playerGroups} />
          <PickInput label="2nd choice" value={pick2} onChange={setPick2} disabled={locked} kind={category.pick_kind} teamGroups={filteredTeamGroups} playerGroups={playerGroups} />
        </div>
      )}

      {!locked && (
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={save}
            disabled={(isSinglePick ? !pick1 : (!pick1 && !pick2)) || state === 'saving'}
            className="rounded-full bg-lime/15 px-4 py-1.5 font-body font-bold text-base uppercase tracking-wide text-lime transition hover:bg-lime/25 disabled:opacity-30"
          >
            {state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved ✓' : pred ? 'Update' : 'Save picks'}
          </button>
          {state === 'error' && <span className="font-mono text-base text-flame">Couldn&apos;t save</span>}
        </div>
      )}
    </div>
  );
}

// ---- TOTT Formation Slot ----
const POS_COLOURS: Record<string, string> = {
  GK:  'bg-gold/20 text-gold border-gold/30',
  DEF: 'bg-lime/15 text-lime border-lime/30',
  MID: 'bg-[#60a5fa]/15 text-[#60a5fa] border-[#60a5fa]/30',
  FWD: 'bg-flame/15 text-flame border-flame/30',
};

function TottSlot({
  category, pos, playerGroups, pred, userId, supabase, onSaved,
}: {
  category: AwardCategory;
  pos: string;
  playerGroups: SelectGroup[];
  pred?: AwardPrediction;
  userId: string;
  supabase: ReturnType<typeof createClient>;
  onSaved: (p: AwardPrediction) => void;
}) {
  const locked = category.deadline !== null && new Date(category.deadline).getTime() <= Date.now();
  const [pick, setPick] = useState(pred?.pick_1 ?? '');
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const playerName = useMemo(() => {
    for (const g of playerGroups) {
      const o = g.options.find((o) => o.value === pick);
      if (o) return o.label;
    }
    return null;
  }, [pick, playerGroups]);

  async function save(v: string) {
    setState('saving');
    const row = { user_id: userId, category_id: category.id, pick_1: v || null, pick_2: null };
    const { error } = await supabase
      .from('award_predictions')
      .upsert(row, { onConflict: 'user_id,category_id' });
    if (error) { setState('error'); return; }
    setState('saved');
    onSaved({ ...(pred ?? { id: 0, points: null }), ...row });
    setTimeout(() => setState('idle'), 1200);
  }

  const settled = pred?.points !== null && pred?.points !== undefined;
  const colour = POS_COLOURS[pos] ?? 'bg-white/10 text-chalk border-white/10';

  return (
    <div className="flex flex-col items-center gap-1.5 w-[4.5rem] sm:w-24">
      <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest ${colour}`}>
        {pos}
      </span>
      <div className={`w-full rounded-xl border-2 bg-pitch-900/80 p-2 text-center transition ${settled ? 'border-lime/40' : state === 'saved' ? 'border-lime/60' : 'border-white/10'}`}>
        {locked ? (
          <p className="font-display text-[10px] sm:text-xs uppercase text-chalk leading-tight min-h-[2rem] flex items-center justify-center">
            {playerName ?? <span className="text-chalk/30">TBD</span>}
          </p>
        ) : (
          <SearchableSelect
            value={pick}
            onChange={(v) => { setPick(v); save(v); }}
            disabled={locked}
            placeholder="Pick"
            groups={playerGroups}
            compact
          />
        )}
        {settled && (
          <span className="mt-1 block font-mono text-[9px] text-lime">+{pred!.points}pt</span>
        )}
      </div>
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
      <p className="mb-1 font-mono text-sm uppercase tracking-widest text-chalk">{label}</p>

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
          groups={[{ label: '', options: CONFEDERATIONS.map((c) => ({ value: c, label: c })) }]}
        />
      )}

      {kind === 'stage' && (
        <SearchableSelect
          value={value}
          onChange={onChange}
          disabled={disabled}
          placeholder="— pick a stage —"
          groups={STAGE_GROUPS}
        />
      )}
    </div>
  );
}
