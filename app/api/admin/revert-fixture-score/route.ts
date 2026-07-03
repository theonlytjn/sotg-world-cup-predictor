import { NextRequest, NextResponse } from 'next/server';
import { getAdminUser, isAdmin, unauthorizedResponse } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { scorePrediction, EXACT_SCORE_POINTS, CORRECT_RESULT_POINTS } from '@/lib/scoring';

type FDMatch = {
  status: string;
  score: { fullTime: { home: number | null; away: number | null } };
  goals: {
    minute: number | null;
    injuryTime: number | null;
    type: string;
    team: { id: number } | null;
    scorer: { name: string } | null;
    assist: { name: string } | null;
  }[] | null;
};

export async function POST(req: NextRequest) {
  const user = await getAdminUser();
  if (!isAdmin(user?.email)) return unauthorizedResponse();

  const body = await req.json() as { fixture_id?: number };
  const { fixture_id } = body;
  if (!fixture_id) {
    return NextResponse.json({ error: 'fixture_id required' }, { status: 400 });
  }

  const db = createAdminClient();

  // Unlock first so the next cron poll picks this fixture back up even if
  // the immediate re-fetch below fails.
  const { data: fixture, error: unlockErr } = await db
    .from('fixtures')
    .update({ score_locked: false })
    .eq('id', fixture_id)
    .select('id, external_id')
    .single();
  if (unlockErr || !fixture) {
    return NextResponse.json({ error: unlockErr?.message ?? 'fixture not found' }, { status: 500 });
  }

  if (!fixture.external_id) {
    return NextResponse.json({ ok: true, refetched: false });
  }

  const fdKey = process.env.FOOTBALL_DATA_KEY!;
  const res = await fetch(`https://api.football-data.org/v4/matches/${fixture.external_id}`, {
    headers: { 'X-Auth-Token': fdKey },
    cache: 'no-store',
  }).catch(() => null);

  if (!res?.ok) {
    return NextResponse.json({ ok: true, refetched: false });
  }

  const { match } = (await res.json()) as { match: FDMatch };
  const goals = (match.goals ?? []).map((g) => ({
    minute: g.minute,
    injury_time: g.injuryTime,
    type: g.type,
    team_id: g.team?.id ?? null,
    scorer: g.scorer?.name ?? null,
    assist: g.assist?.name ?? null,
  }));

  await db
    .from('fixtures')
    .update({
      status: match.status,
      home_score: match.score?.fullTime?.home ?? null,
      away_score: match.score?.fullTime?.away ?? null,
      goals: goals.length > 0 ? goals : null,
    })
    .eq('id', fixture_id);

  let settled = 0;
  if (match.status === 'FINISHED' && match.score?.fullTime?.home != null && match.score?.fullTime?.away != null) {
    const { data: rulesRows } = await db.from('scoring_rules').select('key, points');
    const rulesMap = Object.fromEntries((rulesRows ?? []).map((r) => [r.key, r.points]));
    const exactPts  = rulesMap['match_exact']  ?? EXACT_SCORE_POINTS;
    const resultPts = rulesMap['match_result'] ?? CORRECT_RESULT_POINTS;

    const { data: preds } = await db
      .from('match_predictions')
      .select('id, home_pred, away_pred, is_banker')
      .eq('fixture_id', fixture_id);

    for (const p of preds ?? []) {
      const pts = scorePrediction(p.home_pred, p.away_pred, match.score.fullTime.home!, match.score.fullTime.away!, exactPts, resultPts, p.is_banker ?? false);
      await db.from('match_predictions').update({ points: pts }).eq('id', p.id);
    }
    settled = preds?.length ?? 0;
  }

  return NextResponse.json({ ok: true, refetched: true, settled });
}
