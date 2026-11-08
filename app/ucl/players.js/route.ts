// Champions League squads for the /ucl predictor's player pickers.
// Pulled from football-data.org (same FOOTBALL_DATA_KEY as the World Cup game), cached for a day.
// If the feed is unavailable the predictor falls back to typed player names.
export const revalidate = 86400;

type FdPlayer = { name?: string; position?: string | null; dateOfBirth?: string | null };
type FdTeam = { name?: string; shortName?: string; squad?: FdPlayer[] };

function pos(p: string | null | undefined): 'GK' | 'DEF' | 'MID' | 'FWD' {
  const s = (p ?? '').toLowerCase();
  if (s.includes('keeper')) return 'GK';
  if (s.includes('defen') || s.includes('back')) return 'DEF';
  if (s.includes('offen') || s.includes('forward') || s.includes('wing') || s.includes('striker') || s.includes('attack')) return 'FWD';
  return 'MID';
}

export async function GET() {
  let players: [string, string, string, string, string][] = [];
  let note = 'ok';
  try {
    const key = process.env.FOOTBALL_DATA_KEY;
    if (!key) throw new Error('FOOTBALL_DATA_KEY not set');
    const res = await fetch('https://api.football-data.org/v4/competitions/CL/teams', {
      headers: { 'X-Auth-Token': key },
      next: { revalidate: 86400 },
    });
    if (!res.ok) throw new Error(`football-data ${res.status}`);
    const json = (await res.json()) as { teams?: FdTeam[] };
    for (const t of json.teams ?? []) {
      const team = t.shortName || t.name || '';
      for (const p of t.squad ?? []) {
        if (!p.name) continue;
        players.push([p.name, p.name, team, pos(p.position), (p.dateOfBirth ?? '').slice(0, 10)]);
      }
    }
    players.sort((a, b) => a[2].localeCompare(b[2]) || a[3].localeCompare(b[3]) || a[0].localeCompare(b[0]));
  } catch (e) {
    players = [];
    note = e instanceof Error ? e.message : 'error';
  }
  const body = `/* squads: ${note}, ${players.length} players */\n` +
    `window.PL_DATA = window.PL_DATA || {}; window.PL_DATA.players = ${JSON.stringify(players)};\n`;
  return new Response(body, {
    headers: { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
}
