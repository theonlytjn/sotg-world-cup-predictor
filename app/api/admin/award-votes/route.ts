import { NextResponse } from 'next/server';
import { getAdminUser, isAdmin, unauthorizedResponse } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  const user = await getAdminUser();
  if (!isAdmin(user?.email)) return unauthorizedResponse();

  const db = createAdminClient();
  const { data, error } = await db
    .from('award_predictions')
    .select(`
      category_id,
      user_id,
      pick_1,
      pick_2,
      pick_3,
      pick_4,
      award_categories!inner(label, pick_kind, section, sort_order),
      profiles!inner(display_name)
    `);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type RawRow = {
    category_id: number;
    user_id: string;
    pick_1: string | null;
    pick_2: string | null;
    pick_3: string | null;
    pick_4: string | null;
    award_categories: { label: string; pick_kind: string; section: string; sort_order: number };
    profiles: { display_name: string };
  };

  const votes = ((data ?? []) as unknown as RawRow[])
    .map((row) => ({
      category_id: row.category_id,
      category_label: row.award_categories.label,
      pick_kind: row.award_categories.pick_kind,
      section: row.award_categories.section,
      sort_order: row.award_categories.sort_order,
      user_id: row.user_id,
      display_name: row.profiles.display_name,
      pick_1: row.pick_1,
      pick_2: row.pick_2,
      pick_3: row.pick_3,
      pick_4: row.pick_4,
    }))
    .sort((a, b) =>
      a.sort_order !== b.sort_order
        ? a.sort_order - b.sort_order
        : a.display_name.localeCompare(b.display_name)
    );

  return NextResponse.json({ votes });
}
