import { NextRequest, NextResponse } from 'next/server';
import { getAdminUser, isAdmin, unauthorizedResponse } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';

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
  return NextResponse.json({ ok: true });
}
