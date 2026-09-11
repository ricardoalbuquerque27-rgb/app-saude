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

**Fase 3 — Prescrição + feedback**
- Nutri define **plano alimentar/metas** para o paciente (tabela `prescriptions`
  ou grava metas no perfil do paciente) e deixa **comentários** (`patient_notes`,
  visíveis ao paciente). Precisa de policies de ESCRITA cruzada específicas.
- Gaia ciente da prescrição (orienta o paciente dentro do plano do nutri).

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
