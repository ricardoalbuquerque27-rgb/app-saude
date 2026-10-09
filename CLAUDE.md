# Pace Fit

SaaS B2B para **nutricionistas acompanharem pacientes**. O nutricionista
convida, prescreve e acompanha; o paciente usa de graça. Quem paga é o
profissional — logo, o lado dele é o produto, não um extra.

Next.js 14 (App Router) · TypeScript · Tailwind · Supabase · Vercel.
Interface e commits em português do Brasil.

## Como o app se divide

**A mesma rota serve duas interfaces.** `/app` devolve o painel do
paciente ou o `NutriHome` conforme `profiles.role` — não existe `/nutri`.
Isso não é óbvio lendo a árvore de arquivos.

- **Paciente:** `app/app/page.tsx` (Início), `nutricionista/` ("Meu plano":
  metas, cardápio, treino, conversa), `dieta/`, `treinos/`, `habitos/`,
  `medidas/`, `exames/`, `tratamento/`, `treino/[id]` (leitura do treino).
- **Nutricionista:** `components/NutriHome.tsx`, `app/app/pacientes/` e o
  detalhe em `pacientes/[id]`: uma página só, por assunto. Ele prescreve ali
  mesmo, em Alimentação (metas, cardápio) e Treino; a fila tem o atalho
  Reaplicar, que grava de novo a última prescrição; o resto é leitura, fora
  a conversa e as notas. Não há mais aba Prescrição. Veja "A página do
  paciente" abaixo.
- **Lógica testada:** `lib/date.ts` (datas e janelas, `dataNoBrasil`),
  `lib/planCheckIn.ts` (adesão, `estadosDaSemana`), `lib/foods.ts` (tabela
  TACO), `lib/edicao.ts` (`reduzirEdicao`, a regra de uma edição por vez),
  `lib/temaClinico.ts` com `lib/contraste.ts` (paleta e razão de contraste)
  e, em `lib/nutri.ts`, a conta do resumo, da fila de triagem e da linha do
  tempo do nutri (`montarResumos`, `filaDeTriagem`, `montarLinhaDoTempo`),
  as médias da semana e a comparação com a meta (`mediasDaSemana`,
  `compararComMeta`), os textos de meta e de desvio (`textoDaMeta`,
  `textoDoDesvio`, `textoDoDesvioDoPlano`) e a divisão dos avisos entre meta
  e plano de treino (`separarDesvios`). As consultas ao banco não têm teste,
  nem `lib/perfil.ts`, que é só uma consulta.

Toda segurança é por **RLS no Postgres**, nunca por service role no app.
Ao mexer em política, teste com `BEGIN ... ROLLBACK` e
`set_config('request.jwt.claims', ...)` antes de `set local role
authenticated` — nessa ordem.

## A página do paciente (nutricionista)

`pacientes/[id]/page.tsx` monta as seções de `secoes/` (Cabecalho, Fila,
Alimentacao, Treino, Corpo, Clinico, ConversaENotas). Cada uma é um
componente de servidor no próprio `Suspense` e mostra `ErroSecao` se a
leitura falha. Fazem as próprias consultas, menos o perfil do paciente, o
resumo, a última prescrição e os avisos abertos (de meta e do plano de
treino): a página pede esses quatro uma vez e reparte, para os números não
discordarem entre seções. A trava de uma edição por vez
(`components/clinico/Edicao.tsx`, regra em `lib/edicao.ts`) vale para
metas, cardápio e treino; o Reaplicar da fila grava fora dela. As abas e o
`PrescricaoClient` não existem mais; `?t=atividade` redireciona para
`pacientes/[id]/linha-do-tempo`.

**Largura.** A partir de `lg`, a área de conteúdo do `AppShell` tem 720 px
seja qual for a largura da janela (`max-w-5xl` menos o menu lateral e as
margens). Com a coluna de conversa de 360 px a partir de `lg`, sobravam
~336 px para a principal, menos que um celular. Por isso as duas colunas só
começam em `xl:` (1280 px), e o `AppShell` abre para `max-w-7xl` apenas em
`/app/pacientes/<id>`. Para encaixar algo ao lado do conteúdo, meça a área
do conteúdo, não a janela.

**Leitura que falha não é "não tem".** O supabase-js devolve
`{ data: null, error }` sem lançar, e `data ?? []` esconde a falha: sem as
refeições o paciente aparecia como "Nunca registrou nada", e sem os exames o
alerta de exame sumia calado. Na página, `resumirPacientes`,
`getPatientSeries` e `getPatientActivity` devolvem `falhou` junto dos dados.
`getPatientsSummary` manteve a assinatura antiga (Início e lista).

**Avisos de meta e de plano.** A Alimentação mostra só os quatro campos de
meta de `prescription_deviations` (`CAMPOS_META`); o aviso de mudança no
plano de treino cai na mesma tabela, mas não é meta, e aparece no Treino.
O gatilho `prescriptions_ack_deviations` dá baixa em **todos** os avisos
abertos do paciente a cada insert em `prescriptions`, então qualquer
`set_patient_goals` ("Reaplicar" ou "Aplicar metas") também limpa um aviso
de plano de treino; com os dois abertos, a fila avisa embaixo do Reaplicar.
E `set_patient_goals` trata nulo como "apagar a meta": "Reaplicar" manda os
quatro valores da última prescrição, nunca só o campo que mudou.

