# Gráficos do nutricionista — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Na página do paciente do nutricionista, a aba Corpo ganha o anel da meta de peso e a Evolução (peso em média semanal com as medidas da consulta, cintura e % de gordura), e a aba Clínico ganha o comparativo dos exames com minigráfico.

**Architecture:** Toda a conta é pura e testada em `lib/evolucao.ts` (corpo e meta) e `lib/exames.ts` (comparativo); as leituras novas moram em `lib/evolucaoDb.ts`; os gráficos são componentes de cliente em `components/clinico/graficos/`, recebendo só dados prontos e serializáveis das seções de servidor `secoes/Corpo.tsx` e `secoes/Clinico.tsx`. Sem migração.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Tailwind com o tema clínico (`clin-*`), recharts (já no `package.json`), vitest, Playwright contra o Supabase falso.

**Spec:** `docs/superpowers/specs/2026-10-14-graficos-do-nutricionista-design.md` · maquetes: https://claude.ai/artifact/WXDsmchTqtCuK3KLjJLXYC

## Global Constraints

- Interface, comentários e commits em português do Brasil; comentário explica o **porquê** (CLAUDE.md, Convenções).
- Cor só do tema clínico, por variável CSS (`var(--clin-primaria)`, `var(--clin-texto)`, `var(--clin-campo)`, `var(--clin-linha)`, `var(--clin-atencao)`, `var(--clin-primaria-fundo)`): nenhum hex nos componentes. Pares novos de gráfico entram em `PARES_GRAFICO` (`lib/temaClinico.ts`), 3:1 nos dois temas.
- Leitura que falha não é "não tem": toda leitura nova devolve `{ data, falhou }` (`Res` de `lib/consultasDb.ts`) e a aba mostra `ErroSecao`, nunca "Ainda não dá para ver tendência".
- Leitura que volta cheia conta como falha: **1.000** linhas no corpo, **200** nos exames.
- Datas: `todayISO()`, `limitesDaJanela`, `addDaysISO`, `dataNoBrasil`, `diaDaConsulta`; nunca `toISOString().slice(0,10)` nem `starts_at.slice(0,10)`; janela com teto e piso (`.gte` + `.lte`).
- Período: desde o início do acompanhamento (`accepted_at` do vínculo ativo; nulo → `created_at`), com teto de **12 meses** (`limitesDaJanela(hoje, 365).desde`).
- Semana de **segunda a domingo**; um valor por dia (a pesagem de casa mais recente por `created_at`) antes da média.
- Meta entra na escala só se estiver a até **5 kg** do menor ou do maior valor do gráfico.
- Minigráfico só com **3** resultados numéricos ou mais na mesma unidade.
- No dia com pesagem de casa e medida da consulta, vale a da consulta (`pesoDoDia`) no Peso atual, na Variação em 30 dias e no anel.
- Textos fixos (exatos): "média da semana", "desde a 1ª semana", "medida na consulta", "sem pesagem", "semana em curso", "Ainda não dá para ver tendência", "segue na faixa", "entrou na faixa", "saiu da faixa", "mais perto da faixa", "mais longe da faixa", "igual ao anterior", "sem faixa para comparar", "primeiro resultado", "unidade diferente do anterior", "meta atingida", "Sem comparação ainda".
- `playwright` fora do `package.json` (`npm install --no-save playwright`); nunca `npm run build` com o `npm run dev` no ar; processos por PID, nunca `pkill -f`.
- Nenhum toque no Supabase de produção.

## Review Focus

1. **Paciente só com medidas de consulta, sem pesagem em casa:** com 2 ou mais pontos de consulta o gráfico aparece só com os pontos, e o título diz "última medida X kg · ±Y kg desde dd/mm" (não "média da semana"). Teste na Task 2.
2. **Número vindo do banco como texto** (`"70.3"`, numeric do PostgREST) e valor nulo no meio: entram como número, nulo fica fora. Teste na Task 2.
3. **Acompanhamento com mais de 12 meses:** o período começa 12 meses atrás, não no `accepted_at`. Teste na Task 2.
4. **Dois resultados do mesmo exame na mesma data:** um só conta (o que vier por último na ordem da leitura), e o "anterior" é o de data anterior, nunca o da mesma data. Teste na Task 4.
5. **Valor de exame com texto em volta** ("< 0,5", "5,6 %", "reagente"): os dois primeiros viram número pelo `parseExamNumber`; "reagente" fica fora do comparativo. Teste na Task 4.

