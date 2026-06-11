-- ============================================================
--  SOTG World Cup 2026 Predictor — Phase 1 schema
--  Paste this whole file into Supabase -> SQL Editor -> Run
-- ============================================================

-- ---------- PROFILES ----------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  username     text unique,
  display_name text not null,
  created_at   timestamptz not null default now()
);

-- Auto-create a profile row whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, split_part(new.email, '@', 1))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- TEAMS ----------
create table if not exists public.teams (
  id          serial primary key,
  external_id integer unique,          -- football-data.org team id
  name        text not null,
  tla         text,                    -- 3-letter code e.g. ENG
  crest       text,                    -- flag/crest url
  group_label text                     -- 'A' .. 'L'
);

-- ---------- FIXTURES ----------
create table if not exists public.fixtures (
  id           serial primary key,
  external_id  integer unique,         -- football-data.org match id
  matchday     integer,
  stage        text not null default 'GROUP_STAGE',
  group_label  text,
  kickoff      timestamptz not null,
  status       text not null default 'SCHEDULED',
  home_score   integer,
  away_score   integer,
  home_team_id integer not null references public.teams (id),
  away_team_id integer not null references public.teams (id)
);

create index if not exists fixtures_kickoff_idx on public.fixtures (kickoff);
create index if not exists fixtures_matchday_idx on public.fixtures (matchday);

-- ---------- MATCH PREDICTIONS ----------
create table if not exists public.match_predictions (
  id         serial primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  fixture_id integer not null references public.fixtures (id) on delete cascade,
  home_pred  integer not null check (home_pred >= 0 and home_pred <= 30),
  away_pred  integer not null check (away_pred >= 0 and away_pred <= 30),
  points     integer,                  -- null until the fixture is settled
  updated_at timestamptz not null default now(),
  unique (user_id, fixture_id)
);

create index if not exists mp_fixture_idx on public.match_predictions (fixture_id);

-- ============================================================
--  ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles          enable row level security;
alter table public.teams             enable row level security;
alter table public.fixtures          enable row level security;
alter table public.match_predictions enable row level security;

-- Profiles: everyone can read (needed for names on the leaderboard),
-- you can only edit your own.
drop policy if exists "profiles read all" on public.profiles;
create policy "profiles read all" on public.profiles
  for select using (true);

drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Teams + fixtures: world-readable, written only by service role (seed/cron,
-- which bypass RLS). No public write policies on purpose.
drop policy if exists "teams read all" on public.teams;
create policy "teams read all" on public.teams for select using (true);

drop policy if exists "fixtures read all" on public.fixtures;
create policy "fixtures read all" on public.fixtures for select using (true);

-- Predictions:
--   * You can always read your own.
--   * You can read OTHERS' only after that fixture has kicked off
--     (stops people copying picks before lock).
drop policy if exists "predictions read" on public.match_predictions;
create policy "predictions read" on public.match_predictions
  for select using (
    auth.uid() = user_id
    or exists (
      select 1 from public.fixtures f
      where f.id = fixture_id and f.kickoff <= now()
    )
  );

--   * You can insert/update only your own rows, and only >15 min before kickoff.
drop policy if exists "predictions insert own" on public.match_predictions;
create policy "predictions insert own" on public.match_predictions
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.fixtures f
      where f.id = fixture_id
        and f.kickoff > now() + interval '15 minutes'
    )
  );

drop policy if exists "predictions update own" on public.match_predictions;
create policy "predictions update own" on public.match_predictions
  for update using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.fixtures f
      where f.id = fixture_id
        and f.kickoff > now() + interval '15 minutes'
    )
  );

-- ============================================================
--  LEADERBOARD VIEW  (updated Phase 2 — includes award_points)
--  Defined WITHOUT security_invoker so it aggregates every user's
--  totals regardless of the prediction read policy above. It only
--  ever exposes sums + names, never individual unplayed picks.
-- ============================================================
drop view if exists public.leaderboard;
create view public.leaderboard as
select
  pr.id                                                                   as user_id,
  pr.display_name,
  pr.username,
  (coalesce(m.total, 0) + coalesce(a.total, 0))::int                     as total_points,
  coalesce(m.exact_scores, 0)::int                                        as exact_scores,
  coalesce(m.correct_results, 0)::int                                     as correct_results,
  coalesce(m.settled, 0)::int                                             as settled_predictions,
  coalesce(a.total, 0)::int                                               as award_points
from public.profiles pr
left join (
  select
    user_id,
    sum(points)                                  as total,
    count(*) filter (where points = 5)           as exact_scores,
    count(*) filter (where points = 1)           as correct_results,
    count(id) filter (where points is not null)  as settled
  from public.match_predictions
  group by user_id
) m on m.user_id = pr.id
left join (
  select user_id, sum(points) as total
  from public.award_predictions
  group by user_id
) a on a.user_id = pr.id;

