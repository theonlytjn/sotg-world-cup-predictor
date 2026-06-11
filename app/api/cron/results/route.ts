import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { scorePrediction, EXACT_SCORE_POINTS, CORRECT_RESULT_POINTS } from '@/lib/scoring';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type FDGoal = {
  minute: number | null;
  injuryTime: number | null;
  type: string;
  team: { id: number; name: string; tla?: string } | null;
  scorer: { id: number; name: string } | null;
  assist: { id: number; name: string } | null;
};

type FDMatch = {
  id: number;
  status: string;
  score: { fullTime: { home: number | null; away: number | null } };
  goals: FDGoal[] | null;
};

type FDStandingRow = {
  position: number;
  team: { id: number };
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
};

type FDStandingGroup = {
  stage: string;
  type: string;
  group: string | null;
  table: FDStandingRow[];
};

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get('authorization');
  if (header === `Bearer ${secret}`) return true;
  if (req.nextUrl.searchParams.get('secret') === secret) return true;
  return false;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const db = createAdminClient();
  const fdKey = process.env.FOOTBALL_DATA_KEY!;

  // 0) load live scoring rules
  const { data: rulesRows } = await db.from('scoring_rules').select('key, points');
  const rulesMap = Object.fromEntries((rulesRows ?? []).map((r) => [r.key, r.points]));
  const exactPts  = rulesMap['match_exact']  ?? EXACT_SCORE_POINTS;
  const resultPts = rulesMap['match_result'] ?? CORRECT_RESULT_POINTS;

  // 1) fetch matches + goals from football-data.org Tier 1
  const [matchesRes, standingsRes] = await Promise.all([
    fetch('https://api.football-data.org/v4/competitions/WC/matches', {
      headers: { 'X-Auth-Token': fdKey },
      cache: 'no-store',
    }),
    fetch('https://api.football-data.org/v4/competitions/WC/standings', {
      headers: { 'X-Auth-Token': fdKey },
      cache: 'no-store',
    }),
  ]);

  if (!matchesRes.ok) {
    return NextResponse.json({ error: `football-data matches ${matchesRes.status}` }, { status: 502 });
  }

  const { matches } = (await matchesRes.json()) as { matches: FDMatch[] };

  // 2) update fixture scores, status, and goals
  let updated = 0;
  for (const m of matches) {
    const goals = (m.goals ?? []).map((g) => ({
      minute: g.minute,
      injury_time: g.injuryTime,
      type: g.type,
      team_id: g.team?.id ?? null,
      scorer: g.scorer?.name ?? null,
      assist: g.assist?.name ?? null,
    }));

    const { data: rows, error } = await db
      .from('fixtures')
      .update({
        status: m.status,
        home_score: m.score?.fullTime?.home ?? null,
        away_score: m.score?.fullTime?.away ?? null,
        goals: goals.length > 0 ? goals : null,
      })
      .eq('external_id', m.id)
      .select('id');
    if (error) continue;
    if (rows?.length) updated += rows.length;
  }

  // 3) rescore all finished predictions
  const { data: finished } = await db
    .from('fixtures')
    .select('id, home_score, away_score')
    .eq('status', 'FINISHED');

  let settled = 0;
  for (const fx of finished ?? []) {
    if (fx.home_score == null || fx.away_score == null) continue;
    const { data: preds } = await db
      .from('match_predictions')
      .select('id, home_pred, away_pred')
      .eq('fixture_id', fx.id);
    for (const p of preds ?? []) {
      const pts = scorePrediction(p.home_pred, p.away_pred, fx.home_score, fx.away_score, exactPts, resultPts);
      await db.from('match_predictions').update({ points: pts }).eq('id', p.id);
      settled++;
    }
  }

  // 4) upsert group standings from Tier 1 API
  let standingsUpserted = 0;
  if (standingsRes.ok) {
    const { standings } = (await standingsRes.json()) as { standings: FDStandingGroup[] };

    // Map football-data team external_id → internal team id
    const { data: dbTeams } = await db.from('teams').select('id, external_id');
    const idByExternal = new Map<number, number>();
    for (const t of dbTeams ?? []) {
      if (t.external_id != null) idByExternal.set(t.external_id, t.id);
    }

    const rows: {
      group_label: string;
      team_id: number;
      position: number;
      played: number;
      won: number;
      drawn: number;
      lost: number;
      goals_for: number;
      goals_against: number;
      goal_diff: number;
      points: number;
      updated_at: string;
    }[] = [];

    for (const sg of standings) {
      if (sg.type !== 'TOTAL' || !sg.group) continue;
      // "GROUP_A" → "A"
      const label = sg.group.replace('GROUP_', '');
      for (const row of sg.table) {
        const teamId = idByExternal.get(row.team.id);
        if (!teamId) continue;
        rows.push({
          group_label:   label,
          team_id:       teamId,
          position:      row.position,
          played:        row.playedGames,
          won:           row.won,
          drawn:         row.draw,
          lost:          row.lost,
          goals_for:     row.goalsFor,
          goals_against: row.goalsAgainst,
          goal_diff:     row.goalDifference,
          points:        row.points,
          updated_at:    new Date().toISOString(),
        });
      }
    }

    if (rows.length > 0) {
      const { error } = await db
        .from('group_standings')
        .upsert(rows, { onConflict: 'group_label,team_id' });
      if (!error) standingsUpserted = rows.length;
    }
  }

  return NextResponse.json({
    ok: true,
    fixtures_updated: updated,
    predictions_settled: settled,
    standings_upserted: standingsUpserted,
    ran_at: new Date().toISOString(),
  });
}
