-- Testes da migração de consultas, num Postgres local (ferramentas/testar-sql.sh).
-- Tudo numa transação que termina em ROLLBACK. Cada passo troca de usuário
-- como a Supabase faz: primeiro o JWT em request.jwt.claims, depois o papel
-- (nessa ordem, CLAUDE.md).

\set ON_ERROR_STOP 1
\set QUIET 1
\o /dev/null
\set n1 '00000000-0000-4000-8000-0000000000a1'
\set n2 '00000000-0000-4000-8000-0000000000a2'
\set p1 '00000000-0000-4000-8000-0000000000b1'
\set p2 '00000000-0000-4000-8000-0000000000b2'
\set p3 '00000000-0000-4000-8000-0000000000b3'

begin;

insert into auth.users (id) values (:'n1'), (:'n2'), (:'p1'), (:'p2'), (:'p3');
insert into public.profiles (id, full_name, role) values
  (:'n1', 'Nutri Um', 'nutritionist'), (:'n2', 'Nutri Dois', 'nutritionist'),
  (:'p1', 'Paciente Um', 'patient'), (:'p2', 'Paciente Dois', 'patient'),
  (:'p3', 'Paciente Três', 'patient');
insert into public.patient_links (nutritionist_id, patient_id, status, accepted_at) values
  (:'n1', :'p1', 'active', now()),
  (:'n2', :'p2', 'active', now()),
  (:'n1', :'p3', 'revoked', now());

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

-- ---------------------------------------------------------------- nutri 1
select set_config('request.jwt.claims', json_build_object('sub', :'n1', 'role', 'authenticated')::text, true) \gset x
set local role authenticated;

select public.marcar_consulta(:'p1', now() + interval '2 days', 60, 'retorno', 'presencial') as r \gset
select teste.ok(:'r', 'nutri marca consulta do paciente dele');
select :'r'::jsonb->>'id' as c1 \gset

select teste.erro(public.marcar_consulta(:'p2', now() + interval '2 days'), 'não acompanha',
  'nutri não marca para paciente de outro nutri');
select teste.erro(public.marcar_consulta(:'p3', now() + interval '2 days'), 'não acompanha',
  'nutri não marca para paciente desvinculado');
select teste.erro(public.marcar_consulta(:'p1', now() + interval '2 days', 10), 'Duração',
  'duração abaixo de 15 min recusada');
select teste.erro(public.marcar_consulta(:'p1', now() + interval '2 days', 60, 'avaliacao'), 'Tipo',
  'tipo desconhecido recusado');
select teste.erro(public.marcar_consulta(:'p1', null), 'data',
  'sem horário recusado');

do $$ begin
  insert into public.appointments (nutritionist_id, patient_id, starts_at, status)
  values (auth.uid(), '00000000-0000-4000-8000-0000000000b1', now(), 'realizada');
  raise exception 'FALHOU: insert direto passou';
exception when insufficient_privilege then raise notice 'ok: insert direto recusado';
end $$;
do $$ begin
  update public.appointments set status = 'realizada';
  raise exception 'FALHOU: update direto passou';
exception when insufficient_privilege then raise notice 'ok: update direto recusado';
end $$;

-- Consulta de ontem, lançada depois, para fechar.
select public.marcar_consulta(:'p1', now() - interval '1 day', 45, 'retorno', 'online') as r \gset
select :'r'::jsonb->>'id' as c2 \gset
select teste.erro(public.fechar_consulta(:'c1', 'realizada'), 'ainda não começou',
  'realizada antes do início recusada');
select teste.ok(public.fechar_consulta(:'c2', 'realizada'), 'fecha a de ontem como realizada');
select teste.ok(public.fechar_consulta(:'c2', 'faltou'), 'corrige o desfecho para faltou');
select teste.esperar((select status from public.appointments where id = :'c2') = 'faltou',
  'desfecho corrigido gravado');
select teste.erro(public.remarcar_consulta(:'c2', now() + interval '3 days'), 'já foi fechada',
  'não remarca consulta fechada');
select teste.erro(public.fechar_consulta(:'c2', 'sumiu'), 'Desfecho inválido', 'desfecho desconhecido recusado');
select teste.ok(public.fechar_consulta(:'c2', 'realizada'), 'volta para realizada');

-- ---------------------------------------------------------------- paciente 1
reset role;
select set_config('request.jwt.claims', json_build_object('sub', :'p1', 'role', 'authenticated')::text, true) \gset x
set local role authenticated;

select teste.esperar((select count(*) from public.appointments) = 2, 'paciente lê as consultas dele');
select teste.erro(public.marcar_consulta(:'p1', now() + interval '5 days'), 'não acompanha',
  'paciente não usa a função do nutri');

