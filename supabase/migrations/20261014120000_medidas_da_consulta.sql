-- Medidas da consulta e CRN (spec: docs/superpowers/specs/2026-10-13-registro-da-consulta-design.md).
--
-- A avaliação física que o nutricionista tira na consulta vai para
-- body_measurements, na mesma linha do tempo das medidas que o paciente anota.
-- Só que ela é do prontuário, e a política antiga, measurements_all_own
-- (ALL, auth.uid() = user_id), deixava o paciente apagar ou reescrever a linha
-- do nutricionista: bastava ser dono dela. Por isso o ALL some e dá lugar a
-- uma política por comando, e a linha ganha dois campos que dizem de quem é:
--
--   measured_by    quem tirou a medida. Nulo é o paciente; preenchido é o
--                  nutricionista, e a linha passa a ser do prontuário.
--   appointment_id a consulta em que foi tirada. Uma avaliação por consulta
--                  (índice único parcial).
--
-- Ninguém insere linha com measured_by pela tabela: nenhuma política deixa.
-- Essa escrita é de uma função SECURITY DEFINER, que vem em outra migração,
-- como nas consultas (appointments só tem política de leitura).
--
-- A "nutri reads patient" fica como está: o nutricionista com vínculo ativo lê
-- tudo do paciente. A nova measurements_author_read acrescenta o que ele
-- mesmo mediu, para o prontuário não sumir do olho dele quando o vínculo é
-- revogado.

alter table public.profiles
  add column crn text check (crn is null or char_length(crn) <= 30);

alter table public.body_measurements
  add column measured_by uuid,
  -- Sem on delete: apagar a consulta não deve levar a avaliação junto.
  add column appointment_id uuid references public.appointments(id);

-- Uma avaliação por consulta; as medidas do paciente (appointment_id nulo)
-- não entram no índice e repetem à vontade.
create unique index body_measurements_appointment_unique
  on public.body_measurements (appointment_id) where appointment_id is not null;

drop policy measurements_all_own on public.body_measurements;

create policy measurements_patient_read on public.body_measurements
  for select to authenticated
  using (user_id = auth.uid());

-- O paciente só cria linha dele, sem assinatura de nutricionista e sem
-- consulta. Sem o appointment_id nulo, ele prenderia o id de uma consulta
-- numa linha própria e o índice único recusaria depois a avaliação de verdade.
create policy measurements_patient_insert on public.body_measurements
  for insert to authenticated
  with check (user_id = auth.uid() and measured_by is null and appointment_id is null);

-- using: só enxerga para editar o que é dele e não é do prontuário. O with
-- check repete as três travas do insert, para o update não ser um caminho
-- lateral para assinar como nutricionista, ligar a consulta ou trocar o dono.
create policy measurements_patient_update on public.body_measurements
  for update to authenticated
  using (user_id = auth.uid() and measured_by is null)
  with check (user_id = auth.uid() and measured_by is null and appointment_id is null);

create policy measurements_patient_delete on public.body_measurements
  for delete to authenticated
  using (user_id = auth.uid() and measured_by is null);

create policy measurements_author_read on public.body_measurements
  for select to authenticated
  using (measured_by = auth.uid());
