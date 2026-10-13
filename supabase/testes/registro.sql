-- Testes da migração do registro da consulta, num Postgres local
-- (ferramentas/testar-sql.sh). Tudo numa transação que termina em ROLLBACK.
-- Cada passo troca de usuário como a Supabase faz: primeiro o JWT em
-- request.jwt.claims, depois o papel (nessa ordem, CLAUDE.md).
--
-- O que se protege: o registro é do nutricionista que atendeu e só ele o lê;
-- o paciente não. Concluído, não muda mais (correção só por adendo), e a
-- avaliação física vai para body_measurements com a data da consulta em São
-- Paulo. Toda escrita passa pelas funções: as tabelas não têm política de
-- escrita.

\set ON_ERROR_STOP 1
\set QUIET 1
\o /dev/null
\set n1 '00000000-0000-4000-8000-0000000000a1'
\set n2 '00000000-0000-4000-8000-0000000000a2'
\set p1 '00000000-0000-4000-8000-0000000000b1'
\set p2 '00000000-0000-4000-8000-0000000000b2'
\set p3 '00000000-0000-4000-8000-0000000000b3'
\set c1 '00000000-0000-4000-8000-0000000000c1'
\set c2 '00000000-0000-4000-8000-0000000000c2'
\set c3 '00000000-0000-4000-8000-0000000000c3'
\set c4 '00000000-0000-4000-8000-0000000000c4'
\set c5 '00000000-0000-4000-8000-0000000000c5'
\set c6 '00000000-0000-4000-8000-0000000000c6'
\set c7 '00000000-0000-4000-8000-0000000000c7'
\set c8 '00000000-0000-4000-8000-0000000000c8'
\set c9 '00000000-0000-4000-8000-0000000000c9'

begin;

-- O banco da Supabase roda em UTC. Com a sessão em São Paulo, um
-- starts_at::date daria o dia certo por acaso e o teste da data da medida
-- não pegaria a conta errada.
set local time zone 'UTC';

insert into auth.users (id) values (:'n1'), (:'n2'), (:'p1'), (:'p2'), (:'p3');
insert into public.profiles (id, full_name, role) values
  (:'n1', 'Nutri Um', 'nutritionist'), (:'n2', 'Nutri Dois', 'nutritionist'),
  (:'p1', 'Paciente Um', 'patient'), (:'p2', 'Paciente Dois', 'patient'),
  (:'p3', 'Paciente Três', 'patient');
insert into public.patient_links (nutritionist_id, patient_id, status, accepted_at) values
  (:'n1', :'p1', 'active', now()),
  (:'n2', :'p2', 'active', now()),
  (:'n1', :'p3', 'revoked', now());

-- As consultas entram como postgres para fixar a situação e o horário.
--   c1  começou há 10 min, agendada (em andamento)
--   c2  daqui a 2 dias
--   c3  há 3 dias às 22:00 de São Paulo, agendada (sem desfecho): no UTC já é
--       01:00 do dia seguinte
--   c4  faltou;  c7 cancelada;  c8 pedido que ninguém aceitou
--   c5  começou há 2 horas (rascunho em branco, depois descartado)
--   c6  do p3, que o n1 deixou de acompanhar
--   c9  começou há 30 min (para tentar salvar depois da revogação)
insert into public.appointments (id, nutritionist_id, patient_id, starts_at, kind, mode, status, cancelled_by) values
  (:'c1', :'n1', :'p1', now() - interval '10 minutes', 'primeira', 'presencial', 'agendada', null),
  (:'c2', :'n1', :'p1', now() + interval '2 days', 'retorno', 'presencial', 'agendada', null),
  (:'c3', :'n1', :'p1',
     (((now() at time zone 'America/Sao_Paulo')::date - 3) + time '22:00') at time zone 'America/Sao_Paulo',
     'retorno', 'online', 'agendada', null),
  (:'c4', :'n1', :'p1', now() - interval '1 day', 'retorno', 'presencial', 'faltou', null),
  (:'c5', :'n1', :'p1', now() - interval '2 hours', 'retorno', 'presencial', 'agendada', null),
  (:'c6', :'n1', :'p3', now() - interval '1 day', 'retorno', 'presencial', 'realizada', null),
  (:'c7', :'n1', :'p1', now() - interval '1 day', 'retorno', 'presencial', 'cancelada', 'nutri'),
  (:'c8', :'n1', :'p1', now() - interval '1 hour', 'retorno', 'presencial', 'pedido', null),
  (:'c9', :'n1', :'p1', now() - interval '30 minutes', 'retorno', 'presencial', 'agendada', null);

