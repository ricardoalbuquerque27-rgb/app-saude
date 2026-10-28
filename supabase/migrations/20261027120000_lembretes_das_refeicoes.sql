-- Lembretes das refeições (spec: docs/superpowers/specs/2026-10-27-lembretes-das-refeicoes-design.md).
--
-- Aplicar ANTES do deploy: os botões do app leem meal_checks, e sem a tabela
-- eles dizem que não carregaram as respostas.
--
-- No horário de cada refeição do cardápio, o paciente recebe "Almoço: você
-- comeu?", com "Comi" e "Não comi". Esta migração guarda três coisas:
--
--   meal_checks          a resposta, uma por refeição e por dia. "done" é comi,
--                        "skipped" é não comi, e nenhuma linha é sem resposta
--                        (como plan_completions, no treino). meal_id é a
--                        refeição que o "Comi" gravou em meals, quando gravou;
--                        excluída a refeição, a resposta sai junto.
--   profiles             os lembretes ligados e só os horários que o paciente
--                        mudou ({"Almoço": "13:00"}); o resto vale o sugerido.
--   meal_reminders_sent  o que já foi enviado, para ninguém receber duas
--                        vezes. Só a função de envio lê e escreve: RLS ligada
--                        e nenhuma política.
--
-- E a função que o agendador pacefit-reminders chama pela rota
-- /api/cron/reminders, refeicoes_devidas, no padrão de due_reminders (o
-- segredo de app_config protege, e anon executa).
--
-- Os horários sugeridos estão aqui e em HORARIOS_SUGERIDOS
-- (lib/lembretesDasRefeicoes.ts): mudou um, mude o outro. Um teste do vitest
-- lê este arquivo e confere os seis, e o formato do horário.

-- ---------------------------------------------------------------- meal_checks

create table public.meal_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  -- Sem lista fechada: o cardápio pode ter refeição fora de MEAL_TYPES, e ela
  -- também tem lembrete quando o paciente escolhe um horário.
  meal_type text not null check (char_length(trim(meal_type)) between 1 and 200),
  status text not null check (status in ('done', 'skipped')),
  -- Excluir a refeição desfaz a resposta ligada a ela: quem apaga da lista
  -- da Dieta o almoço que o "Comi" gravou não está mais dizendo que comeu
  -- (com set null, o plano perguntaria "Qual opção?").
  meal_id uuid references public.meals(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date, meal_type),
  -- "Não comi" com uma refeição ligada não faz sentido.
  check (status = 'done' or meal_id is null)
);

create function public.meal_checks_touch() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger meal_checks_touch before update on public.meal_checks
  for each row execute function public.meal_checks_touch();

alter table public.meal_checks enable row level security;
-- Quem não está logado não chega nem à RLS.
revoke all on public.meal_checks from anon;
grant select, insert, update, delete on public.meal_checks to authenticated;

create policy meal_checks_select_own on public.meal_checks
  for select to authenticated
  using (auth.uid() = user_id);

-- A refeição ligada tem de ser do próprio paciente: sem isso, ele apontaria a
-- resposta para a refeição de outra pessoa (o id é um uuid, mas vaza).
create policy meal_checks_insert_own on public.meal_checks
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and (meal_id is null
         or exists (select 1 from public.meals m where m.id = meal_id and m.user_id = auth.uid()))
  );

create policy meal_checks_update_own on public.meal_checks
  for update to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (meal_id is null
         or exists (select 1 from public.meals m where m.id = meal_id and m.user_id = auth.uid()))
  );

create policy meal_checks_delete_own on public.meal_checks
  for delete to authenticated
  using (auth.uid() = user_id);

create policy meal_checks_nutri_read on public.meal_checks
  for select to authenticated
  using (is_active_nutri_of(user_id));

-- ---------------------------------------------------------------- profiles

alter table public.profiles
  add column meal_reminders_enabled boolean not null default false,
  add column meal_reminder_times jsonb not null default '{}'::jsonb
    check (jsonb_typeof(meal_reminder_times) = 'object');

-- ---------------------------------------------------------------- meal_reminders_sent

create table public.meal_reminders_sent (
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  meal_type text not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, date, meal_type)
);

alter table public.meal_reminders_sent enable row level security;
revoke all on public.meal_reminders_sent from anon, authenticated;

-- ---------------------------------------------------------------- o envio

