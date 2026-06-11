export type FixtureStatus =
  | 'SCHEDULED'
  | 'TIMED'
  | 'IN_PLAY'
  | 'PAUSED'
  | 'FINISHED'
  | 'SUSPENDED'
  | 'POSTPONED'
  | 'CANCELLED';

export interface Team {
  id: number;
  external_id: number | null;
  name: string;
  tla: string | null;
  crest: string | null;
  group_label: string | null;
}

export interface Fixture {
  id: number;
  external_id: number | null;
  matchday: number | null;
  stage: string;
  group_label: string | null;
  kickoff: string; // ISO timestamp
  status: FixtureStatus;
  home_score: number | null;
  away_score: number | null;
  home_team_id: number;
  away_team_id: number;
  // joined
  home_team?: Team;
  away_team?: Team;
}

export interface MatchPrediction {
  id: number;
  user_id: string;
  fixture_id: number;
  home_pred: number;
  away_pred: number;
  points: number | null;
}

export interface LeaderboardRow {
  user_id: string;
  display_name: string;
  username: string | null;
  total_points: number;
  exact_scores: number;
  correct_results: number;
  settled_predictions: number;
}
