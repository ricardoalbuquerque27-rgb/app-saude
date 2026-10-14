# Visual do app: calmo e confiável — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O app ganha a linguagem nova "calmo e confiável": uma letra só (Instrument Sans), uma paleta com contraste testado, cartão de um nível e botão sólido. A Início do paciente é reorganizada (linha da consulta, "Para hoje", Score explicável, sugestão de proteína, meta ou limite, água em um toque), a Dieta é ajustada, e as outras telas recebem a linguagem.

**Architecture:**
- **Paleta.** Mora em `lib/temaApp.ts` como dado testado. Os papéis comuns importam os valores de `lib/temaClinico.ts`. Ela é servida como variáveis `--app-*` em `:root`/`.dark` e vira as classes `app-*` do Tailwind.
- **Classes globais.** As de `app/globals.css` são refeitas com essas variáveis. As cópias clínicas sob `:where(.tema-clinico)` continuam vencendo dentro da página do paciente do nutricionista.
- **Lógica.** Toda decisão da Início e da Dieta é função pura testada em `lib/`, porque o vitest só roda `lib/**/*.test.ts`. As páginas só desenham.
- **Banco.** Sem migração.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Tailwind, Supabase (supabase-js), vitest, Playwright contra o Supabase falso (`ferramentas/`).

**Spec:** `docs/superpowers/specs/2026-10-14-visual-do-app-do-paciente-design.md`. Maquetes: https://claude.ai/artifact/7SmiUSxW7mjpUYdNpdpqRS

**Quando:** depois do plano dos gráficos (`docs/superpowers/plans/2026-10-14-graficos-do-nutricionista.md`) terminar, com a revisão final, no mesmo branch. Os dois planos mexem em `CLAUDE.md`, `ferramentas/LEIAME.md` e `ferramentas/tirar-prints-nutri.cjs`.

## Global Constraints

- **Escrita:** interface, comentários e commits em pt-BR. O comentário explica o **porquê**, de preferência citando o bug (CLAUDE.md, Convenções).
- **Letra:** Instrument Sans, pesos 400, 500, 600 e 700, por `next/font` no layout raiz, variável `--font-sans`. `font-sans`, `font-display` e `font-clinico` apontam para ela.
- **Paleta:** `lib/temaApp.ts`; variáveis `--app-<nome>` em `:root` e `.dark`; classes `bg-app-*`, `text-app-*`, `border-app-*`.
  - `pagina`: #f6f7f6 no claro, #070b09 no escuro.
  - `cartao` = `chao` do clínico.
  - `macro-proteina`, `macro-carbo`, `macro-gordura`: #0e5d34, #5c9a76, #b9dbc6 no claro; #3fd27b, #2a8a55, #1d5538 no escuro.
  - Os demais papéis valem o mesmo que em `TEMA_CLINICO`.
- **Cor do app:** só `app-*`, sem `dark:` (o par está na variável). Nenhum hex nos componentes, exceto `lib/temaApp.ts`.
- **Texto direto no chão** (`pagina`): `text-app-texto` ou `text-app-texto-2`. Nunca `text-slate-400` nem `text-slate-500`: o slate-500 dá 4,43:1 sobre a página clara.
- **Cartão:** `.card` = borda de 1 px `app-linha`, cantos de 14 px, sem sombra, sem degradê, sem faixa à esquerda. Dentro do cartão, linhas separadas por traço (`divide-y divide-app-linha`), nunca outro cartão.
- **Botões:** primário em `app-primaria` sólido, com `min-height` de 44 px; secundário (`.btn-ghost`) com fundo `app-cartao`, borda `app-campo` e `min-height` de 40 px.
- **Sem caixa alta:** nenhum `uppercase` nem `tracking-wide*` em rótulo do app. A exceção é a landing (`app/page.tsx`, `components/landing.tsx`, `app/recursos/`, `components/MobileMenu.tsx`).
- **Sem cor decorativa:** nada de `violet-*`, `blue-*`, `bg-gradient-*`, sombra colorida ou brilho. Erro e aviso continuam; nas telas reescritas (Início e Dieta) usam `app-perigo`/`app-atencao`.
- **Número que é dado** leva a classe `.tabular`. Número dentro de frase, não.
- **Tamanhos:**
  - título da tela, 24 px (o `h1` do `PageHeader` e da Início);
  - título de seção, 17 px semibold (`.section-title`);
  - texto e lista, 15 px nas telas reescritas (Início e Dieta). Nas outras, o `text-sm` de hoje fica nesta rodada: passar tudo a 15 px mexeria na quebra de linha de cada formulário, e a spec só redesenha a Início e a Dieta;
  - apoio, datas e unidades, 13 px.
- **Nome do nutricionista:** "de {primeiro nome}", nunca "do"/"da". "seu nutricionista" fica.
- **Datas:** `todayISO()`, `limitesDaJanela`, `naJanela`, `dataNoBrasil`, `diaDaConsulta`, hora de São Paulo. Nunca `toLocale*` sem `timeZone`, `getHours()` nem `slice(0,10)` de um instante.
- **Leitura que falha não é "não tem":** um `error` do supabase-js vira mensagem ("Não deu para…"), nunca estado vazio nem "em dia".
- **O lado clínico não muda na tela:** a página do paciente do nutricionista e a agenda. `node ferramentas/tirar-prints-nutri.cjs` passa; o único tolerado é o aviso intermitente de hidratação já conhecido ("Extra attributes from the server: style"). A landing só troca a letra.
- **Git:**
  - commits com estes dois trailers: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` e `Claude-Session: https://claude.ai/code/session_017NRAjF3WaQYDiVpyJ6nub9`;
  - push só para `claude/friendly-keller-rxl7qb`, sem PR;
  - nunca `git add -A`: só os arquivos da tarefa.
- **Ambiente:**
  - `playwright` fora do `package.json`;
  - nunca `npm run build` com o `npm run dev` no ar;
  - processos parados por PID, nunca `pkill -f`;
  - nenhum toque no Supabase de produção.
- **vitest:** roda só `lib/**/*.test.ts`, em node, com `TZ=America/Sao_Paulo`.

## Review Focus

1. **Servidor em UTC.** A saudação e o "hoje" calculados com o relógio local dão a parte do dia errada em produção. O teste de `saudacao` troca `process.env.TZ` para `"UTC"` (Task 4).
2. **Leitura que falha nos blocos novos.** Recado, plano, check-in, cardápio, refeições, tratamento, pendências, peso e consulta: o "Para hoje" nunca diz "em dia", o Progresso nunca mostra o estado vazio e a linha da consulta nunca some. Há teste puro (Task 4) e verificação de tela com `/__falhar` (Tasks 6 e 7).
3. **Paciente com muitas pesagens.** O "Peso atual" é o mais recente, não o de meses atrás; uma pesagem com data futura fica fora. Teste de `pesoDe30Dias` com 90 dias de linhas fora de ordem (Task 5).
4. **Leitura que falha antes de somar água.** `adicionarAgua` não pode gravar `ml` por cima do total do dia. Teste: com erro na leitura, nenhum `upsert` é chamado (Task 5).
5. **Dois toques rápidos no "+250 ml".** O número do anel depois de recarregar a página é igual ao que a tela mostrou. Não pode haver soma perdida silenciosa (Task 7).

## Arquivos

