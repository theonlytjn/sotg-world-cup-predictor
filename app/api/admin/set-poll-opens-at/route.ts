import { NextRequest, NextResponse } from 'next/server';
import { getAdminUser, isAdmin, unauthorizedResponse } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  const user = await getAdminUser();
  if (!isAdmin(user?.email)) return unauthorizedResponse();

  const body = await req.json() as {
    question_id: number | null; // null = apply to all questions
    opens_at: string | null;
  };
  const { question_id, opens_at } = body;

  const db = createAdminClient();

  const query = db.from('poll_questions').update({ opens_at: opens_at ?? null });
  const { error } = question_id != null
    ? await query.eq('id', question_id)
    : await query.neq('id', 0); // matches all rows

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
