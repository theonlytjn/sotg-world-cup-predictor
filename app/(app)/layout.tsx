import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Nav from '@/components/Nav';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('nickname_set')
    .eq('id', user.id)
    .single();

  if (!profile?.nickname_set) redirect('/onboarding');

  return (
    <div className="min-h-dvh">
      <Nav />
      <div className="mx-auto max-w-4xl px-4 pb-24 pt-6">{children}</div>
    </div>
  );
}
