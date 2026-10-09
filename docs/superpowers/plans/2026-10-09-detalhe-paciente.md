# Detalhe do paciente: página única e piloto visual — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar as 7 abas de `/app/pacientes/[id]` por uma página única
organizada pelo que o nutricionista faz, com edição no lugar e a direção
visual "Clínico sereno" aplicada só nesta página.

**Architecture:** A conta nova é feita por funções puras com teste:
- em `lib/nutri.ts`: médias de 7 dias, real × meta e o tipo de cada alerta;
- em `lib/planCheckIn.ts`: os estados da semana de treino;
- em `lib/edicao.ts`: a regra de uma edição por vez;
- em `lib/temaClinico.ts`: a paleta.

A página vira um componente de servidor que monta seções assíncronas dentro
de `Suspense`. A edição usa os editores que já existem, tirados do
`PrescricaoClient` e coordenados por um contexto de cliente. O visual entra
por um `layout.tsx` da rota, que carrega a fonte e as variáveis de cor.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Tailwind 3, Supabase
(RLS), Vitest, Playwright fora do `package.json` (só para os prints).

**Spec:** `docs/superpowers/specs/2026-10-09-detalhe-paciente-design.md`

## Global Constraints

- Interface, comentários e commits em português do Brasil; comentário explica **por quê**.
- Segurança só por RLS. Nada de service role. Nenhum caminho de gravação novo: metas por `set_patient_goals`; conversa e notas em `patient_notes`; treino nas mesmas tabelas de hoje (`routines`, `routine_exercises`, `workout_plan`).
- Datas só com `todayISO`, `addDaysISO`, `naJanela` e `weekDates` de `lib/`. Nunca `toLocaleDateString` sem `timeZone` e nunca `toISOString().slice(0,10)`.
- `profiles` sempre filtrado por `id`. Tratamento ativo sempre com `.order("created_at", { ascending: false }).limit(1).maybeSingle()`.
- Cor nos componentes novos só por classes `clin-*`, dentro de `.tema-clinico`. Nenhum hex solto em componente.
- Contraste: texto ≥ 4,5:1 e elemento gráfico ≥ 3:1, nos dois temas.
- Ações principais com ≥ 44 px de altura; ações secundárias com ≥ 40 px.
- Tipografia: Instrument Sans em tudo; nome do paciente 24 px, título de seção 18 px, texto 14–15 px, rótulos 13 px; números com `tabular-nums`.
- Duas colunas a partir de 1024 px (`lg:`), com coluna lateral de 360 px; abaixo disso, uma coluna.
- Limites de atenção: calorias com |Δ| > 10%; proteína e água com Δ < −10% (Δ arredondado para inteiro).
- Comandos:
  - testes: `npm test`, ou um arquivo com `npx vitest run <arquivo>`;
  - tipos: `npx tsc --noEmit -p .`;
  - build: `npm run build`, nunca com o `npm run dev` no ar;
  - prints: `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm i --no-save playwright`.

## Review Focus

1. **Paciente com dois tratamentos ativos.** A seção Clínico mostra o mais recente; não pode sumir. Hoje `TabClinico` usa `maybeSingle()` sem `limit`, que falha com duas linhas. Coberto na Tarefa 8, passo 4, e na Tarefa 9 (cenário "dois tratamentos").
2. **Rascunho de metas aberto quando outra ação recarrega a página** (enviar mensagem, reaplicar). O rascunho continua lá depois do `router.refresh()`. Coberto na Tarefa 9 (verificação "rascunho sobrevive").
3. **Voltar do celular com `?conversa=1`.** Fecha a conversa e fica na página do paciente. Coberto na Tarefa 9 (verificação "voltar fecha a conversa").
4. **Meta zero ou ausente.** Sem divisão por zero; a tela mostra "Definir metas". Coberto na Tarefa 3 (teste "meta zero conta como sem meta") e na Tarefa 9 (paciente recém-chegado).
5. **Paciente sem vínculo ativo** (a RLS devolve o perfil nulo). Mostra "Sem acesso a este paciente", e nenhuma seção chega a consultar. Coberto na Tarefa 9 (cenário "sem vínculo").

---

### Task 1: Confirmar o que `set_patient_goals` faz (portão, sem código)

**Files:** nenhum, além da spec (seção "Riscos", item 1), onde o resultado fica anotado.

**Interfaces:**
- Produces: a decisão de como o `ReaplicarMetas` da Tarefa 7 grava. Ou só a RPC, ou a RPC mais a baixa em `prescription_deviations`.

