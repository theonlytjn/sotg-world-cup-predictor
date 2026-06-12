import { NextRequest, NextResponse } from 'next/server';
import { getAdminUser, isAdmin, unauthorizedResponse } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { scoreAwardPrediction } from '@/lib/scoring';

export async function POST(req: NextRequest) {
  const user = await getAdminUser();
  if (!isAdmin(user?.email)) return unauthorizedResponse();

  const body = await req.json() as { category_id?: number; pts_pick_1?: number; pts_pick_2?: number };
  const { category_id, pts_pick_1, pts_pick_2 } = body;

  if (
    !category_id ||
    pts_pick_1 == null || !Number.isInteger(pts_pick_1) || pts_pick_1 < 0 ||
    pts_pick_2 == null || !Number.isInteger(pts_pick_2) || pts_pick_2 < 0
  ) {
    return NextResponse.json({ error: 'category_id, pts_pick_1, pts_pick_2 required (non-negative integers)' }, { status: 400 });
  }

  const db = createAdminClient();

  const { error } = await db
    .from('award_categories')
    .update({ pts_pick_1, pts_pick_2 })
    .eq('id', category_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // If a result is already set, rescore all predictions with the new point values
  const { data: existing } = await db
    .from('award_results')
    .select('result')
    .eq('category_id', category_id)
    .maybeSingle();

  let rescored = 0;
  if (existing?.result) {
    const { data: preds } = await db
      .from('award_predictions')
      .select('id, pick_1, pick_2')
      .eq('category_id', category_id);

    const updates = (preds ?? []).map((p) => ({
      id: p.id,
      points: scoreAwardPrediction(p.pick_1, p.pick_2, existing.result, pts_pick_1, pts_pick_2),
    }));

    if (updates.length > 0) {
      await db.from('award_predictions').upsert(updates, { onConflict: 'id' });
      rescored = updates.length;
    }
  }

  return NextResponse.json({ ok: true, rescored });
}
