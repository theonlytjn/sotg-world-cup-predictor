import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const LOCK_BEFORE_MS = 15 * 60_000;

export async function POST(req: NextRequest) {
  const serverClient = await createClient();
  const { data: { user } } = await serverClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json() as { fixture_id?: number };
  const { fixture_id } = body;
  if (!fixture_id) return NextResponse.json({ error: 'fixture_id required' }, { status: 400 });

  const db = createAdminClient();

  const { data: fixture } = await db
    .from('fixtures')
    .select('id, matchday, stage, kickoff')
    .eq('id', fixture_id)
    .single();

  if (!fixture) return NextResponse.json({ error: 'fixture not found' }, { status: 404 });

  const lockAt = new Date(fixture.kickoff).getTime() - LOCK_BEFORE_MS;
  if (lockAt <= Date.now()) {
    return NextResponse.json({ error: 'fixture is locked' }, { status: 400 });
  }

  const { data: currentPred } = await db
    .from('match_predictions')
    .select('is_banker')
    .eq('user_id', user.id)
    .eq('fixture_id', fixture_id)
    .maybeSingle();

  if (!currentPred) {
    return NextResponse.json({ error: 'no prediction for this fixture' }, { status: 404 });
  }

  const newBankerState = !currentPred.is_banker;

  if (newBankerState) {
    // Find siblings in the same matchday (group stage) or same stage (knockout)
    const siblingQuery = fixture.matchday !== null
      ? db.from('fixtures').select('id').eq('matchday', fixture.matchday).neq('id', fixture_id)
      : db.from('fixtures').select('id').eq('stage', fixture.stage).neq('id', fixture_id);

    const { data: siblings } = await siblingQuery;
    if (siblings && siblings.length > 0) {
      await db
        .from('match_predictions')
        .update({ is_banker: false })
        .eq('user_id', user.id)
        .in('fixture_id', siblings.map((s) => s.id));
    }
  }

  await db
    .from('match_predictions')
    .update({ is_banker: newBankerState })
    .eq('user_id', user.id)
    .eq('fixture_id', fixture_id);

  return NextResponse.json({ ok: true, is_banker: newBankerState });
}