---

### Task 1: Peso do dia pela mesma regra no topo do Corpo e no resumo

**Files:**
- Modify: `lib/nutri.ts` (`montarResumos`, ~linhas 271-370; a leitura de `body_measurements` em `resumirPacientes`, ~linha 133)
- Modify: `app/app/pacientes/[id]/secoes/Corpo.tsx` (leitura ~linha 51, "Peso atual" ~linhas 74-95)
- Test: `lib/nutri.test.ts`

**Interfaces:**
- Consumes: `pesoDoDia(linhas)` de `lib/nutri.ts` (já existe).
- Produces: `PatientSummary.weightLast` e `weightDelta30` com um valor por dia pela regra de `pesoDoDia`; nenhuma assinatura muda.

- [ ] **Step 1: Testes que falham** em `lib/nutri.test.ts`, no `describe` de `montarResumos`:
  - `"no dia com as duas medidas, o peso atual é o da consulta"`: dia D com `{weight_kg: 71.2, measured_by: null, created_at: "D 08:00"}` e `{weight_kg: 70.8, measured_by: "nutri", created_at: "D 07:00"}` → `weightLast === 70.8`, nas duas ordens de chegada;
  - `"a variação em 30 dias usa um valor por dia"`: D-20 com casa 72,0 e consulta 71,6; D com casa 70,9 → `weightDelta30 === -0.7`.
- [ ] **Step 2:** `npx vitest run lib/nutri.test.ts` — FAIL.
- [ ] **Step 3:** Em `resumirPacientes`, `created_at` no `select` das medidas. Em `montarResumos`, agrupe `pesos30` por `date` e tire um valor por dia com `pesoDoDia` antes de `weightLast`/`weightFirst`, com o comentário do porquê (as duas pegavam uma das duas ao acaso).
- [ ] **Step 4:** Em `Corpo.tsx`, `created_at` no `select`; "Peso atual" = `pesoDoDia` das linhas da data mais recente com peso; a linha de baixo diz "em dd/mm" e, quando o valor veio da consulta, "em dd/mm, na consulta".
- [ ] **Step 5:** `npm test && npx tsc --noEmit` — tudo passa.
- [ ] **Step 6: Commit** — `git commit -m "Peso do dia: a medida da consulta vence no topo do Corpo e no resumo"`

### Task 2: Lógica da Evolução do corpo

**Files:**
- Create: `lib/evolucao.ts`
- Test: `lib/evolucao.test.ts`