-- A conta do envio, com a hora de São Paulo como parâmetro. Ninguém fora do
-- dono a executa: quem chama é refeicoes_devidas, depois do segredo. Existe
-- separada para o teste passar a hora em vez de depender do relógio (com
-- now(), o caso da meia-noite não se testa).
create function public.refeicoes_devidas_em(p_agora timestamp)
returns table(user_id uuid, data date, refeicao text, itens jsonb, endpoint text, p256dh text, auth text)
language plpgsql
set search_path = public
as $$
#variable_conflict use_column
declare
  hoje date := p_agora::date;
  hora time := p_agora::time;
begin
  -- Uma semana basta para "já foi enviada hoje"; o resto só ocupa espaço.
  delete from public.meal_reminders_sent s where s.date < hoje - 7;

  return query
  with sugeridos(tipo, horario) as (values
    ('Café da manhã', '08:00'), ('Lanche da manhã', '10:00'), ('Almoço', '12:30'),
    ('Lanche da tarde', '16:00'), ('Jantar', '20:00'), ('Ceia', '22:00')),
  plano as (
    -- O cardápio ativo mais novo de cada paciente, o mesmo que a Dieta mostra.
    select distinct on (mp.patient_id) mp.patient_id, mp.id
    from public.meal_plans mp
    where mp.active
    order by mp.patient_id, mp.created_at desc),
  tipos as (
    select pl.patient_id, i.meal_type,
           jsonb_agg(jsonb_build_object('id', i.id, 'description', i.description,
             'calories', i.calories, 'protein_g', i.protein_g, 'carbs_g', i.carbs_g,
             'fat_g', i.fat_g) order by i.position, i.id) as itens
    from plano pl
    join public.meal_plan_items i on i.meal_plan_id = pl.id
    group by pl.patient_id, i.meal_type),
  devidas as (
    -- O horário salvo fora do formato vale como o sugerido; refeição fora da
    -- lista sem horário salvo fica sem lembrete.
    select t.patient_id, t.meal_type, t.itens,
           coalesce(case when (p.meal_reminder_times ->> t.meal_type) ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
                         then p.meal_reminder_times ->> t.meal_type end,
                    s.horario)::time as horario
    from tipos t
    join public.profiles p on p.id = t.patient_id and p.meal_reminders_enabled
    left join sugeridos s on s.tipo = t.meal_type
    where exists (select 1 from public.patient_links l
                   where l.patient_id = t.patient_id and l.status = 'active')
      -- Sem inscrição não marca como enviado: quem ligar o celular depois,
      -- dentro da hora, ainda recebe.
      and exists (select 1 from public.push_subscriptions ps where ps.user_id = t.patient_id)
      and not exists (select 1 from public.meal_checks c
                       where c.user_id = t.patient_id and c.date = hoje and c.meal_type = t.meal_type)
      and not exists (select 1 from public.meals m
                       where m.user_id = t.patient_id and m.date = hoje and m.meal_type = t.meal_type)),
  enviadas as (
    insert into public.meal_reminders_sent (user_id, date, meal_type)
    select d.patient_id, hoje, d.meal_type
    from devidas d
    -- hora - horario, e não horario + 1 hora: o time dá a volta à meia-noite,
    -- e a ceia das 23:30 nunca sairia. Até 1 hora depois do horário: uma
    -- rodada perdida do agendador não manda o café às 15h.
    where d.horario is not null and hora >= d.horario and hora - d.horario < interval '1 hour'
    on conflict do nothing
    returning meal_reminders_sent.user_id, meal_reminders_sent.meal_type)
  select e.user_id, hoje, e.meal_type, d.itens, ps.endpoint, ps.p256dh, ps.auth
  from enviadas e
  join devidas d on d.patient_id = e.user_id and d.meal_type = e.meal_type
  join public.push_subscriptions ps on ps.user_id = e.user_id;
end $$;

revoke all on function public.refeicoes_devidas_em(timestamp) from public, anon, authenticated;

create function public.refeicoes_devidas(p_secret text)
returns table(user_id uuid, data date, refeicao text, itens jsonb, endpoint text, p256dh text, auth text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_secret is distinct from (select value from public.app_config where key = 'cron_secret') then
    return;
  end if;
  return query select * from public.refeicoes_devidas_em(now() at time zone 'America/Sao_Paulo');
end $$;

revoke all on function public.refeicoes_devidas(text) from public;
grant execute on function public.refeicoes_devidas(text) to anon, authenticated;