| Arquivo | Papel | Tarefa |
|---|---|---|
| `lib/temaApp.ts` (+ teste) | paleta do app, pares, CSS das variáveis | 1 |
| `tailwind.config.ts` | classes `app-*`; famílias apontando para `--font-sans` | 1, 2 |
| `app/layout.tsx` | CSS das variáveis; Instrument Sans; `themeColor` | 1, 2 |
| `app/globals.css` | corpo da página e classes globais | 2 |
| `components/clinico/TemaClinico.tsx` | deixa de carregar fonte própria | 2 |
| `app/manifest.webmanifest` | cores do app instalado | 2 |
| `ferramentas/tirar-prints.cjs` | todas as telas do paciente | 2 |
| `components/AppShell.tsx`, `components/ChatWidget.tsx` | casca | 3 |
| `lib/date.ts` (`saudacao`), `lib/paraHoje.ts`, `lib/cardapio.ts`, `lib/anel.ts`, `lib/nutri.ts` (`papelDasCalorias`), `lib/healthScore.ts` (+ testes) | funções puras | 4 |
| `lib/nutri.ts` (`pesoDe30Dias`), `lib/agua.ts`, `lib/aiActions.ts` (+ testes) | extrações com leitura e escrita | 5 |
| `lib/consultas.ts` (`estadoDaConsulta`), `components/CartaoConsulta.tsx`, `components/LinhaDaConsulta.tsx`, `app/app/nutricionista/page.tsx`, `ferramentas/conferir-consulta-paciente.cjs` | consulta na Início | 6 |
| `app/app/page.tsx`, `components/ProgressRing.tsx`, `components/inicio/*`, `components/NutriNotes.tsx`, `components/PlanCheckIn.tsx`, `lib/pending.ts`, `ferramentas/conferir-inicio.cjs` | Início | 7 |
| `app/app/dieta/page.tsx`, `components/MealPlanView.tsx`, `ferramentas/conferir-dieta.cjs` | Dieta | 8 |
| `app/app/*/page.tsx` das outras telas do paciente | linguagem | 9 |
| componentes da lista da spec, `NutriHome`, `PacientesClient`, `login`, `redefinir-senha` | linguagem | 10 |
| `CLAUDE.md`, `ferramentas/LEIAME.md`, a spec da agenda | documentação | 11 |

---

### Task 1: Paleta do app

**Files:**
- Create: `lib/temaApp.ts`, `lib/temaApp.test.ts`
- Modify: `tailwind.config.ts`, `app/layout.tsx`, `app/estilo/page.tsx`

**Interfaces:**
- Consumes: `TEMA_CLINICO` de `lib/temaClinico.ts`, por import **relativo** (`./temaClinico`). O carregador de config do Tailwind não resolve `@/`.
- Produces:
  - `type NomeCorApp`: `"pagina" | "cartao" | "texto" | "texto-2" | "linha" | "campo" | "primaria" | "sobre-primaria" | "primaria-fundo" | "atencao" | "atencao-fundo" | "atencao-texto-2" | "perigo" | "perigo-fundo" | "macro-proteina" | "macro-carbo" | "macro-gordura"`.
  - `NOMES_COR_APP: NomeCorApp[]`.
  - `TEMA_APP: Record<"claro" | "escuro", Record<NomeCorApp, string>>`.
  - `PARES_TEXTO_APP`, `PARES_GRAFICO_APP`, `VIZINHOS_MACRO`: `[NomeCorApp, NomeCorApp][]`.
  - `cssDoTemaApp(): string`.
  - As classes Tailwind `app-<nome>`.

- [ ] **Step 1: Testes que falham** em `lib/temaApp.test.ts`, no formato de `lib/temaClinico.test.ts`:
  - **`PARES_TEXTO_APP`** ≥ 4,5:1 nos dois temas, com exatamente estes pares (os da spec):
    - `texto`, `texto-2` e `primaria`, cada um sobre `cartao` e sobre `pagina`;
    - `sobre-primaria` sobre `primaria`;
    - `primaria` e `texto-2` sobre `primaria-fundo`;
    - `atencao`, `texto` e `atencao-texto-2` sobre `atencao-fundo`;
    - `atencao` sobre `cartao`;
    - `perigo` sobre `perigo-fundo` e sobre `cartao`.
  - **`PARES_GRAFICO_APP`** ≥ 3:1: `primaria` sobre `linha`; `campo` sobre `cartao` e sobre `pagina`.
  - **`VIZINHOS_MACRO`** ≥ 2:1: `macro-proteina` com `macro-carbo`; `macro-carbo` com `macro-gordura`. Um comentário explica por que os tons claros não passam 3:1 contra o fundo: a legenda dá nome e gramas em texto.
  - **Papéis comuns.** `"os papéis comuns são os do clínico"`: para cada tema e cada nome em `texto … perigo-fundo`, `TEMA_APP[t][n] === TEMA_CLINICO[t][n]`; e `TEMA_APP[t].cartao === TEMA_CLINICO[t].chao`.
  - **Valores próprios.** `"página e macros com os valores da spec"`: os hex exatos das Global Constraints.
  - **Lista de nomes.** `"a lista de nomes e a tabela têm as mesmas cores"`, como no clínico.
  - **CSS.** `cssDoTemaApp()` começa com `:root{--app-pagina:#f6f7f6;` e contém `.dark{--app-pagina:#070b09;`.
- [ ] **Step 2:** `npx vitest run lib/temaApp.test.ts` — FAIL ("Cannot find module").
- [ ] **Step 3:** Implementar `lib/temaApp.ts`. `TEMA_APP` é montado a partir de `TEMA_CLINICO` mais os quatro valores próprios. `cssDoTemaApp()` segue o formato sem espaços de `cssDoTemaClinico`. O comentário do topo diz por que os papéis comuns são importados: a "mesma principal" fica garantida pelo código.
- [ ] **Step 4:** `npx vitest run lib/temaApp.test.ts` — PASS.
- [ ] **Step 5:** Em `tailwind.config.ts`, `app: Object.fromEntries(NOMES_COR_APP.map((n) => [n, \`var(--app-${n})\`]))`, ao lado de `clin`, com import relativo `./lib/temaApp`. Em `app/layout.tsx`, `<head><style dangerouslySetInnerHTML={{ __html: cssDoTemaApp() }} /></head>`.
- [ ] **Step 6:** Em `/estilo`, uma seção "Paleta do app" ao lado da clínica, com os pares e a razão (`razaoContraste`). As variáveis existem, mas nada as usa ainda: nenhuma tela muda.
- [ ] **Step 7:** `npm test && npx tsc --noEmit` — tudo passa.
- [ ] **Step 8: Commit** — `git commit -m "Paleta do app: tokens com contraste testado nos dois temas"`

### Task 2: Letra única e classes globais

**Files:**
- Modify: `ferramentas/tirar-prints.cjs`, `app/layout.tsx`, `tailwind.config.ts`, `components/clinico/TemaClinico.tsx`, `app/globals.css`, `app/manifest.webmanifest`, `app/app/page.tsx` (só o token `card-accent`), `components/MealPlanView.tsx` (só o token), `app/estilo/page.tsx` (só o token)

**Interfaces:**
- Consumes: as classes `app-*` da Task 1.
- Produces: `.card`, `.card-interactive`, `.btn-primary`, `.btn-ghost`, `.input`, `.label`, `.eyebrow`, `.section-title`, `.icon-badge`, `.chip` e `.pf-skel` na linguagem nova. A classe `.card-accent` deixa de existir. As famílias `sans`, `display` e `clinico` passam a ser todas `var(--font-sans)`.

