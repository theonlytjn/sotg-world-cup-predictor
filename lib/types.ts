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
  award_points: number;
}

export interface Player {
  id: number;
  external_id: number | null;
  name: string;
  position: string | null;
  nationality: string | null;
  shirt_number: number | null;
  team_id: number | null;
}

export interface AwardCategory {
  id: number;
  slug: string;
  label: string;
  pick_kind: 'team' | 'player' | 'confederation';
  deadline: string | null;
  pts_pick_1: number;
  pts_pick_2: number;
  sort_order: number;
}

export interface AwardPrediction {
  id: number;
  user_id: string;
  category_id: number;
  pick_1: string | null;
  pick_2: string | null;
  points: number | null;
}

export interface AwardResult {
  category_id: number;
  result: string;
  set_at: string;
}
