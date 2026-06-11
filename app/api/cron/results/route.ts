import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { scorePrediction } from '@/lib/scoring';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type FDMatch = {
  id: number;
  status: string;
  score: { fullTime: { home: number | null; away: number | null } };
};

// Accept Vercel Cron's bearer header OR a ?secret= query param (for an
// external poller like cron-job.org / GitHub Actions).
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get('authorization');
  if (header === `Bearer ${secret}`) return true;
  if (req.nextUrl.searchParams.get('secret') === secret) return true;
  return false;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const db = createAdminClient();

  // 1) pull live data from football-data.org
  const res = await fetch('https://api.football-data.org/v4/competitions/WC/matches', {
    headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_KEY! },
    cache: 'no-store',
  });
  if (!res.ok) {
    return NextResponse.json({ error: `football-data ${res.status}` }, { status: 502 });
  }
  const { matches } = (await res.json()) as { matches: FDMatch[] };

  // 2) update fixture scores/status by external_id
  let updated = 0;
  const newlyFinished: number[] = [];
  for (const m of matches) {
    const { data: rows, error } = await db
      .from('fixtures')
      .update({
        status: m.status,
        home_score: m.score?.fullTime?.home ?? null,
        away_score: m.score?.fullTime?.away ?? null,
      })
      .eq('external_id', m.id)
      .select('id, status');
    if (error) continue;
    if (rows && rows.length) {
      updated += rows.length;
      if (m.status === 'FINISHED') newlyFinished.push(rows[0].id);
    }
  }

  // 3) (re)compute points for every finished fixture
  const { data: finished } = await db
    .from('fixtures')
    .select('id, home_score, away_score, status')
    .eq('status', 'FINISHED');

  let settled = 0;
  for (const fx of finished ?? []) {
    if (fx.home_score == null || fx.away_score == null) continue;
    const { data: preds } = await db
      .from('match_predictions')
      .select('id, home_pred, away_pred')
      .eq('fixture_id', fx.id);
    for (const p of preds ?? []) {
      const pts = scorePrediction(p.home_pred, p.away_pred, fx.home_score, fx.away_score);
      await db.from('match_predictions').update({ points: pts }).eq('id', p.id);
      settled++;
    }
  }

  return NextResponse.json({
    ok: true,
    fixtures_updated: updated,
    newly_finished: newlyFinished.length,
    predictions_settled: settled,
    ran_at: new Date().toISOString(),
  });
}
