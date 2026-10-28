-- Testes da migração dos lembretes das refeições, num Postgres local
-- (ferramentas/testar-sql.sh). Tudo numa transação que termina em ROLLBACK.
-- Cada passo troca de usuário como a Supabase faz: primeiro o JWT em
-- request.jwt.claims, depois o papel (nessa ordem, CLAUDE.md).
--
-- O que se protege: a resposta "comi"/"não comi" (meal_checks) é do paciente,
-- que só liga a ela uma refeição DELE; a nutricionista com vínculo ativo lê; o
-- que já foi enviado (meal_reminders_sent) só a função de envio vê. E a conta
-- do envio: quem recebe, quando, e que ninguém recebe duas vezes.
--
-- As datas do envio são de 2030, longe de hoje: a chamada de verdade
-- (refeicoes_devidas, com now()), no fim, marca como enviado o que estiver no
-- horário AGORA, e isso não pode esbarrar nas datas dos testes de antes.

\set ON_ERROR_STOP 1
\set QUIET 1
\o /dev/null
\set n1 '00000000-0000-4000-8000-0000000000a1'
\set n2 '00000000-0000-4000-8000-0000000000a2'
\set p1 '00000000-0000-4000-8000-0000000000b1'
\set p2 '00000000-0000-4000-8000-0000000000b2'
\set p3 '00000000-0000-4000-8000-0000000000b3'
\set p4 '00000000-0000-4000-8000-0000000000b4'
\set p5 '00000000-0000-4000-8000-0000000000b5'
\set p6 '00000000-0000-4000-8000-0000000000b6'

begin;

insert into auth.users (id) values (:'n1'), (:'n2'), (:'p1'), (:'p2'), (:'p3'), (:'p4'), (:'p5'), (:'p6');
insert into public.profiles (id, full_name, role, meal_reminders_enabled) values
  (:'n1', 'Nutri Um', 'nutritionist', false), (:'n2', 'Nutri Dois', 'nutritionist', false),
  (:'p1', 'Paciente Um', 'patient', true), (:'p2', 'Paciente Dois', 'patient', true),
  (:'p3', 'Paciente Três', 'patient', true), (:'p4', 'Paciente Quatro', 'patient', true),
  (:'p5', 'Paciente Cinco', 'patient', false), (:'p6', 'Paciente Seis', 'patient', true);
insert into public.patient_links (nutritionist_id, patient_id, status, accepted_at) values
  (:'n1', :'p1', 'active', now()), (:'n2', :'p2', 'active', now()),
  (:'n1', :'p3', 'revoked', now()), (:'n1', :'p4', 'active', now()),
  (:'n1', :'p5', 'active', now()), (:'n1', :'p6', 'active', now());
insert into public.app_config (key, value) values ('cron_secret', 'segredo-de-teste');

