'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { LockIcon } from '@hugeicons-pro/core-stroke-rounded';
import { createClient } from '@/lib/supabase/client';
import type { PollQuestion } from '@/lib/types';

type Team   = { id: number; name: string; tla: string | null };
type Player = { id: number; name: string; position: string | null; team_id: number | null };
type TeamGroup = { team: Team; players: Player[] };

type ResponseWithUser = {
  question_id: number;
  pick: string;
  user_id: string;
  profiles: { display_name: string } | null;
};

const POS_ORDER: Record<string, number> = { Goalkeeper: 0, Defence: 1, Midfield: 2, Offence: 3 };
const POS_ABBR:  Record<string, string>  = { Goalkeeper: 'GK', Defence: 'DEF', Midfield: 'MID', Offence: 'FWD' };

export default function PollPage() {
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId]       = useState<string | null>(null);
  const [questions, setQuestions] = useState<PollQuestion[]>([]);
  const [teams, setTeams]         = useState<Team[]>([]);
  const [players, setPlayers]     = useState<Player[]>([]);
  const [myPicks, setMyPicks]     = useState<Record<number, string>>({});
  const [allResponses, setAllResponses] = useState<ResponseWithUser[]>([]);
  const [loading, setLoading]     = useState(true);

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    setUserId(u.user.id);

    const [{ data: qs }, { data: ts }, { data: ps }, { data: resp }] = await Promise.all([
      supabase.from('poll_questions').select('*').order('sort_order'),
      supabase.from('teams').select('id, name, tla').order('name'),
      supabase.from('players').select('id, name, position, team_id').order('name'),
      supabase
        .from('poll_responses')
        .select('question_id, pick, user_id, profiles:user_id (display_name)'),
    ]);

    setQuestions((qs as PollQuestion[]) ?? []);
    setTeams((ts as Team[]) ?? []);
    setPlayers((ps as Player[]) ?? []);

    const responses = (resp as unknown as ResponseWithUser[]) ?? [];
    setAllResponses(responses);

    const picks: Record<number, string> = {};
    for (const r of responses) {
      if (r.user_id === u.user.id) picks[r.question_id] = r.pick;
    }
    setMyPicks(picks);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const playersByTeam = useMemo((): TeamGroup[] => {
    const teamMap = new Map(teams.map((t) => [t.id, t]));
    const groups  = new Map<number, TeamGroup>();
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
  }, [players, teams]);

  const anyOpen = questions.some(
    (q) => q.opens_at != null && new Date(q.opens_at) <= new Date()
  );

  if (loading) {
    return <p className="py-20 text-center font-mono text-sm text-chalk/40">Loading…</p>;
  }

  if (!anyOpen) {
    return (
      <div className="flex flex-col items-center py-24 text-center">
        <span className="text-chalk/40"><HugeiconsIcon icon={LockIcon} size={48} color="currentColor" strokeWidth={1.5} /></span>
        <h1 className="mt-4 font-display text-4xl uppercase text-chalk">Opinion Poll</h1>
        <p className="mt-3 max-w-sm text-chalk/55">
          The poll opens after the final whistle. Come back once the trophy has been lifted.
        </p>
      </div>
    );
  }

  function resolvePick(kind: PollQuestion['pick_kind'], pick: string): string {
    if (kind === 'team') {
      const t = teams.find((x) => String(x.id) === pick);
      return t ? (t.tla ? `${t.tla} — ${t.name}` : t.name) : pick;
    }
    const p = players.find((x) => String(x.id) === pick);
    return p ? p.name : pick;
  }

  return (
    <div>
      <h1 className="font-display text-4xl uppercase text-chalk">Opinion Poll</h1>
      <p className="mt-1 text-sm text-chalk/55">
        The final whistle has blown — now tell us how it really went.
      </p>

      <div className="mt-6 space-y-4">
        {questions.map((q) => {
          const open = q.opens_at != null && new Date(q.opens_at) <= new Date();
          const qResponses = allResponses.filter((r) => r.question_id === q.id);

          return (
            <QuestionCard
              key={q.id}
              question={q}
              open={open}
              myPick={myPicks[q.id] ?? ''}
              responses={qResponses}
              teams={teams}
              playersByTeam={playersByTeam}
              userId={userId!}
              supabase={supabase}
              resolvePick={(pick) => resolvePick(q.pick_kind, pick)}
              onSaved={(pick) => {
                setMyPicks((prev) => ({ ...prev, [q.id]: pick }));
                setAllResponses((prev) => {
                  const filtered = prev.filter(
                    (r) => !(r.question_id === q.id && r.user_id === userId)
                  );
                  return [...filtered, { question_id: q.id, pick, user_id: userId!, profiles: null }];
                });
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

function QuestionCard({
  question,
  open,
  myPick,
  responses,
  teams,
  playersByTeam,
  userId,
  supabase,
  resolvePick,
  onSaved,
}: {
  question: PollQuestion;
  open: boolean;
  myPick: string;
  responses: ResponseWithUser[];
  teams: Team[];
  playersByTeam: TeamGroup[];
  userId: string;
  supabase: ReturnType<typeof createClient>;
  resolvePick: (pick: string) => string;
  onSaved: (pick: string) => void;
}) {
  const [pick, setPick]   = useState(myPick);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  async function save() {
    if (!pick) return;
    setState('saving');
    const { error } = await supabase
      .from('poll_responses')
      .upsert(
        { user_id: userId, question_id: question.id, pick },
        { onConflict: 'user_id,question_id' }
      );
    if (error) {
      setState('error');
    } else {
      setState('saved');
      onSaved(pick);
      setTimeout(() => setState('idle'), 1500);
    }
  }

  // Aggregate: group responses by pick, sorted by count desc
  const tally = useMemo(() => {
    const counts = new Map<string, { count: number; voters: string[] }>();
    for (const r of responses) {
      const name = r.profiles?.display_name ?? 'Someone';
      if (!counts.has(r.pick)) counts.set(r.pick, { count: 0, voters: [] });
      const entry = counts.get(r.pick)!;
      entry.count++;
      entry.voters.push(name);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .map(([pickVal, { count, voters }]) => ({
        pickVal,
        label: resolvePick(pickVal),
        count,
        voters,
      }));
  }, [responses, resolvePick]);

  const totalVotes = responses.length;
  const maxCount   = tally[0]?.count ?? 1;

  return (
    <div className="rounded-2xl border border-white/10 bg-pitch-900/60 p-5 shadow-card">
      <h2 className="font-display text-xl uppercase tracking-wide text-chalk">{question.label}</h2>

      {!open ? (
        <p className="mt-2 font-mono text-sm uppercase tracking-widest text-chalk/40">Not open yet</p>
      ) : (
        <>
          {/* Picker */}
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[200px]">
              <PickSelect
                kind={question.pick_kind}
                value={pick}
                onChange={setPick}
                teams={teams}
                playersByTeam={playersByTeam}
              />
            </div>
            <button
              onClick={save}
              disabled={!pick || state === 'saving'}
              className="rounded-xl bg-lime px-5 py-2.5 font-display text-sm uppercase tracking-wide text-pitch-950 transition hover:brightness-110 disabled:opacity-40"
            >
              {state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved ✓' : myPick ? 'Update' : 'Submit'}
            </button>
            {state === 'error' && <span className="font-mono text-sm text-flame">Couldn&apos;t save</span>}
          </div>

          {/* Results reveal */}
          {tally.length > 0 && (
            <div className="mt-5 border-t border-white/5 pt-4">
              <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-chalk/40">
                {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
              </p>
              <div className="space-y-3">
                {tally.map(({ pickVal, label, count, voters }) => {
                  const pct = Math.round((count / totalVotes) * 100);
                  const barPct = Math.round((count / maxCount) * 100);
                  const isMe = pickVal === myPick;
                  return (
                    <div key={pickVal}>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className={`font-display text-sm uppercase tracking-wide ${isMe ? 'text-lime' : 'text-chalk'}`}>
                          {label}
                          {isMe && <span className="ml-1.5 font-mono text-[10px] text-lime/70">you</span>}
                        </span>
                        <span className="shrink-0 font-mono text-sm text-chalk/40">{pct}%</span>
                      </div>
                      <div className="mt-1 h-1.5 w-full rounded-full bg-pitch-700">
                        <div
                          className={`h-1.5 rounded-full transition-all ${isMe ? 'bg-lime' : 'bg-chalk/30'}`}
                          style={{ width: `${barPct}%` }}
                        />
                      </div>
                      <p className="mt-0.5 font-mono text-[10px] text-chalk/35">
                        {voters.join(', ')}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PickSelect({
  kind, value, onChange, teams, playersByTeam,
}: {
  kind: PollQuestion['pick_kind'];
  value: string;
  onChange: (v: string) => void;
  teams: Team[];
  playersByTeam: TeamGroup[];
}) {
  const base = 'w-full rounded-xl border border-white/15 bg-pitch-800 px-3 py-2.5 font-mono text-sm text-chalk outline-none focus:border-lime/70';

  if (kind === 'team') {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} className={base}>
        <option value="">— pick a team —</option>
        {teams.map((t) => (
          <option key={t.id} value={String(t.id)}>
            {t.tla ? `${t.tla} — ${t.name}` : t.name}
          </option>
        ))}
      </select>
    );
  }

  if (playersByTeam.length > 0) {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} className={base}>
        <option value="">— pick a player —</option>
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
      placeholder="Player name"
      className={base}
    />
  );
}
