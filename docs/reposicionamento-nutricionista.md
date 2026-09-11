# Reposicionamento — Sistema para nutricionistas acompanharem pacientes

De um app de consumidor (self-tracking) para um **SaaS B2B**: nutricionistas
acompanham e prescrevem para seus pacientes. O app atual vira o **lado do
paciente**; construímos o **lado profissional** por cima.

## Decisões (travadas com o fundador)
- **Vínculo:** o nutricionista **convida** o paciente (gera código; paciente aceita = consentimento LGPD).
- **Nutri faz:** acompanhar **e** prescrever (ver dados + plano/metas + comentários).
- **Cobrança:** nutri paga (B2B); paciente grátis.

## Papéis
- `profiles.role` = `patient` (padrão) | `nutritionist`.
- Um paciente usa o app como hoje (registra dieta/peso/exames/hábitos + Gaia).
- Um nutricionista tem um painel de pacientes.

## Fundação de dados — ✅ FEITO
- `profiles.role` (patient|nutritionist).
- Tabela `patient_links` (nutritionist_id, patient_id, patient_label, invite_code,
  status pending|active|revoked) + RLS.
- Função `is_active_nutri_of(patient)` (SECURITY DEFINER) usada nas policies.
- **Leitura cruzada:** policy SELECT em meals, body_measurements, daily_logs,
  workouts, exercises, exams, treatments, dose_logs, side_effects, workout_plan,
  plan_completions, health_insights, reports, routines, routine_exercises e
  profiles — o nutri **ativo** lê os dados do paciente (o dono continua vendo os seus).
- Funções `create_patient_invite(label)` → código; `accept_patient_invite(code)`.

## Fases de UI

**Fase 1 — Perfil + vínculo (loop mínimo) — ✅ FEITO**
- Onboarding/perfil: escolher "Sou paciente" ou "Sou nutricionista".
- Nutri: tela "Pacientes" → gerar convite (código/link) + lista de pacientes.
- Paciente: "Meu nutricionista" → inserir código e aceitar (consentindo).
- Nav por papel no AppShell (nutri vê "Pacientes"; paciente vê o app normal).

**Fase 2 — Painel do nutricionista (monitorar) — ✅ FEITO**
- `lib/nutri.ts`: camada de leitura do nutri. `getPatientsSummary` resume N
  pacientes em 6 consultas (usa `.in(user_id, ids)`), `getPatientActivity` une
  7 tabelas numa linha do tempo e `getPatientSeries` monta a série diária.
  Tudo com o cliente autenticado — quem libera as linhas é a RLS.
- `/app` do nutri deixa de redirecionar e vira a **visão macro**
  (`components/NutriHome.tsx`): KPIs (ativos, registraram hoje, precisam de
  atenção, convites pendentes) + listas "Precisam de atenção", "Movimento de
  hoje" e "Em dia". Nav do nutri ganhou "Visão geral".
- `/app/pacientes` virou server component + `components/PacientesClient.tsx`;
  cada linha mostra adesão 7d, treinos, peso e variação, ou o alerta quando há
  um. Filtros Todos / Atenção / Ativos hoje.
- `/app/pacientes/[id]` com 6 abas via `?t=` (server-rendered, cada aba busca
  só o que precisa): Visão geral (perfil + metas + Score + peso 14d + calendário
  de adesão), Atividade (linha do tempo de 30 dias), Nutrição (médias vs. metas
  + gráficos + refeições), Treino (plano semanal, rotinas, treinos com
  exercícios), Corpo (evolução do peso + tabela de medidas) e Clínico
  (tratamento, doses, efeitos colaterais, exames). Somente leitura.
- Regras de atenção: 3+ dias sem registrar, dose atrasada, exames fora da
  referência.

**Fase 3 — Prescrição + feedback — ✅ FEITO**
- `prescriptions`: histórico do que foi prescrito e por quem. `patient_notes`:
  recados do nutri para o paciente, com marcação de lido.
- Metas são aplicadas no perfil do paciente por `set_patient_goals()`, função
  SECURITY DEFINER. Não é policy de UPDATE em profiles de propósito:
  privilégio por coluna no Postgres é por ROLE, não por linha — restringir o
  nutri às colunas de meta restringiria também o paciente de editar o próprio
  nome. Assim as 12 telas que já leem as metas do perfil seguem intactas.
- `workout_plan.prescribed_by` + policies de insert/update/delete para o nutri
  do paciente. Aqui escrita direta é adequada: a linha é do paciente e o
  profissional legitimamente a gerencia.
- Comentários são imutáveis por GATILHO, não só por grant: o projeto tem
  DEFAULT PRIVILEGES concedendo ALL em tabelas novas do schema public para
  anon/authenticated, então `grant update (read_at)` não restringia nada e o
  paciente conseguia reescrever o texto do nutricionista. Descoberto em teste.
- UI: aba "Prescrição" no painel (metas, plano, recados) — a única que
  escreve. No paciente: recado não lido aparece em "Hoje", metas marcadas como
  vindas do nutri no Perfil, sessões prescritas com selo na aba Treino, e a
  página "Meu nutricionista" lista metas vigentes e histórico de recados.
**Fase 3b — treino completo e canal de acompanhamento — ✅ FEITO**
- O nutri monta o treino DE VERDADE: policies de escrita em routines e
  routine_exercises (+ routines.prescribed_by). Ele cria a rotina com
  exercícios, séries, reps, carga e descanso, e encaixa num dia da semana
  ligando workout_plan.routine_id — o que faz o paciente ver "Iniciar treino"
  e executar série por série.
- patient_notes vira duas coisas separadas, via author_id + visibility:
  CONVERSA (shared, mão dupla — o paciente responde pelo app dele) e NOTAS
  PRIVADAS (private, só o nutricionista; anamnese e conduta). O gatilho de
  imutabilidade passou a congelar também autoria e visibilidade, para ninguém
  converter nota privada em mensagem.
- Aba Prescrição reorganizada em Metas / Treino / Conversa / Notas privadas,
  com contador de mensagens não lidas.
- Validado: nota privada não vaza para o paciente (0 linhas), paciente não
  cria nota privada, não forja autoria do nutricionista e não escreve na
  conversa de outro paciente.

- Pendente: Gaia ciente da prescrição (orientar dentro do plano do nutri).

**Fase 4 — Conta/cobrança**
- Assinatura do nutricionista (limite de pacientes por plano), paciente grátis.

## Riscos / cuidados
- **LGPD:** paciente é dono do dado; aceitar o convite = consentimento explícito.
  Permitir revogar o vínculo a qualquer momento. Deixar claro o que o nutri vê.
- **Escrita cruzada (Fase 3):** policies específicas — o nutri só escreve no que
  for de prescrição, nunca sobrescreve registros do paciente.
- **Concorrência BR:** Dietbox, WebDiet, Nutrium, Dietsystem. Diferencial =
  melhor app de engajamento do paciente (com a Gaia/IA).
- **Nome/identidade:** rebrand visual pendente (definir depois).
