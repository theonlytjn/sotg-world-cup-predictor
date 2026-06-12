import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

type StandingsRow = {
  group_label: string;
  position: number;
  played: number;
  points: number;
  goal_diff: number;
  goals_for: number;
  team_id: number;
  team_name: string;
  tla: string | null;
};

// Official FIFA 2026 Round of 32 bracket (from the app)
const R32: { date: string; slot1: string; slot2: string }[] = [
  { date: 'Sun 28 Jun', slot1: '2A', slot2: '2B' },
  { date: 'Mon 29 Jun', slot1: '1C', slot2: '2F' },
  { date: 'Mon 29 Jun', slot1: '1E', slot2: '3ABCDF' },
  { date: 'Tue 30 Jun', slot1: '1F', slot2: '2C' },
  { date: 'Tue 30 Jun', slot1: '2E', slot2: '2I' },
  { date: 'Tue 30 Jun', slot1: '1I', slot2: '3CDFGH' },
  { date: 'Wed 1 Jul',  slot1: '1A', slot2: '3CEFHI' },
  { date: 'Wed 1 Jul',  slot1: '1L', slot2: '3EHIJK' },
  { date: 'Wed 1 Jul',  slot1: '1G', slot2: '3AEHIJ' },
  { date: 'Thu 2 Jul',  slot1: '1D', slot2: '3BEFIJ' },
  { date: 'Thu 2 Jul',  slot1: '1H', slot2: '2J' },
  { date: 'Fri 3 Jul',  slot1: '2K', slot2: '2L' },
  { date: 'Fri 3 Jul',  slot1: '1B', slot2: '3EFGIJ' },
  { date: 'Fri 3 Jul',  slot1: '2D', slot2: '2G' },
  { date: 'Sat 4 Jul',  slot1: '1J', slot2: '2H' },
  { date: 'Sat 4 Jul',  slot1: '1K', slot2: '3ABCDGHKL' },
];