- [ ] **Step 1: Ler a definição da função.** Pedir ao dono do produto que rode no SQL Editor do Supabase, ou rodar pela conexão Supabase desta sessão **com autorização explícita** (só leitura):

```sql
select pg_get_functiondef('public.set_patient_goals'::regproc);
```

- [ ] **Step 2: Responder duas perguntas e anotar na spec.**
  - (a) Com `p_calories` nulo, a função apaga a meta ou mantém a anterior?
  - (b) A função preenche `acknowledged_at` em `prescription_deviations` do paciente?
- [ ] **Step 3: Decidir.**
  - Se (b) for sim: `ReaplicarMetas` chama só a RPC.
  - Se (b) for não: conferir se a RLS deixa o nutricionista dar `update` em `acknowledged_at`. Se deixar, `ReaplicarMetas` faz a RPC e depois esse `update`. Se não deixar, **parar e levar ao dono do produto**: isso exige migração, e migração está fora deste plano.
- [ ] **Step 4: Commit da spec atualizada.**

```bash
git add docs/superpowers/specs/2026-10-09-detalhe-paciente-design.md
git commit -m "Spec: o que set_patient_goals faz, confirmado no banco"
```

### Task 2: Tipo de cada alerta no resumo

**Files:**
- Modify: `lib/nutri.ts` (tipo `PatientSummary`, função `alertar` dentro de `montarResumos`)
- Test: `lib/nutri.test.ts`

**Interfaces:**
- Produces:
  - `export type TipoAlerta = "dose" | "prescricao" | "parado" | "treino" | "exame"`
  - `export type Alerta = { tipo: TipoAlerta; nivel: number; texto: string }`
  - `PatientSummary.alertas: Alerta[]`

  `PatientSummary.alerts: string[]` continua igual, porque `NutriHome` e `PacientesClient` usam.

- [ ] **Step 1: Escrever o teste que falha** (novo `describe("montarResumos — tipo dos alertas")`, reaproveitando os dados do teste "os alertas saem do mais grave para o menos grave"):

```ts
expect(r.alertas.map((a) => a.tipo)).toEqual([
  "dose", "prescricao", "parado", "treino", "treino", "exame",
]);
expect(r.alertas.map((a) => a.texto)).toEqual(r.alerts);
expect(r.alertas.map((a) => a.nivel)).toEqual([1, 2, 3, 4, 4, 5]);
// e, num paciente sem dado nenhum:
expect(resumo({}).alertas).toEqual([
  { tipo: "parado", nivel: 3, texto: "Nunca registrou nada" },
]);
```

- [ ] **Step 2:** `npx vitest run lib/nutri.test.ts`. Esperado: FAIL com `r.alertas` indefinido.
- [ ] **Step 3: Implementar.** `alertar(tipo: TipoAlerta, nivel: number, texto: string)` empurra em `summary.alertas` e em `summary.alerts`, e atualiza `gravidade` como hoje.
- [ ] **Step 4:** `npm test`. Esperado: tudo PASS.
- [ ] **Step 5: Commit.** `"Resumo do paciente guarda o tipo de cada alerta"`

### Task 3: Médias de 7 dias e real × meta

**Files:**
- Modify: `lib/nutri.ts`
- Test: `lib/nutri.test.ts`

**Interfaces:**
- Consumes: `DailySeries` (já em `lib/nutri.ts`); `naJanela(data, hoje, dias)` de `lib/date.ts`.
- Produces:
  - `export type Media = { valor: number | null; dias: number }`
  - `export type MediasDaSemana = { calorias: Media; proteina: Media; agua: Media }`
  - `export function mediasDaSemana(serie: DailySeries[], hoje: string): MediasDaSemana`. A água sai em ml.
  - `export type ItemMeta = "calorias" | "proteina" | "agua"`
  - `export type StatusMeta = "ok" | "atencao" | "sem-meta" | "sem-dado"`
  - `export type Comparacao = { delta: number | null; status: StatusMeta }`
  - `export function compararComMeta(item: ItemMeta, real: number | null, meta: number | null): Comparacao`

- [ ] **Step 1: Escrever os testes que falham** (`HOJE = "2026-10-08"`; o helper `dia(date, calories, protein, water)` preenche `sleep: null, workouts: 0, weight: null`):