- [ ] **Step 1: Fotos de antes.**
  - Em `ferramentas/tirar-prints.cjs`, a lista `TELAS` passa a ter todas as telas do paciente: `inicio /app`, `meu-plano /app/nutricionista`, `dieta`, `treinos`, `habitos`, `medidas`, `exames`, `tratamento`, `relatorios`, `saude`, `perfil`, `integracoes`, `diagnostico`, `assistente`.
  - Com o mock e o dev no ar (LEIAME), rode `OUT=<scratchpad>/visual-antes node ferramentas/tirar-prints.cjs` e `OUT=<scratchpad>/visual-antes-nutri node ferramentas/tirar-prints-nutri.cjs`, **antes de qualquer outra mudança**. Anote no relatório o caminho das duas pastas: as Tasks 9 a 11 comparam com elas.
- [ ] **Step 2: Letra.**
  - `app/layout.tsx`: `Instrument_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-sans" })` na `<html>`; saem `Inter` e `Sora`.
  - `tailwind.config.ts`: `sans`, `display` e `clinico` = `["var(--font-sans)", "system-ui", "sans-serif"]`.
  - `TemaClinico.tsx`: sai o `Instrument_Sans` próprio e o `fonte.variable` da `className`, e o comentário do topo diz que a fonte vem da raiz.
  - `globals.css` `@layer base`: `h1, h2, h3, .font-display` com `font-family: var(--font-sans), system-ui, sans-serif; letter-spacing: -0.01em; font-feature-settings: normal;`.
  - Sai a regra `:where(.tema-clinico) :is(h1, h2, h3)` e o comentário dela, porque a global ficou igual.
- [ ] **Step 3: Corpo da página** (`globals.css`).
  - `body` com `background-color: var(--app-pagina); color: var(--app-texto);` e sem `background-image`.
  - Sai o bloco `.dark body { background-image… }`.
  - `::selection` com `var(--app-primaria-fundo)`.
  - `--background`/`--foreground` saem se nada mais os usar; confira com `rg`.
  - `body:has(.tema-clinico)` continua vencendo por especificidade; não mexa.
- [ ] **Step 4: Classes** (primeiro bloco `@layer components`), com os valores da spec, seção "Cartão, linha, botão, campo":
  - `.card`: `rounded-[14px] border border-app-linha bg-app-cartao p-5`, sem sombra.
  - `.card-interactive`: `tappable cursor-pointer hover:border-app-campo`; sai o `translateY` do hover.
  - `.btn-primary`: `btn bg-app-primaria text-app-sobre-primaria min-h-[44px] hover:[filter:brightness(0.94)]`.
  - `.btn-ghost`: `btn border border-app-campo bg-app-cartao text-app-texto min-h-[40px] hover:bg-app-primaria-fundo`.
  - `.input`: `rounded-[10px]`, `bg-app-cartao`, `border-app-campo`, `text-app-texto`, `placeholder:text-app-texto-2`; no foco, `border-app-primaria`, com `ring-4 ring-app-primaria-fundo`.
  - `.label` e `.eyebrow`: `text-[13px] font-medium text-app-texto-2`, sem `uppercase` nem `tracking`.
  - `.section-title`: `flex items-center gap-2.5 text-[17px] font-semibold text-app-texto`.
  - `.icon-badge`: `bg-app-primaria-fundo text-app-primaria`.
  - `.chip`: `border-app-linha bg-app-cartao text-app-texto-2`.
  - `.pf-skel`: `var(--app-linha)` nos dois temas; sai `.dark .pf-skel`.
  - `.card-accent` sai, com o `::before`.
  - Sem `dark:` nessas classes: o par está na variável. As cópias clínicas, mais abaixo, ficam como estão.
- [ ] **Step 5:** Tire o token `card-accent` de `app/app/page.tsx`, `components/MealPlanView.tsx` e `app/estilo/page.tsx`. `rg -n "card-accent" app components` não acha nada.
- [ ] **Step 6:** `themeColor: "#0e5d34"` no viewport. No manifesto, `theme_color: "#0e5d34"` e `background_color: "#f6f7f6"`.
- [ ] **Step 7: Verificar.**
  - `npm test && npx tsc --noEmit`.
  - Com o dev parado, `npm run build`. Depois suba o dev de novo.
  - Rode `tirar-prints.cjs` com `OUT=<scratchpad>/visual-depois-2`, `tirar-prints-nutri.cjs` (passa, ver Global Constraints) e `conferir-inicio.cjs` (os cinco OK de hoje).
  - Compare antes e depois tela a tela, e liste no relatório cada tela em que algo quebrou ou transbordou em 390 px. Conserte o que a troca das classes causou; o resto fica para as Tasks 9 e 10.
  - As fotos clínicas de antes e depois devem ser iguais, exceto pela fonte dos títulos, que já era Instrument Sans.
- [ ] **Step 8: Commit** — `git commit -m "Letra única e classes globais na linguagem nova (cartão de um nível, botão sólido)"`

### Task 3: A casca

**Files:**
- Modify: `components/AppShell.tsx`, `components/ChatWidget.tsx`

**Interfaces:**
- Consumes: classes `app-*`.
- Produces: nada novo. O `aria-label="Abrir a Gaia"`, a posição (`bottom-20 right-4`, `lg:bottom-6 lg:right-6`) e o esconder ao rolar continuam iguais.

- [ ] **Step 1:** `AppShell`.
  - Toda superfície da casca (menu lateral, barra de cima do celular, barra de baixo, gaveta "Mais") fica `bg-app-cartao` sólido, com borda `app-linha`, sem translucidez nem `backdrop-blur`.
  - A marca vira um quadrado `bg-app-primaria` sólido, sem degradê nem sombra.
  - Os rótulos de grupo da gaveta perdem `uppercase tracking-*`.
  - Na barra de baixo, o item ativo fica em `text-app-primaria font-semibold` e os outros em `text-app-texto-2`.
- [ ] **Step 2:** `ChatWidget`.
  - Botão flutuante em `bg-app-primaria text-app-sobre-primaria`, sem degradê nem `shadow-*` colorida.
  - Cabeçalho da conversa em `bg-app-cartao`, título em `text-app-texto`, borda de baixo `app-linha`.
  - Os botões do cabeçalho viram ícones em `text-app-texto-2`.
- [ ] **Step 3: Verificar.**
  - `rg -n "gradient|shadow-\[|backdrop-blur|uppercase" components/AppShell.tsx components/ChatWidget.tsx` não acha nada.
  - `conferir-inicio.cjs` continua com o (3) do balão OK.
  - `tirar-prints-nutri.cjs` passa.
  - Olhe a Início e a `NutriHome` em 390 e 1280 px, claro e escuro.
- [ ] **Step 4: Commit** — `git commit -m "Casca: menu, barras e Gaia em superfície sólida, sem degradê"`

### Task 4: Funções puras da Início

**Files:**
- Modify: `lib/date.ts`, `lib/date.test.ts`, `lib/cardapio.ts`, `lib/nutri.ts`, `lib/nutri.test.ts`, `lib/healthScore.ts`
- Create: `lib/paraHoje.ts`, `lib/paraHoje.test.ts`, `lib/cardapio.test.ts`, `lib/anel.ts`, `lib/anel.test.ts`, `lib/healthScore.test.ts`

