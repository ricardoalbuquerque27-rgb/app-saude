-- Registro da consulta (spec: docs/superpowers/specs/2026-10-13-registro-da-consulta-design.md).
--
-- O prontuário enxuto do nutricionista: um registro por consulta (anamnese ou
-- evolução, diagnóstico, conduta, o que observar no retorno e a avaliação
-- física). Enquanto é rascunho, o autor reescreve à vontade; concluído, não
-- muda mais, e a correção é um adendo assinado e datado. É o que pedem as
-- regras de prontuário: o que foi escrito no dia fica como foi escrito.
--
-- Como em appointments, as tabelas só têm política de LEITURA, e só para o
-- autor (o paciente não lê). Toda escrita passa pelas funções abaixo,
-- SECURITY DEFINER, que conferem quem pede, a situação da consulta e a
-- concorrência entre abas. Com política de update, o autor poderia reescrever
-- um registro concluído direto pela API.
--
-- A leitura não exige vínculo ativo: o prontuário é de quem atendeu e não
-- some do olho dele quando o paciente revoga o acesso (a medida publicada
-- segue a mesma regra, measurements_author_read, na migração anterior).
-- Escrever, sim: salvar, concluir e descartar pedem o vínculo, como a agenda.

create table public.consultation_records (
  id uuid primary key default gen_random_uuid(),
  -- Sem on delete: a consulta não se apaga, e se um dia se apagar o
  -- prontuário não vai junto.
  appointment_id uuid not null unique references public.appointments(id),
  -- Sem chave para auth.users, como o measured_by: apagar a conta não pode
  -- levar o prontuário em cascata.
  nutritionist_id uuid not null,
  patient_id uuid not null,
  anamnese text check (char_length(anamnese) <= 20000),
  diagnostico text check (char_length(diagnostico) <= 5000),
  conduta text check (char_length(conduta) <= 10000),
  observar text check (char_length(observar) <= 2000),
  -- As medidas do rascunho, chave = coluna de body_measurements. Ficam aqui
  -- também depois de concluído: é a cópia do prontuário; measurement_id é a
  -- linha publicada na série do paciente.
  medidas jsonb not null default '{}'::jsonb check (jsonb_typeof(medidas) = 'object'),
  measurement_id uuid references public.body_measurements(id),
  status text not null default 'rascunho' check (status in ('rascunho', 'concluido')),
  concluded_at timestamptz,
  assinatura_nome text,
  assinatura_crn text,
  created_at timestamptz not null default now(),
  -- A trava de concorrência: a tela devolve o updated_at que leu, e a função
  -- recusa se ele mudou.
  updated_at timestamptz not null default now(),
  -- Concluído tem data e CRN; rascunho não tem data. O banco segura o que a
  -- função já confere, para uma função nova não "concluir pela metade".
  constraint consultation_records_conclusao_coerente
    check ((status = 'concluido') = (concluded_at is not null)),
  constraint consultation_records_concluido_assinado
    check (status = 'rascunho' or assinatura_crn is not null)
);

create index consultation_records_paciente on public.consultation_records (patient_id, updated_at desc);
create index consultation_records_nutri on public.consultation_records (nutritionist_id);

create table public.consultation_addenda (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.consultation_records(id),
  author_id uuid not null,
  body text not null check (char_length(body) between 1 and 5000),
  assinatura_nome text,
  assinatura_crn text,
  created_at timestamptz not null default now()
);

create index consultation_addenda_registro on public.consultation_addenda (record_id, created_at);

alter table public.consultation_records enable row level security;
alter table public.consultation_addenda enable row level security;

create policy consultation_records_author_read on public.consultation_records
  for select to authenticated
  using (nutritionist_id = auth.uid());

create policy consultation_addenda_author_read on public.consultation_addenda
  for select to authenticated
  using (exists (
    select 1 from public.consultation_records r
     where r.id = record_id and r.nutritionist_id = auth.uid()
  ));

-- A Supabase dá tudo a anon e authenticated nas tabelas públicas. Sem
-- política de escrita a RLS já recusa, mas o privilégio fica revogado para
-- não depender de ninguém lembrar disso ao criar uma política nova.
revoke all on public.consultation_records, public.consultation_addenda from anon;
revoke insert, update, delete, truncate, references, trigger
  on public.consultation_records, public.consultation_addenda from authenticated;
grant select on public.consultation_records, public.consultation_addenda to authenticated;