**Interfaces:**
- Consumes: `addDaysISO`, `limitesDaJanela`, `dataNoBrasil`, `weekStartISO` (a segunda-feira da semana; já existe, não duplicar) (`lib/date.ts`); `pesoDoDia` (`lib/nutri.ts`).
- Produces:
  - `type LinhaDoCorpo = { date: string; weight_kg: number | string | null; waist_cm: number | string | null; body_fat_pct: number | string | null; measured_by: string | null; created_at: string | null }`
  - `inicioDoPeriodo(vinculo: { accepted_at: string | null; created_at: string }, hoje: string): string` — o dia (SP) do início, nunca antes de `limitesDaJanela(hoje, 365).desde`.
  - `type SemanaDePeso = { inicio: string; fim: string; media: number | null; dias: number; menor: number | null; maior: number | null; emCurso: boolean }`
  - `semanasDePeso(linhas: LinhaDoCorpo[], desde: string, ate: string): SemanaDePeso[]` — uma por semana do período, em ordem; só linhas de casa (`measured_by` nulo); um valor por dia (o de `created_at` mais recente); média com 1 casa decimal; semana sem pesagem com `media: null`.
  - `type PontoDeConsulta = { data: string; valor: number }`
  - `pontosDaConsulta(linhas: LinhaDoCorpo[], campo: "weight_kg" | "waist_cm" | "body_fat_pct"): PontoDeConsulta[]`
  - `type PontoDeMedida = { data: string; valor: number; daConsulta: boolean }`
  - `serieDeMedida(linhas: LinhaDoCorpo[], campo: "waist_cm" | "body_fat_pct"): PontoDeMedida[]` — um ponto por linha com valor, em ordem de data; no mesmo dia, as duas aparecem.
  - `type TituloDoPeso = { rotulo: "média da semana" | "última medida"; valor: number; variacao: number | null; desde: string | null }`
  - `tituloDoPeso(semanas: SemanaDePeso[], consulta: PontoDeConsulta[]): TituloDoPeso | null` — com semana com média: a última delas contra a primeira ("desde a 1ª semana"); sem nenhuma, a última medida da consulta contra a primeira; nada → null.
  - `temGraficoDePeso(semanas: SemanaDePeso[], consulta: PontoDeConsulta[]): boolean` — 2+ semanas com média ou 2+ pontos de consulta.
  - `escalaDoPeso(valores: number[], meta: number | null): { min: number; max: number; metaNaEscala: boolean; metaAcima: boolean }` — `min`/`max` arredondados para o kg inteiro abaixo/acima com 0,5 kg de folga; a meta entra se `meta >= menor - 5 && meta <= maior + 5`.
  - `descricaoDoPeso(semanas, consulta, meta: number | null): string` — a frase do `aria-label`, ex.: "Peso de 12/05 a 13/10: média da semana caiu de 74,4 para 70,1 kg; seis consultas, a última com 70,3 kg; meta 66 kg."
  - `descricaoDaMedida(nome: string, unidade: string, pontos: PontoDeMedida[]): string` — ex.: "Cintura medida 6 vezes, de 92 para 85 cm."

- [ ] **Step 1: Testes que falham** (`lib/evolucao.test.ts`), com estes valores:
  - semanas nas bordas: pesagem num domingo ("2026-10-18") cai na semana de "2026-10-12"; numa segunda ("2026-10-19"), na seguinte; "2027-01-01" (sexta) na semana de "2026-12-28".
  - `inicioDoPeriodo`: `accepted_at` "2026-05-12T13:00:00Z", hoje "2026-10-14" → "2026-05-12"; `accepted_at` nulo usa `created_at`; `accepted_at` "2025-01-10T…", hoje "2026-10-14" → `limitesDaJanela("2026-10-14", 365).desde`.
  - `semanasDePeso`: três pesagens no mesmo dia (70,0 às 07h, 71,0 às 20h, 72,0 às 12h) e uma no dia seguinte de 69,0 → média da semana 70,0 (71,0 e 69,0), `dias` 2, `menor` 69, `maior` 71; uma semana vazia no meio → `media: null`, `dias: 0`; a medida com `measured_by` não entra; `"70.3"` (texto) conta como 70,3; `weight_kg` nulo fica fora; a semana de hoje vem com `emCurso: true`.
  - `pontosDaConsulta`/`serieDeMedida`: só linhas com valor; `daConsulta` pelo `measured_by`.
  - `tituloDoPeso`: semanas 74,4 … 70,1 → `{ rotulo: "média da semana", valor: 70.1, variacao: -4.3 }`; sem pesagem de casa e consultas 74,6 (12/05) e 70,3 (13/10) → `{ rotulo: "última medida", valor: 70.3, variacao: -4.3, desde: "2026-05-12" }`; nada → null.
  - `temGraficoDePeso`: 1 semana + 1 consulta → false; 0 semanas + 2 consultas → true.
  - `escalaDoPeso([70.1, 74.6], 66)` → `metaNaEscala: true`; `escalaDoPeso([98, 101], 70)` → `metaNaEscala: false, metaAcima: false`; ganho de peso `escalaDoPeso([50, 52], 60)` → `metaNaEscala: false, metaAcima: true`.
  - `descricaoDoPeso` com os dados acima devolve a frase do exemplo; `descricaoDaMedida("Cintura", "cm", …)` a do exemplo.