**Interfaces:**
- Produces:
  - `saudacao(agora: Date): "Bom dia" | "Boa tarde" | "Boa noite"` em `lib/date.ts`.
  - Em `lib/paraHoje.ts`:
    ```ts
    export type EntradaParaHoje = {
      recados: { id: string }[];
      treinos: { id: string; prescribed_by: string | null }[]; // sessões de hoje
      confirmados: string[];                 // plan_id com check-in hoje
      temNutri: boolean;
      aplicacao: { atrasada: boolean } | null; // só quando é hoje ou atrasada
      refeicoesFaltando: number;             // tipos do cardápio sem registro hoje
      pendencias: { key: string; urgent?: boolean }[]; // de getPending
      falhou: boolean;                       // alguma leitura acima falhou
    };
    export type LinhaParaHoje =
      | { tipo: "recados"; quantidade: number }
      | { tipo: "treino"; id: string; doNutri: boolean; confirmado: boolean }
      | { tipo: "aplicacao"; atrasada: boolean }
      | { tipo: "cardapio"; faltam: number }
      | { tipo: "pendencia"; key: string; urgente: boolean };
    export type ParaHoje = {
      linhas: LinhaParaHoje[];
      pendentes: number;
      estado: "pendente" | "em-dia" | "incompleto";
    };
    export function montarParaHoje(e: EntradaParaHoje): ParaHoje;
    ```
  - Em `lib/cardapio.ts`:
    - `type ItemDoPlano = { meal_type: string; position: number; description: string; protein_g: number | null }`;
    - `type SugestaoDeProteina = { faltam: number; refeicao: string; descricao: string; proteina: number }`;
    - `sugestaoDeProteina(e: { meta: number | null; consumido: number; itens: ItemDoPlano[]; tiposRegistrados: string[]; vinculoAtivo: boolean }): SugestaoDeProteina | null`;
    - `textoDaSugestao(s: SugestaoDeProteina): string`.
  - `papelDasCalorias(pesoAtual: number | null, metaDePeso: number | null): "limite" | "meta" | null` em `lib/nutri.ts`.
  - Em `lib/anel.ts`:
    - `rotuloDoAnel(label: string, papel: "limite" | "meta" | null): string`;
    - `avisoDoAnel(pct: number, avisoAcima: boolean): "acima do limite" | null`.
  - `ScorePillar` ganha `semRegistro: boolean`, e as dicas ficam sem emoji.

- [ ] **Step 1: Testes que falham.**
  - **`saudacao`** (em `lib/date.test.ts`). Num `describe` com `beforeAll(() => { process.env.TZ = "UTC" })`, restaurado em `afterAll`, e um comentário dizendo que a Vercel roda em UTC e que um `getHours()` ingênuo passaria com o TZ de São Paulo do vitest:
    | instante (UTC) | hora em São Paulo | esperado |
    |---|---|---|
    | `2026-10-14T07:59:00Z` | 04:59 | "Boa noite" |
    | `08:00Z` | 05:00 | "Bom dia" |
    | `14:59Z` | 11:59 | "Bom dia" |
    | `15:00Z` | 12:00 | "Boa tarde" |
    | `20:59Z` | 17:59 | "Boa tarde" |
    | `21:00Z` | 18:00 | "Boa noite" |
    | `2026-10-15T01:30:00Z` | 22:30 do dia 14 | "Boa noite" |
  - **`montarParaHoje`** (em `lib/paraHoje.test.ts`):
    - **ordem:** recados, treinos do nutri, treinos próprios, aplicação, cardápio, pendências;
    - **recados:** `quantidade` é o número de recados, e cada um conta 1 em `pendentes`;
    - **treino confirmado:** aparece com `confirmado: true` e não conta;
    - **dose:** com `aplicacao`, a pendência `key: "dose"` sai; sem `aplicacao`, ela fica e `urgente` vem de `urgent`;
    - **sem vínculo:** com `temNutri: false`, um treino com `prescribed_by` fica `doNutri: false`;
    - **cardápio:** `refeicoesFaltando: 0` não dá linha;
    - **estado:**
      - nada pendente → `"em-dia"`;
      - só treino confirmado → `"em-dia"`;
      - algo pendente → `"pendente"`;
      - `falhou: true` → `"incompleto"`, com ou sem linhas e com `pendentes` contando só as linhas que vieram.
  - **`sugestaoDeProteina` e `textoDaSugestao`** (em `lib/cardapio.test.ts`), com os itens do cardápio da Maria no mock (`ferramentas/mock-supabase.cjs`, `meal_plan_items`):
    - **dão `null`:** meta nula; `itens: []`; `vinculoAtivo: false`; meta 110 com consumido 101 (faltam 9). Faltam exatamente 10 já sugere;
    - **ordem de `MEAL_TYPES`:** com "Café da manhã" registrado → Almoço, 45 g, "120 g de frango…";
    - **registrada pulada:** com Almoço também registrado → Lanche da tarde, 25 g;
    - **empate:** duas opções do Lanche com 25 g → a de menor `position`;
    - **sem proteína informada:** uma refeição com todas as opções `protein_g: null` é pulada;
    - **todas registradas** → `null`;
    - **tipo desconhecido:** `"Pré-treino"` só aparece depois de todas as conhecidas registradas;
    - **arredondamento:** meta 110, consumido 69,6 → `faltam: 40`; `protein_g` 24,6 → `proteina: 25`;
    - **texto exato:** `textoDaSugestao({ faltam: 40, refeicao: "Lanche da tarde", descricao: "1 scoop de whey + 1 maçã", proteina: 25 })` === `"Faltam 40 g de proteína para a meta de hoje. Próxima refeição do seu plano: lanche da tarde, 25 g (1 scoop de whey + 1 maçã)."`.
  - **`papelDasCalorias`** (em `lib/nutri.test.ts`):
    | peso atual | meta | esperado |
    |---|---|---|
    | 70 | 66 | `"limite"` |
    | 60 | 66 | `"meta"` |
    | 66,5 | 66 | `null` (a 0,5 kg ainda é manutenção) |
    | 66,6 | 66 | `"limite"` |
    | 65,4 | 66 | `"meta"` |
    | `null` | 66 | `null` |
    | 70 | `null` | `null` |
  - **`anel`** (em `lib/anel.test.ts`):
    - `rotuloDoAnel("Calorias", "limite")` === `"Calorias · limite"`; com `"meta"`, `"Calorias · meta"`; com `null`, `"Calorias"`;
    - `avisoDoAnel(1.01, true)` === `"acima do limite"`;
    - `avisoDoAnel(1, true)` === `null`;
    - `avisoDoAnel(1.5, false)` === `null`.
  - **`computeHealthScore`** (em `lib/healthScore.test.ts`):
    - **primeiro, a caracterização, ANTES de mexer no código.** Duas entradas: (a) dia vazio (tudo nulo ou zero, `waterGoal: 2500`); (b) sono 7, 1 treino na semana, 2 refeições, proteína 60 de 110, calorias 900 de 1800, água 1200 de 2500, humor "bem". Fixe `score`, `label` e o `value` de cada pilar com o que a função dá hoje. Rode e veja passar, porque esses testes travam o comportamento atual;
    - **depois, o que falha:**
      - na entrada (a), `semRegistro` é verdadeiro em sono, nutrição e bem-estar e falso em movimento, e o bem-estar vale 24;
      - na entrada (b), `semRegistro` é falso nos quatro pilares;
      - nenhuma dica (`tip` e `topTip`), em seis entradas variadas, casa com `/\p{Extended_Pictographic}/u`.
