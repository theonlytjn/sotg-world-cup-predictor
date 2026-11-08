-- SOTG predictors — migration 003: opening time + Champions League 2026/27.
-- Run in the Supabase SQL Editor after migration 002.
-- Entries are refused before opens_at (enforced in the database).

alter table public.pred_seasons add column if not exists opens_at timestamptz;

-- Champions League 2026/27: voting opens Wed 11 Nov 2026 6pm UK, locks before Matchday 5 (Tue 24 Nov, 5:30pm UK)
insert into public.pred_seasons (comp, season, title, is_current, opens_at, closes_at)
values ('ucl', '2026/27', 'Champions League 2026/27', true,
        '2026-11-11 18:00:00 Europe/London', '2026-11-24 17:30:00 Europe/London')
on conflict (comp, season) do nothing;

create or replace function public.pred_state(p_comp text, p_season text default null)
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare s pred_seasons;
begin
  s := pred_resolve(p_comp, p_season);
  if s.comp is null then raise exception 'No such competition or season'; end if;
  return jsonb_build_object(
    'comp', s.comp, 'season', s.season, 'title', s.title, 'is_current', s.is_current,
    'locked', pred_is_closed(s), 'opens_at', s.opens_at, 'closes_at', s.closes_at, 'results', s.results,
    'count', (select count(*) from pred_entries where comp = s.comp and season = s.season),
    'seasons', (select coalesce(jsonb_agg(jsonb_build_object('season', season, 'title', title, 'is_current', is_current)
                  order by created_at desc), '[]'::jsonb) from pred_seasons where comp = s.comp));
end $$;

create or replace function public.pred_submit(p_comp text, p_season text, p_name text, p_answers jsonb, p_token text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare s pred_seasons; e pred_entries; n text := btrim(p_name);
begin
  s := pred_resolve(p_comp, p_season);
  if s.comp is null or not s.is_current then raise exception 'This season is not open'; end if;
  if s.opens_at is not null and now() < s.opens_at then raise exception 'Voting has not opened yet'; end if;
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
