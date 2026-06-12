import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { scorePrediction, EXACT_SCORE_POINTS, CORRECT_RESULT_POINTS } from '@/lib/scoring';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type FDGoal = {
  minute: number | null;
  injuryTime: number | null;
  type: string;
  team: { id: number; name: string; tla?: string } | null;
  scorer: { id: number; name: string } | null;
  assist: { id: number; name: string } | null;
};

type FDMatch = {
  id: number;
  status: string;
  score: { fullTime: { home: number | null; away: number | null } };
  goals: FDGoal[] | null;
};

type FDStandingRow = {
  position: number;
  team: { id: number };
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
};

type FDStandingGroup = {
  stage: string;
  type: string;
  group: string | null;
  table: FDStandingRow[];
};

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
  const fdKey = process.env.FOOTBALL_DATA_KEY!;

  // 0) load live scoring rules
  const { data: rulesRows } = await db.from('scoring_rules').select('key, points');
  const rulesMap = Object.fromEntries((rulesRows ?? []).map((r) => [r.key, r.points]));
  const exactPts  = rulesMap['match_exact']  ?? EXACT_SCORE_POINTS;
  const resultPts = rulesMap['match_result'] ?? CORRECT_RESULT_POINTS;

  // 1) fetch matches, standings, and top scorers from football-data.org Tier 1
  const [matchesRes, standingsRes, scorersRes] = await Promise.all([
    fetch('https://api.football-data.org/v4/competitions/WC/matches', {
      headers: { 'X-Auth-Token': fdKey },
      cache: 'no-store',
    }),
    fetch('https://api.football-data.org/v4/competitions/WC/standings', {
      headers: { 'X-Auth-Token': fdKey },
      cache: 'no-store',
    }),
    fetch('https://api.football-data.org/v4/competitions/WC/scorers?limit=50', {
      headers: { 'X-Auth-Token': fdKey },
      cache: 'no-store',
    }),
  ]);

  if (!matchesRes.ok) {
    return NextResponse.json({ error: `football-data matches ${matchesRes.status}` }, { status: 502 });
  }

  const { matches } = (await matchesRes.json()) as { matches: FDMatch[] };

  // 2) update fixture scores, status, and goals
  let updated = 0;
  for (const m of matches) {
    const goals = (m.goals ?? []).map((g) => ({
      minute: g.minute,
      injury_time: g.injuryTime,
      type: g.type,
      team_id: g.team?.id ?? null,
      scorer: g.scorer?.name ?? null,
      assist: g.assist?.name ?? null,
    }));

    const baseUpdate = db
      .from('fixtures')
      .update({
        status: m.status,
        home_score: m.score?.fullTime?.home ?? null,
        away_score: m.score?.fullTime?.away ?? null,
        goals: goals.length > 0 ? goals : null,
      })
      .eq('external_id', m.id);

    // When football-data.org lags (still TIMED/SCHEDULED after KO), don't
    // overwrite a score the admin has already manually confirmed as FINISHED.
    const isActive = ['FINISHED', 'IN_PLAY', 'PAUSED'].includes(m.status);
    const { data: rows, error } = isActive
      ? await baseUpdate.select('id')
      : await baseUpdate.neq('status', 'FINISHED').select('id');
    if (error) continue;
    if (rows?.length) updated += rows.length;
  }

  // 3) rescore all finished predictions
  const { data: finished } = await db
    .from('fixtures')
    .select('id, home_score, away_score')
    .eq('status', 'FINISHED');

  let settled = 0;
  for (const fx of finished ?? []) {
    if (fx.home_score == null || fx.away_score == null) continue;
    const { data: preds } = await db
      .from('match_predictions')
      .select('id, home_pred, away_pred')
      .eq('fixture_id', fx.id);
    for (const p of preds ?? []) {
      const pts = scorePrediction(p.home_pred, p.away_pred, fx.home_score, fx.away_score, exactPts, resultPts);
      await db.from('match_predictions').update({ points: pts }).eq('id', p.id);
      settled++;
    }
  }

  // 4) upsert group standings from Tier 1 API
  let standingsUpserted = 0;
  if (standingsRes.ok) {
    const { standings } = (await standingsRes.json()) as { standings: FDStandingGroup[] };

    // Map football-data team external_id → internal team id
    const { data: dbTeams } = await db.from('teams').select('id, external_id');
    const idByExternal = new Map<number, number>();
    for (const t of dbTeams ?? []) {
      if (t.external_id != null) idByExternal.set(t.external_id, t.id);
    }

    const rows: {
      group_label: string;
      team_id: number;
      position: number;
      played: number;
      won: number;
      drawn: number;
      lost: number;
      goals_for: number;
      goals_against: number;
      goal_diff: number;
      points: number;
      updated_at: string;
    }[] = [];

    for (const sg of standings) {
      if (sg.type !== 'TOTAL' || !sg.group) continue;
      // "Group A" (2026 API) or "GROUP_A" (older) → "A"
      const label = sg.group
        .replace(/^GROUP_/i, '')
        .replace(/^Group\s*/i, '')
        .trim();
      for (const row of sg.table) {
        const teamId = idByExternal.get(row.team.id);
        if (!teamId) continue;
        rows.push({
          group_label:   label,
          team_id:       teamId,
          position:      row.position,
          played:        row.playedGames,
          won:           row.won,
          drawn:         row.draw,
          lost:          row.lost,
          goals_for:     row.goalsFor,
          goals_against: row.goalsAgainst,
          goal_diff:     row.goalDifference,
          points:        row.points,
          updated_at:    new Date().toISOString(),
        });
      }
    }

    if (rows.length > 0) {
      const { error } = await db
        .from('group_standings')
        .upsert(rows, { onConflict: 'group_label,team_id' });
      if (!error) standingsUpserted = rows.length;
    }
  }

  // 5) upsert top scorers from dedicated /scorers endpoint (Tier 1 accessible)
  let scorersUpserted = 0;
  if (scorersRes.ok) {
    type FDScorer = {
      player: { id: number; name: string };
      team: { id: number; tla: string; name: string; crest: string };
      playedMatches: number;
      goals: number;
      assists: number | null;
      penalties: number | null;
    };
    const { scorers } = (await scorersRes.json()) as { scorers: FDScorer[] };
    if (scorers.length > 0) {
      const scorerRows = scorers.map((s) => ({
        player_external_id: s.player.id,
        player_name:        s.player.name,
        team_external_id:   s.team.id,
        team_tla:           s.team.tla,
        team_name:          s.team.name,
        team_crest:         s.team.crest,
        goals:              s.goals ?? 0,
        assists:            s.assists ?? 0,
        penalties:          s.penalties ?? 0,
        played_matches:     s.playedMatches ?? 0,
        updated_at:         new Date().toISOString(),
      }));
      const { error } = await db
        .from('competition_scorers')
        .upsert(scorerRows, { onConflict: 'player_external_id' });
      if (!error) scorersUpserted = scorerRows.length;
    }
  }

  // 6) ESPN fallback — rescue stale fixtures (TIMED/SCHEDULED, kickoff > 2h ago)
  //    football-data.org sometimes lags flipping match status; ESPN is usually faster.
  let espnFallback = 0;
  const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const { data: stale } = await db
    .from('fixtures')
    .select('id, kickoff, home_team_id, away_team_id')
    .not('status', 'in', '("FINISHED","IN_PLAY","PAUSED")')
    .lt('kickoff', cutoff);

  if (stale && stale.length > 0) {
    const { data: allTeams } = await db.from('teams').select('id, tla, name');
    const teamById = new Map<number, { tla: string; name: string }>();
    for (const t of allTeams ?? []) teamById.set(t.id, { tla: t.tla ?? '', name: t.name ?? '' });

    type EspnComp = { homeAway: string; team: { abbreviation: string; displayName: string }; score: string };
    type EspnEvent = { competitions: [{ status: { type: { completed: boolean } }; competitors: EspnComp[] }] };

    // Group by UTC date so we fetch ESPN once per day, not once per fixture
    const byDate = new Map<string, typeof stale>();
    for (const fx of stale) {
      const d = new Date(fx.kickoff);
      const key = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
      if (!byDate.has(key)) byDate.set(key, []);
      byDate.get(key)!.push(fx);
    }

    for (const [dateStr, fxList] of byDate) {
      const espnRes = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${dateStr}`,
        { cache: 'no-store' }
      ).catch(() => null);
      if (!espnRes?.ok) continue;

      const body = await espnRes.json().catch(() => null);
      const events: EspnEvent[] = body?.events ?? [];
      if (events.length === 0) continue;

      for (const fx of fxList) {
        const homeTeam = teamById.get(fx.home_team_id);
        const awayTeam = teamById.get(fx.away_team_id);
        if (!homeTeam || !awayTeam) continue;

        const event = events.find((ev) => {
          const comp = ev.competitions?.[0];
          if (!comp?.status?.type?.completed) return false;
          const h = comp.competitors.find((c) => c.homeAway === 'home');
          const a = comp.competitors.find((c) => c.homeAway === 'away');
          if (!h || !a) return false;
          const tlaMatch =
            h.team.abbreviation.toUpperCase() === homeTeam.tla.toUpperCase() &&
            a.team.abbreviation.toUpperCase() === awayTeam.tla.toUpperCase();
          const nameMatch =
            h.team.displayName.toLowerCase().includes(homeTeam.name.toLowerCase().split(' ')[0]) &&
            a.team.displayName.toLowerCase().includes(awayTeam.name.toLowerCase().split(' ')[0]);
          return tlaMatch || nameMatch;
        });

        if (!event) continue;

        const comp = event.competitions[0];
        const h = comp.competitors.find((c) => c.homeAway === 'home')!;
        const a = comp.competitors.find((c) => c.homeAway === 'away')!;
        const homeScore = parseInt(h.score, 10);
        const awayScore = parseInt(a.score, 10);
        if (isNaN(homeScore) || isNaN(awayScore)) continue;

        const { data: rows } = await db
          .from('fixtures')
          .update({ status: 'FINISHED', home_score: homeScore, away_score: awayScore })
          .eq('id', fx.id)
          .select('id');
        if (rows?.length) espnFallback++;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    fixtures_updated: updated,
    predictions_settled: settled,
    standings_upserted: standingsUpserted,
    scorers_upserted: scorersUpserted,
    espn_fallback: espnFallback,
    ran_at: new Date().toISOString(),
  });
}
