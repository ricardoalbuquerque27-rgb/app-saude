-- Réplica mínima do que a Supabase já tem, para testar migrações num
-- Postgres local (ferramentas/testar-sql.sh). NÃO roda em produção.
--
-- Só o que as migrações de consulta tocam: auth.uid() lido do JWT como a
-- Supabase faz, os papéis anon/authenticated, auth.users, profiles e
-- patient_links, e as duas funções de vínculo copiadas de produção
-- (pg_get_functiondef em 2026-10-13). A body_measurements e as duas políticas
-- dela vêm do catálogo de produção em 2026-10-14.

create extension if not exists pgcrypto;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;

create schema if not exists auth;
grant usage on schema auth to anon, authenticated;
grant usage on schema public to anon, authenticated;

create table if not exists auth.users (id uuid primary key);

-- Igual à Supabase: o `sub` do JWT que o PostgREST põe em request.jwt.claims.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::json->>'sub', '')::uuid
$$;
grant execute on function auth.uid() to anon, authenticated;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'patient' check (role in ('patient','nutritionist')),
  height_cm numeric
);

create table if not exists public.patient_links (
  id uuid primary key default gen_random_uuid(),
  nutritionist_id uuid not null references auth.users(id) on delete cascade,
  patient_id uuid references auth.users(id) on delete cascade,
  patient_label text,
  invite_code text unique,
  status text not null default 'pending' check (status in ('pending','active','revoked')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

-- A Supabase dá todos os privilégios das tabelas públicas a anon e
-- authenticated, e quem segura é a RLS. A réplica faz o mesmo, para o teste
-- pegar uma tabela nova que esqueça de revogar.
alter default privileges in schema public grant all on tables to anon, authenticated;
grant all on public.profiles, public.patient_links to anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_active_nutri_of(p_patient uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.patient_links pl
    where pl.patient_id = p_patient
      and pl.nutritionist_id = auth.uid()
      and pl.status = 'active'
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_my_nutritionist(p_nutri uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.patient_links pl
    where pl.nutritionist_id = p_nutri
      and pl.patient_id = auth.uid()
      and pl.status = 'active'
  );
$function$;

-- As colunas de produção, sem o appointment_id e o measured_by: esses dois a
-- migração 20261014120000_medidas_da_consulta é que acrescenta. Sem índice
-- único em (user_id, date), como em produção.
create table if not exists public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null default current_date,
  weight_kg numeric,
  body_fat_pct numeric,
  waist_cm numeric,
  hip_cm numeric,
  chest_cm numeric,
  arm_cm numeric,
  thigh_cm numeric,
  neck_cm numeric,
  calf_cm numeric,
  notes text,
  created_at timestamptz default now()
);
create index if not exists measurements_user_date_idx on public.body_measurements (user_id, date desc);
grant all on public.body_measurements to anon, authenticated;
alter table public.body_measurements enable row level security;

-- Copiadas do catálogo de produção (roles public, como lá).
create policy measurements_all_own on public.body_measurements
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "nutri reads patient" on public.body_measurements
  for select
  using (is_active_nutri_of(user_id));
