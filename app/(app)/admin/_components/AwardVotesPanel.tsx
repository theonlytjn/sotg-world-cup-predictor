'use client';

import { useEffect, useState } from 'react';

type Team   = { id: number; name: string; tla: string | null };
type Player = { id: number; name: string };

type VoteRow = {
  category_id: number;
  category_label: string;
  pick_kind: string;
  section: string;
  sort_order: number;
  user_id: string;
  display_name: string;
  pick_1: string | null;
  pick_2: string | null;
  pick_3: string | null;
  pick_4: string | null;
};

type CategoryGroup = {
  category_id: number;
  label: string;
  pick_kind: string;
  section: string;
  sort_order: number;
  votes: VoteRow[];
};

const SECTION_ORDER = ['main', 'specials', 'xtra', 'opinion', 'tott'] as const;
const SECTION_LABELS: Record<string, string> = {
  main:     'Awards',
  specials: 'SOTG Specials',
  xtra:     'SOTG Xtra',
  opinion:  'Opinion',
  tott:     'Team of Tournament XI',
};

export default function AwardVotesPanel({
  teams,
  players,
}: {
  teams: Team[];
  players: Player[];
}) {
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch('/api/admin/award-votes')
      .then((r) => r.json())
      .then(({ votes, error }: { votes?: VoteRow[]; error?: string }) => {
        if (error || !votes) { setErr(error ?? 'Failed to load'); setLoading(false); return; }
        const map = new Map<number, CategoryGroup>();
        for (const v of votes) {
          if (!map.has(v.category_id)) {
            map.set(v.category_id, {
              category_id: v.category_id,
              label: v.category_label,
              pick_kind: v.pick_kind,
              section: v.section,
              sort_order: v.sort_order,
              votes: [],
            });
          }
          map.get(v.category_id)!.votes.push(v);
        }
        setGroups([...map.values()]);
        setLoading(false);
      })
      .catch(() => { setErr('Network error'); setLoading(false); });
  }, []);

  const teamMap   = new Map(teams.map((t) => [String(t.id), t]));
  const playerMap = new Map(players.map((p) => [String(p.id), p]));

  function resolve(kind: string, value: string | null): string {
    if (!value) return '—';
    if (kind === 'team')   { const t = teamMap.get(value);   return t ? (t.tla ?? t.name) : value; }
    if (kind === 'player') { const p = playerMap.get(value); return p ? p.name : value; }
    return value;
  }

  if (loading) return <p className="font-mono text-base text-chalk">Loading votes…</p>;
  if (err)     return <p className="font-mono text-base text-flame">{err}</p>;
  if (groups.length === 0) return <p className="font-mono text-base text-chalk">No award predictions submitted yet.</p>;

  const bySection = new Map<string, CategoryGroup[]>();
  for (const g of groups) {
    if (!bySection.has(g.section)) bySection.set(g.section, []);
    bySection.get(g.section)!.push(g);
  }

  return (
    <div>
      <h2 className="font-display text-2xl uppercase text-chalk">Award Votes</h2>
      <p className="mt-1 font-mono text-base text-chalk">
        Every user&apos;s picks across all categories
      </p>

      {SECTION_ORDER.map((sectionKey) => {
        const cats = bySection.get(sectionKey);
        if (!cats?.length) return null;
        return (
          <section key={sectionKey} className="mt-8">
            <div className="mb-4 flex items-center gap-3">
              <h3 className="font-display text-lg uppercase text-lime">{SECTION_LABELS[sectionKey]}</h3>
              <span className="h-px flex-1 bg-white/10" />
            </div>
            <div className="space-y-5">
              {cats.map((cat) => (
                <div key={cat.category_id}>
                  <p className="mb-2.5 font-display text-sm uppercase tracking-[0.2em] text-chalk">
                    {cat.label}
                    <span className="ml-2 font-mono text-sm normal-case tracking-normal text-chalk/50">
                      {cat.votes.length} vote{cat.votes.length !== 1 ? 's' : ''}
                    </span>
                  </p>

                  {cat.votes.length === 0 ? (
                    <p className="font-mono text-sm text-chalk/40">No picks yet</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {cat.votes.map((v) => {
                        const p1 = resolve(cat.pick_kind, v.pick_1);
                        const p2 = v.pick_2 ? resolve(cat.pick_kind, v.pick_2) : null;
                        const p3 = v.pick_3 ? resolve(cat.pick_kind, v.pick_3) : null;
                        const p4 = v.pick_4 ? resolve(cat.pick_kind, v.pick_4) : null;
                        const extras = [p2, p3, p4].filter(Boolean);
                        return (
                          <div
                            key={v.user_id}
                            className="rounded-xl border border-white/10 bg-pitch-900/60 px-3 py-2.5"
                          >
                            <p className="truncate font-display text-sm uppercase tracking-wide text-lime">
                              {v.display_name}
                            </p>
                            <p className="mt-1 truncate font-mono text-sm text-chalk">{p1}</p>
                            {extras.map((ex, i) => (
                              <p key={i} className="truncate font-mono text-sm text-chalk/55">{ex}</p>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
