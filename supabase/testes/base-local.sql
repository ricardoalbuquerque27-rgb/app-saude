-- Réplica mínima do que a Supabase já tem, para testar migrações num
-- Postgres local (ferramentas/testar-sql.sh). NÃO roda em produção.
--
-- Só o que as migrações de consulta tocam: auth.uid() lido do JWT como a
-- Supabase faz, os papéis anon/authenticated, auth.users, profiles e
-- patient_links, e as duas funções de vínculo copiadas de produção
-- (pg_get_functiondef em 2026-10-13). A body_measurements e as duas políticas
-- dela vêm do catálogo de produção em 2026-10-14; meals, meal_plans,
-- meal_plan_items, push_subscriptions e app_config (para os lembretes das
-- refeições), em 2026-10-28, no fim do arquivo.

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

-- ---------------------------------------------------------------------------
-- Para a migração dos lembretes das refeições (20261027120000): o que a
-- resposta e a função de envio leem. Colunas, chaves e políticas copiadas do
-- catálogo de produção em 2026-10-28 (information_schema.columns,
-- pg_constraint e pg_policies; roles public, como lá).

create table if not exists public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null default current_date,
  meal_type text not null default 'refeicao',
  description text not null,
  calories numeric,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  created_at timestamptz not null default now()
);
grant all on public.meals to anon, authenticated;
alter table public.meals enable row level security;
create policy meals_all_own on public.meals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "nutri reads patient" on public.meals
  for select using (is_active_nutri_of(user_id));

create table if not exists public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references auth.users(id) on delete cascade,
  nutritionist_id uuid references auth.users(id) on delete set null,
  name text not null default 'Plano alimentar',
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant all on public.meal_plans to anon, authenticated;
alter table public.meal_plans enable row level security;
create policy meal_plans_nutri_all on public.meal_plans
  for all using (is_active_nutri_of(patient_id)) with check (is_active_nutri_of(patient_id));
create policy meal_plans_patient_read on public.meal_plans
  for select using (patient_id = auth.uid());

create table if not exists public.meal_plan_items (
  id uuid primary key default gen_random_uuid(),
  meal_plan_id uuid not null references public.meal_plans(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  meal_type text not null,
  position integer not null default 1,
  description text not null check (length(trim(description)) >= 1 and length(trim(description)) <= 2000),
  calories numeric,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  notes text
);
grant all on public.meal_plan_items to anon, authenticated;
alter table public.meal_plan_items enable row level security;
create policy meal_plan_items_nutri_all on public.meal_plan_items
  for all using (is_active_nutri_of(user_id)) with check (is_active_nutri_of(user_id));
create policy meal_plan_items_patient_read on public.meal_plan_items
  for select using (user_id = auth.uid());

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
grant all on public.push_subscriptions to anon, authenticated;
alter table public.push_subscriptions enable row level security;
create policy push_select_own on public.push_subscriptions for select using (auth.uid() = user_id);
create policy push_insert_own on public.push_subscriptions for insert with check (auth.uid() = user_id);
create policy push_update_own on public.push_subscriptions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy push_delete_own on public.push_subscriptions for delete using (auth.uid() = user_id);

-- O segredo do agendador mora aqui. RLS ligada e nenhuma política, como em
-- produção: só as funções SECURITY DEFINER o leem.
create table if not exists public.app_config (
  key text primary key,
  value text not null
);
grant all on public.app_config to anon, authenticated;
alter table public.app_config enable row level security;