```ts
it("média só dos dias com registro daquele item", () => {
  const m = mediasDaSemana(
    [dia("2026-10-08", 2000, 90, 2000), dia("2026-10-07", 0, 0, 0), dia("2026-10-06", 1801, 80, 0)],
    HOJE
  );
  expect(m.calorias).toEqual({ valor: 1901, dias: 2 }); // 1900,5 arredonda
  expect(m.proteina).toEqual({ valor: 85, dias: 2 });
  expect(m.agua).toEqual({ valor: 2000, dias: 1 });
});
it("o oitavo dia e o futuro ficam fora", () => {
  const m = mediasDaSemana(
    [dia("2026-10-01", 3000, 200, 3000), dia("2026-10-09", 3000, 200, 3000), dia("2026-10-02", 1500, 60, 1500)],
    HOJE
  );
  expect(m.calorias).toEqual({ valor: 1500, dias: 1 });
});
it("sem registro, valor nulo", () => {
  expect(mediasDaSemana([], HOJE).agua).toEqual({ valor: null, dias: 0 });
});

it.each([
  ["calorias", 2050, 1800, { delta: 14, status: "atencao" }],
  ["calorias", 1980, 1800, { delta: 10, status: "ok" }],
  ["calorias", 1600, 1800, { delta: -11, status: "atencao" }],
  ["proteina", 92, 110, { delta: -16, status: "atencao" }],
  ["proteina", 130, 110, { delta: 18, status: "ok" }],
  ["agua", 1900, 2500, { delta: -24, status: "atencao" }],
  ["agua", 2300, 2500, { delta: -8, status: "ok" }],
  ["calorias", 2000, null, { delta: null, status: "sem-meta" }],
  ["calorias", null, 1800, { delta: null, status: "sem-dado" }],
])("compararComMeta(%s, %s, %s)", (item, real, meta, esperado) => {
  expect(compararComMeta(item as ItemMeta, real, meta)).toEqual(esperado);
});
it("meta zero conta como sem meta", () => {
  expect(compararComMeta("calorias", 2000, 0)).toEqual({ delta: null, status: "sem-meta" });
});
```

- [ ] **Step 2:** `npx vitest run lib/nutri.test.ts`. Esperado: FAIL, `mediasDaSemana is not a function`.
- [ ] **Step 3: Implementar.**
  - `mediasDaSemana`: só datas com `naJanela(d.date, hoje, 7)`; para cada item, só os dias com valor `> 0`; `Math.round(soma / dias)`.
  - `compararComMeta`: `delta = Math.round((real / meta - 1) * 100)`. O status é decidido sobre o **delta arredondado**, para a tela nunca mostrar "+10%" em atenção. Meta nula ou ≤ 0 vira `sem-meta`; real nulo vira `sem-dado`. Os limites ficam numa constante com comentário citando a spec.
- [ ] **Step 4:** `npm test`. Esperado: PASS.
- [ ] **Step 5: Commit.** `"Média dos dias com registro e comparação com a meta, com teste"`

### Task 4: Estados da semana de treino e regra de uma edição por vez

**Files:**
- Modify: `lib/planCheckIn.ts` · Test: `lib/planCheckIn.test.ts`
- Create: `lib/edicao.ts` · Test: `lib/edicao.test.ts`
- Create: `components/clinico/Edicao.tsx`

**Interfaces:**
- Consumes: `weekDates(iso)` e `indexCompletions` de `lib/planCheckIn.ts`.
- Produces:
  - `export type EstadoDia = "feito" | "falta" | "sem-resposta" | "hoje" | "previsto" | "descanso" | "livre"`
  - `export function estadosDaSemana(plano: { id: string; day_of_week: number; sport: string | null }[], checkins: Completion[], hoje: string): { data: string; estado: EstadoDia }[]`, com 7 itens de segunda a domingo da semana de `hoje`.
  - `export type SecaoEditavel = "metas" | "cardapio" | "treino"`
  - `export type EstadoEdicao = { aberta: SecaoEditavel | null; suja: boolean }`
  - `export type AcaoEdicao = { tipo: "abrir"; secao: SecaoEditavel } | { tipo: "sujar" } | { tipo: "fechar" }`
  - `export function reduzirEdicao(e: EstadoEdicao, a: AcaoEdicao): EstadoEdicao`
  - `export function podeAbrir(e: EstadoEdicao, secao: SecaoEditavel): boolean`
  - `EdicaoProvider` e `useEdicao(secao: SecaoEditavel): { editando: boolean; bloqueadaPor: string | null; abrir(): void; fechar(): void; marcarSuja(): void }`. `bloqueadaPor` é o rótulo da seção que impede ("Metas", "Cardápio" ou "Treino").