create schema teste;
grant usage on schema teste to anon, authenticated;
create function teste.esperar(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FALHOU: %', msg; end if;
  raise notice 'ok: %', msg;
end $$;
create function teste.ok(r jsonb, msg text) returns void language plpgsql as $$
begin
  perform teste.esperar((r->>'ok')::boolean, msg || ' (' || coalesce(r->>'error', '') || ')');
end $$;
create function teste.erro(r jsonb, trecho text, msg text) returns void language plpgsql as $$
begin
  perform teste.esperar(
    (r->>'ok')::boolean is false and position(trecho in coalesce(r->>'error', '')) > 0,
    msg || ' (veio: ' || r::text || ')');
end $$;
grant execute on all functions in schema teste to anon, authenticated;

select teste.esperar(
  (select (starts_at at time zone 'UTC')::date <> (starts_at at time zone 'America/Sao_Paulo')::date
     from public.appointments where id = :'c3'),
  'a consulta c3 cai em dias diferentes no UTC e em São Paulo');

-- ================================================================ nutri 1: rascunho
select set_config('request.jwt.claims', json_build_object('sub', :'n1', 'role', 'authenticated')::text, true) \gset x
set local role authenticated;

select public.salvar_registro(:'c1',
  '{"anamnese": "Queixa: cansaço à tarde.", "diagnostico": "Proteína baixa no café.",
    "conduta": "Ovo ou iogurte no café.", "observar": "Sono", "medidas": {}}',
  null) as r \gset
select teste.ok(:'r', 'salvar_registro cria o rascunho na primeira chamada');
select teste.esperar(
  (:'r'::jsonb->>'id') is not null and (:'r'::jsonb->>'updated_at') is not null,
  'a criação devolve id e updated_at');
select :'r'::jsonb->>'id' as reg1, :'r'::jsonb->>'updated_at' as u1 \gset
select teste.esperar(
  (select status = 'rascunho' and nutritionist_id = :'n1' and patient_id = :'p1'
          and updated_at = :'u1'::timestamptz and concluded_at is null
     from public.consultation_records where id = :'reg1'),
  'o rascunho é do nutri e do paciente da consulta, com o updated_at devolvido');
select teste.esperar((select status = 'agendada' from public.appointments where id = :'c1'),
  'salvar não fecha a consulta');

select public.salvar_registro(:'c1',
  '{"anamnese": "Queixa: cansaço à tarde e à noite.", "conduta": "Ovo ou iogurte no café.",
    "medidas": {"weight_kg": 72.4}}',
  :'u1') as r \gset
select teste.ok(:'r', 'segunda chamada com o updated_at devolvido salva');
select :'r'::jsonb->>'updated_at' as u2 \gset
select teste.esperar(:'u2'::timestamptz > :'u1'::timestamptz,
  'cada salvamento avança o updated_at, mesmo dentro da mesma transação');
select teste.esperar(
  (select anamnese = 'Queixa: cansaço à tarde e à noite.' and diagnostico is null and observar is null
          and medidas = '{"weight_kg": 72.4}'::jsonb
     from public.consultation_records where id = :'reg1'),
  'grava o conjunto inteiro: o que não veio fica vazio (não é remendo)');

-- Concorrência: duas abas na mesma consulta.
select teste.erro(public.salvar_registro(:'c1', '{"anamnese": "da outra aba"}', :'u1'),
  'O rascunho mudou em outra aba. Recarregue a página.',
  'salvar com o updated_at antigo é recusado');
select teste.erro(public.salvar_registro(:'c1', '{"anamnese": "da outra aba"}', null),
  'O rascunho mudou em outra aba. Recarregue a página.',
  'rascunho já existe e p_visto_em nulo (duas abas começaram): recusado');
select teste.esperar(
  (select anamnese = 'Queixa: cansaço à tarde e à noite.' from public.consultation_records where id = :'reg1'),
  'a gravação recusada não mexeu no rascunho');

-- Consultas sem direito a registro.
select teste.erro(public.salvar_registro(:'c2', '{"anamnese": "x"}', null),
  'A consulta ainda não começou.', 'consulta futura não tem registro');
