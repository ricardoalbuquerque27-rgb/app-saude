-- Testes da migração das medidas da consulta, num Postgres local
-- (ferramentas/testar-sql.sh). Tudo numa transação que termina em ROLLBACK.
-- Cada passo troca de usuário como a Supabase faz: primeiro o JWT em
-- request.jwt.claims, depois o papel (nessa ordem, CLAUDE.md).
--
-- O que se protege: a medida tirada pelo nutricionista na consulta
-- (measured_by preenchido) é do prontuário. O paciente a lê, mas não apaga
-- nem edita, e não consegue fabricar uma. A política antiga, ALL com
-- auth.uid() = user_id, deixava os três.

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
grant execute on all functions in schema teste to anon, authenticated;

-- Como postgres, porque nenhuma política deixa ninguém inserir uma medida
-- com measured_by (é a função da tarefa seguinte que vai fazer isso). A
-- chave estrangeira pede uma consulta de verdade.
insert into public.appointments (id, nutritionist_id, patient_id, starts_at, kind, mode, status) values
  (:'c1', :'n1', :'p1', now() - interval '2 days', 'primeira', 'presencial', 'realizada'),
  (:'c2', :'n1', :'p1', now() - interval '1 day', 'retorno', 'presencial', 'realizada'),
  (:'c3', :'n1', :'p3', now() - interval '1 day', 'primeira', 'presencial', 'realizada');

-- A avaliação física do p1, tirada pelo n1 na consulta c1; e a do p3, que o
-- n1 deixou de acompanhar.
insert into public.body_measurements (user_id, weight_kg, waist_cm, measured_by, appointment_id)
  values (:'p1', 70, 80, :'n1', :'c1') returning id as mn \gset
insert into public.body_measurements (user_id, weight_kg, measured_by, appointment_id)
  values (:'p3', 60, :'n1', :'c3') returning id as mn3 \gset
-- E uma que o p3 anotou sozinho, para provar que o n1 revogado não a enxerga.
insert into public.body_measurements (user_id, weight_kg)
  values (:'p3', 61) returning id as mp3 \gset

-- ---------------------------------------------------------------- índice
-- Uma consulta, uma avaliação: duas linhas com a mesma consulta não passam.
do $$ begin
  insert into public.body_measurements (user_id, weight_kg, measured_by, appointment_id)
  values ('00000000-0000-4000-8000-0000000000b1', 71,
          '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000c1');
  raise exception 'FALHOU: duas medidas na mesma consulta passaram';
exception when unique_violation then raise notice 'ok: segunda medida da mesma consulta recusada';
end $$;
-- Já as medidas sem consulta (as do paciente) podem se repetir à vontade, e
-- outra consulta aceita a sua.
insert into public.body_measurements (user_id, weight_kg) values (:'p1', 70), (:'p1', 70);
insert into public.body_measurements (user_id, weight_kg, measured_by, appointment_id)
  values (:'p1', 72, :'n1', :'c2');
select teste.esperar(
  (select count(*) from public.body_measurements where user_id = :'p1') = 4,
  'medidas sem consulta repetem; outra consulta tem a sua');
delete from public.body_measurements where user_id = :'p1' and id <> :'mn';

-- ---------------------------------------------------------------- paciente 1
select set_config('request.jwt.claims', json_build_object('sub', :'p1', 'role', 'authenticated')::text, true) \gset x
set local role authenticated;

-- Inserir
insert into public.body_measurements (user_id, weight_kg, measured_by)
  values (:'p1', 80, null) returning id as mp1 \gset
select teste.esperar(
  (select weight_kg = 80 from public.body_measurements where id = :'mp1'),
  'paciente insere medida própria sem measured_by');

do $$ begin
  insert into public.body_measurements (user_id, weight_kg, measured_by)
  values (auth.uid(), 80, '00000000-0000-4000-8000-0000000000a1');
  raise exception 'FALHOU: paciente inseriu medida assinada pelo nutri';
exception when insufficient_privilege then raise notice 'ok: paciente não assina medida como o nutri';
end $$;
do $$ begin
  insert into public.body_measurements (user_id, weight_kg, measured_by)
  values (auth.uid(), 80, auth.uid());
  raise exception 'FALHOU: paciente inseriu medida com measured_by dele mesmo';
exception when insufficient_privilege then raise notice 'ok: paciente não preenche measured_by nem com o próprio id';
end $$;
-- Prender a consulta numa linha dele ocuparia o lugar da avaliação do nutri
-- no índice único.
do $$ begin
  insert into public.body_measurements (user_id, weight_kg, appointment_id)
  values (auth.uid(), 80, '00000000-0000-4000-8000-0000000000c2');
  raise exception 'FALHOU: paciente prendeu uma consulta a uma medida dele';
