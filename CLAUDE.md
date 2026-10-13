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
- **Nutricionista:** `components/NutriHome.tsx`, `app/app/pacientes/`, a
  agenda em `app/app/agenda/` (veja "Consultas e agenda") e o
  detalhe em `pacientes/[id]`, em abas por assunto: Resumo, Alimentação,
  Treino, Corpo, Clínico e Consultas. Ele prescreve ali mesmo, nas abas Alimentação
  (metas, cardápio) e Treino; a fila do Resumo tem o atalho Reaplicar, que
  grava de novo a última prescrição; o resto é leitura, fora a conversa e as
  notas. Não há aba Prescrição. Veja "A página do paciente" abaixo.
- **Lógica testada:** `lib/date.ts` (datas e janelas, `dataNoBrasil`),
  `lib/planCheckIn.ts` (adesão, `estadosDaSemana`), `lib/foods.ts` (tabela
  TACO), `lib/edicao.ts` (`reduzirEdicao`, a regra de uma edição por vez,
  e `oQueSeguraATroca`), `lib/abas.ts` (a aba que o endereço pede),
  `lib/consultas.ts` (situação de cada consulta, hora de São Paulo, choque,
  grade do mês e da semana, o que cabe num dia do Mês, alertas de consulta), `lib/desdeConsulta.ts`
  ("desde a última consulta"),
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