- [ ] **Step 2:** `npx vitest run lib/date.test.ts lib/paraHoje.test.ts lib/cardapio.test.ts lib/nutri.test.ts lib/anel.test.ts lib/healthScore.test.ts`. Esperado: FAIL nos testes novos e PASS na caracterização.
- [ ] **Step 3: Implementar.**
  - `saudacao`: `Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "numeric", hourCycle: "h23" })`.
  - `textoDaSugestao`: a primeira letra da refeição fica minúscula ("lanche da tarde").
  - `semRegistro`:
    - sono: `sleepHours == null`;
    - nutrição: `mealsLoggedToday === 0`;
    - bem-estar: `waterToday === 0`, humor nulo e energia nula;
    - movimento: sempre falso.
  - Dicas sem emoji: "Que tal treinar hoje?" e "Meta de proteína batida.".
  - Cada função leva um comentário com o porquê, citando a spec.
- [ ] **Step 4:** O mesmo comando — PASS. Depois, `npm test && npx tsc --noEmit`.
- [ ] **Step 5: Commit** — `git commit -m "Início: saudação, Para hoje, sugestão de proteína, meta ou limite e Score explicável, testados"`

### Task 5: Peso de 30 dias e água, num lugar só

**Files:**
- Modify: `lib/nutri.ts` (`montarResumos`, o trecho de "Peso de 30 dias" com `porDia`/`pesos30`), `lib/nutri.test.ts`, `lib/aiActions.ts` (`registrar_agua`)
- Create: `lib/agua.ts`, `lib/agua.test.ts`

**Interfaces:**
- Consumes: `pesoDoDia`, `naJanela`.
- Produces:
  - `type LinhaDePeso = { date: string; weight_kg: number | string | null; measured_by?: string | null; created_at?: string | null }`.
  - `pesoDe30Dias(linhas: LinhaDePeso[], hoje: string): { pontos: { data: string; peso: number }[]; atual: number | null; variacao: number | null }` em `lib/nutri.ts`. Os pontos vêm em ordem crescente, um por dia, pela regra de `pesoDoDia`. `variacao` é o último menos o primeiro, com 1 casa, e é `null` com menos de 2 dias.
  - `adicionarAgua(supabase: any, uid: string, ml: number, hoje: string = todayISO()): Promise<{ ok: true; total: number } | { ok: false; erro: string }>` em `lib/agua.ts`.

- [ ] **Step 1: Testes que falham.**
  - **`pesoDe30Dias`** (em `lib/nutri.test.ts`):
    - **dia com as duas medidas:** o ponto do dia é o da consulta, nas duas ordens de chegada;
    - **borda da janela:** o primeiro e o último dia da janela, como `naJanela(…, 30)` define (leia o JSDoc em `lib/date.ts`), entram, e o dia logo antes não entra;
    - **data futura:** `addDaysISO(hoje, 1)` fica fora;
    - **um dia só:** `variacao: null`;
    - **muitas pesagens:** 90 dias de linhas embaralhadas → `atual` é o peso do dia mais recente até hoje, e `pontos` vem em ordem crescente;
    - **o resumo continua igual:** os testes atuais de `weightDelta30`/`weightLast` passam sem mudança.
  - **`adicionarAgua`** (em `lib/agua.test.ts`). Use um banco falso mínimo no próprio arquivo (`from().select().eq().eq().maybeSingle()` e `from().upsert(linha, opções)`), que registra cada `upsert` e aceita um erro injetado na leitura ou na escrita:
    - **sem linha no dia:** cria com 250 e devolve `{ ok: true, total: 250 }`;
    - **com 1000 no dia:** grava 1250;
    - **desfazer abaixo de zero:** −250 com 100 no dia grava 0;
    - **erro na leitura:** `{ ok: false }`, e **nenhum** `upsert` foi chamado;
    - **erro na gravação:** `{ ok: false }`;
    - **o que vai no `upsert`:** só `{ user_id, date, water_ml }`, com `onConflict: "user_id,date"`.
- [ ] **Step 2:** `npx vitest run lib/nutri.test.ts lib/agua.test.ts` — FAIL.
- [ ] **Step 3: Implementar.**
  - `pesoDe30Dias`: `montarResumos` passa a chamá-la (`weightLast = atual`, `weightDelta30 = variacao`). O comentário de hoje vai junto para a função.
  - `adicionarAgua`: comentário dizendo que o `registrar_agua` antigo, com a leitura falhando, tratava o total como 0 e gravava só `ml` por cima do dia.
  - `registrar_agua`: chama `adicionarAgua`. Com `!ok`, lança `new Error(erro)`, mantendo o contrato de hoje, e o texto do `resumo` não muda.
- [ ] **Step 4:** `npm test && npx tsc --noEmit` — tudo passa, inclusive `lib/aiActions.test.ts`.
- [ ] **Step 5: Commit** — `git commit -m "Peso de 30 dias e água: uma conta e uma gravação, testadas"`

### Task 6: A consulta numa linha da Início

**Files:**
- Modify: `lib/consultas.ts`, `lib/consultas.test.ts`, `components/CartaoConsulta.tsx`, `app/app/page.tsx`, `app/app/nutricionista/page.tsx`, `ferramentas/conferir-consulta-paciente.cjs`
- Create: `components/LinhaDaConsulta.tsx`

**Interfaces:**
- Consumes: `fimDa`, `rotuloDaConsulta`, `ROTULO_MODO`, `diaDaConsulta`, `nomeCurtoDoDia`, `dataCurta`, `Consulta`.
- Produces:
  - `estadoDaConsulta(consultas: Consulta[], agora: number | string): { proxima: Consulta | null; pedido: Consulta | null; canceladaPeloNutri: Consulta | null }` em `lib/consultas.ts`. A regra é exatamente a de hoje no `CartaoConsulta`:
    - `proxima`: agendada com `fimDa > agora`, a mais cedo;
    - `pedido`: a primeira com `status === "pedido"`;
    - `canceladaPeloNutri`: só sem as duas acima, quando a mais recente (por `starts_at`) foi cancelada pelo nutri e começa depois de agora − 7 dias.
  - `<LinhaDaConsulta consultas={Consulta[]} agora={string} nutriNome={string} falhou={boolean} />`, componente de servidor.

- [ ] **Step 1: Testes que falham** de `estadoDaConsulta`:
  - agendada que já terminou fica fora;
  - entre duas agendadas futuras, vale a mais cedo;
  - pedido e agendada juntos aparecem os dois;
  - cancelada pelo paciente não conta;
  - cancelada pelo nutri há 8 dias não conta, e há 6 dias conta;
  - com uma agendada futura, a cancelada não aparece.
- [ ] **Step 2:** `npx vitest run lib/consultas.test.ts` — FAIL.
- [ ] **Step 3:** Implementar `estadoDaConsulta` e trocar a escolha dentro do `CartaoConsulta` por ela. O cartão não muda de comportamento.
- [ ] **Step 4: `LinhaDaConsulta`.** É uma linha com seta, link para `/app/nutricionista#consulta`, com os textos exatos da spec ("A consulta, numa linha"):
  - **agendada:** título "Próxima consulta", subtítulo `${rotuloDaConsulta(p)} · ${ROTULO_MODO[p.mode]}`. Acrescente " · remarcação pedida" quando há `reschedule_requested_at`, e " · e um pedido aguardando" quando também há pedido;
  - **só pedido:** "Consulta pedida" e `${rotuloDaConsulta(pedido)} · aguardando ${primeiro nome}` (sem nome, "aguardando o nutricionista");
  - **cancelada pelo nutri:** "Consulta de ${nomeCurtoDoDia(d)}, ${dataCurta(d)} cancelada por ${primeiro nome}", com `d = diaDaConsulta(c)`;
  - **nenhuma:** `null`;
  - **`falhou`:** "Não deu para carregar a consulta".