select teste.erro(public.salvar_registro(:'c8', '{"anamnese": "x"}', null),
  'A consulta ainda não começou.', 'pedido que ninguém aceitou não tem registro');
select teste.erro(public.salvar_registro(:'c4', '{"anamnese": "x"}', null),
  'Consulta com falta ou cancelada não tem registro.', 'consulta com falta não tem registro');
select teste.erro(public.salvar_registro(:'c7', '{"anamnese": "x"}', null),
  'Consulta com falta ou cancelada não tem registro.', 'consulta cancelada não tem registro');
select teste.erro(public.salvar_registro(:'c6', '{"anamnese": "x"}', null),
  'Consulta não encontrada.', 'n1 não salva em consulta do p3 (vínculo revogado)');
select teste.erro(public.salvar_registro(gen_random_uuid(), '{"anamnese": "x"}', null),
  'Consulta não encontrada.', 'consulta inexistente');

-- Limites de texto.
select teste.erro(public.salvar_registro(:'c1', jsonb_build_object('anamnese', repeat('a', 20001)), :'u2'),
  'Texto longo demais em Anamnese.', 'anamnese com 20.001 caracteres recusada');
select teste.erro(public.salvar_registro(:'c1', jsonb_build_object('diagnostico', repeat('a', 5001)), :'u2'),
  'Texto longo demais em Diagnóstico.', 'diagnóstico com 5.001 caracteres recusado');
select teste.erro(public.salvar_registro(:'c1', jsonb_build_object('conduta', repeat('a', 10001)), :'u2'),
  'Texto longo demais em Conduta.', 'conduta com 10.001 caracteres recusada');
select teste.erro(public.salvar_registro(:'c1', jsonb_build_object('observar', repeat('a', 2001)), :'u2'),
  'Texto longo demais em Observar no retorno.', 'observar com 2.001 caracteres recusado');
select public.salvar_registro(:'c1', jsonb_build_object(
    'anamnese', repeat('a', 20000), 'diagnostico', repeat('d', 5000),
    'conduta', repeat('c', 10000), 'observar', repeat('o', 2000)), :'u2') as r \gset
select teste.ok(:'r', 'textos no limite cabem');
select :'r'::jsonb->>'updated_at' as u3 \gset

-- Medidas: valor ruim não fica parado no rascunho.
select teste.erro(public.salvar_registro(:'c1', '{"medidas": {"weight_kg": 718}}', :'u3'),
  'Peso fora da faixa (20 a 400 kg).', 'salvar com peso 718 recusado');
select teste.erro(public.salvar_registro(:'c1', '{"medidas": {"body_fat_pct": 80}}', :'u3'),
  '% de gordura fora da faixa (2 a 75%).', 'gordura de 80% recusada');
select teste.erro(public.salvar_registro(:'c1', '{"medidas": {"waist_cm": 29.9}}', :'u3'),
  'Cintura fora da faixa (30 a 250 cm).', 'cintura abaixo de 30 cm recusada');
select teste.erro(public.salvar_registro(:'c1', '{"medidas": {"thigh_cm": 121}}', :'u3'),
  'Coxa fora da faixa (20 a 120 cm).', 'coxa acima de 120 cm recusada');
select teste.erro(public.salvar_registro(:'c1', '{"medidas": {"neck_cm": 9}}', :'u3'),
  'Pescoço fora da faixa (10 a 80 cm).', 'pescoço abaixo de 10 cm recusado');
select teste.erro(public.salvar_registro(:'c1', '{"medidas": {"weight_kg": "72"}}', :'u3'),
  'Peso fora da faixa (20 a 400 kg).', 'número em texto não é número');
select teste.erro(public.salvar_registro(:'c1', '{"medidas": {"altura_cm": 170}}', :'u3'),
  'Medida desconhecida.', 'chave que não é coluna de body_measurements recusada');
select teste.erro(public.salvar_registro(:'c1', '{"medidas": [72]}', :'u3'),
  'Medida desconhecida.', 'medidas que não são objeto recusadas');
select public.salvar_registro(:'c1',
  '{"medidas": {"weight_kg": 20, "body_fat_pct": 75, "waist_cm": 250, "hip_cm": 30, "chest_cm": 30,
                "arm_cm": 80, "thigh_cm": 20, "calf_cm": 10, "neck_cm": 80}}',
  :'u3') as r \gset
