import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import AwardPanel from './_components/AwardPanel';
import FixturePanel from './_components/FixturePanel';
import type { AwardCategory } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail || user?.email !== adminEmail) redirect('/predict');

  const db = createAdminClient();

  const [
    { data: categories },
    { data: results },
    { data: teams },
    { data: players },
    { data: fixtures },
  ] = await Promise.all([
    db.from('award_categories').select('*').order('sort_order'),
    db.from('award_results').select('*'),
    db.from('teams').select('id, name, tla, confederation').order('name'),
    db.from('players').select('id, name, position, team_id').order('name'),
    db.from('fixtures').select(`
      id, matchday, stage, group_label, kickoff, status, home_score, away_score,
      home_team:teams!fixtures_home_team_id_fkey (id, name, tla),
      away_team:teams!fixtures_away_team_id_fkey (id, name, tla)
    `).order('kickoff'),
  ]);

  const resultsByCategory: Record<number, string> = {};
  for (const r of results ?? []) resultsByCategory[r.category_id] = r.result;

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-4xl uppercase text-chalk">Admin</h1>
          <p className="mt-1 font-mono text-xs text-chalk/40">{user.email}</p>
        </div>
        <span className="rounded-full bg-flame/20 px-3 py-1 font-mono text-xs uppercase tracking-widest text-flame">
          Admin
        </span>
      </div>

      <AwardPanel
        categories={(categories as AwardCategory[]) ?? []}
        resultsByCategory={resultsByCategory}
        teams={(teams as { id: number; name: string; tla: string | null; confederation: string | null }[]) ?? []}
        players={(players as { id: number; name: string; position: string | null; team_id: number | null }[]) ?? []}
      />

      <div className="mt-12">
        <FixturePanel
          fixtures={(fixtures as unknown as Parameters<typeof FixturePanel>[0]['fixtures']) ?? []}
        />
      </div>
    </div>
  );
}