- [ ] **Step 5: Páginas.**
  - Na Início, `LinhaDaConsulta` vai logo depois da saudação, só com `temNutri`, no lugar do `CartaoConsulta`. O comentário antigo ("Depois do 'Hoje'…") sai, trocado pelo porquê novo: a data à vista; as ações em Meu plano.
  - Em `app/app/nutricionista/page.tsx`, o `CartaoConsulta` fica dentro de `<div id="consulta" className="scroll-mt-20">`.
- [ ] **Step 6: Verificação de tela** em `conferir-consulta-paciente.cjs`:
  - **as ações** (pedir, remarcar, cancelar, cancelar pedido) passam a ser dirigidas em `/app/nutricionista`;
  - **na Início, uma conferência por situação:** agendada, remarcação pedida, pedido, nenhuma (sem a linha), cancelada pelo nutri (crie a situação pelo próprio fluxo do script ou pelos dados do mock) e falha (`POST /__falhar {"tabela":"appointments"}`, depois `/__reset`);
  - **o link** leva a `/app/nutricionista#consulta`.

  Rode e veja passar. `npm test && npx tsc --noEmit`.
- [ ] **Step 7: Commit** — `git commit -m "Consulta na Início: uma linha no topo, ações em Meu plano, uma regra só para o cartão e a linha"`

### Task 7: A Início reorganizada

**Files:**
- Modify: `app/app/page.tsx`, `components/ProgressRing.tsx`, `components/NutriNotes.tsx`, `components/PlanCheckIn.tsx`, `lib/pending.ts`, `app/app/habitos/page.tsx` e `app/app/dieta/page.tsx` (só a chamada do `ProgressRing`), `ferramentas/conferir-inicio.cjs`, `ferramentas/mock-supabase.cjs` (só se faltar dado da Maria)
- Create: `components/inicio/ParaHoje.tsx`, `components/inicio/ScoreExplicado.tsx`, `components/inicio/AdicionarAgua.tsx`, `components/inicio/LinhaDoPeso.tsx`

**Interfaces:**
- Consumes: tudo das Tasks 4 a 6; `limitesDaJanela`, `pesoDoDia`, `textoVariacaoPeso`, `hojeLongo`, `createClient` de `lib/supabase/client.ts` (no componente de cliente).
- Produces:
  - `ProgressRing({ pct, centerMain, centerSub?, label, papel?: "limite" | "meta" | null, avisoAcima?: boolean })`. Sai o `colorClass`. O anel fica em `app-primaria` sobre trilho `app-linha`; o rótulo vem de `rotuloDoAnel`, o aviso de `avisoDoAnel` (em `text-app-atencao`), e o centro leva `.tabular`.
  - `getPending` devolve também `falhou: boolean`.
  - `<AdicionarAgua uid={string} />`, componente de cliente.

- [ ] **Step 1: Verificação de tela que falha.** Em `conferir-inicio.cjs`, como Maria, em 390 px. Mantenha (1), (2), (3) e (5). Troque o (4) por "o título do recado é 'Recado de Ricardo' (sem 'do' nem 'da') e não há 'RECADO DO SEU NUTRICIONISTA'". Acrescente:
  - **ordem:** linha da consulta, "Para hoje", "Registrar", "Seu dia", "Progresso", links (pela ordem das posições `y`);
  - **saudação:** "Bom dia", "Boa tarde" ou "Boa noite", pela hora de São Paulo do momento do teste, seguida de ", Maria";
  - **"Para hoje":** contagem "N pendentes" igual ao número de linhas pendentes. Depois `POST /__falhar {"tabela":"patient_notes"}` → aparece "Não deu para carregar tudo" e não aparece "em dia"; depois `/__reset`;
  - **anéis:** "Calorias · limite" (meta de peso da Maria abaixo do peso atual). O centro dos anéis tem `font-variant-numeric` com `tabular-nums`, e dois `span` com o mesmo estilo, "000" e "111", medem a mesma largura (±0,5 px);
  - **Score:** abrir "score" mostra os quatro pilares e "O score é a média dos quatro";
  - **sugestão de proteína:** aparece e leva a `/app/dieta#plano`. Se não aparecer porque o dado do mock não a produz, acerte o dado da Maria e diga isso no relatório;
  - **"+250 ml":**
    - o número do anel de água sobe 0,25 L e o "Desfazer" o devolve;
    - dois cliques rápidos seguidos de recarregar a página dão o mesmo número que a tela mostrava;
    - com `POST /__falhar {"tabela":"daily_logs"}`, aparece "Não deu para registrar a água" e o anel não muda; depois `/__reset`;
  - **Progresso:** "kg em 30 dias" e a linha com `role="img"`. Com `/__falhar {"tabela":"body_measurements"}`, aparece "Não deu para carregar o peso" e não o estado vazio; depois `/__reset`;
  - **links:** "Treinos recentes" e "Relatório para levar à consulta";
  - **nada de:** `text-transform: uppercase` no `main`; `background-image` em `.card` nem em `.btn-primary`; rolagem horizontal (`scrollWidth <= innerWidth`).
- [ ] **Step 2:** Rodar e ver as novas falharem.
- [ ] **Step 3: `ProgressRing`** com a interface acima. Atualize as três chamadas (Início, Hábitos e Dieta) só o bastante para compilar; a Dieta é refeita na Task 8.
- [ ] **Step 4: Leituras da página.**
  - Cada leitura que alimenta o "Para hoje" guarda o `error`: recados, plano de treino, check-ins, cardápio (`meal_plans` e `meal_plan_items`), refeições de hoje, tratamento e `getPending`. Qualquer uma com erro dá `falhou: true` em `montarParaHoje`.
  - A leitura de peso passa a ser `body_measurements` com `select("date, weight_kg, measured_by, created_at")`, `.not("weight_kg", "is", null)`, e `.gte`/`.lte` de `limitesDaJanela(today, 30)`. O resultado vai por `pesoDe30Dias`. Sem ponto na janela, uma segunda leitura busca a última pesagem antes de `desde` (`.lt("date", desde)`, ordem por `date` e `created_at` decrescentes, `.limit(10)`, `pesoDoDia` das linhas da data mais recente), mostrada com "em dd/mm".
  - O papel das calorias é `papelDasCalorias(atual ?? anterior, profile.weight_goal_kg)`.
  - Mantenha a leitura de treinos recentes, porque o Score usa (`trainedToday`).
