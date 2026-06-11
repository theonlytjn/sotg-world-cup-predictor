// Single source of truth for the Phase 1 scoring rules.
//   Exact score (home & away both correct)  -> 5 points
//   Correct result only (W / D / L matches) -> 1 point
//   Wrong                                    -> 0 points
// Group games have no extra time, so the full-time score IS the 90' score.

export const EXACT_SCORE_POINTS = 5;
export const CORRECT_RESULT_POINTS = 1;

// Award point splits: [pts if pick_1 correct, pts if pick_2 correct]
export const AWARD_POINTS: Record<string, [number, number]> = {
  winner:                 [35, 30],
  runners_up:             [25, 20],
  player_of_tournament:   [18, 15],
  top_scorer:             [13, 10],
  confederation_furthest: [5,  3],
};

export function scoreAwardPrediction(
  pick1: string | null,
  pick2: string | null,
  result: string,
  pts1: number,
  pts2: number,
): number {
  if (pick1 === result) return pts1;
  if (pick2 === result) return pts2;
  return 0;
}

function outcome(home: number, away: number): 'H' | 'D' | 'A' {
  if (home > away) return 'H';
  if (home < away) return 'A';
  return 'D';
}

export function scorePrediction(
  predHome: number,
  predAway: number,
  actualHome: number,
  actualAway: number
): number {
  if (predHome === actualHome && predAway === actualAway) {
    return EXACT_SCORE_POINTS;
  }
  if (outcome(predHome, predAway) === outcome(actualHome, actualAway)) {
    return CORRECT_RESULT_POINTS;
  }
  return 0;
}
