import { NextResponse } from 'next/server';
import { getAdminUser, isAdmin } from '@/lib/admin-auth';

export async function GET() {
  const user = await getAdminUser();
  return NextResponse.json({ isAdmin: isAdmin(user?.email) });
}