- [ ] **Step 5: Desenho, na ordem e com os textos da spec ("Início (paciente)").**
  - Data em `text-app-texto-2`, depois `saudacao(new Date())` + ", " + primeiro nome, sem emoji.
  - `LinhaDaConsulta` (Task 6).
  - `ParaHoje`: um `.card` com `divide-y`. Cada linha de `montarParaHoje` é desenhada assim:
    - **recados:** `NutriNotes` compacto, com o título "Recado de {primeiro nome}" e "· seu nutricionista". Sem nome no perfil do nutricionista, só "Recado";
    - **treinos:** `PlanCheckIn` em forma de linha, com "{categoria} · do seu nutricionista" ou "· seu treino";
    - **aplicação:** "Aplicação de hoje", ou "Aplicação atrasada" com o título em `text-app-atencao`. Embaixo, o remédio e a dose, e "Registrar" leva a `/app/tratamento`;
    - **cardápio:** "Cardápio de hoje" e "N refeições ainda faltam", em link para `/app/dieta`;
    - **pendências:** linha com seta, sem pontinho colorido. A urgente tem o título em `text-app-atencao`.
    - A frase "Seu nutricionista vê essa confirmação" aparece uma vez.
    - Com `estado`:
      - `"em-dia"`: o texto de hoje ("Treino de hoje já confirmado…" ou "Dia de descanso…");
      - `"incompleto"`: "Não deu para carregar tudo. Recarregue a página.", em `text-app-atencao`, acima das linhas.
  - "Registrar": título e grade `grid-cols-2 sm:grid-cols-4` de `btn-ghost` com "+", com os destinos de hoje.
  - "Seu dia":
    - `ScoreExplicado` no lugar do número colorido: um `<details>` com `summary` "score {n} · {label em minúscula}" e uma linha por pilar (nome, barra `primaria` sobre `linha`, valor `.tabular`, e a dica ou "sem registro hoje · conta {valor}"), mais a frase da spec;
    - três anéis, com Calorias levando o papel e `avisoAcima` só quando o papel é "limite";
    - `AdicionarAgua` sob o anel de água, com os textos da spec, `aria-live="polite"`, desabilitado durante a gravação e `router.refresh()` depois;
    - a sugestão (`textoDaSugestao`) em link para `/app/dieta#plano`;
    - o `topTip`, menos quando há sugestão e o pilar mais fraco é a nutrição;
    - "Definir metas" e o texto de sem-dados, como hoje.
  - "Progresso": peso `.tabular`, "{textoVariacaoPeso} em 30 dias", `LinhaDoPeso` e "Ver medidas".
    - `LinhaDoPeso` é um SVG `polyline` em `var(--app-primaria)`, sem eixos, com `role="img"`, o `aria-label` da spec (números com vírgula) e as datas das pontas com `dataCurta`.
    - Com a leitura falhando, "Não deu para carregar o peso".
    - Sem peso nenhum, o estado vazio de hoje ("Registre seu peso algumas vezes…" e "Registrar peso").
    - A página toda é uma coluna; o `h1` tem 24 px; texto e lista têm 15 px.
  - Links: "Próxima aplicação · em N dias" (quando a dose não é de hoje nem atrasada), "Treinos recentes" e "Relatório para levar à consulta".
  - Saem os cartões "Treinos recentes", "Relatório com IA" e "Fale com a Gaia", e a grade `lg:grid-cols-2`.
  - Nenhuma cor `violet`, `blue`, `amber` ou `rose` na página: aviso e erro usam `app-atencao`/`app-perigo`.
- [ ] **Step 6:** `npm test && npx tsc --noEmit`; rode `conferir-inicio.cjs` e `conferir-consulta-paciente.cjs` (tudo OK) e `tirar-prints.cjs`. Olhe a Início em 390 e 1280 px, claro e escuro, e compare com a maquete.
- [ ] **Step 7: Commit** — `git commit -m "Início reorganizada: Para hoje, Registrar, Score explicável, água em um toque e Progresso de 30 dias"`

### Task 8: A Dieta

**Files:**
- Modify: `app/app/dieta/page.tsx`, `components/MealPlanView.tsx`
- Create: `ferramentas/conferir-dieta.cjs` (no padrão de `conferir-inicio.cjs`)

**Interfaces:**
- Consumes: `ProgressRing` (Task 7), `papelDasCalorias`, `sugestaoDeProteina`, `textoDaSugestao`, `pesoDoDia`, `todayISO`.
- Produces: `MealPlanView` ganha `nutriNome?: string` e o `id="plano"` na raiz.

- [ ] **Step 1: Verificação de tela que falha** (`conferir-dieta.cjs`, Maria, 390 px):
  - **rótulo do dia:** começa com "Hoje, " seguido do dia da semana curto (`/^Hoje, \S+\. \d{1,2}\/\d{1,2}$/`). O `input[type=date]` existe com `max` = hoje em São Paulo, e preencher uma data de ontem nele troca o rótulo;
  - **cabeçalho:** sem "Acompanhe suas refeições e macros."; "Registrar refeição" ocupa a largura do conteúdo;
  - **anéis e macros:** "Calorias · limite"; a barra de macros com 3 segmentos e a legenda com gramas;
  - **sugestão:** aparece com a data em hoje e some ao ir para ontem;
  - **plano:** `#plano` com "de Ricardo, seu nutricionista"; "Café da manhã · feito" quando registrado; botões "Comi isso";
  - **dia sem refeição:** "Nenhuma refeição neste dia.";
  - **nada de:** `uppercase` no `main` e rolagem horizontal.
- [ ] **Step 2:** Rodar e ver falhar.
- [ ] **Step 3: Leituras novas** (no `load` de hoje):
  - `profiles.weight_goal_kg`, com `.eq("id", uid)`, nunca sem filtro (CLAUDE.md, "`profiles` sem filtro por id");
  - a pesagem mais recente até hoje, pela mesma regra da Task 7;
  - o vínculo ativo e o primeiro nome do nutricionista, também com `.eq("id", nutricionistaId)`.

  Leitura que falha não vira papel nem sugestão inventados: sem os dados, `papel` é `null` e não há sugestão.
- [ ] **Step 4: Desenho** (spec, "Dieta (paciente)"):
  - **cabeçalho:**
    - setas mais um botão-rótulo que chama `showPicker()` do `input type="date"`. Mantenha o `input` no DOM, visualmente escondido mas focável;
    - o rótulo é "Hoje, sex. 9/10" ou "qua. 7/10", com o dia da semana pela data ISO, sem `toLocale*` sem `timeZone`;
    - o chip "Hoje" fica;
  - **resumo:** anéis com papel; barra de macros em `bg-app-macro-*` com `gap` de 2 px; legenda "Proteína 45 g" etc. com `.tabular`; a sugestão abaixo, só com a data em hoje;
  - **`MealPlanView`:**
    - um `.card` só, com o título e "de {primeiro nome}, seu nutricionista · ver em Meu plano", seguido da observação;
    - cada refeição tem um subtítulo ("· feito" quando registrada) e as opções em linhas (`divide-y`), com a descrição e "380 kcal · 20 g prot" (`.tabular`);
    - o botão é "Comi isso" (`btn-ghost`) ou o texto "comi" em `text-app-primaria`;
    - saem as caixas por opção e os `uppercase`;
  - **refeições registradas:** um `.card` com `divide-y`, uma linha por refeição (tipo, itens, kcal e macros `.tabular`, excluir). Sem refeição, "Nenhuma refeição neste dia." e um botão com cara de link "Registrar refeição", que abre o modal.
- [ ] **Step 5:** `npm test && npx tsc --noEmit`; rode `conferir-dieta.cjs`, `conferir-inicio.cjs` e `tirar-prints.cjs` (Dieta e Meu plano, que também usa `MealPlanView`). Tudo OK.
- [ ] **Step 6: Commit** — `git commit -m "Dieta: rótulo do dia, meta ou limite, macros em tons da principal e o plano num cartão só"`

### Task 9: As outras telas do paciente

