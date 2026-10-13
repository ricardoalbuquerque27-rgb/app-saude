-- Consultas e agenda (spec: docs/superpowers/specs/2026-10-13-consultas-e-agenda-design.md).
--
-- A tabela só tem política de LEITURA. Toda escrita passa pelas funções
-- abaixo, SECURITY DEFINER, que conferem quem pede e se a mudança de
-- situação vale: com política de update, o paciente poderia se marcar como
-- "realizada" ou trocar o nutricionista da consulta.
--
-- "Sem desfecho" não é gravado: é uma agendada cujo fim já passou. Gravar
-- pediria um cron, e o plano Hobby da Vercel só aceita cron diário.

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  nutritionist_id uuid not null references auth.users(id) on delete cascade,
  patient_id uuid not null references auth.users(id) on delete cascade,
  starts_at timestamptz not null,
  duration_min integer not null default 60 check (duration_min between 15 and 240),
  kind text not null default 'retorno' check (kind in ('primeira', 'retorno')),
  mode text not null default 'presencial' check (mode in ('presencial', 'online')),
  status text not null check (status in ('pedido', 'agendada', 'realizada', 'faltou', 'cancelada')),
  patient_message text check (patient_message is null or char_length(patient_message) <= 500),
  reschedule_requested_at timestamptz,
  cancelled_by text check (cancelled_by in ('nutri', 'paciente')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Quem cancelou existe se, e só se, está cancelada.
  constraint appointments_cancelamento_coerente
    check ((status = 'cancelada') = (cancelled_by is not null)),
  -- Pedido de remarcação só numa agendada.
  constraint appointments_remarcacao_so_em_agendada
    check (reschedule_requested_at is null or status = 'agendada')
);

create index appointments_nutri_inicio on public.appointments (nutritionist_id, starts_at);
create index appointments_paciente_inicio on public.appointments (patient_id, starts_at);
-- Um pedido aberto por paciente. A função já confere; o índice segura dois
-- pedidos simultâneos (dois toques no botão).
create unique index appointments_um_pedido_aberto
  on public.appointments (patient_id) where status = 'pedido';

alter table public.appointments enable row level security;

create policy appointments_nutri_read on public.appointments
  for select to authenticated
  using (nutritionist_id = auth.uid() and public.is_active_nutri_of(patient_id));

create policy appointments_patient_read on public.appointments
  for select to authenticated
  using (patient_id = auth.uid());

-- A Supabase dá tudo a anon e authenticated nas tabelas públicas. Sem
-- política de escrita a RLS já recusa, mas o privilégio fica revogado para
-- não depender de ninguém lembrar disso ao criar uma política nova.
revoke all on public.appointments from anon;
revoke insert, update, delete, truncate, references, trigger on public.appointments from authenticated;
grant select on public.appointments to authenticated;

-- ---------------------------------------------------------------------------
-- Nutricionista
-- ---------------------------------------------------------------------------

create or replace function public.marcar_consulta(
  p_patient uuid,
  p_inicio timestamptz,
  p_duracao integer default 60,
  p_tipo text default 'retorno',
  p_modo text default 'presencial'
) returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_id uuid;
begin
  if not public.is_active_nutri_of(p_patient) then
    return jsonb_build_object('ok', false, 'error', 'Você não acompanha este paciente.');
  end if;
  if p_inicio is null then
    return jsonb_build_object('ok', false, 'error', 'Escolha a data e a hora.');
  end if;
  if p_duracao is null or p_duracao not between 15 and 240 then
    return jsonb_build_object('ok', false, 'error', 'Duração inválida.');
  end if;
  if p_tipo is null or p_tipo not in ('primeira', 'retorno') then
    return jsonb_build_object('ok', false, 'error', 'Tipo de consulta inválido.');
  end if;
  if p_modo is null or p_modo not in ('presencial', 'online') then
    return jsonb_build_object('ok', false, 'error', 'Modalidade inválida.');
  end if;

  -- No passado é permitido: o nutri pode lançar a consulta de ontem para
  -- fechar como realizada.
  insert into public.appointments
    (nutritionist_id, patient_id, starts_at, duration_min, kind, mode, status)
  values
    (auth.uid(), p_patient, p_inicio, p_duracao, p_tipo, p_modo, 'agendada')
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

-- Pedido ou agendada → agendada. Parâmetro nulo mantém o valor atual:
-- "Aceitar" um pedido e "Manter horário" de um pedido de remarcação são
-- chamar só com o id.
create or replace function public.remarcar_consulta(
  p_id uuid,
  p_inicio timestamptz default null,
  p_duracao integer default null,
  p_tipo text default null,
  p_modo text default null
) returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
  c public.appointments;