select teste.ok(:'r', 'as bordas das faixas valem');
select :'r'::jsonb->>'updated_at' as u4 \gset
select public.salvar_registro(:'c1', '{"medidas": {"weight_kg": 400, "waist_cm": null}}', :'u4') as r \gset
select teste.ok(:'r', 'medida nula é medida não tirada');
select :'r'::jsonb->>'updated_at' as u4 \gset
select teste.esperar(
  (select medidas = '{"weight_kg": 400}'::jsonb from public.consultation_records where id = :'reg1'),
  'a medida nula não fica gravada');

-- O rascunho de c1 que vai ser concluído: sem medidas.
select public.salvar_registro(:'c1',
  '{"anamnese": "Queixa: cansaço à tarde.", "conduta": "Ovo ou iogurte no café.",
    "observar": "Sono e fome à noite.", "medidas": {}}',
  :'u4') as r \gset
select teste.ok(:'r', 'rascunho final do c1, sem medidas');
select :'r'::jsonb->>'updated_at' as u5 \gset

-- O de c3, com medidas; e um em branco em c5.
select public.salvar_registro(:'c3',
  '{"anamnese": "Retorno: perdeu 1 kg.", "medidas": {"weight_kg": 71.8, "waist_cm": 86, "body_fat_pct": 27.5}}',
  null) as r \gset
select teste.ok(:'r', 'rascunho do c3 (sem desfecho) com medidas');
select :'r'::jsonb->>'id' as reg3, :'r'::jsonb->>'updated_at' as u3c \gset
select public.salvar_registro(:'c5',
  '{"anamnese": "   ", "diagnostico": "\n\t", "conduta": null, "observar": "", "medidas": {}}',
  null) as r \gset
select teste.ok(:'r', 'rascunho só com espaços salva (é rascunho)');
select :'r'::jsonb->>'updated_at' as u5c \gset

-- ================================================================ outros não mexem
reset role;
select set_config('request.jwt.claims', json_build_object('sub', :'n2', 'role', 'authenticated')::text, true) \gset x
set local role authenticated;
select teste.erro(public.salvar_registro(:'c1', '{"anamnese": "x"}', :'u5'),
  'Consulta não encontrada.', 'n2 não salva no registro de consulta do n1');
select teste.erro(public.concluir_registro(:'c1', :'u5', 'CRN-1 1'),
  'Consulta não encontrada.', 'n2 não conclui registro do n1');
select teste.erro(public.descartar_rascunho(:'c5'),
  'Consulta não encontrada.', 'n2 não descarta rascunho do n1');

reset role;
select set_config('request.jwt.claims', json_build_object('sub', :'p1', 'role', 'authenticated')::text, true) \gset x
set local role authenticated;
select teste.erro(public.salvar_registro(:'c1', '{"anamnese": "x"}', :'u5'),
  'Consulta não encontrada.', 'o paciente não escreve no registro da própria consulta');
select teste.erro(public.descartar_rascunho(:'c5'),
  'Consulta não encontrada.', 'o paciente não descarta o rascunho');

-- ================================================================ nutri 1: concluir
reset role;
select set_config('request.jwt.claims', json_build_object('sub', :'n1', 'role', 'authenticated')::text, true) \gset x
set local role authenticated;

select teste.erro(public.concluir_registro(:'c1', :'u5'),
  'Informe o seu CRN para concluir.', 'concluir sem CRN no perfil e sem p_crn');
select teste.erro(public.concluir_registro(:'c1', :'u5', '   '),
  'Informe o seu CRN para concluir.', 'CRN em branco não conta');
select teste.erro(public.concluir_registro(:'c1', :'u5', repeat('9', 31)),
  'CRN longo demais', 'CRN com mais de 30 caracteres recusado');
select teste.erro(public.concluir_registro(:'c1', :'u4', 'CRN-3 12345'),
  'O rascunho mudou em outra aba. Recarregue a página.', 'concluir com o updated_at antigo');
select teste.erro(public.concluir_registro(:'c1', null, 'CRN-3 12345'),
  'O rascunho mudou em outra aba. Recarregue a página.', 'concluir com p_visto_em nulo');
