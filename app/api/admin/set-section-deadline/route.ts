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

  const { section, deadline } = await req.json();
  if (!section) return NextResponse.json({ error: 'section required' }, { status: 400 });

  const deadlineValue = deadline ? new Date(deadline).toISOString() : null;
  const db = createAdminClient();
  const { error } = await db
    .from('award_categories')
    .update({ deadline: deadlineValue })
    .eq('section', section);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