begin
  select * into c from public.appointments where id = p_id for update;
  if not found or c.nutritionist_id is distinct from auth.uid() or not public.is_active_nutri_of(c.patient_id) then
    return jsonb_build_object('ok', false, 'error', 'Consulta não encontrada.');
  end if;
  if c.status not in ('pedido', 'agendada') then
    return jsonb_build_object('ok', false, 'error', 'Esta consulta já foi fechada.');
  end if;
  if p_duracao is not null and p_duracao not between 15 and 240 then
    return jsonb_build_object('ok', false, 'error', 'Duração inválida.');
  end if;
  if p_tipo is not null and p_tipo not in ('primeira', 'retorno') then
    return jsonb_build_object('ok', false, 'error', 'Tipo de consulta inválido.');
  end if;
  if p_modo is not null and p_modo not in ('presencial', 'online') then
    return jsonb_build_object('ok', false, 'error', 'Modalidade inválida.');
  end if;

  update public.appointments set
    starts_at = coalesce(p_inicio, starts_at),
    duration_min = coalesce(p_duracao, duration_min),
    kind = coalesce(p_tipo, kind),
    mode = coalesce(p_modo, mode),
    status = 'agendada',
    reschedule_requested_at = null,
    updated_at = now()
  where id = p_id;

  return jsonb_build_object('ok', true, 'id', p_id);
end;
$$;

-- O desfecho. Realizada e faltou só depois do início, e só de uma agendada
-- (ou para trocar uma pela outra); cancelada de qualquer situação, inclusive
-- pedido, que é o "Recusar". Cancelada não volta a realizada nem a falta: um
-- pedido recusado nunca foi consulta, e "corrigi-lo" mudaria o "desde a
-- última consulta" e o tipo sugerido da próxima.
create or replace function public.fechar_consulta(p_id uuid, p_desfecho text)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
  c public.appointments;
begin
  if p_desfecho is null or p_desfecho not in ('realizada', 'faltou', 'cancelada') then
    return jsonb_build_object('ok', false, 'error', 'Desfecho inválido.');
  end if;
  select * into c from public.appointments where id = p_id for update;
  if not found or c.nutritionist_id is distinct from auth.uid() or not public.is_active_nutri_of(c.patient_id) then
    return jsonb_build_object('ok', false, 'error', 'Consulta não encontrada.');
  end if;
  if p_desfecho in ('realizada', 'faltou') then
    if c.status = 'pedido' then
      return jsonb_build_object('ok', false, 'error', 'Aceite o pedido antes de fechar a consulta.');
    end if;
    if c.status = 'cancelada' then
      return jsonb_build_object('ok', false, 'error', 'Consulta cancelada não pode virar realizada nem falta. Marque outra.');
    end if;
    if c.starts_at > now() then
      return jsonb_build_object('ok', false, 'error', 'A consulta ainda não começou.');
    end if;
  end if;

  update public.appointments set
    status = p_desfecho,
    cancelled_by = case when p_desfecho = 'cancelada' then 'nutri' end,
    reschedule_requested_at = null,
    updated_at = now()
  where id = p_id;

  return jsonb_build_object('ok', true, 'id', p_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Paciente
-- ---------------------------------------------------------------------------

create or replace function public.pedir_consulta(
  p_inicio timestamptz,
  p_modo text default 'presencial',
  p_mensagem text default null
) returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_nutri uuid;
  v_tipo text;
  v_msg text := nullif(btrim(coalesce(p_mensagem, '')), '');
  v_id uuid;
begin
  select pl.nutritionist_id into v_nutri
    from public.patient_links pl
   where pl.patient_id = auth.uid() and pl.status = 'active'
   order by pl.accepted_at desc nulls last
   limit 1;
  if v_nutri is null then
    return jsonb_build_object('ok', false, 'error', 'Você ainda não tem nutricionista no app.');
  end if;
  if p_inicio is null or p_inicio <= now() then
    return jsonb_build_object('ok', false, 'error', 'Escolha um horário no futuro.');
  end if;
  if p_modo is null or p_modo not in ('presencial', 'online') then
    return jsonb_build_object('ok', false, 'error', 'Modalidade inválida.');
  end if;
  if v_msg is not null and char_length(v_msg) > 500 then
    return jsonb_build_object('ok', false, 'error', 'O recado passa de 500 caracteres.');
  end if;
  if exists (select 1 from public.appointments
              where patient_id = auth.uid() and status = 'pedido') then
    return jsonb_build_object('ok', false, 'error', 'Você já tem um pedido aguardando resposta.');
  end if;

  -- Retorno se já houve consulta realizada com este nutricionista.
  v_tipo := case when exists (
      select 1 from public.appointments
       where patient_id = auth.uid() and nutritionist_id = v_nutri and status = 'realizada'
    ) then 'retorno' else 'primeira' end;

  insert into public.appointments
    (nutritionist_id, patient_id, starts_at, duration_min, kind, mode, status, patient_message)
  values
    (v_nutri, auth.uid(), p_inicio, case when v_tipo = 'primeira' then 60 else 45 end,
     v_tipo, p_modo, 'pedido', v_msg)
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id);
exception
  -- Dois pedidos ao mesmo tempo: o segundo bate no índice único.
  when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'Você já tem um pedido aguardando resposta.');
