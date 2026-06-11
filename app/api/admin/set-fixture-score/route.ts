import { NextRequest, NextResponse } from 'next/server';
import { getAdminUser, isAdmin, unauthorizedResponse } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { scorePrediction } from '@/lib/scoring';

export async function POST(req: NextRequest) {
  const user = await getAdminUser();
  if (!isAdmin(user?.email)) return unauthorizedResponse();

  const body = await req.json() as { fixture_id?: number; home_score?: number; away_score?: number };
  const { fixture_id, home_score, away_score } = body;
  if (!fixture_id || home_score == null || away_score == null) {
    return NextResponse.json({ error: 'fixture_id, home_score, away_score required' }, { status: 400 });
  }

  const db = createAdminClient();

  const { error: fxErr } = await db
    .from('fixtures')
    .update({ home_score, away_score, status: 'FINISHED' })
    .eq('id', fixture_id);
  if (fxErr) return NextResponse.json({ error: fxErr.message }, { status: 500 });

  const { data: preds } = await db
    .from('match_predictions')
    .select('id, home_pred, away_pred')
    .eq('fixture_id', fixture_id);

  for (const p of preds ?? []) {
    const pts = scorePrediction(p.home_pred, p.away_pred, home_score, away_score);
    await db.from('match_predictions').update({ points: pts }).eq('id', p.id);
  }

  return NextResponse.json({ ok: true, scored: preds?.length ?? 0 });
}