## Comandos

```bash
npm run dev      # desenvolvimento
npm test         # 153 testes unitários (vitest)
npm run build    # produção
```

Testes visuais e de tela: veja `ferramentas/LEIAME.md`. Eles sobem um
Supabase falso e dirigem o Chromium — é a única forma de ver as telas
logadas num ambiente sem acesso ao banco. Para a página do paciente, o mock
com `CENARIO=carteira` e `ferramentas/tirar-prints-nutri.cjs`.

## Armadilhas que já custaram caro

Cada uma destas quebrou em produção. Estão listadas porque voltam.

**Janelas de N dias.** `data >= addDaysISO(hoje, -7)` com comparação `>=`
abrange **oito** dias, não sete. E sem teto, um registro com data futura
entra na conta. Isso apareceu em **quatro** lugares diferentes e produziu
"Adesão: 114% — 8 de 7 dias". Use `naJanela` / `diasNaJanela` de
`lib/date.ts`, que têm teste. Não escreva a conta à mão.

**Fuso horário.** O app conta datas em `America/Sao_Paulo` (`lib/date.ts`),
mas o servidor da Vercel roda em UTC. `toLocaleDateString` **sem**
`timeZone` num componente de servidor mostra a data de amanhã entre 21h e
meia-noite. Use `hojeLongo()` / `todayISO()`. Pelo mesmo motivo,
`toISOString().slice(0,10)` não serve para aritmética de data — use
`addDaysISO` / `avancarDia`. E `created_at.slice(0,10)` é a data em UTC: uma
mensagem das 22h aparecia com a data de amanhã. Para um instante do banco, use
`dataNoBrasil()`.

**`profiles` sem filtro por id.** A RLS deixa o paciente ver também o
perfil do nutricionista vinculado, então
`from("profiles").select(...).maybeSingle()` devolve **duas** linhas e
falha. Quebrava seis telas, e só para quem TEM acompanhamento — o caso de
uso principal. Use `meuPerfil()` de `lib/perfil.ts`.

**`vercel.json`.** O plano Hobby recusa cron abaixo de diário **na criação
do deploy**, com HTTP 400, antes de qualquer build. Foi o que travou todos
os deploys por semanas sem mensagem de erro visível.

**`npm run build` com o `npm run dev` no ar** apaga os chunks que o dev
está servindo. O sintoma engana: 404 nos scripts, React não hidrata,
formulário faz submit nativo.

**`playwright` fica fora do `package.json`** de propósito (o postinstall
baixa navegadores e atrasa o build na Vercel). Qualquer `npm install`
remove ele. `MODULE_NOT_FOUND` nos scripts de `ferramentas/` é isso.

## Convenções

- Comentário explica **por quê**, não o quê — de preferência citando o bug
  que motivou o código. Veja `lib/date.ts` e `lib/perfil.ts`.
- Cor sempre em par claro/escuro: **não existe um tom da marca que sirva
  aos dois temas** (no claro só `brand-700+` passa em contraste; no escuro
  só `brand-600` para trás). A rota `/estilo`, só em desenvolvimento,
  mostra a escala com a razão de contraste calculada.
- A página do paciente do nutricionista tem tema próprio, `.tema-clinico`,
  aplicado por `pacientes/[id]/layout.tsx`. A paleta mora em
  `lib/temaClinico.ts`, com contraste testado em `lib/temaClinico.test.ts`
  (texto 4,5:1; gráfico e borda de campo 3:1; nos dois temas): trocar um hex
  que não passa quebra o teste, não a tela. As classes `clin-*` do Tailwind
  só dentro de `.tema-clinico`, porque as variáveis `--clin-*` só existem ali.
  `.card`, `.input` e `.btn-*` são refeitos nesse escopo em `app/globals.css`,
  sob `:where(.tema-clinico)`, que não soma especificidade: no claro, um
  utilitário na mesma tag continua vencendo. No escuro, não: a cópia
  `.dark :where(.tema-clinico) .x` tem duas classes e vence um utilitário sem
  `dark:`; repita a variante (`text-clin-texto-2 dark:text-clin-texto-2`).
  A `/estilo` mostra também esta paleta.
- Campo de data que registra algo já acontecido leva `max={todayISO()}`. A
  exceção é "próxima aplicação", que é futura por definição.

## Em aberto

- **Nenhum nutricionista real usou o produto.** É a maior incerteza, e
  nenhuma ferramenta resolve. A página do paciente foi aprovada pelo dono do
  produto, não por um nutricionista.
- A landing fala com consumidor final, não com nutricionista.
- Sem Web Push (falta VAPID) e sem cobrança.
- Conta de teste (`Maria Souza (teste)`) e a rota `/estilo` precisam sair
  antes de usuários reais.
- No painel do Supabase, falta ligar a proteção contra senhas vazadas.