`pacientes/[id]/page.tsx` monta as seções de `secoes/` em abas: Resumo
(Fila: alertas, números e "desde a última consulta"), Alimentação, Treino,
Corpo, Clínico e Consultas. A aba vem
do endereço (`?aba=treino`; `lib/abas.ts`, que manda qualquer valor
desconhecido para o Resumo) e **só a aba aberta é montada e consulta o
banco**: cada aba cria ali mesmo as consultas que usa (o perfil do
paciente vem uma vez, antes). O Cabecalho fica fora das abas; a
ConversaENotas também, na coluna da direita no computador, embaixo da aba
entre `lg` e `xl` e, no celular, só em tela cheia (Mensagem, Nota). Cada
seção é um componente de servidor no próprio `Suspense` e mostra
`ErroSecao` se a leitura falha. A trava de uma edição por vez
(`components/clinico/Edicao.tsx`, regra em `lib/edicao.ts`) vale para
metas, cardápio e treino; o Reaplicar da fila grava fora dela. Trocar de aba
desmonta o editor aberto, então a barra (`AbasPaciente`) pergunta
"Descartar as alterações em …?" quando há alteração não salva, e segura a
troca enquanto uma gravação está em voo (`oQueSeguraATroca`); recarregar ou
fechar a página cai no aviso do navegador. **O Voltar do navegador não
pergunta** e perde o rascunho: um ouvinte de `popstate` não roda antes do
Next (na `window` a ordem é a de registro, mesmo em captura), e cancelar
deixava o endereço de uma aba com o conteúdo de outra. Sair da página por
outro link (menu, Pacientes, Linha do tempo) também não pergunta. A tela cheia do celular (`?conversa=1`,
`?notas=1`) leva `?aba=` junto (`hrefDaAba`): sem isso o Voltar caía no
Resumo e desmontava o rascunho. Botões da fila que levavam a uma seção ("Ver
semana", "Ver clínico") agora abrem a aba dela.
`?t=atividade` redireciona para `pacientes/[id]/linha-do-tempo`.

No celular as seis abas passam de 390 px: a barra rola, e uma seta com
esmaecido na borda mostra que há aba escondida (sem ela, só o "C" de
Consultas aparecia). `ErroSecao` e os estilos de botão (`estilos.ts`) moram em
`components/clinico/`, porque a agenda usa os mesmos.

**Largura.** A partir de `lg`, a área de conteúdo do `AppShell` tem 720 px
seja qual for a largura da janela (`max-w-5xl` menos o menu lateral e as
margens). Com a coluna de conversa de 360 px a partir de `lg`, sobravam
~336 px para a principal, menos que um celular. Por isso as duas colunas só
começam em `xl:` (1280 px). Em `/app/pacientes/<id>` e na agenda (a grade da
Semana tem sete colunas), o `AppShell` solta o conteúdo para ocupar a área
ao lado do menu até 1440 px: com `max-w-7xl` centrado na janela, ele parava
em 976 px, e numa janela de 1728 px sobravam 256 px vazios entre o menu e o
paciente. Nessas duas telas o fundo da página inteira é o chão do tema
clínico (`body:has(.tema-clinico)`, em `cssDoTemaClinico`); sem isso a página
parecia uma caixa solta, com a faixa de outra cor em volta. Para encaixar
algo ao lado do conteúdo, meça a área do conteúdo, não a janela.

**Leitura que falha não é "não tem".** O supabase-js devolve
`{ data: null, error }` sem lançar, e `data ?? []` esconde a falha: sem as
refeições o paciente aparecia como "Nunca registrou nada", e sem os exames o
alerta de exame sumia calado. Na página, `resumirPacientes`,
`getPatientSeries` e `getPatientActivity` devolvem `falhou` junto dos dados.
`getPatientsSummary` manteve a assinatura antiga (Início e lista).

**Avisos de meta e de plano.** A Alimentação mostra só os quatro campos de
meta de `prescription_deviations` (`CAMPOS_META`); o aviso de mudança no
plano de treino cai na mesma tabela, mas não é meta, e aparece no Treino.
Os gatilhos gravam `kind`: 'meta' com a coluna no `field`; 'plano' com o
nome da sessão no `field` e no `prescribed`, e `current_value` igual a
'removido pelo paciente' quando a sessão é apagada (ou o nome novo, quando
muda). Mostrado cru, saía "ela está com removido pelo paciente":
`separarDesvios` divide pelo `kind` e `textoDoDesvioDoPlano` escreve o aviso.
O gatilho `prescriptions_ack_deviations` dá baixa em **todos** os avisos
abertos do paciente a cada insert em `prescriptions`, então qualquer
`set_patient_goals` ("Reaplicar" ou "Aplicar metas") também limpa um aviso
de plano de treino; com os dois abertos, a fila avisa embaixo do Reaplicar.
E `set_patient_goals` trata nulo como "apagar a meta": "Reaplicar" manda os
quatro valores da última prescrição, nunca só o campo que mudou.

## Consultas e agenda

Spec: `docs/superpowers/specs/2026-10-13-consultas-e-agenda-design.md`.
Tabela `appointments` com **só política de leitura**; toda escrita é por
função `SECURITY DEFINER` (`marcar_consulta`, `remarcar_consulta`,
`fechar_consulta`, `pedir_consulta`, `pedir_remarcacao`, `cancelar_consulta`),
que confere quem pede e a mudança de situação: com política de update, o
paciente poderia se marcar como "realizada". As funções devolvem `{ ok, error }`
como `set_patient_goals`. "Remarcar" com só o id é "Aceitar" o pedido e
"Manter horário" na remarcação. **"Sem desfecho" não é gravado**: é uma agendada
cujo fim (`starts_at + duration_min`) já passou (`situacao` em
`lib/consultas.ts`); gravar pediria cron, e o Hobby só aceita diário.

A migração mora em `supabase/migrations/` e é testada num Postgres local com
`ferramentas/testar-sql.sh` (ver `ferramentas/LEIAME.md`), não em produção.
Hora de consulta é sempre de São Paulo com o deslocamento do dia
(`instanteEmSaoPaulo`), nunca `-03:00` fixo; o dia de uma consulta é
`diaDaConsulta`/`dataNoBrasil`, nunca `starts_at.slice(0,10)`.

A agenda (`/app/agenda?vista=dia|semana|mes&data=`) usa o tema clínico
(`components/clinico/TemaClinico.tsx`, o mesmo do paciente) e os mesmos
componentes (`components/consultas/`). Sem `?vista=`, vale a última usada
(cookie `agenda_vista`); sem cookie, Dia. Pendência (pedido, pedido de
remarcação, sem desfecho) vira alerta de tipo `consulta` na fila (nível 2 e
4) e aparece tracejada na agenda, com uma linha de aviso no topo; não há
coluna de pendências (o dono do produto achou "bagunçado"). Choque de
horário avisa e não impede. O paciente vê o cartão de consulta
(`components/CartaoConsulta.tsx`) na Início e em "Meu plano", no visual do
app dele, e não recebe aviso fora do app (sem Web Push).

## Comandos

```bash
npm run dev      # desenvolvimento
npm test         # 230 testes unitários (vitest)
ferramentas/testar-sql.sh   # migrações e testes SQL num Postgres local
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
`lib/date.ts`, que têm teste, e, na consulta ao banco, `limitesDaJanela`
(`.gte("date", desde).lte("date", ate)`). Não escreva a conta à mão.

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

**Service worker e `router.refresh()`.** `public/sw.js` tinha `/app` na lista
de cache-primeiro, e o `router.refresh()` do Next busca `/app?_rsc=…` (mesmo
caminho): depois de qualquer ação na Início do paciente (confirmar treino, ler
recado, cancelar consulta) a página voltava com o dado VELHO, para quem tinha o
service worker instalado. A resposta RSC (`_rsc`, cabeçalho `RSC`) nunca vai
para o cache; cache-primeiro só em `/_next/static/`. Ao mexer no sw.js, troque
o nome do `CACHE` para apagar o antigo.

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