**Files:**
- Modify: `app/app/nutricionista/page.tsx`, `app/app/treinos/page.tsx`, `app/app/treino/[id]/page.tsx`, `app/app/habitos/page.tsx`, `app/app/medidas/page.tsx`, `app/app/exames/page.tsx`, `app/app/tratamento/page.tsx`, `app/app/relatorios/page.tsx`, `app/app/saude/page.tsx`, `app/app/perfil/page.tsx`, `app/app/integracoes/page.tsx`, `app/app/diagnostico/page.tsx`, `app/app/assistente/` (a página)

**Interfaces:**
- Consumes: classes `app-*` e as globais refeitas. Nenhuma assinatura muda.

- [ ] **Step 1:** Em cada arquivo, só a linguagem (spec, "As outras telas"):
  - **(a)** sai `uppercase` e `tracking-*` dos rótulos;
  - **(b)** `violet-*`, `blue-*`, `bg-gradient-*` e sombra colorida viram `app-primaria`/`app-primaria-fundo` ou neutro;
  - **(c)** sai o `icon-badge` dos títulos de seção (`section-title`);
  - **(d)** texto direto no chão em `text-slate-400/500` passa a `text-app-texto-2`;
  - **(e)** número que é dado ganha `.tabular`;
  - **(f)** os pares rosa e âmbar de erro e aviso podem ficar.

  Ordem e conteúdo das telas não mudam.
- [ ] **Step 2: Verificar.**
  - `rg -n "violet-|blue-|bg-gradient|uppercase|tracking-wide" app/app/{nutricionista,treinos,treino,habitos,medidas,exames,tratamento,relatorios,saude,perfil,integracoes,diagnostico,assistente}` não acha nada.
  - `rg -n "text-slate-(400|500)"` nesses arquivos só acha ícone ou texto dentro de `.card`; justifique cada um que sobrar no relatório.
- [ ] **Step 3:** `npm test && npx tsc --noEmit`. Rode `tirar-prints.cjs` com `OUT=<scratchpad>/visual-depois-9` e compare tela a tela com `visual-antes` da Task 2, listando no relatório o que mudou em cada tela. Rode também `conferir-inicio.cjs`, `conferir-dieta.cjs` e `conferir-consulta-paciente.cjs` (OK).
- [ ] **Step 4: Commit** — `git commit -m "Telas do paciente na linguagem nova: sem caixa alta, sem cor decorativa"`

### Task 10: Componentes, nutricionista fora do clínico e entrada

**Files:**
- Modify: `components/MealPlanView.tsx` (se sobrou algo da Task 8), `components/PlanCheckIn.tsx`, `components/NutriNotes.tsx`, `components/CartaoConsulta.tsx`, `components/WorkoutSession.tsx`, `components/RestTimer.tsx`, `components/PlateCalculator.tsx`, `components/FoodSearch.tsx`, `components/TemplateBar.tsx`, `components/Onboarding.tsx`, `components/ConectarNutri.tsx`, `components/RevogarNutri.tsx`, `components/PwaSettings.tsx`, `components/ui.tsx`, `components/Skeleton.tsx`, `components/charts.tsx`, `components/NutriHome.tsx`, `components/PacientesClient.tsx`, `app/login/page.tsx`, `app/redefinir-senha/page.tsx`

**Interfaces:**
- Produces:
  - `StatCard` perde a prop `accent`, porque todos passam a `primaria-fundo`/`primaria`; atualize os chamadores.
  - O título do `PageHeader` passa a `text-2xl` (24 px) em `text-app-texto`, sem `dark:`.
  - `TrendChart` e `BarsChart` passam a usar como cor padrão `var(--app-primaria)` e a grade `var(--app-linha)`.

- [ ] **Step 1:** As mesmas regras (a) a (f) da Task 9. A `NutriHome` mantém o âmbar e o rosa dos níveis de alerta da fila, que são semânticos.
- [ ] **Step 2: Cuidado com o tema clínico.** `MealPlanEditor`, `NutriNotes`, `PlanCheckIn`, `ErroSecao` e o que mais aparecer dentro de `.tema-clinico` não podem mudar de cara lá. Rode `tirar-prints-nutri.cjs` (passa) e compare as fotos clínicas com `visual-antes-nutri` da Task 2. Qualquer diferença além da letra é defeito desta tarefa.
- [ ] **Step 3: Verificar.**
  - `rg -n "violet-|blue-|bg-gradient|uppercase|tracking-wide|shadow-\[" <arquivos desta tarefa>` não acha nada. A exceção é um `shadow` neutro de modal, se houver, justificado no relatório.
  - `npm test && npx tsc --noEmit`.
  - Rode `tirar-prints.cjs`, `tirar-prints-nutri.cjs` e os três `conferir-*`.
- [ ] **Step 4: Commit** — `git commit -m "Componentes, telas do nutri fora do clínico e entrada na linguagem nova"`

### Task 11: Verificações finais e documentação

**Files:**
- Modify: `ferramentas/conferir-inicio.cjs`, `ferramentas/LEIAME.md`, `CLAUDE.md`, `docs/superpowers/specs/2026-10-13-consultas-e-agenda-design.md`

- [ ] **Step 1: Verificações que faltam.** Em `conferir-inicio.cjs`, um segundo contexto logado como nutricionista (`nutri.teste@exemplo.com`, a mesma senha do mock) confere que a `font-family` computada do `body` e do `h1` da `NutriHome` casa com `/Instrument[_ ]Sans/`. O `next/font` renomeia a família, por isso a expressão aceita o `_`. A mesma conferência entra para o paciente.
- [ ] **Step 2: Rodada completa.**
  - `npm test`, `npx tsc --noEmit`.
  - `npm run build`, com o dev parado.
  - Com o dev de novo: `conferir-inicio.cjs`, `conferir-dieta.cjs`, `conferir-consulta-paciente.cjs`, `tirar-prints-nutri.cjs` e `tirar-prints.cjs`, com `OUT=<scratchpad>/visual-final`.
  - Anexe ao relatório as fotos da Início e da Dieta em 390 e 1280 px, claro e escuro.
- [ ] **Step 3: `CLAUDE.md`.**
  - **Seção nova "Visual do app"**, curta e no estilo do arquivo, com:
    - `lib/temaApp.ts`, as variáveis `--app-*` e as classes `app-*`, válidas fora de `.tema-clinico`;
    - a letra única;
    - o cartão de um nível;
    - texto no chão em `app-texto-2`, com o 4,43 do slate-500;
    - `.tabular` no dado;
    - meta ou limite pela meta de peso;
    - `adicionarAgua` como única gravação de água;
    - o `semRegistro` do Score;
    - a sugestão só do plano;
    - a linha da consulta e `estadoDaConsulta`.
  - **"Lógica testada":** acrescente `temaApp`, `paraHoje`, `cardapio`, `anel`, `agua`, `healthScore`, `saudacao`, `pesoDe30Dias`, `papelDasCalorias` e `estadoDaConsulta`.
  - **"Comandos":** o número de testes do `npm test`.
  - **"Armadilhas":** o slate-500 sobre a página.
  - **"Em aberto":** a gravação de Hábitos (`persist` regrava o dia inteiro e não confere erro).
- [ ] **Step 4:** Na spec da agenda, em "Lado do paciente", uma nota datada: na Início, a consulta virou uma linha no topo e as ações ficam em "Meu plano" (ver a spec do visual). No `ferramentas/LEIAME.md`, entram o `conferir-dieta.cjs` e a lista nova de `TELAS` do `tirar-prints.cjs`.
- [ ] **Step 5: Commit** — `git commit -m "Visual do app: verificações completas e documentação"`
