import { NextRequest, NextResponse } from 'next/server';
import { getAdminUser, isAdmin, unauthorizedResponse } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { scorePrediction, EXACT_SCORE_POINTS, CORRECT_RESULT_POINTS } from '@/lib/scoring';

export async function POST(req: NextRequest) {
  const user = await getAdminUser();
  if (!isAdmin(user?.email)) return unauthorizedResponse();

  const body = await req.json() as { fixture_id?: number; home_score?: number; away_score?: number };
  const { fixture_id, home_score, away_score } = body;
  if (!fixture_id || home_score == null || away_score == null) {
    return NextResponse.json({ error: 'fixture_id, home_score, away_score required' }, { status: 400 });
  }

  const db = createAdminClient();

  const { data: rulesRows } = await db.from('scoring_rules').select('key, points');
  const rulesMap = Object.fromEntries((rulesRows ?? []).map((r) => [r.key, r.points]));
  const exactPts  = rulesMap['match_exact']  ?? EXACT_SCORE_POINTS;
  const resultPts = rulesMap['match_result'] ?? CORRECT_RESULT_POINTS;

  const { error: fxErr } = await db
    .from('fixtures')
    .update({ home_score, away_score, status: 'FINISHED' })
    .eq('id', fixture_id);
  if (fxErr) return NextResponse.json({ error: fxErr.message }, { status: 500 });

  const { data: preds } = await db
    .from('match_predictions')
    .select('id, home_pred, away_pred, is_banker')
    .eq('fixture_id', fixture_id);

  for (const p of preds ?? []) {
    const pts = scorePrediction(p.home_pred, p.away_pred, home_score, away_score, exactPts, resultPts, p.is_banker ?? false);
    await db.from('match_predictions').update({ points: pts }).eq('id', p.id);
  }

  return NextResponse.json({ ok: true, scored: preds?.length ?? 0 });
}
