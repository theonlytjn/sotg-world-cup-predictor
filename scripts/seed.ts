/**
 * One-time seed: pulls all 2026 World Cup teams + fixtures from
 * football-data.org and upserts them into Supabase.
 *
 *   npm run seed
 *
 * Re-runnable safely (upserts on external_id). Run it again any time
 * to refresh kickoff times / venues if the schedule changes.
 */
import { config } from 'dotenv'; config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const FD_KEY = process.env.FOOTBALL_DATA_KEY!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!FD_KEY || !SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing env vars. Need FOOTBALL_DATA_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

type FDTeam = { id: number; name: string; tla: string | null; crest: string | null };
type FDMatch = {
  id: number;
  utcDate: string;
  status: string;
  matchday: number | null;
  stage: string;
  group: string | null;
  homeTeam: FDTeam;
  awayTeam: FDTeam;
  score: { fullTime: { home: number | null; away: number | null } };
};

function groupLabel(g: string | null): string | null {
  if (!g) return null;
  return g.replace('GROUP_', '').trim(); // 'GROUP_A' -> 'A'
}

async function main() {
  console.log('Fetching World Cup matches from football-data.org ...');
  const res = await fetch('https://api.football-data.org/v4/competitions/WC/matches', {
    headers: { 'X-Auth-Token': FD_KEY },
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`football-data.org returned ${res.status}.`);
    console.error(body);
    console.error('\nIf this is a 403/restricted error the WC competition may not be on your free plan.');
    console.error('See README "Fallback: seeding without an API" for the openfootball route.');
    process.exit(1);
  }

  const data = (await res.json()) as { matches: FDMatch[] };
  const matches = data.matches ?? [];
  console.log(`Got ${matches.length} matches.`);

  // 1) unique teams
  const teamMap = new Map<number, { external_id: number; name: string; tla: string | null; crest: string | null; group_label: string | null }>();
  for (const m of matches) {
    for (const [team, g] of [
      [m.homeTeam, m.group],
      [m.awayTeam, m.group],
    ] as const) {
      if (!team?.id) continue;
      const existing = teamMap.get(team.id);
      teamMap.set(team.id, {
        external_id: team.id,
        name: team.name,
        tla: team.tla,
        crest: team.crest,
        group_label: groupLabel(g) ?? existing?.group_label ?? null,
      });
    }
  }
  const teamRows = [...teamMap.values()];
  console.log(`Upserting ${teamRows.length} teams ...`);
  const { error: teamErr } = await db.from('teams').upsert(teamRows, { onConflict: 'external_id' });
  if (teamErr) throw teamErr;

  // 2) build external_id -> internal id map
  const { data: dbTeams, error: selErr } = await db.from('teams').select('id, external_id');
  if (selErr) throw selErr;
  const idByExternal = new Map<number, number>();
  for (const t of dbTeams ?? []) if (t.external_id != null) idByExternal.set(t.external_id, t.id);

  // 3) fixtures
  const fixtureRows = matches
    .filter((m) => idByExternal.has(m.homeTeam?.id) && idByExternal.has(m.awayTeam?.id))
    .map((m) => ({
      external_id: m.id,
      matchday: m.matchday,
      stage: m.stage,
      group_label: groupLabel(m.group),
      kickoff: m.utcDate,
      status: m.status,
      home_score: m.score?.fullTime?.home ?? null,
      away_score: m.score?.fullTime?.away ?? null,
      home_team_id: idByExternal.get(m.homeTeam.id)!,
      away_team_id: idByExternal.get(m.awayTeam.id)!,
    }));

  console.log(`Upserting ${fixtureRows.length} fixtures ...`);
  const { error: fxErr } = await db.from('fixtures').upsert(fixtureRows, { onConflict: 'external_id' });
  if (fxErr) throw fxErr;

  console.log('Done. Teams + fixtures seeded.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