exception when insufficient_privilege then raise notice 'ok: paciente não liga medida dele a uma consulta';
end $$;
do $$ begin
  insert into public.body_measurements (user_id, weight_kg)
  values ('00000000-0000-4000-8000-0000000000b2', 80);
  raise exception 'FALHOU: paciente inseriu medida para outro paciente';
exception when insufficient_privilege then raise notice 'ok: paciente não insere medida de outro';
end $$;

-- Ler a que o nutri tirou, sem poder mexer nela
select teste.esperar(
  (select weight_kg = 70 and measured_by is not null and appointment_id is not null
     from public.body_measurements where id = :'mn'),
  'paciente lê a medida que o nutri tirou');

do $$
declare n integer;
begin
  update public.body_measurements set weight_kg = 1
   where id = (select id from public.body_measurements where measured_by is not null limit 1);
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALHOU: paciente editou a medida do nutri (% linhas)', n; end if;
  raise notice 'ok: update da medida do nutri afeta 0 linhas';
end $$;
do $$
declare n integer;
begin
  delete from public.body_measurements where measured_by is not null;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALHOU: paciente apagou a medida do nutri (% linhas)', n; end if;
  raise notice 'ok: delete da medida do nutri afeta 0 linhas';
end $$;
select teste.esperar(
  (select weight_kg = 70 and waist_cm = 80 from public.body_measurements where id = :'mn'),
  'a medida do nutri continua intacta');

-- Assumir a autoria de uma linha dele, ou soltar a consulta da do nutri
do $$ begin
  update public.body_measurements set measured_by = '00000000-0000-4000-8000-0000000000a1'
   where weight_kg = 80;
  raise exception 'FALHOU: paciente assinou como o nutri por update';
exception when insufficient_privilege then raise notice 'ok: update não vira medida do nutri';
end $$;
do $$ begin
  update public.body_measurements set appointment_id = '00000000-0000-4000-8000-0000000000c2'
   where weight_kg = 80;
  raise exception 'FALHOU: paciente ligou a medida dele a uma consulta por update';
exception when insufficient_privilege then raise notice 'ok: update não liga medida dele a uma consulta';
end $$;
do $$ begin
  update public.body_measurements set user_id = '00000000-0000-4000-8000-0000000000b2'
   where weight_kg = 80;
  raise exception 'FALHOU: paciente passou a medida dele para outro paciente';
exception when insufficient_privilege then raise notice 'ok: update não troca o dono da medida';
end $$;

-- Editar e apagar a própria
do $$
declare n integer;
begin
  update public.body_measurements set weight_kg = 81 where weight_kg = 80;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FALHOU: paciente não editou a própria medida (% linhas)', n; end if;
  raise notice 'ok: paciente edita a própria medida';
end $$;
select teste.esperar(
  (select weight_kg = 81 from public.body_measurements where id = :'mp1'),
  'a edição ficou gravada');
do $$
declare n integer;
begin
  delete from public.body_measurements where weight_kg = 81;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FALHOU: paciente não apagou a própria medida (% linhas)', n; end if;
  raise notice 'ok: paciente apaga a própria medida';
end $$;
select teste.esperar(
  (select count(*) from public.body_measurements where id = :'mp1') = 0,
  'a medida apagada sumiu');

-- Uma que fica, para o nutri ver e depois deixar de ver
insert into public.body_measurements (user_id, weight_kg) values (:'p1', 79) returning id as mp1b \gset
select teste.esperar(
  (select count(*) from public.body_measurements) = 2,
  'paciente vê só as dele: a do nutri e a que anotou');

-- ---------------------------------------------------------------- paciente 2
reset role;
select set_config('request.jwt.claims', json_build_object('sub', :'p2', 'role', 'authenticated')::text, true) \gset x
set local role authenticated;

select teste.esperar((select count(*) from public.body_measurements) = 0,
  'outro paciente não lê medida de ninguém');
do $$
declare n integer;
begin
  update public.body_measurements set weight_kg = 1;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALHOU: outro paciente editou medida alheia (% linhas)', n; end if;
  delete from public.body_measurements;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALHOU: outro paciente apagou medida alheia (% linhas)', n; end if;
  raise notice 'ok: outro paciente não edita nem apaga medida alheia';
end $$;

-- ---------------------------------------------------------------- nutri 1
reset role;
select set_config('request.jwt.claims', json_build_object('sub', :'n1', 'role', 'authenticated')::text, true) \gset x
set local role authenticated;