select public.pedir_consulta(now() + interval '4 days', 'online', '  prefiro de manhã  ') as r \gset
select teste.ok(:'r', 'paciente pede consulta');
select :'r'::jsonb->>'id' as pedido1 \gset
select teste.esperar(
  (select kind = 'retorno' and duration_min = 45 and nutritionist_id = :'n1'
          and patient_message = 'prefiro de manhã' and status = 'pedido'
     from public.appointments where id = :'pedido1'),
  'pedido vira retorno de 45 min com o nutri ativo e o recado aparado');
select teste.erro(public.pedir_consulta(now() + interval '6 days'), 'já tem um pedido',
  'segundo pedido aberto recusado');
select teste.erro(public.pedir_consulta(now() - interval '1 hour'), 'futuro',
  'pedido no passado recusado');

select teste.ok(public.pedir_remarcacao(:'c1', 'Pode ser quinta?'), 'pede remarcação da agendada futura');
select teste.erro(public.pedir_remarcacao(:'c1', '   '), 'qual horário',
  'remarcação sem recado recusada');
select teste.erro(public.pedir_remarcacao(:'c2', 'outro dia'), 'ainda vai acontecer',
  'remarcação de consulta passada recusada');
select teste.erro(public.cancelar_consulta(:'c2'), 'não pode mais',
  'paciente não cancela consulta que já aconteceu');

-- ---------------------------------------------------------------- paciente 2
reset role;
select set_config('request.jwt.claims', json_build_object('sub', :'p2', 'role', 'authenticated')::text, true) \gset x
set local role authenticated;

select teste.esperar((select count(*) from public.appointments) = 0, 'paciente não lê as consultas de outro');
select teste.erro(public.cancelar_consulta(:'c1'), 'não encontrada', 'paciente não cancela a de outro');
select teste.erro(public.pedir_remarcacao(:'c1', 'oi'), 'não encontrada', 'paciente não remarca a de outro');
select public.pedir_consulta(now() + interval '2 days') as r \gset
select teste.ok(:'r', 'paciente do outro nutri pede consulta');
select teste.esperar(
  (select kind = 'primeira' and duration_min = 60 and nutritionist_id = :'n2'
     from public.appointments where id = (:'r'::jsonb->>'id')::uuid),
  'sem consulta realizada, o pedido é 1ª consulta de 60 min');
select :'r'::jsonb->>'id' as pedido2 \gset

-- ---------------------------------------------------------------- paciente 3 (desvinculado)
reset role;
select set_config('request.jwt.claims', json_build_object('sub', :'p3', 'role', 'authenticated')::text, true) \gset x
set local role authenticated;
select teste.erro(public.pedir_consulta(now() + interval '2 days'), 'não tem nutricionista',
  'paciente sem vínculo ativo não pede');

-- ---------------------------------------------------------------- nutri 2
reset role;
select set_config('request.jwt.claims', json_build_object('sub', :'n2', 'role', 'authenticated')::text, true) \gset x
set local role authenticated;
select teste.esperar((select count(*) from public.appointments) = 1, 'nutri 2 só lê as dele');
select teste.erro(public.remarcar_consulta(:'c1'), 'não encontrada', 'nutri não remarca consulta de outro');
select teste.erro(public.fechar_consulta(:'c1', 'cancelada'), 'não encontrada', 'nutri não cancela consulta de outro');
select teste.ok(public.fechar_consulta(:'pedido2', 'cancelada'), 'nutri recusa o pedido (cancelada)');
select teste.esperar((select cancelled_by = 'nutri' from public.appointments where id = :'pedido2'),
  'recusa grava que foi o nutri');

-- ---------------------------------------------------------------- nutri 1 de novo
reset role;
select set_config('request.jwt.claims', json_build_object('sub', :'n1', 'role', 'authenticated')::text, true) \gset x
set local role authenticated;
select teste.esperar((select reschedule_requested_at is not null from public.appointments where id = :'c1'),
  'nutri vê o pedido de remarcação');
select teste.ok(public.remarcar_consulta(:'pedido1'), 'nutri aceita o pedido como veio');
select teste.esperar((select status = 'agendada' and kind = 'retorno' from public.appointments where id = :'pedido1'),
  'pedido aceito vira agendada sem perder o tipo');
select teste.erro(public.fechar_consulta(:'pedido1', 'realizada'), 'ainda não começou',
  'pedido aceito no futuro não fecha como realizada');
select teste.ok(public.remarcar_consulta(:'c1', now() + interval '3 days', 30), 'nutri remarca com outra hora e duração');
select teste.esperar(
  (select reschedule_requested_at is null and duration_min = 30 and mode = 'presencial'
     from public.appointments where id = :'c1'),
  'remarcar limpa o pedido de remarcação e mantém o que não veio');
select teste.erro(public.remarcar_consulta(:'c1', null, 500), 'Duração', 'remarcar com duração inválida recusado');

-- ---------------------------------------------------------------- paciente 1 cancela
reset role;
select set_config('request.jwt.claims', json_build_object('sub', :'p1', 'role', 'authenticated')::text, true) \gset x
set local role authenticated;
select teste.ok(public.cancelar_consulta(:'c1'), 'paciente cancela a agendada futura');
select teste.esperar(
  (select status = 'cancelada' and cancelled_by = 'paciente' from public.appointments where id = :'c1'),
  'cancelamento grava que foi o paciente');