- [ ] **Step 1: Escrever os testes que falham.** Em `planCheckIn.test.ts`, com `HOJE = "2026-10-08"` (quinta) e `SEMANA` igual à do arquivo:
  - plano com `{id:"a",day_of_week:SEG,sport:"Musculação"}`, `{id:"b",day_of_week:QUA,sport:"Corrida"}`, `{id:"c",day_of_week:1,sport:"Corrida"}` (terça), `{id:"d",day_of_week:3,sport:"Corrida"}` (quinta, hoje), `{id:"e",day_of_week:5,sport:"Corrida"}` (sábado) e `{id:"f",day_of_week:6,sport:"Descanso"}`;
  - check-ins `check("a","2026-10-05","done")` e `check("b","2026-10-07","skipped")`;
  - esperado: `estadosDaSemana(...).map(d => d.estado)` igual a `["feito","sem-resposta","falta","hoje","livre","previsto","descanso"]`, e `[0].data === "2026-10-05"`.

  Em `edicao.test.ts`:

```ts
const vazio = { aberta: null, suja: false };
it("abre e marca como suja", () => {
  const e = reduzirEdicao(reduzirEdicao(vazio, { tipo: "abrir", secao: "metas" }), { tipo: "sujar" });
  expect(e).toEqual({ aberta: "metas", suja: true });
});
it("seção suja bloqueia as outras, não a si mesma", () => {
  const e = { aberta: "metas" as const, suja: true };
  expect(podeAbrir(e, "treino")).toBe(false);
  expect(podeAbrir(e, "metas")).toBe(true);
  expect(reduzirEdicao(e, { tipo: "abrir", secao: "treino" })).toEqual(e);
});
it("seção limpa cede o lugar", () => {
  expect(reduzirEdicao({ aberta: "metas", suja: false }, { tipo: "abrir", secao: "treino" }))
    .toEqual({ aberta: "treino", suja: false });
});
it("fechar limpa tudo", () => {
  expect(reduzirEdicao({ aberta: "treino", suja: true }, { tipo: "fechar" })).toEqual(vazio);
});
```

- [ ] **Step 2:** `npx vitest run lib/planCheckIn.test.ts lib/edicao.test.ts`. Esperado: FAIL, funções ausentes.
- [ ] **Step 3: Implementar.**
  - `estadosDaSemana`: sessão com `sport` contendo "descanso" vira `descanso`; dia sem sessão vira `livre`. Hoje, com check-in `done` ou `skipped`, vira `feito` ou `falta`; sem check-in, `hoje`. Num dia com mais de uma sessão, vale o pior estado, na ordem falta > sem-resposta > feito.
  - `reduzirEdicao` e `podeAbrir` como os testes pedem.
  - `Edicao.tsx` (`"use client"`): um `useReducer(reduzirEdicao)` num contexto. Os rótulos ficam em `{ metas: "Metas", cardapio: "Cardápio", treino: "Treino" }`.
- [ ] **Step 4:** `npm test` e `npx tsc --noEmit -p .`. Esperado: PASS e sem erros.
- [ ] **Step 5: Commit.** `"Semana de treino e regra de uma edição por vez, com teste"`

### Task 5: Paleta clínica, contraste testado e escopo do visual

**Files:**
- Create: `lib/contraste.ts` · Test: `lib/contraste.test.ts`
- Create: `lib/temaClinico.ts` · Test: `lib/temaClinico.test.ts`
- Create: `app/app/pacientes/[id]/layout.tsx`
- Modify: `tailwind.config.ts` (adicionar `colors.clin` e `fontFamily.clinico`)
- Modify: `app/estilo/page.tsx` (usar `razaoContraste` no lugar das funções locais `rgb`, `lum` e `razao`; adicionar a seção "Tema clínico (piloto)")

**Interfaces:**
- Produces:
  - `export function razaoContraste(a: string, b: string): number`
  - `export type NomeCor` = `"chao" | "texto" | "texto-2" | "linha" | "primaria" | "sobre-primaria" | "primaria-fundo" | "atencao" | "atencao-fundo" | "atencao-texto-2" | "perigo" | "perigo-fundo"`
  - `export const NOMES_COR: NomeCor[]`
  - `export const TEMA_CLINICO: Record<"claro" | "escuro", Record<NomeCor, string>>`
  - `export const PARES_TEXTO: [NomeCor, NomeCor][]` (frente, fundo)
  - `export const PARES_GRAFICO: [NomeCor, NomeCor][]`
  - `export function cssDoTemaClinico(): string`
  - as classes Tailwind `bg-clin-*`, `text-clin-*` e `border-clin-*`, mais `font-clinico`.