- [ ] **Step 2:** `npx vitest run lib/evolucao.test.ts` — FAIL (módulo não existe).
- [ ] **Step 3:** Implementar `lib/evolucao.ts` com as assinaturas acima. Número formatado em pt-BR (vírgula) só em `descricaoDoPeso`; o resto devolve número.
- [ ] **Step 4:** `npx vitest run lib/evolucao.test.ts` — PASS; `npx tsc --noEmit` limpo.
- [ ] **Step 5: Commit** — `git commit -m "Evolução do corpo: média semanal, pontos da consulta e escala, testados"`

### Task 3: Lógica do anel da meta de peso

**Files:**
- Modify: `lib/evolucao.ts`
- Test: `lib/evolucao.test.ts`

**Interfaces:**
- Consumes: `LinhaDoCorpo`, `pesoDoDia` (Task 2 e `lib/nutri.ts`).
- Produces:
  - `pesoInicialDoPeriodo(linhas: LinhaDoCorpo[], desde: string): { valor: number; data: string } | null` — o primeiro dia com peso a partir de `desde`, pela regra de `pesoDoDia`.
  - `type ProgressoDaMeta = { tipo: "progresso"; fracao: number; feito: number; total: number } | { tipo: "atingida"; passou: number | null } | { tipo: "lado-errado"; diferenca: number } | null`
  - `progressoDaMeta(inicial: number | null, atual: number | null, meta: number | null): ProgressoDaMeta`

- [ ] **Step 1: Testes que falham:**
  - perder: `progressoDaMeta(74.6, 70.3, 66)` → `{ tipo: "progresso", fracao: 0.5, feito: 4.3, total: 8.6 }`;
  - ganhar: `progressoDaMeta(50, 52, 56)` → `{ tipo: "progresso", fracao: 1/3, feito: 2, total: 6 }` (fração com 2 casas no teste: `toBeCloseTo`);
  - lado errado: `progressoDaMeta(74.6, 75.8, 66)` → `{ tipo: "lado-errado", diferenca: 1.2 }`; ganhar e perdeu: `progressoDaMeta(50, 49, 56)` → `{ tipo: "lado-errado", diferenca: -1 }`;
  - atingida: `progressoDaMeta(74.6, 66.2, 66)` → `{ tipo: "atingida", passou: null }`; `progressoDaMeta(74.6, 65.2, 66)` → `{ tipo: "atingida", passou: 0.8 }`;
  - sem anel: meta nula, inicial nulo, atual nulo, `meta === inicial` → `null`;
  - `pesoInicialDoPeriodo`: no primeiro dia, casa 74,9 e consulta 74,6 → `{ valor: 74.6, data }`; linhas antes de `desde` ficam fora.
- [ ] **Step 2:** `npx vitest run lib/evolucao.test.ts` — FAIL.
- [ ] **Step 3:** Implementar. Atingida quando o atual passou da meta no sentido certo ou está a menos de 0,05 kg dela; `passou` só quando passou mais de 0,5 kg.
- [ ] **Step 4:** PASS e `npx tsc --noEmit` limpo.
- [ ] **Step 5: Commit** — `git commit -m "Anel da meta: progresso do peso inicial até a meta, testado"`

### Task 4: Comparativo dos exames

**Files:**
- Modify: `lib/examRanges.ts` (exportar a busca da tabela)
- Create: `lib/exames.ts`
- Test: `lib/exames.test.ts`