select teste.esperar(
  (select crn is null from public.profiles where id = :'n1')
  and (select status = 'rascunho' from public.consultation_records where id = :'reg1'),
  'conclusão recusada não grava o CRN nem trava o registro');

select public.concluir_registro(:'c1', :'u5', '  CRN-3 12345 ') as r \gset
select teste.ok(:'r', 'concluir com p_crn');
select teste.esperar((:'r'::jsonb->>'id')::uuid = :'reg1', 'concluir devolve o id do registro');
select teste.esperar((select crn = 'CRN-3 12345' from public.profiles where id = :'n1'),
  'o CRN informado fica gravado no perfil, aparado');
select teste.esperar(
  (select status = 'concluido' and concluded_at is not null
          and assinatura_nome = 'Nutri Um' and assinatura_crn = 'CRN-3 12345'
          and measurement_id is null
     from public.consultation_records where id = :'reg1'),
  'registro concluído, com nome e CRN copiados');
select teste.esperar((select status = 'realizada' from public.appointments where id = :'c1'),
  'concluir marca a consulta agendada como realizada');
reset role;
select teste.esperar(
  (select count(*) = 0 from public.body_measurements where appointment_id = :'c1' or user_id = :'p1'),
  'concluir sem medidas não cria linha em body_measurements');
set local role authenticated;

-- Concluído não muda mais.
select teste.erro(public.salvar_registro(:'c1', '{"anamnese": "reescrito"}', :'u5'),
  'O registro já foi concluído. Para corrigir, use um adendo.', 'salvar depois de concluído recusado');
select teste.erro(public.salvar_registro(:'c1', '{"anamnese": "reescrito"}', null),
  'O registro já foi concluído. Para corrigir, use um adendo.', 'salvar depois de concluído, sem p_visto_em');
select teste.erro(public.descartar_rascunho(:'c1'),
  'O registro já foi concluído. Para corrigir, use um adendo.', 'descartar depois de concluído recusado');
select teste.erro(public.concluir_registro(:'c1', :'u5', 'CRN-3 12345'),
  'O registro já foi concluído. Para corrigir, use um adendo.', 'não conclui duas vezes');
select teste.erro(public.fechar_consulta(:'c1', 'cancelada'),
  'Esta consulta tem registro concluído.', 'consulta com registro concluído não vira cancelada');
select teste.erro(public.fechar_consulta(:'c1', 'faltou'),
  'Esta consulta tem registro concluído.', 'consulta com registro concluído não vira falta');
select teste.esperar(
  (select anamnese = 'Queixa: cansaço à tarde.' and status = 'concluido'
     from public.consultation_records where id = :'reg1')
  and (select status = 'realizada' from public.appointments where id = :'c1'),
  'o registro concluído e a consulta ficaram como estavam');

-- c3: o servidor confere de novo as medidas na conclusão. Um 718 que chegou
-- ao rascunho por fora da função (como postgres) não é publicado.
select teste.erro(public.adicionar_adendo(:'reg3', 'Nota.'),
  'Só registro concluído recebe adendo.', 'adendo em rascunho recusado');
reset role;
update public.consultation_records set medidas = '{"weight_kg": 718, "waist_cm": 86}' where id = :'reg3';
set local role authenticated;
select teste.erro(public.concluir_registro(:'c3', :'u3c'),
  'Peso fora da faixa (20 a 400 kg).', 'concluir com peso 718 recusado');
reset role;
select teste.esperar(
  (select status = 'rascunho' from public.consultation_records where id = :'reg3')
  and (select status = 'agendada' from public.appointments where id = :'c3')
  and (select count(*) = 0 from public.body_measurements where appointment_id = :'c3'),
  'conclusão recusada não publica medida nem fecha a consulta');
set local role authenticated;

select public.salvar_registro(:'c3',
  '{"anamnese": "Retorno: perdeu 1 kg.", "medidas": {"weight_kg": 71.8, "waist_cm": 86, "body_fat_pct": 27.5}}',
  :'u3c') as r \gset
select :'r'::jsonb->>'updated_at' as u3c \gset
select public.concluir_registro(:'c3', :'u3c') as r \gset
select teste.ok(:'r', 'concluir o c3 com o CRN que já está no perfil');
reset role;
select teste.esperar((select status = 'realizada' from public.appointments where id = :'c3'),
  'consulta sem desfecho vira realizada ao concluir');