-- ---------------------------------------------------------------------------
-- Conferências internas
-- ---------------------------------------------------------------------------

-- Nulo = as medidas valem. As faixas são as de lib/registro.ts: a tela avisa
-- antes, o banco garante (a API aceita qualquer jsonb). A ordem é a da tela,
-- para a mensagem ser a do primeiro campo errado que o nutri vê. Texto que
-- parece número ("72") não passa: o rascunho guarda número.
create or replace function public.erro_das_medidas(p jsonb)
returns text
language plpgsql immutable set search_path to 'public'
as $$
declare
  f record;
  v jsonb;
  n numeric;
begin
  if p is null or jsonb_typeof(p) = 'null' then
    return null;
  end if;
  if jsonb_typeof(p) <> 'object' then
    return 'Medida desconhecida.';
  end if;
  if exists (select 1 from jsonb_object_keys(p) k
              where k not in ('weight_kg', 'body_fat_pct', 'waist_cm', 'hip_cm', 'chest_cm',
                              'arm_cm', 'thigh_cm', 'calf_cm', 'neck_cm')) then
    return 'Medida desconhecida.';
  end if;

  for f in
    select * from (values
      (1, 'weight_kg', 20, 400, 'Peso', ' kg'),
      (2, 'body_fat_pct', 2, 75, '% de gordura', '%'),
      (3, 'waist_cm', 30, 250, 'Cintura', ' cm'),
      (4, 'hip_cm', 30, 250, 'Quadril', ' cm'),
      (5, 'chest_cm', 30, 250, 'Tórax', ' cm'),
      (6, 'arm_cm', 10, 80, 'Braço', ' cm'),
      (7, 'thigh_cm', 20, 120, 'Coxa', ' cm'),
      (8, 'calf_cm', 10, 80, 'Panturrilha', ' cm'),
      (9, 'neck_cm', 10, 80, 'Pescoço', ' cm')
    ) as t(ordem, campo, minimo, maximo, rotulo, unidade)
    order by ordem
  loop
    v := p -> f.campo;
    continue when v is null or jsonb_typeof(v) = 'null';
    -- Dois ifs, não um "or": o plpgsql não promete curto-circuito, e o cast
    -- de um texto qualquer lançaria erro em vez de devolver a mensagem.
    if jsonb_typeof(v) <> 'number' then
      return format('%s fora da faixa (%s a %s%s).', f.rotulo, f.minimo, f.maximo, f.unidade);
    end if;
    n := (v #>> '{}')::numeric;
    if n < f.minimo or n > f.maximo then
      return format('%s fora da faixa (%s a %s%s).', f.rotulo, f.minimo, f.maximo, f.unidade);
    end if;
  end loop;
  return null;
end;
$$;

-- Os limites de texto e as medidas, na ordem da tela. Salvar confere o que
-- chega; concluir confere de novo o que está gravado (um rascunho antigo, ou
-- escrito por outro caminho, não é publicado sem passar por aqui).
create or replace function public.erro_do_registro(
  p_anamnese text, p_diagnostico text, p_conduta text, p_observar text, p_medidas jsonb
) returns text
language plpgsql immutable set search_path to 'public'
as $$
begin
  if char_length(p_anamnese) > 20000 then return 'Texto longo demais em Anamnese.'; end if;
  if char_length(p_diagnostico) > 5000 then return 'Texto longo demais em Diagnóstico.'; end if;
  if char_length(p_conduta) > 10000 then return 'Texto longo demais em Conduta.'; end if;
  if char_length(p_observar) > 2000 then return 'Texto longo demais em Observar no retorno.'; end if;
  return public.erro_das_medidas(p_medidas);
end;
$$;

-- ---------------------------------------------------------------------------
-- Rascunho e conclusão
-- ---------------------------------------------------------------------------

-- Grava o conjunto inteiro que a tela manda (não é remendo: o que não veio
-- fica vazio). p_visto_em é o updated_at que a tela leu: nulo só cria. Com
-- rascunho já gravado, nulo ou diferente é outra aba escrevendo na mesma
-- consulta, e a última gravação apagaria a primeira sem ninguém ver.
--
-- O "for update" na consulta enfileira esta função com fechar_consulta: sem
-- ele, um "faltou" e o primeiro salvamento ao mesmo tempo deixariam rascunho
-- numa consulta com falta.
create or replace function public.salvar_registro(
  p_consulta uuid, p_campos jsonb, p_visto_em timestamptz
) returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
  c public.appointments;
  r public.consultation_records;
  v_existe boolean;
  v_anamnese text := p_campos->>'anamnese';
  v_diagnostico text := p_campos->>'diagnostico';
  v_conduta text := p_campos->>'conduta';
  v_observar text := p_campos->>'observar';
  -- Medida nula é medida não tirada: some do objeto, para não publicar uma
  -- linha vazia nem contar como "parte preenchida".
  v_medidas jsonb := jsonb_strip_nulls(coalesce(nullif(p_campos->'medidas', 'null'::jsonb), '{}'::jsonb));
  v_erro text;
  v_id uuid;
  v_quando timestamptz;
begin
  select * into c from public.appointments where id = p_consulta for update;
  if not found or c.nutritionist_id is distinct from auth.uid() or not public.is_active_nutri_of(c.patient_id) then
    return jsonb_build_object('ok', false, 'error', 'Consulta não encontrada.');
  end if;
  if c.status in ('faltou', 'cancelada') then
    return jsonb_build_object('ok', false, 'error', 'Consulta com falta ou cancelada não tem registro.');
  end if;
  -- Pedido ainda não é consulta: ninguém aceitou o horário.
  if c.status = 'pedido' or c.starts_at > now() then
    return jsonb_build_object('ok', false, 'error', 'A consulta ainda não começou.');
  end if;

  select * into r from public.consultation_records where appointment_id = p_consulta for update;
  v_existe := found;
  if v_existe and r.status = 'concluido' then
    return jsonb_build_object('ok', false, 'error', 'O registro já foi concluído. Para corrigir, use um adendo.');
  end if;
  if v_existe and (p_visto_em is null or p_visto_em <> r.updated_at) then
    return jsonb_build_object('ok', false, 'error', 'O rascunho mudou em outra aba. Recarregue a página.');
  end if;

  v_erro := public.erro_do_registro(v_anamnese, v_diagnostico, v_conduta, v_observar, v_medidas);
  if v_erro is not null then
    return jsonb_build_object('ok', false, 'error', v_erro);
  end if;

  -- clock_timestamp, não now(): now() é o mesmo durante a transação, e dois
  -- salvamentos nela teriam o mesmo updated_at (a trava não veria o segundo).
  -- O greatest garante que o valor sempre anda, mesmo no mesmo microssegundo.
  if not v_existe then
    v_quando := clock_timestamp();
    insert into public.consultation_records
      (appointment_id, nutritionist_id, patient_id, anamnese, diagnostico, conduta, observar,
       medidas, created_at, updated_at)
    values
      (c.id, c.nutritionist_id, c.patient_id, v_anamnese, v_diagnostico, v_conduta, v_observar,
       v_medidas, v_quando, v_quando)
    returning id into v_id;
  else
    v_quando := greatest(clock_timestamp(), r.updated_at + interval '1 microsecond');
    update public.consultation_records set
      anamnese = v_anamnese,
      diagnostico = v_diagnostico,
      conduta = v_conduta,
      observar = v_observar,
      medidas = v_medidas,
      updated_at = v_quando
    where id = r.id;
    v_id := r.id;
  end if;

  return jsonb_build_object('ok', true, 'id', v_id, 'updated_at', v_quando);
end;
$$;

-- Trava o registro: copia nome e CRN (o perfil pode mudar depois, o
-- prontuário não), fecha a consulta como realizada se ainda estava agendada e
-- publica as medidas na série do paciente, com a data da consulta em São
-- Paulo. starts_at::date seria o dia em UTC: uma consulta às 22h caía no dia
-- seguinte (a armadilha de fuso do CLAUDE.md).
--
-- Tudo é conferido antes de escrever qualquer coisa: uma conclusão recusada
-- não grava nem o CRN no perfil.
create or replace function public.concluir_registro(
  p_consulta uuid, p_visto_em timestamptz, p_crn text default null
) returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
  c public.appointments;
  r public.consultation_records;
  v_crn text := nullif(btrim(coalesce(p_crn, '')), '');
  v_nome text;
  v_crn_perfil text;
  v_erro text;
  v_medida uuid;
begin
  select * into c from public.appointments where id = p_consulta for update;
  if not found or c.nutritionist_id is distinct from auth.uid() or not public.is_active_nutri_of(c.patient_id) then
    return jsonb_build_object('ok', false, 'error', 'Consulta não encontrada.');
  end if;
  if c.status in ('faltou', 'cancelada') then
    return jsonb_build_object('ok', false, 'error', 'Consulta com falta ou cancelada não tem registro.');
  end if;
  if c.status = 'pedido' or c.starts_at > now() then
    return jsonb_build_object('ok', false, 'error', 'A consulta ainda não começou.');
  end if;

  select * into r from public.consultation_records where appointment_id = p_consulta for update;
  if not found then
    -- Sem rascunho, não há o que concluir.
    return jsonb_build_object('ok', false, 'error', 'Preencha ao menos uma parte do registro.');
  end if;
  if r.status = 'concluido' then
    return jsonb_build_object('ok', false, 'error', 'O registro já foi concluído. Para corrigir, use um adendo.');
  end if;
  if p_visto_em is null or p_visto_em <> r.updated_at then
    return jsonb_build_object('ok', false, 'error', 'O rascunho mudou em outra aba. Recarregue a página.');
  end if;

  v_erro := public.erro_do_registro(r.anamnese, r.diagnostico, r.conduta, r.observar, r.medidas);
  if v_erro is not null then
    return jsonb_build_object('ok', false, 'error', v_erro);
  end if;
  -- Só espaço ou quebra de linha não é parte preenchida (\S: algum caractere
  -- que não é branco).
  if not (coalesce(r.anamnese ~ '\S', false) or coalesce(r.diagnostico ~ '\S', false)
          or coalesce(r.conduta ~ '\S', false) or coalesce(r.observar ~ '\S', false)
          or exists (select 1 from jsonb_object_keys(r.medidas))) then
    return jsonb_build_object('ok', false, 'error', 'Preencha ao menos uma parte do registro.');
  end if;
  if v_crn is not null and char_length(v_crn) > 30 then
    return jsonb_build_object('ok', false, 'error', 'CRN longo demais (até 30 caracteres).');
  end if;

  select p.full_name, nullif(btrim(coalesce(p.crn, '')), '')
    into v_nome, v_crn_perfil
    from public.profiles p where p.id = auth.uid();
  if coalesce(v_crn, v_crn_perfil) is null then
    return jsonb_build_object('ok', false, 'error', 'Informe o seu CRN para concluir.');
  end if;

  -- Daqui em diante, só escrita.
  if v_crn is not null then
    update public.profiles set crn = v_crn where id = auth.uid();
  else
    v_crn := v_crn_perfil;
  end if;

  if c.status = 'agendada' then
    update public.appointments set
      status = 'realizada',
      reschedule_requested_at = null,
      updated_at = now()
    where id = c.id;
  end if;

  if exists (select 1 from jsonb_object_keys(r.medidas)) then
    insert into public.body_measurements
      (user_id, date, weight_kg, body_fat_pct, waist_cm, hip_cm, chest_cm,
       arm_cm, thigh_cm, calf_cm, neck_cm, measured_by, appointment_id)
    values
      (c.patient_id, (c.starts_at at time zone 'America/Sao_Paulo')::date,
       (r.medidas->>'weight_kg')::numeric, (r.medidas->>'body_fat_pct')::numeric,
       (r.medidas->>'waist_cm')::numeric, (r.medidas->>'hip_cm')::numeric,
       (r.medidas->>'chest_cm')::numeric, (r.medidas->>'arm_cm')::numeric,
       (r.medidas->>'thigh_cm')::numeric, (r.medidas->>'calf_cm')::numeric,
       (r.medidas->>'neck_cm')::numeric, auth.uid(), c.id)
    returning id into v_medida;
  end if;

  update public.consultation_records set
    status = 'concluido',
    concluded_at = now(),
    measurement_id = v_medida,
    assinatura_nome = v_nome,
    assinatura_crn = v_crn,
    updated_at = greatest(clock_timestamp(), r.updated_at + interval '1 microsecond')
  where id = r.id;

  return jsonb_build_object('ok', true, 'id', r.id);
end;
$$;

-- Rascunho ainda não é prontuário: descartar apaga a linha. Não confere a
-- situação nem o horário da consulta: um rascunho que ficou numa consulta
-- remarcada para a frente também precisa poder sair. Sem rascunho, ok: a
-- outra aba já descartou.
create or replace function public.descartar_rascunho(p_consulta uuid)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
  c public.appointments;
  r public.consultation_records;
begin
  select * into c from public.appointments where id = p_consulta for update;
  if not found or c.nutritionist_id is distinct from auth.uid() or not public.is_active_nutri_of(c.patient_id) then
    return jsonb_build_object('ok', false, 'error', 'Consulta não encontrada.');
  end if;

  select * into r from public.consultation_records where appointment_id = p_consulta for update;
  if not found then
    return jsonb_build_object('ok', true);
  end if;
  if r.status = 'concluido' then
    return jsonb_build_object('ok', false, 'error', 'O registro já foi concluído. Para corrigir, use um adendo.');
  end if;

  delete from public.consultation_records where id = r.id;
  return jsonb_build_object('ok', true);
end;
$$;

-- A correção de um registro concluído. Só o autor, e sem exigir vínculo
-- ativo: o prontuário é de quem atendeu, e corrigir depois que o paciente
-- saiu continua sendo dever dele. Nome e CRN são os do perfil agora (o
-- adendo é assinado quando é escrito); sem CRN no perfil, fica o da
-- conclusão, para o adendo não sair sem assinatura.
create or replace function public.adicionar_adendo(p_registro uuid, p_texto text)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
  r public.consultation_records;
  v_texto text := regexp_replace(coalesce(p_texto, ''), '^\s+|\s+$', '', 'g');
  v_nome text;
  v_crn text;
  v_id uuid;
begin
  select * into r from public.consultation_records where id = p_registro;
  if not found or r.nutritionist_id is distinct from auth.uid() then
    return jsonb_build_object('ok', false, 'error', 'Registro não encontrado.');
  end if;
  if r.status <> 'concluido' then
    return jsonb_build_object('ok', false, 'error', 'Só registro concluído recebe adendo.');
  end if;
  if v_texto = '' or char_length(v_texto) > 5000 then
    return jsonb_build_object('ok', false, 'error', 'Escreva o adendo (até 5.000 caracteres).');
  end if;

  select p.full_name, nullif(btrim(coalesce(p.crn, '')), '')
    into v_nome, v_crn
    from public.profiles p where p.id = auth.uid();

  insert into public.consultation_addenda (record_id, author_id, body, assinatura_nome, assinatura_crn)
  values (r.id, auth.uid(), v_texto, coalesce(v_nome, r.assinatura_nome), coalesce(v_crn, r.assinatura_crn))
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- fechar_consulta, com as duas recusas do registro
-- ---------------------------------------------------------------------------

-- Igual à da agenda, mais as duas recusas antes do update. Consulta com falta
-- ou cancelada não tem registro: deixar fechar assim um rascunho aberto
-- prenderia um texto que ninguém mais conclui (salvar e concluir recusam
-- essas situações), e com um concluído o prontuário diria que houve
-- atendimento numa consulta marcada como falta. Realizada continua livre.
create or replace function public.fechar_consulta(p_id uuid, p_desfecho text)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
  c public.appointments;
  v_registro text;
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
  if p_desfecho in ('faltou', 'cancelada') then
    select status into v_registro from public.consultation_records where appointment_id = p_id;
    if v_registro = 'rascunho' then
      return jsonb_build_object('ok', false, 'error', 'Descarte o rascunho do registro antes.');
    end if;
    if v_registro = 'concluido' then
      return jsonb_build_object('ok', false, 'error', 'Esta consulta tem registro concluído.');
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

-- Internas: só as funções acima (do mesmo dono) chamam.
revoke execute on function public.erro_das_medidas(jsonb) from public, anon, authenticated;
revoke execute on function public.erro_do_registro(text, text, text, text, jsonb) from public, anon, authenticated;

-- Só quem está logado chama, como em harden_function_grants. O create or
-- replace de fechar_consulta mantém os privilégios; repetidos aqui para a
-- migração dizer sozinha quem chama o quê.
revoke execute on function public.salvar_registro(uuid, jsonb, timestamptz) from public, anon;
revoke execute on function public.concluir_registro(uuid, timestamptz, text) from public, anon;
revoke execute on function public.descartar_rascunho(uuid) from public, anon;
revoke execute on function public.adicionar_adendo(uuid, text) from public, anon;
revoke execute on function public.fechar_consulta(uuid, text) from public, anon;
grant execute on function public.salvar_registro(uuid, jsonb, timestamptz) to authenticated;
grant execute on function public.concluir_registro(uuid, timestamptz, text) to authenticated;
grant execute on function public.descartar_rascunho(uuid) to authenticated;
grant execute on function public.adicionar_adendo(uuid, text) to authenticated;
grant execute on function public.fechar_consulta(uuid, text) to authenticated;
