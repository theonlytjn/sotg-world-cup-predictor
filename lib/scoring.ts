// Single source of truth for the Phase 1 scoring rules.
//   Exact score (home & away both correct)  -> 5 points
//   Correct result only (W / D / L matches) -> 1 point
//   Wrong                                    -> 0 points
// Group games have no extra time, so the full-time score IS the 90' score.

export const EXACT_SCORE_POINTS = 5;
export const CORRECT_RESULT_POINTS = 1;

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