select teste.esperar(
  (select count(*) = 1 from public.body_measurements where appointment_id = :'c3'),
  'concluir com medidas publica uma linha em body_measurements');
select teste.esperar(
  (select m.date = (now() at time zone 'America/Sao_Paulo')::date - 3
     from public.body_measurements m where m.appointment_id = :'c3'),
  'a medida tem a data da consulta em São Paulo');
select teste.esperar(
  (select m.date <> (a.starts_at at time zone 'UTC')::date and m.date <> current_date
     from public.body_measurements m join public.appointments a on a.id = m.appointment_id
    where m.appointment_id = :'c3'),
  'a data da medida não é a do UTC nem a de hoje');
select teste.esperar(
  (select m.user_id = :'p1' and m.measured_by = :'n1' and m.weight_kg = 71.8 and m.waist_cm = 86
          and m.body_fat_pct = 27.5 and m.hip_cm is null
     from public.body_measurements m where m.appointment_id = :'c3'),
  'a medida é do paciente, assinada pelo nutri, com os valores do rascunho');
select teste.esperar(
  (select r.measurement_id = m.id and r.status = 'concluido' and r.assinatura_crn = 'CRN-3 12345'
     from public.consultation_records r join public.body_measurements m on m.appointment_id = r.appointment_id
    where r.id = :'reg3'),
  'consultation_records.measurement_id aponta para a medida publicada');
set local role authenticated;

-- c5: nada preenchido não conclui; rascunho prende o desfecho de falta.
select teste.erro(public.concluir_registro(:'c5', :'u5c'),
  'Preencha ao menos uma parte do registro.', 'concluir sem nenhuma parte recusado');
select teste.erro(public.fechar_consulta(:'c5', 'faltou'),
  'Descarte o rascunho do registro antes.', 'falta com rascunho aberto recusada');
select teste.erro(public.fechar_consulta(:'c5', 'cancelada'),
  'Descarte o rascunho do registro antes.', 'cancelar com rascunho aberto recusado');
select teste.ok(public.descartar_rascunho(:'c5'), 'descarta o rascunho');
reset role;
select teste.esperar((select count(*) = 0 from public.consultation_records where appointment_id = :'c5'),
  'o rascunho descartado some');
set local role authenticated;
select teste.ok(public.descartar_rascunho(:'c5'), 'descartar sem rascunho não é erro (duas abas)');
-- A aba que ficou aberta com o rascunho descartado ainda tem o updated_at
-- dele: o salvamento automático dela não pode trazer o rascunho de volta.
select teste.erro(public.salvar_registro(:'c5', '{"anamnese": "da aba velha"}', :'u5c'),
  'O rascunho mudou em outra aba. Recarregue a página.',
  'salvar com o updated_at de um rascunho descartado é recusado');
select teste.erro(public.concluir_registro(:'c5', :'u5c', 'CRN-3 12345'),
  'O rascunho mudou em outra aba. Recarregue a página.',
  'concluir com o updated_at de um rascunho descartado é recusado');
reset role;
select teste.esperar((select count(*) = 0 from public.consultation_records where appointment_id = :'c5'),
  'a aba velha não recriou o rascunho descartado');
set local role authenticated;
select teste.erro(public.concluir_registro(:'c5', null),
  'Preencha ao menos uma parte do registro.', 'concluir sem rascunho nenhum recusado');
select public.salvar_registro(:'c5', '{"anamnese": "Começando de novo."}', null) as r \gset
select teste.ok(:'r', 'depois do descarte, salvar com p_visto_em nulo cria normalmente');
reset role;
select teste.esperar(
  (select anamnese = 'Começando de novo.' and status = 'rascunho'
     from public.consultation_records where appointment_id = :'c5'),
  'o rascunho novo ficou gravado');
set local role authenticated;
select teste.ok(public.descartar_rascunho(:'c5'), 'descarta o rascunho novo');
select teste.ok(public.fechar_consulta(:'c5', 'faltou'), 'sem o rascunho, a falta passa');

-- ================================================================ adendo
select teste.erro(public.adicionar_adendo(:'reg1', '   '),
  'Escreva o adendo (até 5.000 caracteres).', 'adendo vazio recusado');
select teste.erro(public.adicionar_adendo(:'reg1', null),
  'Escreva o adendo (até 5.000 caracteres).', 'adendo nulo recusado');