end;
$$;

create or replace function public.pedir_remarcacao(p_id uuid, p_mensagem text)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
  c public.appointments;
  v_msg text := nullif(btrim(coalesce(p_mensagem, '')), '');
begin
  select * into c from public.appointments where id = p_id for update;
  if not found or c.patient_id is distinct from auth.uid() then
    return jsonb_build_object('ok', false, 'error', 'Consulta não encontrada.');
  end if;
  if c.status <> 'agendada' or c.starts_at <= now() then
    return jsonb_build_object('ok', false, 'error', 'Só dá para pedir remarcação de uma consulta que ainda vai acontecer.');
  end if;
  if v_msg is null then
    return jsonb_build_object('ok', false, 'error', 'Diga qual horário fica melhor.');
  end if;
  if char_length(v_msg) > 500 then
    return jsonb_build_object('ok', false, 'error', 'O recado passa de 500 caracteres.');
  end if;

  update public.appointments set
    reschedule_requested_at = now(),
    patient_message = v_msg,
    updated_at = now()
  where id = p_id;

  return jsonb_build_object('ok', true, 'id', p_id);
end;
$$;

-- O paciente cancela um pedido (mesmo com o horário pedido já passado: o
-- nutri não respondeu) ou uma agendada que ainda não começou.
create or replace function public.cancelar_consulta(p_id uuid)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
  c public.appointments;
begin
  select * into c from public.appointments where id = p_id for update;
  if not found or c.patient_id is distinct from auth.uid() then
    return jsonb_build_object('ok', false, 'error', 'Consulta não encontrada.');
  end if;
  if not (c.status = 'pedido' or (c.status = 'agendada' and c.starts_at > now())) then
    return jsonb_build_object('ok', false, 'error', 'Esta consulta não pode mais ser cancelada pelo app.');
  end if;

  update public.appointments set
    status = 'cancelada',
    cancelled_by = 'paciente',
    reschedule_requested_at = null,
    updated_at = now()
  where id = p_id;

  return jsonb_build_object('ok', true, 'id', p_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Desvincular
-- ---------------------------------------------------------------------------

-- Quando o vínculo deixa de ser ativo (o paciente revoga, o nutri remove), o
-- que vinha pela frente com aquele nutricionista é cancelado: o nutri não vê
-- mais as consultas (a RLS exige vínculo ativo), e um pedido aberto com ele
-- prenderia o paciente pelo índice de um pedido por vez, sem ninguém para
-- responder. O que já aconteceu fica como histórico.
create or replace function public.cancelar_consultas_ao_desvincular()
returns trigger
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_nutri uuid := old.nutritionist_id;
  v_paciente uuid := old.patient_id;
begin
  if v_paciente is null or old.status <> 'active' then
    return coalesce(new, old);
  end if;
  if tg_op = 'UPDATE' and new.status = 'active' then
    return new;
  end if;

  update public.appointments set
    status = 'cancelada',
    cancelled_by = case when auth.uid() = v_paciente then 'paciente' else 'nutri' end,
    reschedule_requested_at = null,
    updated_at = now()
  where patient_id = v_paciente
    and nutritionist_id = v_nutri
    and (status = 'pedido' or (status = 'agendada' and starts_at > now()));

  return coalesce(new, old);
end;
$$;

create trigger patient_links_cancela_consultas
  after update of status or delete on public.patient_links
  for each row execute function public.cancelar_consultas_ao_desvincular();

-- Função de gatilho: ninguém chama direto.
revoke execute on function public.cancelar_consultas_ao_desvincular() from public, anon, authenticated;

-- Só quem está logado chama, como em harden_function_grants.
revoke execute on function public.marcar_consulta(uuid, timestamptz, integer, text, text) from public, anon;
revoke execute on function public.remarcar_consulta(uuid, timestamptz, integer, text, text) from public, anon;
revoke execute on function public.fechar_consulta(uuid, text) from public, anon;
revoke execute on function public.pedir_consulta(timestamptz, text, text) from public, anon;
revoke execute on function public.pedir_remarcacao(uuid, text) from public, anon;
revoke execute on function public.cancelar_consulta(uuid) from public, anon;
grant execute on function public.marcar_consulta(uuid, timestamptz, integer, text, text) to authenticated;
grant execute on function public.remarcar_consulta(uuid, timestamptz, integer, text, text) to authenticated;
grant execute on function public.fechar_consulta(uuid, text) to authenticated;
grant execute on function public.pedir_consulta(timestamptz, text, text) to authenticated;
grant execute on function public.pedir_remarcacao(uuid, text) to authenticated;
grant execute on function public.cancelar_consulta(uuid) to authenticated;
