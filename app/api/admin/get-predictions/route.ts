import { NextRequest, NextResponse } from 'next/server';
import { getAdminUser, isAdmin, unauthorizedResponse } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  const user = await getAdminUser();
  if (!isAdmin(user?.email)) return unauthorizedResponse();

  const fixtureId = req.nextUrl.searchParams.get('fixture_id');
  if (!fixtureId) return NextResponse.json({ error: 'fixture_id required' }, { status: 400 });

  const db = createAdminClient();
  const { data, error } = await db
    .from('match_predictions')
    .select('user_id, home_pred, away_pred, is_banker')
    .eq('fixture_id', Number(fixtureId));

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
