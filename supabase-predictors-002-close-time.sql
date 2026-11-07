-- SOTG predictors — migration 002: scheduled close time.
-- Run in the Supabase SQL Editor after supabase-predictors-schema.sql.
-- A season counts as closed once it is manually locked OR its closes_at time has passed.
-- Enforced in the database (submit is refused and picks are revealed once closed).

alter table public.pred_seasons add column if not exists closes_at timestamptz;

-- Premier League 2026/27 closes Wednesday 11 November 2026, 6pm UK time
update public.pred_seasons set closes_at = '2026-11-11 18:00:00 Europe/London'
where comp = 'pl' and season = '2026/27' and closes_at is null;

create or replace function public.pred_is_closed(s public.pred_seasons)
returns boolean language sql stable set search_path = public as $$
  select s.locked or (s.closes_at is not null and now() >= s.closes_at);
$$;

create or replace function public.pred_state(p_comp text, p_season text default null)
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare s pred_seasons;
begin
  s := pred_resolve(p_comp, p_season);
  if s.comp is null then raise exception 'No such competition or season'; end if;
  return jsonb_build_object(
    'comp', s.comp, 'season', s.season, 'title', s.title, 'is_current', s.is_current,
    'locked', pred_is_closed(s), 'closes_at', s.closes_at, 'results', s.results,
    'count', (select count(*) from pred_entries where comp = s.comp and season = s.season),
    'seasons', (select coalesce(jsonb_agg(jsonb_build_object('season', season, 'title', title, 'is_current', is_current)
                  order by created_at desc), '[]'::jsonb) from pred_seasons where comp = s.comp));
end $$;

create or replace function public.pred_entries_list(p_comp text, p_season text default null, p_name text default null, p_token text default null)
returns jsonb language plpgsql security definer set search_path = public, extensions stable as $$
declare s pred_seasons; can_see boolean;
begin
  s := pred_resolve(p_comp, p_season);
  if s.comp is null then raise exception 'No such competition or season'; end if;
  can_see := pred_is_closed(s) or not s.is_current or exists (
    select 1 from pred_entries where comp = s.comp and season = s.season
      and p_name is not null and p_token is not null
      and lower(name) = lower(btrim(p_name)) and token_hash = crypt(p_token, token_hash));
  return (select coalesce(jsonb_agg(jsonb_build_object(
      'id', e.id, 'name', e.name, 'created_at', e.created_at,
      'answers', case when can_see then e.answers else null end
    ) order by e.created_at), '[]'::jsonb)
    from pred_entries e where e.comp = s.comp and e.season = s.season);
end $$;

create or replace function public.pred_submit(p_comp text, p_season text, p_name text, p_answers jsonb, p_token text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare s pred_seasons; e pred_entries; n text := btrim(p_name);
begin
  s := pred_resolve(p_comp, p_season);
  if s.comp is null or not s.is_current then raise exception 'This season is not open'; end if;
  if pred_is_closed(s) then raise exception 'Predictions are closed'; end if;
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

create or replace function public.pred_admin_get(p_pin text, p_comp text, p_season text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s pred_seasons;
begin
  if not pred_admin_ok(p_pin) then raise exception 'Wrong PIN'; end if;
  s := pred_resolve(p_comp, p_season);
  if s.comp is null then raise exception 'No such competition or season'; end if;
  return jsonb_build_object(
    'settings', jsonb_build_object('comp', s.comp, 'season', s.season, 'title', s.title, 'is_current', s.is_current,
                                   'locked', pred_is_closed(s), 'closes_at', s.closes_at, 'results', s.results),
    'entries', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'answers', answers,
                  'created_at', created_at, 'updated_at', created_at) order by created_at), '[]'::jsonb)
                from pred_entries where comp = s.comp and season = s.season));
end $$;

-- Close now / re-open. Re-opening also clears a close time that has already passed.
create or replace function public.pred_admin_set_lock(p_pin text, p_comp text, p_season text, p_locked boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not pred_admin_ok(p_pin) then raise exception 'Wrong PIN'; end if;
  update pred_seasons set locked = p_locked,
    closes_at = case when not p_locked and closes_at <= now() then null else closes_at end,
    updated_at = now()
  where comp = p_comp and season = p_season;
end $$;

-- Set or clear the scheduled close time
create or replace function public.pred_admin_set_close(p_pin text, p_comp text, p_season text, p_closes_at timestamptz)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not pred_admin_ok(p_pin) then raise exception 'Wrong PIN'; end if;
  update pred_seasons set closes_at = p_closes_at, updated_at = now() where comp = p_comp and season = p_season;
end $$;

revoke execute on function public.pred_is_closed(public.pred_seasons) from public, anon, authenticated;
grant execute on function public.pred_admin_set_close(text, text, text, timestamptz) to anon, authenticated;
