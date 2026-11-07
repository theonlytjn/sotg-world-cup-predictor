-- SOTG season/tournament predictors (/pl, later /ucl, ...) — run in the Supabase SQL Editor.
-- One set of tables for every competition and season. A yearly reset = start a new season
-- (admin page → "Start new season"); old seasons stay as read-only archives.
-- Set the admin PIN separately (never commit it):
--   update public.pred_admin set pin_hash = extensions.crypt('YOUR_PIN', extensions.gen_salt('bf')) where id = 1;

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.pred_admin (
  id int primary key default 1 check (id = 1),
  pin_hash text
);
insert into public.pred_admin (id) values (1) on conflict do nothing;

create table if not exists public.pred_seasons (
  comp text not null check (comp ~ '^[a-z0-9-]{1,20}$'),       -- e.g. 'pl', 'ucl'
  season text not null check (char_length(season) between 1 and 20), -- e.g. '2026/27'
  title text not null,
  is_current boolean not null default false,
  locked boolean not null default false,
  results jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (comp, season)
);
create unique index if not exists pred_seasons_one_current on public.pred_seasons (comp) where is_current;

create table if not exists public.pred_entries (
  id uuid primary key default gen_random_uuid(),
  comp text not null,
  season text not null,
  name text not null check (char_length(name) between 1 and 40),
  answers jsonb not null default '{}'::jsonb,
  token_hash text not null,
  created_at timestamptz not null default now(),
  foreign key (comp, season) references public.pred_seasons (comp, season) on delete cascade
);
create unique index if not exists pred_entries_name_key on public.pred_entries (comp, season, lower(name));

alter table public.pred_admin enable row level security;
alter table public.pred_seasons enable row level security;
alter table public.pred_entries enable row level security;
-- No policies: browsers can only go through the security-definer functions below.
revoke all on public.pred_admin, public.pred_seasons, public.pred_entries from anon, authenticated;

insert into public.pred_seasons (comp, season, title, is_current)
values ('pl', '2026/27', 'Premier League 2026/27', true)
on conflict do nothing;

-- Resolve a season: the one asked for, or the competition's current season
create or replace function public.pred_resolve(p_comp text, p_season text)
returns public.pred_seasons language sql security definer set search_path = public stable as $$
  select * from pred_seasons
  where comp = p_comp and (season = p_season or (p_season is null and is_current))
  limit 1;
$$;

create or replace function public.pred_admin_ok(p_pin text)
returns boolean language sql security definer set search_path = public, extensions stable as $$
  select coalesce((select pin_hash = crypt(p_pin, pin_hash) from pred_admin where id = 1), false);
$$;

-- Public: season state + list of seasons for the competition (for archives)
create or replace function public.pred_state(p_comp text, p_season text default null)
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare s pred_seasons;
begin
  s := pred_resolve(p_comp, p_season);
  if s.comp is null then raise exception 'No such competition or season'; end if;
  return jsonb_build_object(
    'comp', s.comp, 'season', s.season, 'title', s.title, 'is_current', s.is_current,
    'locked', s.locked, 'results', s.results,
    'count', (select count(*) from pred_entries where comp = s.comp and season = s.season),
    'seasons', (select coalesce(jsonb_agg(jsonb_build_object('season', season, 'title', title, 'is_current', is_current)
                  order by created_at desc), '[]'::jsonb) from pred_seasons where comp = s.comp));
end $$;

-- Public: entries. Picks are only revealed to someone who has locked in their own entry,
-- or to everyone once the season is closed (and always for past seasons).
create or replace function public.pred_entries_list(p_comp text, p_season text default null, p_name text default null, p_token text default null)
returns jsonb language plpgsql security definer set search_path = public, extensions stable as $$
declare s pred_seasons; can_see boolean;
begin
  s := pred_resolve(p_comp, p_season);
  if s.comp is null then raise exception 'No such competition or season'; end if;
  can_see := s.locked or not s.is_current or exists (
    select 1 from pred_entries where comp = s.comp and season = s.season
      and p_name is not null and p_token is not null
      and lower(name) = lower(btrim(p_name)) and token_hash = crypt(p_token, token_hash));
  return (select coalesce(jsonb_agg(jsonb_build_object(
      'id', e.id, 'name', e.name, 'created_at', e.created_at,
      'answers', case when can_see then e.answers else null end
    ) order by e.created_at), '[]'::jsonb)
    from pred_entries e where e.comp = s.comp and e.season = s.season);
end $$;

