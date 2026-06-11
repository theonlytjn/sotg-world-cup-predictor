/**
 * Imports World Cup 2026 squads from football-data.org into the players table.
 *
 *   npm run seed:players
 *
 * Re-runnable safely (upserts on external_id). Run again whenever squads change.
 * Requires teams to already be seeded (npm run seed).
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

type FDPlayer = {
  id: number;
  name: string;
  position: string | null;
  nationality: string | null;
  shirtNumber: number | null;
};

type FDTeamWithSquad = {
  id: number;
  name: string;
  area: { parentArea?: string } | null;
  squad: FDPlayer[] | null;
};

// Map FD parentArea strings to the confederation codes used in the app
const PARENT_AREA_TO_CONF: Record<string, string> = {
  'Europe': 'UEFA',
  'South America': 'CONMEBOL',
  'North America': 'CONCACAF',
  'Central America': 'CONCACAF',
  'Caribbean': 'CONCACAF',
  'Africa': 'CAF',
  'Asia': 'AFC',
  'Oceania': 'OFC',
};

async function main() {
  console.log('Fetching World Cup squads from football-data.org ...');
  const res = await fetch('https://api.football-data.org/v4/competitions/WC/teams', {
    headers: { 'X-Auth-Token': FD_KEY },
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`football-data.org returned ${res.status}.`);
    console.error(body);
    process.exit(1);
  }

  const data = (await res.json()) as { teams: FDTeamWithSquad[] };
  const fdTeams = data.teams ?? [];
  console.log(`Got ${fdTeams.length} teams.`);

  // Map football-data external_id -> internal team id
  const { data: dbTeams, error: selErr } = await db.from('teams').select('id, external_id');
  if (selErr) throw selErr;
  const idByExternal = new Map<number, number>();
  for (const t of dbTeams ?? []) {
    if (t.external_id != null) idByExternal.set(t.external_id, t.id);
  }

  // Update confederation on teams where parentArea is available
  const confUpdates: { id: number; confederation: string }[] = [];
  for (const team of fdTeams) {
    const teamId = idByExternal.get(team.id);
    if (!teamId) continue;
    const conf = PARENT_AREA_TO_CONF[team.area?.parentArea ?? ''];
    if (conf) confUpdates.push({ id: teamId, confederation: conf });
  }
  if (confUpdates.length > 0) {
    console.log(`Updating confederation for ${confUpdates.length} teams ...`);
    for (const u of confUpdates) {
      const { error } = await db
        .from('teams')
        .update({ confederation: u.confederation })
        .eq('id', u.id);
      if (error) console.warn(`  ⚠ Could not update team ${u.id}: ${error.message}`);
    }
  } else {
    console.log('No parentArea data returned — confederation not set (free tier may not include it).');
  }

  // Build player rows
  const playerRows: {
    external_id: number;
    name: string;
    position: string | null;
    nationality: string | null;
    shirt_number: number | null;
    team_id: number;
  }[] = [];

  for (const team of fdTeams) {
    const teamId = idByExternal.get(team.id);
    if (!teamId) {
      console.warn(`  ⚠ Team ${team.name} (id ${team.id}) not found in DB — run npm run seed first`);
      continue;
    }
    for (const p of team.squad ?? []) {
      playerRows.push({
        external_id: p.id,
        name: p.name,
        position: p.position ?? null,
        nationality: p.nationality ?? null,
        shirt_number: p.shirtNumber ?? null,
        team_id: teamId,
      });
    }
  }

  if (playerRows.length === 0) {
    console.log('No players returned — squads may not be published yet on football-data.org.');
    process.exit(0);
  }

  console.log(`Upserting ${playerRows.length} players ...`);
  const { error } = await db
    .from('players')
    .upsert(playerRows, { onConflict: 'external_id' });
  if (error) throw error;

  console.log('Done. Players + confederation data seeded.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