**Interfaces:**
- Consumes: `parseExamNumber`, `parseReferenceRange`, `classifyExam` e a tabela de `lib/examRanges.ts`.
- Produces:
  - em `lib/examRanges.ts`: `chaveDoExame(nome: string): string` — a primeira chave (`keys[0]`) da entrada que `findDef` acha; fora da tabela, o nome normalizado (`norm`).
  - em `lib/exames.ts`:
    - `type LinhaDeExame = { date: string; title: string; result_value: string | null; unit: string | null; reference_range: string | null; status: string | null }`
    - `type Mudanca = "segue na faixa" | "entrou na faixa" | "saiu da faixa" | "mais perto da faixa" | "mais longe da faixa" | "igual ao anterior" | "sem faixa para comparar" | "primeiro resultado" | "unidade diferente do anterior"`
    - `type LinhaDoComparativo = { chave: string; nome: string; faixaTexto: string | null; ultimo: { valor: number; texto: string; data: string; status: string | null }; anterior: { valor: number; data: string } | null; diferenca: number | null; mudanca: Mudanca; grupo: 1 | 2 | 3 | 4; serie: { data: string; valor: number }[] | null }`
    - `compararExames(linhas: LinhaDeExame[], ctx: { sex?: "M" | "F" | null; age?: number | null }): LinhaDoComparativo[]` — já na ordem: grupo 1 (saiu, mais longe), 2 (mais perto, igual, e "sem faixa"/"unidade diferente" com o último fora ou sem faixa), 3 (entrou, segue), 4 (primeiro resultado); dentro do grupo, data do último decrescente. `serie` só com 3+ resultados numéricos na mesma unidade do último.
    - `resumoDoComparativo(linhas: LinhaDoComparativo[]): { melhores: number; piores: number; umResultado: number }` — melhores = entrou, segue, mais perto; piores = saiu, mais longe.
    - `descricaoDaSerie(linha: LinhaDoComparativo): string` — o `aria-label` do minigráfico, ex.: "Vitamina D: 18 em 15/01, 24 em 10/07, 38 em 02/10; faixa de 30 a 100."

- [ ] **Step 1: Testes que falham** (`lib/exames.test.ts`):
  - `chaveDoExame("Glicose")`, `chaveDoExame("Glicemia de jejum")`, `chaveDoExame("glicose em jejum")` iguais; `chaveDoExame("Ácido Fólico")` → `"acido folico"`.
  - As oito linhas da tabela "O que mudou" da spec, cada uma com o par de valores e a faixa "70 a 99": 90→92 segue; 105→92 entrou; 92→105 saiu; 120→110 mais perto; 110→120 mais longe; 110→110 igual; sem faixa no laudo e fora da tabela → "sem faixa para comparar" com a diferença; um resultado → "primeiro resultado".
  - Unidade: anterior "5,1 mmol/L", último "92 mg/dL" → "unidade diferente do anterior" e `diferenca: null`.
  - Valores com texto: "< 0,5" → 0,5; "5,6 %" → 5,6; "reagente" fica fora (exame só com "reagente" não aparece).
  - Mesma data: dois resultados de glicose em 02/10 (95 e 92, nessa ordem) e um em 10/07 (98) → último 92, anterior 98.
  - Faixa: a do último laudo; sem ela, a da tabela (`classifyExam` com o `ctx`).
  - Ordem: com TG saiu (grupo 1), LDL mais perto (2), Vit D entrou (3), ferritina primeiro (4) → nessa ordem; dois do mesmo grupo, o de último mais recente primeiro.
  - `serie`: com 3 resultados (18, 24, 38) → 3 pontos; com 2 → null; com 3 mas um em outra unidade → null.
  - `resumoDoComparativo` do caso acima → `{ melhores: 2, piores: 1, umResultado: 1 }`.
  - `descricaoDaSerie` da vitamina D devolve a frase do exemplo.
- [ ] **Step 2:** `npx vitest run lib/exames.test.ts` — FAIL.
- [ ] **Step 3:** Exportar `chaveDoExame` de `lib/examRanges.ts` sem mudar `classifyExam`; implementar `lib/exames.ts`. Unidade comparada sem espaço e sem caixa; distância à faixa = 0 dentro, senão a distância à borda mais próxima; a mesma faixa (a do último) para os dois valores.
- [ ] **Step 4:** PASS; `npm test` inteiro passa (o `examRanges` não pode mudar de comportamento); `npx tsc --noEmit` limpo.
- [ ] **Step 5: Commit** — `git commit -m "Exames: comparativo do último contra o anterior, em palavras, testado"`