Valores (claro / escuro):

| | claro | escuro |
|---|---|---|
| chao | `#ffffff` | `#0c1210` |
| texto | `#111827` | `#e7ece9` |
| texto-2 | `#4b5563` | `#a3b1aa` |
| linha | `#e5e7eb` | `#24302b` |
| primaria | `#0e5d34` | `#3fd27b` |
| sobre-primaria | `#ffffff` | `#062e1a` |
| primaria-fundo | `#e7f3ec` | `#16291f` |
| atencao | `#9a3412` | `#fdba74` |
| atencao-fundo | `#fff7ed` | `#24180c` |
| atencao-texto-2 | `#4b5563` | `#c9b9a6` |
| perigo | `#9f1239` | `#fda4af` |
| perigo-fundo | `#fdecea` | `#2d1418` |

Pares:
- `PARES_TEXTO`: texto/chao, texto-2/chao, primaria/chao, sobre-primaria/primaria, primaria/primaria-fundo, texto-2/primaria-fundo, atencao/atencao-fundo, texto/atencao-fundo, atencao-texto-2/atencao-fundo, perigo/perigo-fundo.
- `PARES_GRAFICO`: primaria/linha, atencao/linha.

- [ ] **Step 1: Escrever os testes que falham.**

```ts
// contraste.test.ts
expect(razaoContraste("#000000", "#ffffff")).toBeCloseTo(21, 1);
expect(razaoContraste("#ffffff", "#ffffff")).toBe(1);
expect(razaoContraste("#0e5d34", "#ffffff")).toBe(razaoContraste("#ffffff", "#0e5d34"));

// temaClinico.test.ts
it.each(["claro", "escuro"] as const)("texto passa 4,5:1 no tema %s", (t) => {
  for (const [f, b] of PARES_TEXTO)
    expect(razaoContraste(TEMA_CLINICO[t][f], TEMA_CLINICO[t][b]), `${f} sobre ${b}`).toBeGreaterThanOrEqual(4.5);
});
it.each(["claro", "escuro"] as const)("gráfico passa 3:1 no tema %s", (t) => {
  for (const [f, b] of PARES_GRAFICO)
    expect(razaoContraste(TEMA_CLINICO[t][f], TEMA_CLINICO[t][b])).toBeGreaterThanOrEqual(3);
});
it("toda cor existe nos dois temas", () => {
  expect(Object.keys(TEMA_CLINICO.escuro).sort()).toEqual(Object.keys(TEMA_CLINICO.claro).sort());
});
it("o CSS define os dois temas", () => {
  const css = cssDoTemaClinico();
  expect(css).toContain(".tema-clinico{--clin-chao:#ffffff;");
  expect(css).toContain(".dark .tema-clinico{--clin-chao:#0c1210;");
});
```

- [ ] **Step 2:** `npx vitest run lib/contraste.test.ts lib/temaClinico.test.ts`. Esperado: FAIL, módulos ausentes.
- [ ] **Step 3: Implementar.**
  - `lib/contraste.ts`: as funções da `/estilo`, movidas.
  - `lib/temaClinico.ts`: a tabela acima.
  - `layout.tsx`: `Instrument_Sans` de `next/font/google` com `variable: "--font-clinico"`. Renderiza `<style dangerouslySetInnerHTML={{ __html: cssDoTemaClinico() }} />` e envolve `children` em `<div className={`${fonte.variable} tema-clinico font-clinico bg-clin-chao text-clin-texto`}>`.
  - Tailwind: `clin` é gerado de `NOMES_COR` por import relativo (`./lib/temaClinico`), para a lista de nomes ter uma fonte só.
- [ ] **Step 4:** `npm test`, depois `npx tsc --noEmit -p .`, depois `npm run build`. Esperado: tudo verde.
- [ ] **Step 5: Commit.** `"Paleta clínica com contraste testado, escopada na página do paciente"`

### Task 6: Componentes de apresentação do piloto

Não há teste unitário de componente; isso foi decidido em `vitest.config.mts`. A verificação é o build agora e os prints da Tarefa 9.

**Files:** criar em `components/clinico/`:
- `Secao.tsx`
- `AlertaFila.tsx`
- `Numeros.tsx`
- `BarraMeta.tsx`
- `TabelaRealMeta.tsx`
- `SemanaTreino.tsx`

