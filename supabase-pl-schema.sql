-- SOTG Premier League Predictor 2026/27 — pl_* tables and RPC functions (run in Supabase SQL Editor).
-- Set the admin PIN separately (never commit it):
--   update public.pl_settings set admin_pin_hash = extensions.crypt('YOUR_PIN', extensions.gen_salt('bf')) where id = 1;

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.pl_settings (
  id int primary key default 1 check (id = 1),
  season text not null default '2026/27',
  locked boolean not null default false,
  admin_pin_hash text,
  results jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
insert into public.pl_settings (id) values (1) on conflict do nothing;

create table if not exists public.pl_entries (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  answers jsonb not null default '{}'::jsonb,
  edit_token_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists pl_entries_name_key on public.pl_entries (lower(name));

alter table public.pl_settings enable row level security;
alter table public.pl_entries enable row level security;
revoke all on public.pl_settings from anon, authenticated;
revoke all on public.pl_entries from anon, authenticated;

create or replace function public.pl_state()
returns jsonb language sql security definer set search_path = public stable as $$
  select jsonb_build_object(
    'season', s.season, 'locked', s.locked,
    'results', s.results,
    'count', (select count(*) from pl_entries)
  ) from pl_settings s where id = 1;
$$;

-- Picks are only revealed to people who have locked in their own entry (or to everyone once closed)
drop function if exists public.pl_entries_list();
create or replace function public.pl_entries_list(p_name text default null, p_token text default null)
returns jsonb language plpgsql security definer set search_path = public, extensions stable as $$
declare s pl_settings; can_see boolean;
begin
  select * into s from pl_settings where id = 1;
  can_see := s.locked or exists (
    select 1 from pl_entries where p_name is not null and p_token is not null
      and lower(name) = lower(btrim(p_name)) and edit_token_hash = crypt(p_token, edit_token_hash));
  return (select coalesce(jsonb_agg(jsonb_build_object(
      'id', e.id, 'name', e.name, 'created_at', e.created_at, 'updated_at', e.updated_at,
      'answers', case when can_see then e.answers else null end
    ) order by e.created_at), '[]'::jsonb) from pl_entries e);
end $$;

create or replace function public.pl_submit(p_name text, p_answers jsonb, p_token text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare s pl_settings; e pl_entries; n text := btrim(p_name);
begin
  select * into s from pl_settings where id = 1;
  if s.locked then raise exception 'Predictions are locked'; end if;
  if n is null or char_length(n) < 1 or char_length(n) > 40 then raise exception 'Name must be 1-40 characters'; end if;
  if p_token is null or char_length(p_token) < 16 then raise exception 'Invalid token'; end if;
  if jsonb_typeof(p_answers) <> 'object' or pg_column_size(p_answers) > 20000 then raise exception 'Invalid answers'; end if;
  -- Entries are final: no edits once submitted
  if exists (select 1 from pl_entries where lower(name) = lower(n)) then
    raise exception 'That name has already locked in. Pick another (or add your surname).';
  end if;
  insert into pl_entries (name, answers, edit_token_hash)
  values (n, p_answers, crypt(p_token, gen_salt('bf'))) returning * into e;
  return jsonb_build_object('id', e.id);
end $$;

create or replace function public.pl_my_entry(p_name text, p_token text)
returns jsonb language sql security definer set search_path = public, extensions stable as $$
  select jsonb_build_object('id', id, 'name', name, 'answers', answers, 'updated_at', updated_at)
  from pl_entries where lower(name) = lower(btrim(p_name))
    and edit_token_hash = crypt(p_token, edit_token_hash);
$$;

create or replace function public.pl_admin_ok(p_pin text)
returns boolean language sql security definer set search_path = public, extensions stable as $$
  select coalesce((select admin_pin_hash = crypt(p_pin, admin_pin_hash) from pl_settings where id = 1), false);
$$;

create or replace function public.pl_admin_get(p_pin text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not pl_admin_ok(p_pin) then raise exception 'Wrong PIN'; end if;
  return jsonb_build_object(
    'settings', (select jsonb_build_object('season', season, 'locked', locked, 'results', results) from pl_settings where id = 1),
    'entries', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'answers', answers,
                  'created_at', created_at, 'updated_at', updated_at) order by created_at), '[]'::jsonb) from pl_entries));
end $$;

create or replace function public.pl_admin_set_lock(p_pin text, p_locked boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not pl_admin_ok(p_pin) then raise exception 'Wrong PIN'; end if;
  update pl_settings set locked = p_locked, updated_at = now() where id = 1;
end $$;

create or replace function public.pl_admin_set_results(p_pin text, p_results jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not pl_admin_ok(p_pin) then raise exception 'Wrong PIN'; end if;
  if jsonb_typeof(p_results) <> 'object' then raise exception 'Invalid results'; end if;
  update pl_settings set results = p_results, updated_at = now() where id = 1;
end $$;

create or replace function public.pl_admin_delete_entry(p_pin text, p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not pl_admin_ok(p_pin) then raise exception 'Wrong PIN'; end if;
  delete from pl_entries where id = p_id;
end $$;

create or replace function public.pl_admin_rename_entry(p_pin text, p_id uuid, p_name text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not pl_admin_ok(p_pin) then raise exception 'Wrong PIN'; end if;
  update pl_entries set name = btrim(p_name), updated_at = now() where id = p_id;
end $$;

revoke execute on function public.pl_admin_ok(text) from public, anon, authenticated;
grant execute on function public.pl_state(), public.pl_entries_list(text, text), public.pl_submit(text, jsonb, text),
  public.pl_my_entry(text, text), public.pl_admin_get(text), public.pl_admin_set_lock(text, boolean),
  public.pl_admin_set_results(text, jsonb), public.pl_admin_delete_entry(text, uuid),
  public.pl_admin_rename_entry(text, uuid, text) to anon, authenticated;