select teste.erro(public.cancelar_consulta(:'c1'), 'não pode mais', 'não cancela duas vezes');

-- Um pedido cujo horário já passou sem resposta: o paciente ainda cancela.
reset role;
update public.appointments set starts_at = now() - interval '2 hours'
 where id = :'pedido1';
update public.appointments set status = 'pedido' where id = :'pedido1';
select set_config('request.jwt.claims', json_build_object('sub', :'p1', 'role', 'authenticated')::text, true) \gset x
set local role authenticated;
select teste.ok(public.cancelar_consulta(:'pedido1'), 'paciente cancela pedido vencido');

-- ---------------------------------------------------------------- cancelada não vira realizada
reset role;
select set_config('request.jwt.claims', json_build_object('sub', :'n2', 'role', 'authenticated')::text, true) \gset x
set local role authenticated;
-- pedido2 foi recusado (cancelada) e o horário pedido já passou:
reset role;
update public.appointments set starts_at = now() - interval '3 hours' where id = :'pedido2';
select set_config('request.jwt.claims', json_build_object('sub', :'n2', 'role', 'authenticated')::text, true) \gset x
set local role authenticated;
select teste.erro(public.fechar_consulta(:'pedido2', 'realizada'), 'cancelada',
  'pedido recusado não é "corrigido" para realizada');

-- ---------------------------------------------------------------- desvincular cancela o que vem pela frente
reset role;
select set_config('request.jwt.claims', json_build_object('sub', :'n1', 'role', 'authenticated')::text, true) \gset x
set local role authenticated;
select public.marcar_consulta(:'p1', now() + interval '10 days') as r \gset
select :'r'::jsonb->>'id' as futura \gset
reset role;
select set_config('request.jwt.claims', json_build_object('sub', :'p1', 'role', 'authenticated')::text, true) \gset x
set local role authenticated;
select public.pedir_consulta(now() + interval '12 days') as r \gset
select :'r'::jsonb->>'id' as pedido3 \gset

-- O paciente revoga o acesso (é o que RevogarNutri faz).
update public.patient_links set status = 'revoked' where nutritionist_id = :'n1' and patient_id = :'p1';
select teste.esperar(
  (select status = 'cancelada' and cancelled_by = 'paciente' from public.appointments where id = :'futura'),
  'revogar o nutri cancela a consulta futura com ele (pelo paciente)');
select teste.esperar(
  (select status = 'cancelada' from public.appointments where id = :'pedido3'),
  'revogar o nutri cancela o pedido aberto com ele');
select teste.esperar(
  (select status = 'realizada' from public.appointments where id = :'c2'),
  'revogar não mexe na consulta que já aconteceu');

-- Com outro nutri, o pedido antigo não bloqueia mais: o índice de um pedido
-- aberto por paciente não prende o paciente atrás de um pedido que ninguém vê.
reset role;
insert into public.patient_links (nutritionist_id, patient_id, status, accepted_at)
values (:'n2', :'p1', 'active', now());
select set_config('request.jwt.claims', json_build_object('sub', :'p1', 'role', 'authenticated')::text, true) \gset x
set local role authenticated;
select teste.ok(public.pedir_consulta(now() + interval '5 days'), 'depois de trocar de nutri, o paciente pede ao novo');
reset role;
delete from public.patient_links where nutritionist_id = :'n2' and patient_id = :'p1';
select teste.esperar(
  (select count(*) = 0 from public.appointments
    where patient_id = :'p1' and nutritionist_id = :'n2' and status = 'pedido'),
  'apagar o vínculo também cancela o pedido aberto');

-- ---------------------------------------------------------------- vínculo revogado
reset role;
update public.patient_links set status = 'revoked' where nutritionist_id = :'n1' and patient_id = :'p1';
select set_config('request.jwt.claims', json_build_object('sub', :'n1', 'role', 'authenticated')::text, true) \gset x
set local role authenticated;
select teste.esperar((select count(*) from public.appointments) = 0, 'nutri desvinculado não lê mais');
select teste.erro(public.fechar_consulta(:'c2', 'faltou'), 'não encontrada', 'nutri desvinculado não fecha');

-- ---------------------------------------------------------------- anon
reset role;
select set_config('request.jwt.claims', '{}', true) \gset x
set local role anon;
do $$ begin
  perform public.pedir_consulta(now() + interval '1 day');
  raise exception 'FALHOU: anon chamou pedir_consulta';
exception when insufficient_privilege then raise notice 'ok: anon não chama as funções';
end $$;
do $$ begin
  perform count(*) from public.appointments;
  raise exception 'FALHOU: anon leu appointments';
exception when insufficient_privilege then raise notice 'ok: anon não lê a tabela';
end $$;

reset role;
rollback;
\o
\echo 'TODOS OS TESTES PASSARAM'
