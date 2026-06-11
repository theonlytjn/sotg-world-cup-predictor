'use client';

import { useMemo, useState } from 'react';
import type { AwardCategory } from '@/lib/types';

type Team   = { id: number; name: string; tla: string | null; confederation: string | null };
type Player = { id: number; name: string; position: string | null; team_id: number | null };

const CONFEDERATIONS = ['UEFA', 'CONMEBOL', 'CONCACAF', 'CAF', 'AFC', 'OFC'];
const POS_ORDER: Record<string, number> = { Goalkeeper: 0, Defence: 1, Midfield: 2, Offence: 3 };
const POS_ABBR:  Record<string, string>  = { Goalkeeper: 'GK', Defence: 'DEF', Midfield: 'MID', Offence: 'FWD' };

const SECTIONS: { key: AwardCategory['section']; label: string }[] = [
  { key: 'main',     label: 'Awards' },
  { key: 'specials', label: 'SOTG Specials' },
  { key: 'xtra',     label: 'SOTG Xtra' },
];

type PlayerGroup = { team: Team; players: Player[] };

export default function AwardPanel({
  categories,
  resultsByCategory,
  teams,
  players,
}: {
  categories: AwardCategory[];
  resultsByCategory: Record<number, string>;
  teams: Team[];
  players: Player[];
}) {
  const playersByTeam = useMemo((): PlayerGroup[] => {
    const teamMap = new Map(teams.map((t) => [t.id, t]));
    const groups = new Map<number, PlayerGroup>();
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
    return [...groups.values()].sort((a, b) =>
      (a.team.tla ?? a.team.name).localeCompare(b.team.tla ?? b.team.name)
    );
  }, [teams, players]);

  const bySection = useMemo(() => {
    const map = new Map<string, AwardCategory[]>();
    for (const cat of categories) {
      if (!map.has(cat.section)) map.set(cat.section, []);
      map.get(cat.section)!.push(cat);
    }
    return map;
  }, [categories]);

  function resolveResult(cat: AwardCategory, result: string): string {
    if (cat.pick_kind === 'team') {
      const t = teams.find((x) => String(x.id) === result);
      return t ? (t.tla ? `${t.tla} — ${t.name}` : t.name) : result;
    }
    if (cat.pick_kind === 'player') {
      const p = players.find((x) => String(x.id) === result);
      return p ? p.name : result;
    }
    return result;
  }

  return (
    <div>
      <h2 className="font-display text-2xl uppercase text-chalk">Award Results</h2>
      <p className="mt-1 text-sm text-chalk/50">
        Setting a result immediately scores all existing picks for that category.
      </p>

      {SECTIONS.map(({ key, label }) => {
        const cats = bySection.get(key);
        if (!cats?.length) return null;
        return (
          <section key={key} className="mt-6">
            <div className="mb-3 flex items-center gap-3">
              <h3 className="font-display text-lg uppercase text-lime">{label}</h3>
              <span className="h-px flex-1 bg-white/10" />
            </div>
            <div className="space-y-2">
              {cats.map((cat) => (
                <CategoryCard
                  key={cat.id}
                  category={cat}
                  currentResult={resultsByCategory[cat.id] ?? null}
                  resolvedResult={resultsByCategory[cat.id] ? resolveResult(cat, resultsByCategory[cat.id]) : null}
                  teams={teams}
                  playersByTeam={playersByTeam}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function CategoryCard({
  category,
  currentResult,
  resolvedResult,
  teams,
  playersByTeam,
}: {
  category: AwardCategory;
  currentResult: string | null;
  resolvedResult: string | null;
  teams: Team[];
  playersByTeam: PlayerGroup[];
}) {
  const [pick, setPick]       = useState(currentResult ?? '');
  const [deadline, setDeadline] = useState(
    category.deadline ? new Date(category.deadline).toISOString().slice(0, 16) : ''
  );
  const [resultState, setResultState]   = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [deadlineState, setDeadlineState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const filteredTeams = useMemo(() => {
    const conf = category.meta?.confederation;
    if (!conf) return teams;
    const subset = teams.filter((t) => t.confederation === conf);
    return subset.length > 0 ? subset : teams;
  }, [teams, category.meta]);

  async function setResult(value: string | null) {
    setResultState('saving');
    const res = await fetch('/api/admin/set-award-result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category_id: category.id, result: value }),
    });
    if (res.ok) {
      setResultState('saved');
      if (!value) setPick('');
      setTimeout(() => setResultState('idle'), 1500);
    } else {
      setResultState('error');
    }
  }

  async function saveDeadline(value: string | null) {
    setDeadlineState('saving');
    const res = await fetch('/api/admin/set-award-deadline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category_id: category.id,
        deadline: value ? new Date(value).toISOString() : null,
      }),
    });
    if (res.ok) {
      setDeadlineState('saved');
      setTimeout(() => setDeadlineState('idle'), 1500);
    } else {
      setDeadlineState('error');
    }
  }

  const locked = category.deadline !== null && new Date(category.deadline).getTime() <= Date.now();

  return (
    <div className="rounded-2xl border border-white/10 bg-pitch-900/60 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-display text-base uppercase tracking-wide text-chalk">{category.label}</p>
          <p className="font-mono text-[11px] uppercase tracking-widest text-chalk/40">
            {category.pts_pick_1}pts · {category.pts_pick_2}pts
          </p>
        </div>
        <div className="shrink-0 text-right">
          {resolvedResult ? (
            <span className="rounded-full bg-lime/20 px-2.5 py-1 font-mono text-xs text-lime">
              {resolvedResult}
            </span>
          ) : (
            <span className="rounded-full bg-pitch-700 px-2.5 py-1 font-mono text-xs text-chalk/40">
              Not set
            </span>
          )}
        </div>
      </div>

      {/* Result picker */}
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[180px]">
          <ResultPick
            value={pick}
            onChange={setPick}
            kind={category.pick_kind}
            teams={filteredTeams}
            playersByTeam={playersByTeam}
          />
        </div>
        <button
          onClick={() => setResult(pick || null)}
          disabled={!pick || resultState === 'saving'}
          className="rounded-xl bg-lime px-4 py-2.5 font-display text-sm uppercase tracking-wide text-pitch-950 transition hover:brightness-110 disabled:opacity-40"
        >
          {resultState === 'saving' ? 'Setting…' : resultState === 'saved' ? 'Set ✓' : 'Set result'}
        </button>
        {resolvedResult && (
          <button
            onClick={() => setResult(null)}
            disabled={resultState === 'saving'}
            className="rounded-xl border border-flame/30 px-4 py-2.5 font-display text-sm uppercase tracking-wide text-flame transition hover:bg-flame/10 disabled:opacity-40"
          >
            Clear
          </button>
        )}
        {resultState === 'error' && <span className="font-mono text-xs text-flame">Error</span>}
      </div>

      {/* Deadline */}
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/5 pt-3">
        <span className={`font-mono text-[11px] uppercase tracking-widest ${locked ? 'text-flame' : 'text-chalk/40'}`}>
          {locked ? 'Locked' : category.deadline ? 'Locks ' + new Date(category.deadline).toLocaleString() : 'No deadline'}
        </span>
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <input
            type="datetime-local"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="rounded-lg border border-white/15 bg-pitch-800 px-2 py-1 font-mono text-xs text-chalk outline-none focus:border-lime/60"
          />
          <button
            onClick={() => saveDeadline(deadline || null)}
            disabled={deadlineState === 'saving'}
            className="rounded-lg bg-pitch-700 px-3 py-1 font-mono text-xs uppercase tracking-widest text-chalk/70 transition hover:bg-pitch-600 disabled:opacity-40"
          >
            {deadlineState === 'saving' ? 'Saving…' : deadlineState === 'saved' ? 'Saved ✓' : 'Set deadline'}
          </button>
          {!locked && (
            <button
              onClick={() => { const now = new Date().toISOString(); setDeadline(now.slice(0, 16)); saveDeadline(now); }}
              disabled={deadlineState === 'saving'}
              className="rounded-lg bg-flame/15 px-3 py-1 font-mono text-xs uppercase tracking-widest text-flame transition hover:bg-flame/25 disabled:opacity-40"
            >
              Lock now
            </button>
          )}
          {locked && (
            <button
              onClick={() => { setDeadline(''); saveDeadline(null); }}
              disabled={deadlineState === 'saving'}
              className="rounded-lg bg-pitch-700 px-3 py-1 font-mono text-xs uppercase tracking-widest text-chalk/50 transition hover:bg-pitch-600 disabled:opacity-40"
            >
              Unlock
            </button>
          )}
          {deadlineState === 'error' && <span className="font-mono text-xs text-flame">Error</span>}
        </div>
      </div>
    </div>
  );
}

function ResultPick({
  value,
  onChange,
  kind,
  teams,
  playersByTeam,
}: {
  value: string;
  onChange: (v: string) => void;
  kind: AwardCategory['pick_kind'];
  teams: Team[];
  playersByTeam: PlayerGroup[];
}) {
  const base = 'w-full rounded-xl border border-white/15 bg-pitch-800 px-3 py-2.5 font-mono text-sm text-chalk outline-none focus:border-lime/70';

  if (kind === 'team') {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} className={base}>
        <option value="">— select team —</option>
        {teams.map((t) => (
          <option key={t.id} value={String(t.id)}>
            {t.tla ? `${t.tla} — ${t.name}` : t.name}
          </option>
        ))}
      </select>
    );
  }

  if (kind === 'player') {
    if (playersByTeam.length > 0) {
      return (
        <select value={value} onChange={(e) => onChange(e.target.value)} className={base}>
          <option value="">— select player —</option>
          {playersByTeam.map(({ team, players }) => (
            <optgroup key={team.id} label={team.tla ?? team.name}>
              {players.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.name}{p.position ? ` · ${POS_ABBR[p.position] ?? p.position}` : ''}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      );
    }
    return (
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Player name or ID"
        className={base}
      />
    );
  }

  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={base}>
      <option value="">— select confederation —</option>
      {CONFEDERATIONS.map((c) => <option key={c} value={c}>{c}</option>)}
    </select>
  );
}