### Task 5: Dados do Supabase falso para os gráficos

**Files:**
- Modify: `ferramentas/mock-supabase.cjs`, `ferramentas/LEIAME.md`

**Interfaces:**
- Produces (para as Tasks 6 e 7): no cenário `carteira`, um paciente com o corpo da maquete e um com exames com histórico.
  - **Corpo:** ~22 semanas desde o início do vínculo (`accepted_at` 154 dias atrás), pesagens de casa de 2 a 4 dias por semana caindo de ~74,4 para ~70,1 kg, **uma semana sem pesagem** (a 8ª), seis consultas realizadas com medida (peso, cintura, % de gordura: 74,6/92/34,0 … 70,3/85/30,4), uma delas na semana sem pesagem, e **um dia com pesagem de casa e medida da consulta**; meta 66 kg.
  - **Exames:** triglicerídeos 141 → 168 (saiu), LDL 145 → 132 (mais perto), vitamina D 18 → 24 → 38 (entrou, com minigráfico), glicose como "Glicose" 101 e "Glicemia de jejum" 98 e 92 (uma chave só, minigráfico), ferritina 45 (um resultado), e um exame com unidade diferente entre os dois resultados.
- [ ] **Step 1:** Escolher o paciente: as verificações antigas conferem números de Luiza (Verificação 19: 5 medidas no Corpo), Joana e Beatriz. Use um paciente novo no `carteira` (ex.: `P.helena = id(6)`), com vínculo ativo, sem alerta que mude a ordem da fila que as verificações conferem. Rode `node ferramentas/tirar-prints-nutri.cjs`: se alguma verificação antiga conferir a quantidade de pacientes, atualize só esse número, com um comentário dizendo que entrou o paciente dos gráficos.
- [ ] **Step 2:** `/__reset` restaura tudo; as consultas do paciente novo aparecem pela regra que já existe.
- [ ] **Step 3:** LEIAME: o paciente novo, para que serve, e a nota de que o Supabase falso ignora a lista de colunas do `select` (pendência da revisão final do registro).
- [ ] **Step 4:** `node ferramentas/tirar-prints-nutri.cjs` (CENARIO=carteira) — as verificações de antes passam.
- [ ] **Step 5: Commit** — `git commit -m "Supabase falso: paciente com meses de pesagem e exames com histórico"`

### Task 6: Aba Corpo com o anel e a Evolução

**Files:**
- Create: `lib/evolucaoDb.ts`, `components/clinico/graficos/AnelDaMeta.tsx`, `components/clinico/graficos/GraficoPeso.tsx`, `components/clinico/graficos/GraficoMedida.tsx`
- Modify: `app/app/pacientes/[id]/secoes/Corpo.tsx`, `lib/temaClinico.ts`, `lib/temaClinico.test.ts`, `ferramentas/tirar-prints-nutri.cjs`

**Interfaces:**
- Consumes: Tasks 1–3, 5; `getConsultasDoPaciente(supabase, uid)` (`lib/consultasDb.ts`), `diaDaConsulta` (`lib/consultas.ts`), `Res`.
- Produces:
  - `getInicioDoAcompanhamento(supabase: any, pacienteId: string): Promise<Res<{ accepted_at: string | null; created_at: string } | null>>` — o vínculo ativo do nutri logado com o paciente (o mais recente).
  - `getEvolucaoDoCorpo(supabase: any, pacienteId: string, desde: string, ate: string): Promise<Res<LinhaDoCorpo[]>>` — `.gte("date", desde).lte("date", ate)`, ordem por `date` e `created_at`, `.limit(1000)`; 1.000 linhas → `falhou: true`.
  - `<AnelDaMeta progresso={ProgressoDaMeta} meta={number} inicio={string} />`, `<GraficoPeso inicio={string} semanas={SemanaDePeso[]} pontosDaConsulta={PontoDeConsulta[]} datasDasConsultas={string[]} meta={number | null} escala={ReturnType<typeof escalaDoPeso>} titulo={TituloDoPeso} descricao={string} />`, `<GraficoMedida nome={string} unidade={string} pontos={PontoDeMedida[]} descricao={string} />` — componentes de cliente (`"use client"`), props serializáveis; `datasDasConsultas` são os dias (`diaDaConsulta`) das consultas realizadas no período, com ou sem medida.