create schema teste;
grant usage on schema teste to anon, authenticated;
create function teste.esperar(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FALHOU: %', msg; end if;
  raise notice 'ok: %', msg;
end $$;
grant execute on all functions in schema teste to anon, authenticated;

-- Os cardápios. O p1 tem um plano antigo, ainda ativo, com Jantar: vale só o
-- mais novo, como na Dieta. O p4 não tem cardápio.
insert into public.meal_plans (id, patient_id, nutritionist_id, created_at) values
  ('00000000-0000-4000-8000-00000000c1a0', :'p1', :'n1', now() - interval '30 days'),
  ('00000000-0000-4000-8000-00000000c1a1', :'p1', :'n1', now()),
  ('00000000-0000-4000-8000-00000000c2a1', :'p2', :'n2', now()),
  ('00000000-0000-4000-8000-00000000c3a1', :'p3', :'n1', now()),
  ('00000000-0000-4000-8000-00000000c5a1', :'p5', :'n1', now()),
  ('00000000-0000-4000-8000-00000000c6a1', :'p6', :'n1', now());
insert into public.meal_plan_items (meal_plan_id, user_id, meal_type, position, description) values
  ('00000000-0000-4000-8000-00000000c1a0', :'p1', 'Jantar', 1, 'Sopa'),
  ('00000000-0000-4000-8000-00000000c1a1', :'p1', 'Café da manhã', 2, 'Iogurte'),
  ('00000000-0000-4000-8000-00000000c1a1', :'p1', 'Café da manhã', 1, 'Ovos'),
  ('00000000-0000-4000-8000-00000000c1a1', :'p1', 'Almoço', 1, 'Arroz e feijão'),
  ('00000000-0000-4000-8000-00000000c1a1', :'p1', 'Ceia', 1, 'Chá'),
  ('00000000-0000-4000-8000-00000000c1a1', :'p1', 'Pré-treino', 1, 'Banana'),
  ('00000000-0000-4000-8000-00000000c2a1', :'p2', 'Almoço', 1, 'Frango'),
  ('00000000-0000-4000-8000-00000000c3a1', :'p3', 'Almoço', 1, 'Peixe'),
  ('00000000-0000-4000-8000-00000000c5a1', :'p5', 'Almoço', 1, 'Massa'),
  ('00000000-0000-4000-8000-00000000c6a1', :'p6', 'Almoço', 1, 'Salada');
-- Duas inscrições do p1 (celular e computador); o p6 não tem nenhuma.
insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values
  (:'p1', 'https://push.exemplo/p1-celular', 'k', 'a'), (:'p1', 'https://push.exemplo/p1-pc', 'k', 'a'),
  (:'p2', 'https://push.exemplo/p2', 'k', 'a'), (:'p3', 'https://push.exemplo/p3', 'k', 'a'),
  (:'p4', 'https://push.exemplo/p4', 'k', 'a'), (:'p5', 'https://push.exemplo/p5', 'k', 'a');

-- Para os testes da RLS: uma refeição do p1 e uma do p2 em 2030-01-10, e uma
-- resposta do p2 e uma do p3, gravadas como postgres.
insert into public.meals (user_id, date, meal_type, description) values
  (:'p1', '2030-01-10', 'Almoço', 'Arroz e feijão') returning id as m1 \gset
insert into public.meals (user_id, date, meal_type, description) values
  (:'p2', '2030-01-10', 'Almoço', 'Frango') returning id as m2 \gset
insert into public.meal_checks (user_id, date, meal_type, status) values
  (:'p2', '2030-01-10', 'Almoço', 'done'), (:'p3', '2030-01-10', 'Almoço', 'skipped');
-- O id da refeição do p2 vai para dentro dos blocos `do` por aqui: a variável
-- do psql não entra entre $$.
select set_config('teste.m2', :'m2', false) \gset x

-- ---------------------------------------------------------------- anon
select set_config('request.jwt.claims', '{}', true) \gset x
set local role anon;
do $$ begin
  perform count(*) from public.meal_checks;
  raise exception 'FALHOU: anon leu meal_checks';
exception when insufficient_privilege then raise notice 'ok: anon não lê as respostas';
end $$;
do $$ begin
  insert into public.meal_checks (user_id, date, meal_type, status)
  values ('00000000-0000-4000-8000-0000000000b1', '2030-01-10', 'Jantar', 'done');
  raise exception 'FALHOU: anon gravou uma resposta';
exception when insufficient_privilege then raise notice 'ok: anon não grava resposta';
end $$;

-- ---------------------------------------------------------------- paciente 1
reset role;
select set_config('request.jwt.claims', json_build_object('sub', :'p1', 'role', 'authenticated')::text, true) \gset x
set local role authenticated;

insert into public.meal_checks (user_id, date, meal_type, status)
  values (:'p1', '2030-01-10', 'Café da manhã', 'done');
insert into public.meal_checks (user_id, date, meal_type, status, meal_id)
  values (:'p1', '2030-01-10', 'Almoço', 'done', :'m1') returning id as ck1 \gset
select teste.esperar(
  (select count(*) from public.meal_checks where user_id = :'p1') = 2,
  'paciente grava a resposta sem refeição e com uma refeição dele');

do $$ begin
  insert into public.meal_checks (user_id, date, meal_type, status, meal_id)
  values (auth.uid(), '2030-01-10', 'Jantar', 'done', current_setting('teste.m2')::uuid);
  raise exception 'FALHOU: paciente ligou a resposta a uma refeição de outro';
exception when insufficient_privilege then raise notice 'ok: refeição de outro paciente recusada no insert';
end $$;
do $$ begin
  update public.meal_checks set meal_id = current_setting('teste.m2')::uuid
   where user_id = auth.uid() and meal_type = 'Café da manhã';
  raise exception 'FALHOU: paciente trocou a refeição da resposta por uma de outro';
exception when insufficient_privilege then raise notice 'ok: refeição de outro paciente recusada no update';
end $$;
do $$ begin
  insert into public.meal_checks (user_id, date, meal_type, status)
  values ('00000000-0000-4000-8000-0000000000b2', '2030-01-10', 'Jantar', 'done');
  raise exception 'FALHOU: paciente gravou uma resposta em nome de outro';
exception when insufficient_privilege then raise notice 'ok: paciente não grava resposta de outro';
end $$;
select teste.esperar(
  (select count(*) from public.meal_checks where user_id <> :'p1') = 0,
  'paciente só lê as respostas dele');
do $$ begin
  insert into public.meal_checks (user_id, date, meal_type, status, meal_id)
  values (auth.uid(), '2030-01-11', 'Almoço', 'skipped',
          (select id from public.meals where user_id = auth.uid() limit 1));
  raise exception 'FALHOU: "não comi" com refeição ligada passou';
exception when check_violation then raise notice 'ok: "não comi" não leva refeição';
end $$;
do $$ begin
  insert into public.meal_checks (user_id, date, meal_type, status)
  values (auth.uid(), '2030-01-10', 'Almoço', 'skipped');
  raise exception 'FALHOU: duas respostas para a mesma refeição no mesmo dia';
exception when unique_violation then raise notice 'ok: uma resposta por refeição e por dia';
end $$;

-- Excluir a refeição ligada desfaz a resposta; a resposta sem refeição fica.
delete from public.meals where id = :'m1';
select teste.esperar(
  (select count(*) from public.meal_checks where id = :'ck1') = 0
    and (select count(*) from public.meal_checks where user_id = :'p1') = 1,
  'excluir a refeição apaga a resposta ligada a ela, e só ela');

do $$ begin
  perform count(*) from public.meal_reminders_sent;
  raise exception 'FALHOU: paciente leu meal_reminders_sent';
exception when insufficient_privilege then raise notice 'ok: paciente não lê o que foi enviado';
end $$;
do $$ begin
  insert into public.meal_reminders_sent (user_id, date, meal_type) values (auth.uid(), '2030-01-10', 'Almoço');
  raise exception 'FALHOU: paciente gravou em meal_reminders_sent';
exception when insufficient_privilege then raise notice 'ok: paciente não grava o que foi enviado';
end $$;
do $$ begin
  perform * from public.refeicoes_devidas_em(timestamp '2030-01-10 12:40');
  raise exception 'FALHOU: paciente chamou refeicoes_devidas_em';
exception when insufficient_privilege then raise notice 'ok: paciente não chama refeicoes_devidas_em';
end $$;

-- ---------------------------------------------------------------- nutris
reset role;
select set_config('request.jwt.claims', json_build_object('sub', :'n1', 'role', 'authenticated')::text, true) \gset x
set local role authenticated;
select teste.esperar(
  (select count(*) from public.meal_checks where user_id = :'p1') = 1,
  'a nutri com vínculo ativo lê as respostas do paciente');
select teste.esperar(
  (select count(*) from public.meal_checks where user_id = :'p3') = 0,
  'a nutri não lê as respostas de quem revogou o vínculo');
do $$ begin
  insert into public.meal_checks (user_id, date, meal_type, status)
  values ('00000000-0000-4000-8000-0000000000b1', '2030-01-12', 'Almoço', 'done');
  raise exception 'FALHOU: a nutri gravou uma resposta pelo paciente';
exception when insufficient_privilege then raise notice 'ok: a nutri não grava resposta pelo paciente';
end $$;

reset role;
select set_config('request.jwt.claims', json_build_object('sub', :'n2', 'role', 'authenticated')::text, true) \gset x
set local role authenticated;
select teste.esperar(
  (select count(*) from public.meal_checks where user_id = :'p1') = 0,
  'outra nutri não lê as respostas do paciente');

-- ---------------------------------------------------------------- envio
-- refeicoes_devidas_em, como o dono das funções (é quem a chama, de dentro de
-- refeicoes_devidas). Cada chamada marca o que devolve como enviado, então
-- cada resultado vai para uma tabela temporária antes das asserções.
reset role;
select set_config('request.jwt.claims', '{}', true) \gset x

-- 2030-01-15, 08:10: o café do p1, com as opções na ordem de position.
create temp table r_cafe as select * from public.refeicoes_devidas_em(timestamp '2030-01-15 08:10');
select teste.esperar(
  (select count(*) from r_cafe where user_id = :'p1' and refeicao = 'Café da manhã') = 2
    and (select bool_and(data = date '2030-01-15') from r_cafe),
  'café às 08:10: uma linha por inscrição do p1, com a data do dia');
select teste.esperar(
  (select itens->0->>'description' = 'Ovos' and itens->1->>'description' = 'Iogurte'
     and jsonb_array_length(itens) = 2 and itens->0 ? 'id' and itens->0 ? 'calories'
     from r_cafe where user_id = :'p1' limit 1),
  'as opções vêm na ordem de position, com id e macros');

-- 12:40: o almoço do p1 (duas inscrições) e do p2; ninguém mais.
create temp table r_almoco as select * from public.refeicoes_devidas_em(timestamp '2030-01-15 12:40');
select teste.esperar(
  (select count(*) from r_almoco where user_id = :'p1' and refeicao = 'Almoço') = 2
    and (select count(*) from r_almoco where user_id = :'p2' and refeicao = 'Almoço') = 1,
  'almoço às 12:40: p1 nas duas inscrições e p2');
select teste.esperar(
  (select count(*) from r_almoco where user_id in (:'p3', :'p4', :'p5', :'p6')) = 0,
  'revogado (p3), sem cardápio (p4), desligado (p5) e sem inscrição (p6) não recebem');
select teste.esperar(
  (select count(*) from public.meal_reminders_sent where user_id = :'p6') = 0,
  'quem não tem inscrição não fica marcado como enviado');
select teste.esperar(
  (select count(*) from public.refeicoes_devidas_em(timestamp '2030-01-15 12:50')) = 0,
  'a mesma refeição não sai de novo no mesmo dia');
select teste.esperar(
  (select count(*) from public.refeicoes_devidas_em(timestamp '2030-01-15 20:10') where refeicao = 'Jantar') = 0,
  'o jantar do cardápio antigo do p1 não sai: vale só o mais novo');

-- 2030-01-16: a resposta do dia tira a refeição.
insert into public.meal_checks (user_id, date, meal_type, status) values (:'p1', '2030-01-16', 'Almoço', 'skipped');
create temp table r_resposta as select * from public.refeicoes_devidas_em(timestamp '2030-01-16 12:40');
select teste.esperar(
  (select count(*) from r_resposta where user_id = :'p1') = 0
    and (select count(*) from r_resposta where user_id = :'p2') = 1,
  'com resposta no dia, a refeição não sai (e a do p2 sai)');

-- 2030-01-17: a refeição registrada no dia também tira.
insert into public.meals (user_id, date, meal_type, description) values (:'p1', '2030-01-17', 'Almoço', 'Marmita');
select teste.esperar(
  (select count(*) from public.refeicoes_devidas_em(timestamp '2030-01-17 12:40') where user_id = :'p1') = 0,
  'com a refeição do tipo registrada no dia, ela não sai');

-- 2030-01-18: a janela de 1 hora, com o p2.
select teste.esperar(
  (select count(*) from public.refeicoes_devidas_em(timestamp '2030-01-18 12:29') where user_id = :'p2') = 0,
  'antes do horário não sai');
select teste.esperar(
  (select count(*) from public.refeicoes_devidas_em(timestamp '2030-01-18 13:31') where user_id = :'p2') = 0,
  'passou mais de 1 hora: não sai');
select teste.esperar(
  (select count(*) from public.refeicoes_devidas_em(timestamp '2030-01-18 13:29') where user_id = :'p2') = 1,
  '59 minutos depois do horário ainda sai');

-- 2030-01-19 e 20: o horário salvo vale; o inválido vale o sugerido.
update public.profiles set meal_reminder_times = '{"Almoço": "13:00"}' where id = :'p2';
select teste.esperar(
  (select count(*) from public.refeicoes_devidas_em(timestamp '2030-01-19 12:40') where user_id = :'p2') = 0,
  'com 13:00 salvo, às 12:40 não sai');
select teste.esperar(
  (select count(*) from public.refeicoes_devidas_em(timestamp '2030-01-19 13:05') where user_id = :'p2') = 1,
  'com 13:00 salvo, às 13:05 sai');
update public.profiles set meal_reminder_times = '{"Almoço": "25:99"}' where id = :'p2';
select teste.esperar(
  (select count(*) from public.refeicoes_devidas_em(timestamp '2030-01-20 12:40') where user_id = :'p2') = 1,
  'horário salvo inválido vale o sugerido');
do $$ begin
  update public.profiles set meal_reminder_times = '["Almoço"]' where id = '00000000-0000-4000-8000-0000000000b2';
  raise exception 'FALHOU: meal_reminder_times aceitou uma lista';
exception when check_violation then raise notice 'ok: meal_reminder_times só aceita objeto';
end $$;

-- 2030-01-21: refeição fora de MEAL_TYPES só com horário escolhido.
select teste.esperar(
  (select count(*) from public.refeicoes_devidas_em(timestamp '2030-01-21 17:10') where refeicao = 'Pré-treino') = 0,
  'Pré-treino sem horário salvo não sai');
update public.profiles set meal_reminder_times = '{"Pré-treino": "17:00", "Ceia": "23:30"}' where id = :'p1';
select teste.esperar(
  (select count(*) from public.refeicoes_devidas_em(timestamp '2030-01-21 17:10') where refeicao = 'Pré-treino') = 2,
  'Pré-treino com 17:00 salvo sai às 17:10');

-- 2030-01-22 e 23: a ceia das 23:30, perto da meia-noite.
select teste.esperar(
  (select count(*) from public.refeicoes_devidas_em(timestamp '2030-01-22 22:10') where refeicao = 'Ceia') = 0,
  'com 23:30 salvo, a ceia não sai no sugerido (22:00)');
select teste.esperar(
  (select count(*) from public.refeicoes_devidas_em(timestamp '2030-01-22 23:40') where refeicao = 'Ceia') = 2,
  'a ceia das 23:30 sai às 23:40');
select teste.esperar(
  (select count(*) from public.refeicoes_devidas_em(timestamp '2030-01-23 00:10') where refeicao = 'Ceia') = 0,
  'a ceia das 23:30 não sai às 00:10 do dia seguinte');

-- O que foi enviado fica 7 dias: em 2030-01-23, o de 01-16 (7 dias antes) fica e o
-- de 01-15 sai.
insert into public.meal_reminders_sent (user_id, date, meal_type) values
  (:'p5', '2030-01-16', 'Almoço'), (:'p5', '2030-01-15', 'Almoço');
select count(*) from public.refeicoes_devidas_em(timestamp '2030-01-23 03:00') \gset x
select teste.esperar(
  (select array_agg(date order by date) = array[date '2030-01-16']
     from public.meal_reminders_sent where user_id = :'p5'),
  'o enviado de mais de 7 dias é apagado, o de 7 dias fica');

-- ---------------------------------------------------------------- a chamada do agendador
-- Como anon, com a chave pública, como a rota chama. O segredo errado não
-- devolve nada nem marca nada; o certo roda.
select count(*) as enviados_antes from public.meal_reminders_sent \gset
update public.profiles set meal_reminder_times = jsonb_build_object(
  'Almoço', to_char((now() at time zone 'America/Sao_Paulo') - interval '5 minutes', 'HH24:MI'))
  where id = :'p2';
set local role anon;
select teste.esperar(
  (select count(*) from public.refeicoes_devidas('errado')) = 0,
  'segredo errado não devolve nada');
do $$ begin
  perform * from public.refeicoes_devidas_em(timestamp '2030-01-25 12:40');
  raise exception 'FALHOU: anon chamou refeicoes_devidas_em';
exception when insufficient_privilege then raise notice 'ok: anon não chama refeicoes_devidas_em';
end $$;
reset role;
select teste.esperar(
  (select count(*) from public.meal_reminders_sent) = :enviados_antes,
  'segredo errado não marca nada como enviado');
set local role anon;
select count(*) from public.refeicoes_devidas('segredo-de-teste') \gset x
reset role;
select teste.esperar(true, 'com o segredo certo, anon chama refeicoes_devidas');

rollback;
\o
\echo 'TODOS OS TESTES PASSARAM'
