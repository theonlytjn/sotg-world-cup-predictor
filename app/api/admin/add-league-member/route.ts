import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail || user?.email !== adminEmail) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { league_id, user_id } = await req.json();
  if (!league_id || !user_id) {
    return NextResponse.json({ error: 'league_id and user_id required' }, { status: 400 });
  }

  const db = createAdminClient();
  const { error } = await db
    .from('league_members')
    .upsert({ league_id, user_id }, { onConflict: 'league_id,user_id', ignoreDuplicates: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