- [ ] **Step 1: Verificação de tela que falha** (Verificação 20 em `tirar-prints-nutri.cjs`, computador 1440 e celular 390, claro e escuro), no paciente da Task 5, `?aba=corpo`:
  - o anel com "50%" (ou o número da Task 5) e "N de M kg desde dd/mm";
  - "média da semana" no título do peso, a linha (`.recharts-line-curve`) com **duas** partes (a lacuna), o texto "sem pesagem", seis pontos de consulta, a linha da meta com "meta 66 kg";
  - hover numa semana mostra "Semana de", a média e "pesagens"; no celular, toque;
  - cintura e % de gordura com o último valor e a variação;
  - Peso atual "em dd/mm, na consulta" no dia com as duas medidas;
  - pouco dado: um paciente do `carteira` com menos de 2 semanas de pesagem desde o início do vínculo e menos de 2 consultas com peso mostra "Ainda não dá para ver tendência" no lugar do gráfico (ache nos dados do mock; se nenhum servir, o paciente dos exames da Task 5 fica sem pesagem e serve);
  - `/__falhar {"tabela":"body_measurements"}` → o erro da aba, não "Ainda não dá"; depois `/__reset`;
  - celular sem transbordo; tema escuro com a linha e os pontos visíveis (cor computada diferente do fundo).
- [ ] **Step 2:** Rodar e ver falhar.
- [ ] **Step 3:** Pares novos em `PARES_GRAFICO` (`["primaria", "chao"]`, `["texto", "chao"]`, `["campo", "chao"]` se ainda não estiver, `["primaria", "primaria-fundo"]` para a faixa do exame) e teste passando nos dois temas.
- [ ] **Step 4:** `lib/evolucaoDb.ts` com as duas leituras. Em `Corpo.tsx`, as leituras novas no mesmo `Promise.all` de hoje; qualquer `falhou` → `ErroSecao` da aba (como hoje). O anel no lugar do "faltam N kg" (sem anel → o texto de hoje); o bloco "Evolução" entre o topo e o "Ver medidas registradas", nesta ordem: título, gráfico do peso (ou "Ainda não dá para ver tendência" com o que há), cintura e % de gordura (cada um só com 2+ pontos; a linha que diz qual ficou de fora).
- [ ] **Step 5:** `GraficoPeso` com recharts (`ComposedChart`, eixo X numérico em dias desde o início, marcas nos meses; `Line` da média com `connectNulls={false}`; os pontos da consulta como série só de pontos, cheios em `var(--clin-texto)` com anel `var(--clin-chao)`; `ReferenceLine` vertical tracejada em `var(--clin-linha)` por consulta realizada; `ReferenceLine` da meta em `var(--clin-campo)` tracejada quando `metaNaEscala`, senão o rótulo "meta N kg ↓/↑" no canto; dica própria com "Semana de dd/mm a dd/mm", "semana em curso" quando for, a média, "N pesagens", menor–maior; no ponto da consulta, "consulta de dd/mm" e o valor). `figure` + `figcaption` com o título e a legenda das maquetes; SVG com `role="img"` e `aria-label={descricao}`. `GraficoMedida` igual, menor, ponto cheio (consulta) e vazado (casa). `AnelDaMeta`: SVG com trilho `var(--clin-linha)` e arco `var(--clin-primaria)`; "lado-errado" com o texto em `text-clin-atencao dark:text-clin-atencao`.
- [ ] **Step 6:** `npm test && npx tsc --noEmit && node ferramentas/tirar-prints-nutri.cjs` — tudo passa, zero erro de console.
- [ ] **Step 7: Commit** — `git commit -m "Corpo: anel da meta e Evolução com média semanal, consultas, cintura e % de gordura"`

