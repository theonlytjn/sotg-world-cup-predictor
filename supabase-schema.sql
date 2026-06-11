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

--   * You can insert/update only your own rows, and only BEFORE kickoff.
drop policy if exists "predictions insert own" on public.match_predictions;
create policy "predictions insert own" on public.match_predictions
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.fixtures f
      where f.id = fixture_id and f.kickoff > now()
    )
  );

drop policy if exists "predictions update own" on public.match_predictions;
create policy "predictions update own" on public.match_predictions
  for update using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.fixtures f
      where f.id = fixture_id and f.kickoff > now()
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