export default async function BracketPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail || user?.email !== adminEmail) redirect('/predict');

  const db = createAdminClient();

  const { data: rawStandings } = await db
    .from('group_standings')
    .select(`
      group_label, position, played, points, goal_diff, goals_for, team_id,
      teams!inner(name, tla)
    `)
    .order('group_label')
    .order('position');

  // Flatten the nested join (Supabase returns FK joins as array)
  const standings: StandingsRow[] = (rawStandings ?? []).map((r) => {
    const t = Array.isArray(r.teams) ? r.teams[0] : r.teams;
    return {
      group_label: r.group_label as string,
      position: r.position as number,
      played: r.played as number,
      points: r.points as number,
      goal_diff: r.goal_diff as number,
      goals_for: r.goals_for as number,
      team_id: r.team_id as number,
      team_name: (t as { name: string } | null)?.name ?? '?',
      tla: (t as { tla: string | null } | null)?.tla ?? null,
    };
  });

  // Build lookup: group_label → position → StandingsRow
  const byGroup = new Map<string, StandingsRow[]>();
  for (const row of standings) {
    if (!byGroup.has(row.group_label)) byGroup.set(row.group_label, []);
    byGroup.get(row.group_label)!.push(row);
  }

  const groups = [...byGroup.keys()].sort();

  function getTeam(group: string, pos: number): StandingsRow | undefined {
    return byGroup.get(group)?.find((r) => r.position === pos);
  }

  function resolveSlot(slot: string): { label: string; tla: string | null; confirmed: boolean } {
    const pos = parseInt(slot[0], 10);
    const groups = slot.slice(1);

    if (groups.length === 1) {
      // Direct slot: 1A, 2B, etc.
      const team = getTeam(groups, pos);
      const groupFinished = byGroup.get(groups)?.every((r) => r.played === 3) ?? false;
      if (!team) return { label: `${pos === 1 ? '1st' : '2nd'} Group ${groups}`, tla: null, confirmed: false };
      return {
        label: team.tla ?? team.team_name,
        tla: team.tla,
        confirmed: groupFinished,
      };
    }

    // Best 3rd from multiple groups
    return {
      label: `Best 3rd (${groups.split('').join('/')})`,
      tla: null,
      confirmed: false,
    };
  }

  // Group by date for the bracket display
  const byDate = new Map<string, typeof R32>();
  for (const m of R32) {
    if (!byDate.has(m.date)) byDate.set(m.date, []);
    byDate.get(m.date)!.push(m);
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <Link href="/admin" className="font-mono text-xs uppercase tracking-widest text-chalk/40 hover:text-chalk transition">
          ← Admin
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="font-display text-4xl uppercase text-chalk">Bracket Preview</h1>
        <p className="mt-1 font-mono text-xs text-chalk/40">
          Projected Round of 32 · Admin only · Updates as results come in
        </p>
      </div>

      {/* Group standings grid */}
      <section className="mb-10">
        <h2 className="mb-4 font-display text-lg uppercase text-lime">Group Standings</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {groups.map((g) => {
            const rows = byGroup.get(g) ?? [];
            return (
              <div key={g} className="rounded-xl border border-white/10 bg-pitch-900/60 p-3">
                <p className="mb-2 font-display text-sm uppercase text-lime">Group {g}</p>
                {rows.map((r) => {
                  const isAdvancing = r.position <= 2;
                  const groupDone = rows.every((x) => x.played === 3);
                  return (
                    <div
                      key={r.team_id}
                      className={[
                        'flex items-center justify-between py-0.5',
                        isAdvancing && groupDone ? 'text-chalk' : isAdvancing ? 'text-chalk/70' : 'text-chalk/30',
                      ].join(' ')}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-mono text-[10px] text-chalk/40 w-3">{r.position}</span>
                        <span className="font-mono text-xs truncate">{r.tla ?? r.team_name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span className="font-mono text-[10px] text-chalk/40">{r.played}g</span>
                        <span className="font-mono text-xs font-bold">{r.points}pt</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </section>

      {/* Round of 32 bracket */}
      <section>
        <h2 className="mb-4 font-display text-lg uppercase text-lime">Round of 32</h2>
        <div className="space-y-6">
          {[...byDate.entries()].map(([date, matches]) => (
            <div key={date}>
              <p className="mb-2 font-mono text-xs uppercase tracking-widest text-chalk/40">{date}</p>
              <div className="space-y-2">
                {matches.map((m, i) => {
                  const s1 = resolveSlot(m.slot1);
                  const s2 = resolveSlot(m.slot2);
                  const isBest3rd1 = m.slot1.length > 2;
                  const isBest3rd2 = m.slot2.length > 2;
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-3 rounded-xl border border-white/10 bg-pitch-900/60 px-4 py-3"
                    >
                      <span className="font-mono text-[10px] uppercase tracking-widest text-chalk/30 w-12 shrink-0">
                        {m.slot1}
                      </span>
                      <span className={[
                        'flex-1 font-display text-sm uppercase',
                        s1.confirmed ? 'text-chalk' : isBest3rd1 ? 'text-chalk/30 italic' : 'text-chalk/60',
                      ].join(' ')}>
                        {s1.label}
                      </span>
                      <span className="font-mono text-xs text-chalk/30 shrink-0">vs</span>
                      <span className={[
                        'flex-1 text-right font-display text-sm uppercase',
                        s2.confirmed ? 'text-chalk' : isBest3rd2 ? 'text-chalk/30 italic' : 'text-chalk/60',
                      ].join(' ')}>
                        {s2.label}
                      </span>
                      <span className="font-mono text-[10px] uppercase tracking-widest text-chalk/30 w-12 shrink-0 text-right">
                        {m.slot2}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 font-mono text-xs text-chalk/30">
          Confirmed (bright) once the group finishes all 3 games · Best 3rd slots resolve after all groups complete
        </p>
      </section>
    </div>
  );
}
