# Consultas e agenda: plano de implementação

> Execução: inline (eu implemento cada tarefa) e uma revisão independente do
> branch inteiro no fim. **Ruling:** o dono do produto delegou as decisões
> ("pode construir a agenda"); as tarefas são muito acopladas (tabela →
> funções → lógica → telas) para valer um implementador novo por tarefa.

**Goal:** consultas com agenda Mês/Semana/Dia para o nutri, aba Consultas no
paciente, alertas na fila, e o cartão de consulta do lado do paciente.

**Spec:** `docs/superpowers/specs/2026-10-13-consultas-e-agenda-design.md`

## Global Constraints

- Toda escrita em `appointments` por função `SECURITY DEFINER`; a tabela só
  tem política de `select`. Nada de service role no app.
- Datas e horas em `America/Sao_Paulo`; dia de um instante por
  `dataNoBrasil`; nada de `toISOString().slice(0,10)` nem `-03:00` fixo.
- Janelas por `naJanela`/`diasNaJanela`/`limitesDaJanela` (CLAUDE.md).
- Leitura que falha mostra `ErroSecao`, nunca "não tem consulta".
- Cor em par claro/escuro; dentro do paciente, só `clin-*` testadas.
- Alvos de toque de 44 px; interface e commits em pt-BR.
- A migração só vai para produção com o ok explícito do dono do produto, e
  **antes** do merge (sem a tabela, a página do paciente mostraria erro).

## Review Focus

1. Consulta que passa da meia-noite em São Paulo e é 03:00 UTC do dia
   seguinte: tem de cair no dia certo no Mês, na Semana e no Dia.
2. Fim exato da consulta: "sem desfecho" começa no minuto em que acaba, não
   no início.
3. Paciente desvinculado: o nutri deixa de ver as consultas dele, e as
   funções recusam.
4. Paciente que pede consulta com um pedido já aberto, ou no passado.
5. Pedido de remarcação de uma consulta que já passou.

---

### Task 1: migração e testes SQL

**Files:** `supabase/migrations/20261013120000_consultas_e_agenda.sql`,
`supabase/testes/consultas.sql`, `supabase/testes/base-local.sql`
(réplica mínima de `profiles`, `patient_links`, `auth.uid()` e das funções
`is_active_nutri_of`/`is_my_nutritionist`), `ferramentas/testar-sql.sh`.

Testes (cada um é um `do $$ ... $$` que levanta exceção se falhar): nutri
marca; paciente não marca; paciente pede; segundo pedido aberto recusado;
pedido no passado recusado; nutri aceita (remarcar com os mesmos valores);
remarcar limpa o pedido de remarcação; realizada antes do início recusada;
corrigir desfecho; paciente cancela a dele; paciente não cancela a de outro;
paciente não cancela no passado; nutri desvinculado não lê nem escreve; RLS:
paciente só lê as dele; `insert` direto recusado.

### Task 2: lógica pura (`lib/consultas.ts`, `lib/consultas.test.ts`)

**Produces:**
- `type Consulta = { id; patient_id; nutritionist_id; starts_at; duration_min; kind: TipoConsulta; mode: ModoConsulta; status: StatusConsulta; patient_message; reschedule_requested_at; cancelled_by }`
- `situacao(c, agora): "pedido" | "remarcar" | "agendada" | "sem-desfecho" | "realizada" | "faltou" | "cancelada"`
- `ehPendencia(c, agora): boolean`
- `fimDa(c): number` (ms)
- `instanteEmSaoPaulo(dataISO, "HH:MM"): string` (ISO com o deslocamento do dia)
- `horaEmSaoPaulo(instante): "HH:MM"`, `dataNoBrasil` (de lib/date)
- `choques(lista, inicio, duracao, ignorarId?): Consulta[]` — só agendadas
- `gradeDoMes(dataISO): { data; doMes: boolean }[]` (semanas de segunda a domingo)
- `diasDaSemana(dataISO): string[]` (segunda a domingo)
- `tituloDoPeriodo(vista, dataISO)`, `rotuloDaConsulta(c)` ("ter., 20/10 às 14:00")
- `vistaDaUrl(valor, cookie): Vista`, `dataDaUrl(valor, hoje)`
- `proximaConsulta(lista, agora)`, `ultimaRealizada(lista, agora)`
- `textoDesdeUltima(d: DadosDesde): string | null`
- `sugestaoDeRetorno(c): { data; hora }` (+30 dias)
- `alertasDeConsulta(lista, agora): { tipo: "consulta"; nivel; texto }[]`

### Task 3: alertas na fila

`DadosResumo.consultas?`, `montarResumos(..., agora?)` chama
`alertasDeConsulta`; `TipoAlerta` ganha `"consulta"`. Testes em
`lib/nutri.test.ts`: pedido vira nível 2, sem desfecho nível 4, ordem entre
alertas. `resumirPacientes` busca as consultas pendentes. NutriHome: ícone
por tipo. Fila: ação "Ver consultas".

### Task 4: leitura (`lib/consultasDb.ts`)

`getConsultasDoPeriodo(supabase, nutriId, desde, ate)`,
`getConsultasDoPaciente(supabase, uid)`, `getDesdeUltimaConsulta(supabase,
pacientes)`; cada uma devolve `{ data, falhou }`.

### Task 5: componentes de consulta (`components/consultas/`)

`FormConsulta` (marcar/remarcar, choque), `PainelConsulta` (ações por
situação), `useAcaoConsulta` (chama a RPC, mostra erro, `router.refresh()`).

### Task 6: agenda (`app/app/agenda/page.tsx` + vistas)

Menu (computador e celular), cookie da vista, Dia/Semana/Mês, aviso de
pendências, painel.

### Task 7: página do paciente

Aba Consultas (`lib/abas.ts` + `secoes/Consultas.tsx`), próxima consulta no
Cabecalho, "desde a última consulta" no Resumo.

### Task 8: lado do paciente

`components/CartaoConsulta.tsx` na Início e em Meu plano.

### Task 9: mock, roteiro de telas, documentação

Mock com `appointments` e as seis funções com estado; verificações novas em
`tirar-prints-nutri.cjs`; CLAUDE.md e LEIAME.

### Task 10: revisão, migração em produção (com ok), PR e publicação