-- Public: submit an entry. Final — no edits once submitted.
create or replace function public.pred_submit(p_comp text, p_season text, p_name text, p_answers jsonb, p_token text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare s pred_seasons; e pred_entries; n text := btrim(p_name);
begin
  s := pred_resolve(p_comp, p_season);
  if s.comp is null or not s.is_current then raise exception 'This season is not open'; end if;
  if s.locked then raise exception 'Predictions are closed'; end if;
  if n is null or char_length(n) < 1 or char_length(n) > 40 then raise exception 'Name must be 1-40 characters'; end if;
  if p_token is null or char_length(p_token) < 16 then raise exception 'Invalid token'; end if;
  if jsonb_typeof(p_answers) <> 'object' or pg_column_size(p_answers) > 20000 then raise exception 'Invalid answers'; end if;
  if exists (select 1 from pred_entries where comp = s.comp and season = s.season and lower(name) = lower(n)) then
    raise exception 'That name has already locked in. Pick another (or add your surname).';
  end if;
  insert into pred_entries (comp, season, name, answers, token_hash)
  values (s.comp, s.season, n, p_answers, crypt(p_token, gen_salt('bf'))) returning * into e;
  return jsonb_build_object('id', e.id, 'season', s.season);
end $$;

-- Admin (PIN protected)
create or replace function public.pred_admin_get(p_pin text, p_comp text, p_season text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s pred_seasons;
begin
  if not pred_admin_ok(p_pin) then raise exception 'Wrong PIN'; end if;
  s := pred_resolve(p_comp, p_season);
  if s.comp is null then raise exception 'No such competition or season'; end if;
  return jsonb_build_object(
    'settings', jsonb_build_object('comp', s.comp, 'season', s.season, 'title', s.title, 'is_current', s.is_current,
                                   'locked', s.locked, 'results', s.results),
    'entries', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'answers', answers,
                  'created_at', created_at, 'updated_at', created_at) order by created_at), '[]'::jsonb)
                from pred_entries where comp = s.comp and season = s.season));
end $$;

create or replace function public.pred_admin_set_lock(p_pin text, p_comp text, p_season text, p_locked boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not pred_admin_ok(p_pin) then raise exception 'Wrong PIN'; end if;
  update pred_seasons set locked = p_locked, updated_at = now() where comp = p_comp and season = p_season;
end $$;

create or replace function public.pred_admin_set_results(p_pin text, p_comp text, p_season text, p_results jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not pred_admin_ok(p_pin) then raise exception 'Wrong PIN'; end if;
  if jsonb_typeof(p_results) <> 'object' then raise exception 'Invalid results'; end if;
  update pred_seasons set results = p_results, updated_at = now() where comp = p_comp and season = p_season;
end $$;

create or replace function public.pred_admin_delete_entry(p_pin text, p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not pred_admin_ok(p_pin) then raise exception 'Wrong PIN'; end if;
  delete from pred_entries where id = p_id;
end $$;

create or replace function public.pred_admin_rename_entry(p_pin text, p_id uuid, p_name text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not pred_admin_ok(p_pin) then raise exception 'Wrong PIN'; end if;
  update pred_entries set name = btrim(p_name) where id = p_id;
end $$;

-- Yearly reset: open a new season for a competition. The old one becomes a read-only archive.
create or replace function public.pred_admin_new_season(p_pin text, p_comp text, p_season text, p_title text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not pred_admin_ok(p_pin) then raise exception 'Wrong PIN'; end if;
  if exists (select 1 from pred_seasons where comp = p_comp and season = p_season) then
    raise exception 'That season already exists';
  end if;
  update pred_seasons set is_current = false, locked = true, updated_at = now() where comp = p_comp and is_current;
  insert into pred_seasons (comp, season, title, is_current) values (p_comp, btrim(p_season), btrim(p_title), true);
end $$;

revoke execute on function public.pred_admin_ok(text), public.pred_resolve(text, text) from public, anon, authenticated;
grant execute on function
  public.pred_state(text, text), public.pred_entries_list(text, text, text, text),
  public.pred_submit(text, text, text, jsonb, text), public.pred_admin_get(text, text, text),
  public.pred_admin_set_lock(text, text, text, boolean), public.pred_admin_set_results(text, text, text, jsonb),
  public.pred_admin_delete_entry(text, uuid), public.pred_admin_rename_entry(text, uuid, text),
  public.pred_admin_new_season(text, text, text, text)
to anon, authenticated;
