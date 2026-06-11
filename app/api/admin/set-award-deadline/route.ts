import { NextRequest, NextResponse } from 'next/server';
import { getAdminUser, isAdmin, unauthorizedResponse } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  const user = await getAdminUser();
  if (!isAdmin(user?.email)) return unauthorizedResponse();

  const body = await req.json() as { category_id?: number; deadline?: string | null };
  const { category_id, deadline } = body;
  if (!category_id) return NextResponse.json({ error: 'category_id required' }, { status: 400 });

  const db = createAdminClient();
  const { error } = await db
    .from('award_categories')
    .update({ deadline: deadline ?? null })
    .eq('id', category_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