select teste.esperar(
  (select count(*) from public.body_measurements where user_id = :'p1') = 2,
  'nutri com vínculo ativo lê as medidas do paciente, as dele e as do paciente');
do $$ begin
  insert into public.body_measurements (user_id, weight_kg, measured_by, appointment_id)
  values ('00000000-0000-4000-8000-0000000000b1', 70, auth.uid(), '00000000-0000-4000-8000-0000000000c2');
  raise exception 'FALHOU: nutri inseriu medida direto na tabela';
exception when insufficient_privilege then raise notice 'ok: nutri não insere direto (vai por função)';
end $$;
do $$
declare n integer;
begin
  update public.body_measurements set weight_kg = 1;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALHOU: nutri editou medida direto (% linhas)', n; end if;
  delete from public.body_measurements;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALHOU: nutri apagou medida direto (% linhas)', n; end if;
  raise notice 'ok: nutri não edita nem apaga direto';
end $$;

-- Sem vínculo (p3 revogado desde o começo): só enxerga o que ele mesmo mediu.
select teste.esperar(
  (select count(*) from public.body_measurements where user_id = :'p3') = 1
  and (select measured_by = '00000000-0000-4000-8000-0000000000a1'
         from public.body_measurements where user_id = :'p3'),
  'nutri sem vínculo lê a medida que tirou e não a que o paciente anotou');

-- ---------------------------------------------------------------- nutri 2
reset role;
select set_config('request.jwt.claims', json_build_object('sub', :'n2', 'role', 'authenticated')::text, true) \gset x
set local role authenticated;

select teste.esperar(
  (select count(*) from public.body_measurements where user_id in (:'p1', :'p3')) = 0,
  'nutri sem vínculo nenhum não lê medida do paciente');

-- ---------------------------------------------------------------- vínculo revogado
reset role;
update public.patient_links set status = 'revoked' where nutritionist_id = :'n1' and patient_id = :'p1';
select set_config('request.jwt.claims', json_build_object('sub', :'n1', 'role', 'authenticated')::text, true) \gset x
set local role authenticated;

select teste.esperar(
  (select count(*) from public.body_measurements where user_id = :'p1') = 1
  and (select id = :'mn' from public.body_measurements where user_id = :'p1'),
  'vínculo revogado: nutri ainda lê a medida que tirou, e só ela');

-- O paciente segue vendo e mexendo só no que é dele.
reset role;
select set_config('request.jwt.claims', json_build_object('sub', :'p1', 'role', 'authenticated')::text, true) \gset x
set local role authenticated;
select teste.esperar(
  (select count(*) from public.body_measurements) = 2,
  'depois da revogação o paciente continua vendo a medida do nutri e a dele');

-- ---------------------------------------------------------------- anon
reset role;
select set_config('request.jwt.claims', '{}', true) \gset x
set local role anon;
select teste.esperar((select count(*) from public.body_measurements) = 0,
  'anon não lê nenhuma medida');
do $$ begin
  insert into public.body_measurements (user_id, weight_kg)
  values ('00000000-0000-4000-8000-0000000000b1', 80);
  raise exception 'FALHOU: anon inseriu medida';
exception when insufficient_privilege then raise notice 'ok: anon não insere medida';
end $$;

-- ---------------------------------------------------------------- CRN
-- O CRN é do nutricionista: ele o preenche no próprio perfil.
reset role;
select teste.esperar(
  (select data_type = 'text' from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'crn'),
  'profiles.crn existe e é text');
select set_config('request.jwt.claims', json_build_object('sub', :'n1', 'role', 'authenticated')::text, true) \gset x
set local role authenticated;
do $$
declare n integer;
begin
  update public.profiles set crn = 'CRN-3 12345' where id = auth.uid();
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FALHOU: nutri não gravou o CRN (% linhas)', n; end if;
  raise notice 'ok: usuário atualiza o próprio CRN';
end $$;
select teste.esperar((select crn = 'CRN-3 12345' from public.profiles where id = :'n1'),
  'o CRN ficou gravado');
do $$ begin
  update public.profiles set crn = repeat('9', 31) where id = auth.uid();
  raise exception 'FALHOU: CRN de 31 caracteres passou';
exception when check_violation then raise notice 'ok: CRN passa de 30 caracteres, recusado';
end $$;
-- E o limite é de 30: 30 passa.
update public.profiles set crn = repeat('9', 30) where id = :'n1';
select teste.esperar((select char_length(crn) = 30 from public.profiles where id = :'n1'),
  'CRN de 30 caracteres cabe');

reset role;
rollback;
\o
\echo 'TODOS OS TESTES PASSARAM'