**Interfaces:**
- Consumes: `Alerta`, `Comparacao` (Tarefas 2 e 3); `EstadoDia` (Tarefa 4).
- Produces (todos componentes de servidor, sem `"use client"`):
  - `Secao({ id, titulo, acao, children }: { id: string; titulo: string; acao?: React.ReactNode; children: React.ReactNode })`: `<section id aria-labelledby>`, título `h2` de 18 px.
  - `AlertaFila({ alertas, acoes }: { alertas: Alerta[]; acoes: (a: Alerta) => React.ReactNode })`. Sem alertas, não renderiza nada.
  - `Numeros({ itens }: { itens: { valor: string; rotulo: string }[] })`: três colunas separadas por `border-clin-linha`, sem caixa.
  - `BarraMeta({ rotulo, realTexto, metaTexto, proporcao, comparacao, nota }: { rotulo: string; realTexto: string; metaTexto: string | null; proporcao: number | null; comparacao: Comparacao; nota?: string })`: barra de 4 px, `bg-clin-primaria` ou `bg-clin-atencao` conforme o status.
  - `TabelaRealMeta({ linhas }: { linhas: { item: string; real: string; meta: string; comparacao: Comparacao }[] })`: colunas Item | Real | Meta | Δ, com `tabular-nums`. O Δ aparece como `+14%`, ou como "—" em `sem-meta` e `sem-dado`.
  - `SemanaTreino({ dias }: { dias: { data: string; estado: EstadoDia }[] })`: 7 células; o rótulo do dia vem de `["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"]`. Cada estado tem texto além da cor (✓, ✕, ?, hoje, •, desc.), para não depender só da cor.

- [ ] **Step 1: Implementar os seis componentes,** só com classes `clin-*` e `font-clinico`, sem hex solto.
- [ ] **Step 2:** `npx tsc --noEmit -p .` e `npm run build`. Esperado: sem erros.
- [ ] **Step 3: Commit.** `"Componentes do piloto clínico: seção, fila, números, metas e semana"`

### Task 7: Editores tirados do `PrescricaoClient`

O comportamento de gravação não muda. A verificação é tipo, build e os prints da Tarefa 9.

**Files:**
- Create: `components/clinico/tipos.ts`, que recebe os tipos `Rotina`, `ExercicioRotina`, `PlanoItem`, `Desvio` e `Mensagem` de `components/PrescricaoClient.tsx:43-96`.
- Create: `components/clinico/Editavel.tsx`, `EditorMetas.tsx` (de `AbaMetas`, `PrescricaoClient.tsx:280-355`), `EditorTreino.tsx` (de `AbaTreino`, `:358-766`), `Conversa.tsx` (de `AbaConversa`, `:767-874`), `NotasPrivadas.tsx` (de `AbaNotas`, `:875-968`) e `ReaplicarMetas.tsx`.

**Interfaces:**
- Consumes: `useEdicao` (Tarefa 4); a decisão da Tarefa 1.
- Produces (todos `"use client"`):
  - `Editavel({ secao, rotuloBotao, children, editor }: { secao: SecaoEditavel; rotuloBotao: string; children: React.ReactNode; editor: React.ReactNode })`.
    - Fora de edição: mostra `children`, que é a leitura renderizada no servidor, e um botão `rotuloBotao`.
    - Em edição: mostra `editor` e, acima dele, um botão "Fechar edição" que chama `fechar()`. O `MealPlanEditor` e o `EditorTreino` gravam a cada ação e não têm Cancelar próprio.
    - Com `bloqueadaPor`: o botão fica desativado, com o aviso "Salve ou cancele a edição de {bloqueadaPor}".
  - `EditorMetas({ pacienteId, metas })`: mesmos campos e mesma RPC de `AbaMetas`. Chama `marcarSuja()` no primeiro `onChange` e `fechar()` depois de salvar.
  - `EditorTreino({ pacienteId, nutriId, rotinas, exercicios, plano })`.
  - `Conversa({ pacienteId, nutriId, mensagens })`.
  - `NotasPrivadas({ pacienteId, nutriId, notas })`.
  - `ReaplicarMetas({ pacienteId, prescricao }: { pacienteId: string; prescricao: { daily_calorie_goal: number | null; protein_goal_g: number | null; daily_water_goal_ml: number | null; weight_goal_kg: number | null } })`: o rótulo é "Reaplicar {kcal} kcal"; depois de gravar, `router.refresh()`.
  - Em todos, o erro fica num estado local e aparece embaixo do formulário. Sai a prop `setErro`.

