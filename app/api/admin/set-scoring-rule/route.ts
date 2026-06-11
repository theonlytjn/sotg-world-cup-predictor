import { NextRequest, NextResponse } from 'next/server';
import { getAdminUser, isAdmin, unauthorizedResponse } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  const user = await getAdminUser();
  if (!isAdmin(user?.email)) return unauthorizedResponse();

  const body = await req.json() as { key?: string; points?: number };
  const { key, points } = body;
  if (!key || points == null || !Number.isInteger(points) || points < 0) {
    return NextResponse.json({ error: 'key and non-negative integer points required' }, { status: 400 });
  }

  const db = createAdminClient();
  const { error } = await db
    .from('scoring_rules')
    .update({ points })
    .eq('key', key);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, key, points });
}