grant select on public.leaderboard to anon, authenticated;

-- ============================================================
--  Phase 2 Slice 1: Awards
-- ============================================================

-- ---------- AWARD CATEGORIES ----------
create table if not exists public.award_categories (
  id          serial primary key,
  slug        text unique not null,
  label       text not null,
  pick_kind   text not null check (pick_kind in ('team', 'player', 'confederation')),
  deadline    timestamptz,
  pts_pick_1  integer not null,
  pts_pick_2  integer not null,
  sort_order  integer not null default 0
);

insert into public.award_categories (slug, label, pick_kind, pts_pick_1, pts_pick_2, sort_order)
values
  ('winner',                 'Tournament Winner',     'team',            35, 30, 1),
  ('runners_up',             'Runners-up',            'team',            25, 20, 2),
  ('player_of_tournament',   'Player of Tournament',  'player',          18, 15, 3),
  ('top_scorer',             'Top Scorer',            'player',          13, 10, 4),
  ('confederation_furthest', 'Best Confederation',    'confederation',    5,  3, 5)
on conflict (slug) do nothing;

-- ---------- AWARD PREDICTIONS ----------
create table if not exists public.award_predictions (
  id           serial primary key,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  category_id  integer not null references public.award_categories (id),
  pick_1       text,
  pick_2       text,
  points       integer,
  updated_at   timestamptz not null default now(),
  unique (user_id, category_id)
);

create index if not exists ap_user_idx     on public.award_predictions (user_id);
create index if not exists ap_category_idx on public.award_predictions (category_id);

-- ---------- AWARD RESULTS ----------
create table if not exists public.award_results (
  category_id  integer primary key references public.award_categories (id),
  result       text not null,
  set_at       timestamptz not null default now()
);

-- RLS
alter table public.award_categories  enable row level security;
alter table public.award_predictions enable row level security;
alter table public.award_results     enable row level security;

drop policy if exists "award categories read all" on public.award_categories;
create policy "award categories read all" on public.award_categories
  for select using (true);

drop policy if exists "award results read all" on public.award_results;
create policy "award results read all" on public.award_results
  for select using (true);

drop policy if exists "award predictions read" on public.award_predictions;
create policy "award predictions read" on public.award_predictions
  for select using (
    auth.uid() = user_id
    or exists (
      select 1 from public.award_categories ac
      where ac.id = category_id
        and ac.deadline is not null
        and ac.deadline <= now()
    )
  );

drop policy if exists "award predictions insert own" on public.award_predictions;
create policy "award predictions insert own" on public.award_predictions
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.award_categories ac
      where ac.id = category_id
        and (ac.deadline is null or ac.deadline > now())
    )
  );

drop policy if exists "award predictions update own" on public.award_predictions;
create policy "award predictions update own" on public.award_predictions
  for update using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.award_categories ac
      where ac.id = category_id
        and (ac.deadline is null or ac.deadline > now())
    )
  );

-- ============================================================
--  Phase 2 Slice 2: Players
--  Populated by: npm run seed:players
-- ============================================================

create table if not exists public.players (
  id           serial primary key,
  external_id  integer unique,          -- football-data.org player id
  name         text not null,
  position     text,                    -- Goalkeeper | Defence | Midfield | Offence
  nationality  text,
  shirt_number integer,
  team_id      integer references public.teams (id)
);

create index if not exists players_team_idx on public.players (team_id);

alter table public.players enable row level security;

drop policy if exists "players read all" on public.players;
create policy "players read all" on public.players
  for select using (true);

-- ============================================================
--  Phase 2 Slice 3: SOTG Specials + SOTG Xtra
-- ============================================================

-- Extend teams with confederation (set by npm run seed:players)
alter table public.teams
  add column if not exists confederation text;

-- Extend award_categories with section grouping and optional filter metadata
alter table public.award_categories
  add column if not exists section text not null default 'main',
  add column if not exists meta    jsonb;

-- SOTG Specials
insert into public.award_categories
  (slug, label, pick_kind, pts_pick_1, pts_pick_2, sort_order, section)
values
  ('team_of_tournament', 'Team of the Tournament', 'team',   10, 7, 6, 'specials'),
  ('top_assists',        'Top Assists',             'player', 10, 7, 7, 'specials')
on conflict (slug) do nothing;

-- SOTG Xtra — best nation per confederation
insert into public.award_categories
  (slug, label, pick_kind, pts_pick_1, pts_pick_2, sort_order, section, meta)