select teste.erro(public.adicionar_adendo(:'reg1', repeat('a', 5001)),
  'Escreva o adendo (até 5.000 caracteres).', 'adendo com 5.001 caracteres recusado');
select teste.erro(public.adicionar_adendo(gen_random_uuid(), 'x'),
  'Registro não encontrado.', 'adendo em registro inexistente');
select public.adicionar_adendo(:'reg1', '  Corrijo: a queixa é à noite.  ') as r \gset
select teste.ok(:'r', 'adendo em registro concluído');
select :'r'::jsonb->>'id' as ad1 \gset
select teste.esperar(
  (select body = 'Corrijo: a queixa é à noite.' and author_id = :'n1' and record_id = :'reg1'
          and assinatura_nome = 'Nutri Um' and assinatura_crn = 'CRN-3 12345'
     from public.consultation_addenda where id = :'ad1'),
  'o adendo grava o texto aparado com nome e CRN copiados');
select teste.ok(public.adicionar_adendo(:'reg1', repeat('a', 5000)), 'adendo de 5.000 caracteres cabe');

-- O perfil muda depois; o prontuário não.
reset role;
update public.profiles set full_name = 'Nutri Um Silva', crn = 'CRN-3 99999' where id = :'n1';
set local role authenticated;
select teste.esperar(
  (select assinatura_nome = 'Nutri Um' and assinatura_crn = 'CRN-3 12345'
     from public.consultation_records where id = :'reg1')
  and (select assinatura_nome = 'Nutri Um' and assinatura_crn = 'CRN-3 12345'
     from public.consultation_addenda where id = :'ad1'),
  'mudar o perfil não reescreve a assinatura do registro nem a do adendo');

-- ================================================================ quem lê
reset role;
select set_config('request.jwt.claims', json_build_object('sub', :'n2', 'role', 'authenticated')::text, true) \gset x
set local role authenticated;
select teste.erro(public.adicionar_adendo(:'reg1', 'Intromissão.'),
  'Registro não encontrado.', 'n2 não adenda registro do n1');
select teste.esperar(
  (select count(*) from public.consultation_records) = 0
  and (select count(*) from public.consultation_addenda) = 0,
  'n2 não lê registro nem adendo do n1');

reset role;
select set_config('request.jwt.claims', json_build_object('sub', :'p1', 'role', 'authenticated')::text, true) \gset x
set local role authenticated;
select teste.esperar(
  (select count(*) from public.consultation_records) = 0
  and (select count(*) from public.consultation_addenda) = 0,
  'o paciente não lê o registro nem o adendo da própria consulta');
select teste.esperar(
  (select count(*) = 1 from public.body_measurements where appointment_id = :'c3'),
  'o paciente vê a medida que o nutri publicou');
select teste.erro(public.adicionar_adendo(:'reg1', 'Discordo.'),
  'Registro não encontrado.', 'o paciente não adenda');

reset role;
select set_config('request.jwt.claims', json_build_object('sub', :'n1', 'role', 'authenticated')::text, true) \gset x
set local role authenticated;
select teste.esperar(
  (select count(*) from public.consultation_records) = 2
  and (select count(*) from public.consultation_addenda) = 2,
  'n1 lê os registros e adendos que escreveu');

-- Escrita direta, mesmo do autor: recusada (só pelas funções).
do $$ begin
  insert into public.consultation_records (appointment_id, nutritionist_id, patient_id, status)
  values ('00000000-0000-4000-8000-0000000000c9', auth.uid(), '00000000-0000-4000-8000-0000000000b1', 'rascunho');
  raise exception 'FALHOU: insert direto em consultation_records passou';
exception when insufficient_privilege then raise notice 'ok: insert direto em consultation_records recusado';
end $$;
do $$ begin
  update public.consultation_records set anamnese = 'reescrito';
  raise exception 'FALHOU: update direto em consultation_records passou';
exception when insufficient_privilege then raise notice 'ok: update direto em consultation_records recusado';
end $$;
do $$ begin
  delete from public.consultation_records;
  raise exception 'FALHOU: delete direto em consultation_records passou';
exception when insufficient_privilege then raise notice 'ok: delete direto em consultation_records recusado';
end $$;
do $$ begin
  insert into public.consultation_addenda (record_id, author_id, body)
  select id, auth.uid(), 'por fora' from public.consultation_records limit 1;
  raise exception 'FALHOU: insert direto em consultation_addenda passou';