### Task 7: Aba Clínico com o comparativo dos exames

**Files:**
- Create: `components/clinico/graficos/MiniGrafico.tsx`
- Modify: `app/app/pacientes/[id]/secoes/Clinico.tsx`, `app/app/pacientes/[id]/page.tsx` (passar sexo e nascimento), `ferramentas/tirar-prints-nutri.cjs`

**Interfaces:**
- Consumes: Task 4 (`compararExames`, `resumoDoComparativo`, `descricaoDaSerie`, `LinhaDoComparativo`); `idadeEm(nascimento, hoje)` de `lib/date.ts`; o perfil da página já lê `sex` e `birth_date`.
- Produces: `<Clinico uid sexo nascimento />`; `<MiniGrafico serie faixa descricao />` (SVG simples, sem recharts: 120×36, faixa em `var(--clin-primaria-fundo)`, linha e pontos em `var(--clin-texto)`).

- [ ] **Step 1: Verificação de tela que falha** (continua a Verificação 20), no paciente dos exames, `?aba=clinico`:
  - a linha de resumo com os três números;
  - a tabela na ordem: Triglicerídeos, LDL, … , Ferritina por último;
  - "saiu da faixa" em Triglicerídeos, "mais perto da faixa" em LDL, "entrou na faixa" em Vitamina D;
  - "Glicose" e "Glicemia de jejum" numa linha só, com minigráfico;
  - minigráfico só nas linhas com 3+ resultados (conte os `svg[role=img]` da tabela);
  - "unidade diferente do anterior" na linha do exame da Task 5;
  - "Ver todos os resultados (N)" abre a lista de hoje;
  - um paciente com exames de um resultado cada → "Sem comparação ainda" e a lista;
  - `/__falhar {"tabela":"exams"}` → o erro da aba; `/__reset`;
  - celular: a tabela rola dentro da caixa, a página não transborda.
- [ ] **Step 2:** Rodar e ver falhar.
- [ ] **Step 3:** Em `Clinico.tsx`, a leitura de exames com `.limit(200)` e 200 linhas → falha; o bloco "Exames" vira: resumo, tabela do comparativo (colunas e textos das maquetes: Exame com "ref. …", Último com selo e data, Anterior "valor · dd/mm", O que mudou, Tendência com `MiniGrafico` ou "N resultados"), a nota da ordem e o botão "Ver todos os resultados (N)" que mostra a lista atual (a de hoje, sem mudar). Todos com um resultado → "Sem comparação ainda" + a lista. Caixa com rolagem e foco como a de "Medidas registradas".
- [ ] **Step 4:** `npm test && npx tsc --noEmit && node ferramentas/tirar-prints-nutri.cjs` — tudo passa.
- [ ] **Step 5: Commit** — `git commit -m "Clínico: comparativo dos exames com minigráfico"`

### Task 8: Documentação e verificação final

**Files:**
- Modify: `CLAUDE.md`, `ferramentas/LEIAME.md`, a spec (só se a execução decidiu algo diferente)

- [ ] **Step 1: CLAUDE.md** — na "A página do paciente (nutricionista)", um parágrafo curto sobre os gráficos (onde moram, lógica em `lib/evolucao.ts` e `lib/exames.ts`, cores só por variável, leitura cheia = falha); `lib/evolucao.ts` e `lib/exames.ts` na "Lógica testada"; a frase de `pesoDoDia` na seção do registro passa a valer de verdade (confira); contagem de testes atualizada. Corrija também no LEIAME a frase que exagera o que o Supabase em memória confere (pendência da revisão final do registro).
- [ ] **Step 2: Suíte inteira.** `npm test && npx tsc --noEmit`; parar o dev (por PID); `npm run build`; subir o dev; `node ferramentas/tirar-prints-nutri.cjs && node ferramentas/conferir-consulta-paciente.cjs` — tudo passa.
- [ ] **Step 3: Commit** — `git commit -m "Docs: gráficos do nutricionista no CLAUDE.md"`
