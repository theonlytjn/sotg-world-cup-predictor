import { NextRequest, NextResponse } from 'next/server';
import { getAdminUser, isAdmin, unauthorizedResponse } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { scorePrediction, EXACT_SCORE_POINTS, CORRECT_RESULT_POINTS } from '@/lib/scoring';

export async function POST(req: NextRequest) {
  const user = await getAdminUser();
  if (!isAdmin(user?.email)) return unauthorizedResponse();

  const body = await req.json() as { fixture_id?: number; user_id?: string; is_banker?: boolean };
  const { fixture_id, user_id, is_banker } = body;
  if (!fixture_id || !user_id || is_banker == null) {
    return NextResponse.json({ error: 'fixture_id, user_id, is_banker required' }, { status: 400 });
  }

  const db = createAdminClient();

  const { data: fixture } = await db
    .from('fixtures')
    .select('id, matchday, stage')
    .eq('id', fixture_id)
    .single();
  if (!fixture) return NextResponse.json({ error: 'fixture not found' }, { status: 404 });

  const { data: existingPred } = await db
    .from('match_predictions')
    .select('id')
    .eq('user_id', user_id)
    .eq('fixture_id', fixture_id)
    .maybeSingle();
  if (!existingPred) return NextResponse.json({ error: 'no prediction for this fixture' }, { status: 404 });

  const { data: rulesRows } = await db.from('scoring_rules').select('key, points');
  const rulesMap = Object.fromEntries((rulesRows ?? []).map((r) => [r.key, r.points]));
  const exactPts  = rulesMap['match_exact']  ?? EXACT_SCORE_POINTS;
  const resultPts = rulesMap['match_result'] ?? CORRECT_RESULT_POINTS;

  async function rescore(fxId: number) {
    const { data: fx } = await db.from('fixtures').select('status, home_score, away_score').eq('id', fxId).single();
    if (fx?.status !== 'FINISHED' || fx.home_score == null || fx.away_score == null) return;
    const { data: pred } = await db
      .from('match_predictions')
      .select('home_pred, away_pred, is_banker')
      .eq('fixture_id', fxId)
      .eq('user_id', user_id)
      .maybeSingle();
    if (!pred) return;
    const pts = scorePrediction(pred.home_pred, pred.away_pred, fx.home_score, fx.away_score, exactPts, resultPts, pred.is_banker ?? false);
    await db.from('match_predictions').update({ points: pts }).eq('fixture_id', fxId).eq('user_id', user_id);
  }

  // Only one banker per matchday (group stage) or per stage (knockout) — unset any siblings.
  let siblingIds: number[] = [];
  if (is_banker) {
    const siblingQuery = fixture.matchday !== null
      ? db.from('fixtures').select('id').eq('matchday', fixture.matchday).neq('id', fixture_id)
      : db.from('fixtures').select('id').eq('stage', fixture.stage).neq('id', fixture_id);
    const { data: siblings } = await siblingQuery;
    siblingIds = (siblings ?? []).map((s) => s.id);
    if (siblingIds.length > 0) {
      await db.from('match_predictions').update({ is_banker: false }).eq('user_id', user_id).in('fixture_id', siblingIds);
    }
  }

  const { error } = await db
    .from('match_predictions')
    .update({ is_banker })
    .eq('user_id', user_id)
    .eq('fixture_id', fixture_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await rescore(fixture_id);
  for (const id of siblingIds) await rescore(id);

  return NextResponse.json({ ok: true, is_banker });
}
