import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import Link from 'next/link';
import AwardPanel from './_components/AwardPanel';
import FixturePanel from './_components/FixturePanel';
import ManualPredictionsPanel from './_components/ManualPredictionsPanel';
import PollPanel from './_components/PollPanel';
import ScoringPanel from './_components/ScoringPanel';
import UsersPanel from './_components/UsersPanel';
import LeaguesAdminPanel from './_components/LeaguesAdminPanel';
import type { AwardCategory, PollQuestion } from '@/lib/types';

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
    { data: players1 },
    { data: players2 },
    { data: fixtures },
    { data: pollQuestions },
    { data: scoringRules },
    { data: profiles },
    { data: allLeagues },
    { data: leagueMembers },
    authUsersRes,
    { data: leaderboardData },
  ] = await Promise.all([
    db.from('award_categories').select('*').order('sort_order'),
    db.from('award_results').select('*'),
    db.from('teams').select('id, name, tla, confederation').order('name'),
    db.from('players').select('id, name, position, team_id').order('name').range(0, 999),
    db.from('players').select('id, name, position, team_id').order('name').range(1000, 1999),
    db.from('fixtures').select(`
      id, matchday, stage, group_label, kickoff, status, home_score, away_score,
      home_team:teams!fixtures_home_team_id_fkey (id, name, tla),
      away_team:teams!fixtures_away_team_id_fkey (id, name, tla)
    `).order('kickoff'),
    db.from('poll_questions').select('*').order('sort_order'),
    db.from('scoring_rules').select('key, label, description, points').order('key'),
    db.from('profiles').select('id, display_name, created_at').order('display_name'),
    db.from('leagues').select('id, name, invite_code, created_by, created_at').order('created_at', { ascending: false }),
    db.from('league_members').select('league_id, user_id'),
    db.auth.admin.listUsers({ perPage: 1000 }),
    db.from('leaderboard').select('user_id, total_points'),
  ]);
  const players = [...(players1 ?? []), ...(players2 ?? [])];

  // Build user rows for UsersPanel
  const authUsers = authUsersRes.data?.users ?? [];
  const emailMap = new Map(authUsers.map((u) => [u.id, u.email ?? '']));
  const ptMap = new Map((leaderboardData ?? []).map((r: { user_id: string; total_points: number }) => [r.user_id, r.total_points]));
  const leagueCountMap = new Map<string, number>();
  for (const m of (leagueMembers ?? []) as { league_id: string; user_id: string }[]) {
    leagueCountMap.set(m.user_id, (leagueCountMap.get(m.user_id) ?? 0) + 1);
  }
  const userRows = (profiles ?? []).map((p: { id: string; display_name: string; created_at: string }) => ({
    id: p.id,
    email: emailMap.get(p.id) ?? '',
    display_name: p.display_name,
    created_at: p.created_at,
    total_points: ptMap.get(p.id) ?? 0,
    league_count: leagueCountMap.get(p.id) ?? 0,
  }));

  // Build league rows for LeaguesAdminPanel
  const profileNameMap = new Map((profiles ?? []).map((p: { id: string; display_name: string }) => [p.id, p.display_name]));
  const leagueMemberCounts = new Map<string, number>();
  for (const m of (leagueMembers ?? []) as { league_id: string; user_id: string }[]) {
    leagueMemberCounts.set(m.league_id, (leagueMemberCounts.get(m.league_id) ?? 0) + 1);
  }
  const leagueRows = (allLeagues ?? []).map((l: { id: string; name: string; invite_code: string; created_by: string; created_at: string }) => ({
    id: l.id,
    name: l.name,
    invite_code: l.invite_code,
    created_by: l.created_by,
    creator_name: profileNameMap.get(l.created_by) ?? 'Unknown',
    member_count: leagueMemberCounts.get(l.id) ?? 0,
    created_at: l.created_at,
  }));

  const resultsByCategory: Record<number, string> = {};
  for (const r of results ?? []) resultsByCategory[r.category_id] = r.result;

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-4xl uppercase text-chalk">Admin</h1>
          <p className="mt-1 font-mono text-base text-chalk">{user.email}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/bracket"
            className="rounded-full border border-white/15 px-3 py-1 font-mono text-base uppercase tracking-widest text-chalk transition hover:border-white/40 hover:text-lime"
          >
            Bracket →
          </Link>
          <span className="rounded-full bg-flame/20 px-3 py-1 font-mono text-base uppercase tracking-widest text-flame">
            Admin
          </span>
        </div>
      </div>

      {/* Scoring — full width */}
      <div className="rounded-2xl border-2 border-white/15 bg-pitch-900/40 p-10">
        <ScoringPanel rules={(scoringRules as { key: string; label: string; description: string; points: number }[]) ?? []} />
      </div>

      {/* 2-column grid for the heavier panels */}
      <div className="mt-6 grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border-2 border-white/15 bg-pitch-900/40 p-10">
          <AwardPanel
            categories={(categories as AwardCategory[]) ?? []}
            resultsByCategory={resultsByCategory}
            teams={(teams as { id: number; name: string; tla: string | null; confederation: string | null }[]) ?? []}
            players={(players as { id: number; name: string; position: string | null; team_id: number | null }[]) ?? []}
          />
        </div>

        <div className="flex flex-col gap-6">
          <div className="rounded-2xl border-2 border-white/15 bg-pitch-900/40 p-10">
            <PollPanel questions={(pollQuestions as PollQuestion[]) ?? []} />
          </div>

          <div className="rounded-2xl border-2 border-white/15 bg-pitch-900/40 p-10">
            <FixturePanel
              fixtures={(fixtures as unknown as Parameters<typeof FixturePanel>[0]['fixtures']) ?? []}
            />
          </div>

          <div className="rounded-2xl border-2 border-white/15 bg-pitch-900/40 p-10">
            <ManualPredictionsPanel
              profiles={(profiles as unknown as { id: string; display_name: string; username: string | null }[]) ?? []}
              fixtures={(fixtures as unknown as Parameters<typeof ManualPredictionsPanel>[0]['fixtures']) ?? []}
            />
          </div>

          <div className="rounded-2xl border-2 border-white/15 bg-pitch-900/40 p-10">
            <LeaguesAdminPanel leagues={leagueRows} />
          </div>

          <div className="rounded-2xl border-2 border-white/15 bg-pitch-900/40 p-10">
            <UsersPanel users={userRows} />
          </div>
        </div>
      </div>
    </div>
  );
}