exception when insufficient_privilege then raise notice 'ok: insert direto em consultation_addenda recusado';
end $$;
do $$ begin
  update public.consultation_addenda set body = 'reescrito';
  raise exception 'FALHOU: update direto em consultation_addenda passou';
exception when insufficient_privilege then raise notice 'ok: update direto em consultation_addenda recusado';
end $$;
do $$ begin
  delete from public.consultation_addenda;
  raise exception 'FALHOU: delete direto em consultation_addenda passou';
exception when insufficient_privilege then raise notice 'ok: delete direto em consultation_addenda recusado';
end $$;
do $$ begin
  perform public.erro_das_medidas('{}'::jsonb);
  raise exception 'FALHOU: authenticated chamou erro_das_medidas';
exception when insufficient_privilege then raise notice 'ok: erro_das_medidas é interna (authenticated não chama)';
end $$;

-- ================================================================ vínculo revogado
reset role;
update public.patient_links set status = 'revoked' where nutritionist_id = :'n1' and patient_id = :'p1';
set local role authenticated;
select teste.esperar(
  (select count(*) from public.consultation_records where patient_id = :'p1') = 2
  and (select count(*) from public.consultation_addenda) = 2,
  'vínculo revogado: n1 ainda lê os registros e adendos que escreveu');
select teste.erro(public.salvar_registro(:'c9', '{"anamnese": "x"}', null),
  'Consulta não encontrada.', 'vínculo revogado: n1 não salva mais');
select teste.erro(public.descartar_rascunho(:'c9'),
  'Consulta não encontrada.', 'vínculo revogado: n1 não descarta');
select teste.erro(public.concluir_registro(:'c9', null, 'CRN-3 12345'),
  'Consulta não encontrada.', 'vínculo revogado: n1 não conclui');
-- O prontuário é de quem atendeu: o autor ainda corrige com adendo, e a
-- assinatura sai do perfil de agora.
select public.adicionar_adendo(:'reg1', 'Paciente encerrou o acompanhamento.') as r \gset
select teste.ok(:'r', 'vínculo revogado: o autor ainda adenda o próprio registro');
select teste.esperar(
  (select assinatura_nome = 'Nutri Um Silva' and assinatura_crn = 'CRN-3 99999'
     from public.consultation_addenda where id = (:'r'::jsonb->>'id')::uuid),
  'o adendo novo copia o nome e o CRN do perfil no momento');

-- ================================================================ anon
reset role;
select set_config('request.jwt.claims', '{}', true) \gset x
set local role anon;
do $$ begin
  perform public.salvar_registro('00000000-0000-4000-8000-0000000000c9', '{}'::jsonb, null);
  raise exception 'FALHOU: anon chamou salvar_registro';
exception when insufficient_privilege then raise notice 'ok: anon não chama salvar_registro';
end $$;
do $$ begin
  perform public.concluir_registro('00000000-0000-4000-8000-0000000000c9', null, 'CRN-3 1');
  raise exception 'FALHOU: anon chamou concluir_registro';
exception when insufficient_privilege then raise notice 'ok: anon não chama concluir_registro';
end $$;
do $$ begin
  perform public.descartar_rascunho('00000000-0000-4000-8000-0000000000c9');
  raise exception 'FALHOU: anon chamou descartar_rascunho';
exception when insufficient_privilege then raise notice 'ok: anon não chama descartar_rascunho';
end $$;
do $$ begin
  perform public.adicionar_adendo(gen_random_uuid(), 'x');
  raise exception 'FALHOU: anon chamou adicionar_adendo';
exception when insufficient_privilege then raise notice 'ok: anon não chama adicionar_adendo';
end $$;
do $$ begin
  perform count(*) from public.consultation_records;
  raise exception 'FALHOU: anon leu consultation_records';
exception when insufficient_privilege then raise notice 'ok: anon não lê consultation_records';
end $$;
do $$ begin
  perform count(*) from public.consultation_addenda;
  raise exception 'FALHOU: anon leu consultation_addenda';
exception when insufficient_privilege then raise notice 'ok: anon não lê consultation_addenda';
end $$;

reset role;
rollback;
\o
\echo 'TODOS OS TESTES PASSARAM'