- [ ] **Step 1: Mover os tipos e os quatro editores** sem mudar as chamadas ao Supabase. Cada um troca `setErro` por um estado local.
- [ ] **Step 2: Implementar `Editavel` e `ReaplicarMetas`.** O `ReaplicarMetas` chama `set_patient_goals` com os quatro valores da prescrição, mais o que a Tarefa 1 decidiu.
- [ ] **Step 3:** `npx tsc --noEmit -p .` e `npm run build`. Esperado: sem erros. O `PrescricaoClient.tsx` ainda existe e continua compilando até a Tarefa 8.
- [ ] **Step 4: Commit.** `"Editores da prescrição viram componentes por assunto, com erro no lugar"`

### Task 8: Página única com seções em `Suspense`

**Files:**
- Rewrite: `app/app/pacientes/[id]/page.tsx`
- Create: `app/app/pacientes/[id]/secoes/` com `Cabecalho.tsx`, `Fila.tsx`, `Alimentacao.tsx`, `Treino.tsx`, `Corpo.tsx`, `Clinico.tsx`, `ConversaENotas.tsx` e `ErroSecao.tsx` (este último `"use client"`)
- Create: `app/app/pacientes/[id]/linha-do-tempo/page.tsx`
- Delete: `components/PrescricaoClient.tsx`

**Interfaces:**
- Consumes: tudo das Tarefas 2 a 7; `getPatientsSummary`, `getPatientSeries`, `getPatientActivity`, `computeAdherence`.
- Produces: a rota final. `ErroSecao({ secao }: { secao: string })` mostra "Não foi possível carregar {secao}" e um botão "Tentar de novo", que chama `router.refresh()`.

- [ ] **Step 1: Reescrever `page.tsx`.**
  - Manter a consulta de perfil e a tela "Sem acesso a este paciente" de hoje.
  - `?t=atividade` faz `redirect` para `/app/pacientes/{id}/linha-do-tempo`; os outros valores de `t` são ignorados.
  - Calcular o resumo com `getPatientsSummary(supabase, [uid], { [uid]: name })`.
  - Layout: `lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-6`.
  - Cada seção fica num `<Suspense fallback={<SkelCard />}>`.
  - `?conversa=1` ou `?notas=1`, abaixo de `lg`, mostra só aquela parte em tela cheia, com link "Voltar" que tira o parâmetro.
- [ ] **Step 2: Escrever as seções.**
  - As consultas vêm das funções `Tab*` atuais e de `TabPrescricao` (`page.tsx:1204-1283`). Cada consulta checa `error` e, se houver, a seção mostra `<ErroSecao>`.
  - **`Alimentacao`:** busca a última linha de `prescriptions` (`.eq("patient_id", uid).order("created_at", { ascending: false }).limit(1).maybeSingle()`) e os desvios.
    - Calcula `mediasDaSemana(await getPatientSeries(supabase, uid, 14), today)`.
    - Mostra `BarraMeta` abaixo de `lg` e `TabelaRealMeta` a partir de `lg`.
    - Mostra a nota "média de N dias com registro" e, para cada desvio de meta aberto, "ela está usando {current_value}".
    - `Editavel` "Editar metas" com `EditorMetas`, e `Editavel` "Editar cardápio" com `MealPlanEditor`.
    - O histórico de refeições fica num `<details>` "Ver histórico".
  - **`Treino`:** `SemanaTreino` com `estadosDaSemana`, a adesão de 28 dias, e `Editavel` "Editar plano" com `EditorTreino`. Os treinos de 30 dias ficam em "Ver histórico".
  - **`Corpo`:** peso, variação, a meta de peso com o link "editar nas metas" (`#alimentacao`) e as medidas em "Ver histórico".
  - **`Fila`:** `AlertaFila` com as ações por tipo, conforme a tabela da spec:
    - `dose` e `parado`: Conversar;
    - `prescricao`: Reaplicar e Conversar;
    - `treino`: Ver semana (`#treino`);
    - `exame`: Ver clínico (`#clinico`).

    Conversar aponta para `?conversa=1` no celular e para `#conversa` a partir de `lg`. Depois vêm os `Numeros`, com três itens:
    - `` `${daysLogged7}/7` `` — "dias com registro";
    - `` `${planConfirmadas7} de ${planPrevistas7}` `` — "treinos (7 dias)", ou "—" quando não há treino previsto;
    - `weightDelta30` com sinal e vírgula ("−1,4 kg") — "peso em 30 dias", ou "—" quando falta medida.
  - **`Cabecalho`:** nome; idade, sexo e altura; "Mensagem" com a contagem de mensagens do paciente com `read_at` nulo; "Nota privada"; link "Linha do tempo". Mensagem e Nota usam `?conversa=1` e `?notas=1` abaixo de `lg`, e `#conversa` e `#notas` a partir de `lg`.
  - **Estados vazios:**

    | Situação | A seção mostra |
    |---|---|
    | sem plano de treino | "Prescrever plano", que abre o editor de Treino |
    | sem cardápio | "Montar cardápio", que abre o editor de cardápio |
    | sem metas | "Definir metas", que abre o editor de metas |
    | sem registro nenhum | "—" nos números |
    | sem tratamento ativo | "Sem tratamento ativo" |
    | conversa vazia | só a caixa de escrever |
