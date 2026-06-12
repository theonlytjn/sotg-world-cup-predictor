import { NextRequest, NextResponse } from 'next/server';
import { getAdminUser, isAdmin, unauthorizedResponse } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { scorePrediction } from '@/lib/scoring';

export async function POST(req: NextRequest) {
  const user = await getAdminUser();
  if (!isAdmin(user?.email)) return unauthorizedResponse();

  const body = await req.json() as {
    fixture_id?: number;
    user_id?: string;
    home_pred?: number;
    away_pred?: number;
  };

  const { fixture_id, user_id, home_pred, away_pred } = body;
  if (!fixture_id || !user_id || home_pred == null || away_pred == null) {
    return NextResponse.json({ error: 'fixture_id, user_id, home_pred, away_pred required' }, { status: 400 });
  }

  const db = createAdminClient();
  const { error } = await db
    .from('match_predictions')
    .upsert(
      { fixture_id, user_id, home_pred, away_pred, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,fixture_id' }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // If the fixture is already finished, score this prediction immediately
  const { data: fixture } = await db
    .from('fixtures')
    .select('status, home_score, away_score')
    .eq('id', fixture_id)
    .single();

  if (fixture?.status === 'FINISHED' && fixture.home_score != null && fixture.away_score != null) {
    const [{ data: rulesRows }, { data: latestPred }] = await Promise.all([
      db.from('scoring_rules').select('key, points'),
      db.from('match_predictions').select('is_banker').eq('fixture_id', fixture_id).eq('user_id', user_id).single(),
    ]);
    const rulesMap = Object.fromEntries((rulesRows ?? []).map((r) => [r.key, r.points]));
    const exactPts = (rulesMap['match_exact'] as number | undefined) ?? 5;
    const resultPts = (rulesMap['match_result'] as number | undefined) ?? 1;
    const pts = scorePrediction(home_pred, away_pred, fixture.home_score, fixture.away_score, exactPts, resultPts, latestPred?.is_banker ?? false);
    await db
      .from('match_predictions')
      .update({ points: pts })
      .eq('fixture_id', fixture_id)
      .eq('user_id', user_id);
  }

  return NextResponse.json({ ok: true });
}