values
  ('best_african_nation',        'Best African Nation',        'team', 8, 5, 8,  'xtra', '{"confederation":"CAF"}'),
  ('best_asian_nation',          'Best Asian Nation',          'team', 8, 5, 9,  'xtra', '{"confederation":"AFC"}'),
  ('best_south_american_nation', 'Best South American Nation', 'team', 8, 5, 10, 'xtra', '{"confederation":"CONMEBOL"}'),
  ('best_north_american_nation', 'Best North American Nation', 'team', 8, 5, 11, 'xtra', '{"confederation":"CONCACAF"}'),
  ('best_european_nation',       'Best European Nation',       'team', 8, 5, 12, 'xtra', '{"confederation":"UEFA"}')
on conflict (slug) do nothing;

-- ============================================================
--  Phase 2 Slice 5: Post-tournament Opinion Poll
-- ============================================================

create table if not exists public.poll_questions (
  id         serial primary key,
  slug       text unique not null,
  label      text not null,
  pick_kind  text not null check (pick_kind in ('team', 'player')),
  opens_at   timestamptz,             -- null = locked; past = open
  sort_order integer not null default 0
);

insert into public.poll_questions (slug, label, pick_kind, sort_order)
values
  ('best_team',    'Best Team of the Tournament', 'team',   1),
  ('worst_team',   'Most Disappointing Team',      'team',   2),
  ('best_player',  'Player of the Tournament',     'player', 3),
  ('worst_player', 'Biggest Flop',                 'player', 4)
on conflict (slug) do nothing;

create table if not exists public.poll_responses (
  id          serial primary key,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  question_id integer not null references public.poll_questions (id),
  pick        text not null,
  updated_at  timestamptz not null default now(),
  unique (user_id, question_id)
);

create index if not exists pr_question_idx on public.poll_responses (question_id);

alter table public.poll_questions  enable row level security;
alter table public.poll_responses  enable row level security;

drop policy if exists "poll questions read all" on public.poll_questions;
create policy "poll questions read all" on public.poll_questions
  for select using (true);

drop policy if exists "poll responses read" on public.poll_responses;
create policy "poll responses read" on public.poll_responses
  for select using (
    auth.uid() = user_id
    or exists (
      select 1 from public.poll_questions pq
      where pq.id = question_id
        and pq.opens_at is not null
        and pq.opens_at <= now()
    )
  );

drop policy if exists "poll responses insert own" on public.poll_responses;
create policy "poll responses insert own" on public.poll_responses
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.poll_questions pq
      where pq.id = question_id
        and pq.opens_at is not null
        and pq.opens_at <= now()
    )
  );

drop policy if exists "poll responses update own" on public.poll_responses;
create policy "poll responses update own" on public.poll_responses
  for update using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.poll_questions pq
      where pq.id = question_id
        and pq.opens_at is not null
        and pq.opens_at <= now()
    )
  );

-- ============================================================
--  Phase 3 Step 2: Admin function + forced nicknames
-- ============================================================

-- nickname_set flag — false until user completes onboarding screen
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nickname_set boolean NOT NULL DEFAULT false;

-- nicknames must be unique on the leaderboard
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_display_name_unique;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_display_name_unique UNIQUE (display_name);

-- is_admin() — returns true for the single admin email; use in RLS policies
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(auth.jwt() ->> 'email', '') = 'tony@theonlytjn.com'
$$;

-- ============================================================
--  Phase 3 Step 3: Database-driven scoring rules
-- ============================================================

create table if not exists public.scoring_rules (
  key         text primary key,
  label       text not null,
  description text not null,
  points      integer not null
);

insert into public.scoring_rules (key, label, description, points) values
  ('match_exact',  'Exact score',    'Home and away goals both correct — the full scoreline must match.', 5),
  ('match_result', 'Correct result', 'Win / draw / loss correct but the scoreline is wrong.', 1)
on conflict (key) do nothing;

alter table public.scoring_rules enable row level security;

drop policy if exists "scoring rules read all" on public.scoring_rules;
create policy "scoring rules read all" on public.scoring_rules
  for select using (true);

-- ============================================================
--  FIXTURES — Tier 1 extras
-- ============================================================
alter table public.fixtures add column if not exists goals jsonb;

-- ============================================================
--  GROUP STANDINGS  (populated by /api/cron/results each run)
-- ============================================================
create table if not exists public.group_standings (
  group_label   text    not null,
  team_id       integer not null references public.teams(id),
  position      integer not null,
  played        integer not null default 0,
  won           integer not null default 0,
  drawn         integer not null default 0,
  lost          integer not null default 0,
  goals_for     integer not null default 0,
  goals_against integer not null default 0,
  goal_diff     integer not null default 0,
  points        integer not null default 0,
  updated_at    timestamptz not null default now(),
  primary key (group_label, team_id)
);

alter table public.group_standings enable row level security;

drop policy if exists "group standings read" on public.group_standings;
create policy "group standings read" on public.group_standings
  for select using (true);