- [ ] **Step 3:** passar `TabAtividade` para `linha-do-tempo/page.tsx`, com link de volta.
- [ ] **Step 4: Em `Clinico`, o tratamento usa `.order("created_at", { ascending: false }).limit(1).maybeSingle()`.** É o item 1 do Review Focus.
- [ ] **Step 5: Apagar `PrescricaoClient.tsx`** e o código `Tab*` antigo. Rodar `npm test`, `npx tsc --noEmit -p .` e `npm run build`. Esperado: tudo verde e nenhuma referência ao arquivo apagado (`grep -rn PrescricaoClient app components` vazio).
- [ ] **Step 6: Commit.** `"Detalhe do paciente vira página única por assunto, com edição no lugar"`

### Task 9: Cenários no Supabase falso e verificação na tela

**Files:**
- Modify: `ferramentas/mock-supabase.cjs`
  - cenários por `CENARIO` (padrão: o de hoje). O cenário `carteira` traz os pacientes Carlos (dose atrasada), Beatriz (desvio 1.800 → 2.200, falta, 2 mensagens), Joana (12 dias parada e exame), Pedro (nunca registrou), Luiza (em dia) e 2 convites;
  - a tabela `prescription_deviations`;
  - um segundo tratamento ativo, mais antigo, para Beatriz.
- Create: `ferramentas/tirar-prints-nutri.cjs`: login como nutricionista; paciente × celular/computador × claro/escuro; acusa transbordo de largura.
- Modify: `ferramentas/LEIAME.md`, para documentar `CENARIO` e o script novo.

- [ ] **Step 1: Subir o mock** (`CENARIO=carteira`) e o `npm run dev`, como no `LEIAME`.
- [ ] **Step 2: Tirar os prints** de Beatriz (com alertas), Luiza (sem alertas), Pedro (recém-chegado) e Beatriz com "Editar metas" aberto. Conferir que nenhum print acusa transbordo.
- [ ] **Step 3: Verificações com Playwright,** no mesmo script:
  - **rascunho sobrevive:** no computador, abrir "Editar metas", digitar 1900, enviar uma mensagem pela coluna lateral; o campo continua com 1900;
  - **voltar fecha a conversa:** no celular, tocar em Mensagem, depois `page.goBack()`; a URL fica sem `conversa=1`, e o título "Beatriz Rocha" continua visível;
  - **dois tratamentos:** a seção Clínico de Beatriz mostra o tratamento mais recente;
  - **sem vínculo:** `/app/pacientes/00000000-0000-0000-0000-000000000000` mostra "Sem acesso a este paciente";
  - **reaplicar:** em Beatriz, "Reaplicar 1.800 kcal" envia a RPC. O mock responde `{ ok: true }` em `rpc/`.
- [ ] **Step 4: Parar o dev e o mock,** apagar `.env.local` e `.next`, e conferir no `git status` que o `package.json` não mudou.
- [ ] **Step 5: Commit.** `"Supabase falso ganha a carteira de teste e o script de prints do nutri"`

### Task 10: `CLAUDE.md`, suíte final e PR

**Files:** `CLAUDE.md`.

- [ ] **Step 1: Atualizar o `CLAUDE.md`.**
  - A divisão por papel: a aba Prescrição sai, e a página única edita em Alimentação e Treino.
  - A lista de lógica testada ganha `mediasDaSemana`, `compararComMeta`, `estadosDaSemana`, `reduzirEdicao` e `temaClinico`.
  - Convenções: as classes `clin-*` só dentro de `.tema-clinico`, e a paleta com contraste testado em `lib/temaClinico.test.ts`.
  - A contagem de testes, com o número real tirado da saída do `npm test`.
- [ ] **Step 2:** `npm test`, `npx tsc --noEmit -p .` e `npm run build`. Anotar a saída real (número de testes, saída do build) para o relatório.
- [ ] **Step 3: Commit e push** no branch `claude/friendly-keller-rxl7qb`. Atualizar a descrição do PR #1 com o que entrou, os prints e o que ficou de fora.
