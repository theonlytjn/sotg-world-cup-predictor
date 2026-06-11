import { NextRequest, NextResponse } from 'next/server';
import { getAdminUser, isAdmin, unauthorizedResponse } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { scoreAwardPrediction } from '@/lib/scoring';

export async function POST(req: NextRequest) {
  const user = await getAdminUser();
  if (!isAdmin(user?.email)) return unauthorizedResponse();

  const body = await req.json() as { category_id?: number; result?: string | null };
  const { category_id, result } = body;
  if (!category_id) return NextResponse.json({ error: 'category_id required' }, { status: 400 });

  const db = createAdminClient();

  if (!result) {
    await db.from('award_results').delete().eq('category_id', category_id);
    await db.from('award_predictions').update({ points: null }).eq('category_id', category_id);
    return NextResponse.json({ ok: true, cleared: true });
  }

  const { error: upsertErr } = await db
    .from('award_results')
    .upsert({ category_id, result, set_at: new Date().toISOString() }, { onConflict: 'category_id' });
  if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 });

  const { data: cat } = await db
    .from('award_categories')
    .select('pts_pick_1, pts_pick_2')
    .eq('id', category_id)
    .single();
  if (!cat) return NextResponse.json({ error: 'category not found' }, { status: 404 });

  const { data: preds } = await db
    .from('award_predictions')
    .select('id, pick_1, pick_2')
    .eq('category_id', category_id);

  for (const p of preds ?? []) {
    const pts = scoreAwardPrediction(p.pick_1, p.pick_2, result, cat.pts_pick_1, cat.pts_pick_2);
    await db.from('award_predictions').update({ points: pts }).eq('id', p.id);
  }

  return NextResponse.json({ ok: true, scored: preds?.length ?? 0 });
}
