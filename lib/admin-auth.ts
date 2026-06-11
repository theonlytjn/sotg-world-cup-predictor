import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function getAdminUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export function isAdmin(email: string | undefined | null): boolean {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail || !email) return false;
  return email === adminEmail;
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: 'unauthorized' }, { status: 403 });
}
