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
  grava de novo a última prescrição. Fora isso as abas só leem, menos a
  conversa e as notas; o que ele escreve sobre a consulta vai no registro
  (prontuário), em página própria, `pacientes/[id]/consultas/[consulta]`
  (veja "Registro da consulta"). Não há aba Prescrição. Veja "A página do
  paciente" abaixo.
- **Lógica testada:** `lib/date.ts` (datas e janelas, `dataNoBrasil`),
  `lib/planCheckIn.ts` (adesão, `estadosDaSemana`), `lib/foods.ts` (tabela
  TACO), `lib/edicao.ts` (`reduzirEdicao`, a regra de uma edição por vez,
  e `oQueSeguraATroca`), `lib/abas.ts` (a aba que o endereço pede),
  `lib/consultas.ts` (situação de cada consulta, hora de São Paulo, choque,
  grade do mês e da semana, o que cabe num dia do Mês, alertas de consulta,
  `resumoDaConsulta`), `lib/desdeConsulta.ts` ("desde a última consulta"),
  `lib/registro.ts` (o registro da consulta: faixas e leitura das medidas,
  `lerMedida`, `medidasValidas`, `errosDasMedidas`; `situacaoDoRegistro`; o
  botão do painel, `entradaDoRegistro`; o Observar, `observarDaConsulta` e
  `ultimoObservarPorPaciente`; o "antes" de cada medida, `anteriores`),
  `lib/aiActions.ts` (só `atualizar_peso` e `remover_ultimo` de peso, que não
  podem pegar a medida da consulta),
  `lib/evolucao.ts` (a conta dos gráficos do Corpo: o período,
  `inicioDoPeriodo`; a média semanal, `semanasDePeso`; os pontos da consulta e
  as séries de medida, `variacaoDaMedida`; o anel da meta, `pesoInicialDoPeriodo`
  e `progressoDaMeta`; a escala, o eixo e as frases de título e de `aria-label`),
  `lib/exames.ts` (o comparativo dos exames: `compararExames`,
  `resumoDoComparativo`, `descricaoDaSerie`), a faixa e o nome de exame em
  `lib/examRanges.ts` (`parseReferenceRange`, `chaveDoExame`, `faixaDaTabela`),
  `lib/temaClinico.ts` com `lib/contraste.ts` (paleta e razão de contraste)
  e, em `lib/nutri.ts`, a conta do resumo, da fila de triagem e da linha do
  tempo do nutri (`montarResumos`, `filaDeTriagem`, `montarLinhaDoTempo`),
  as médias da semana e a comparação com a meta (`mediasDaSemana`,
  `compararComMeta`), os textos de meta e de desvio (`textoDaMeta`,
  `textoDoDesvio`, `textoDoDesvioDoPlano`), a divisão dos avisos entre meta
  e plano de treino (`separarDesvios`) e o peso que vale num dia com duas
  medidas (`pesoDoDia`). As consultas ao banco não têm teste (nem
  `lib/perfil.ts`, que é só uma consulta), menos as que rodam contra um
  Supabase em memória: as leituras do resumo, da linha do tempo e da série
  em `lib/nutri.test.ts` e o "antes" das medidas em `lib/registroDb.test.ts`.

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

**Gráficos.** Moram em `components/clinico/graficos/` e só desenham: o anel da
meta e a Evolução (peso, cintura, % de gordura) na aba Corpo, o comparativo dos
exames com o minigráfico na Clínico. A conta é de `lib/evolucao.ts` e
`lib/exames.ts`, testadas. Cor só por `var(--clin-*)`, nunca hex (é o que faz o
escuro funcionar sem segunda lista), e par novo entra em `PARES_GRAFICO`
(`lib/temaClinico.ts`), testado a 3:1 nos dois temas. A faixa do minigráfico é
`primaria-fundo`, que contra a página dá 1,1 a 1,2:1; por isso o limite dela é
uma linha de 1 px em `campo`. O `GraficoPeso` tem dica própria e não o `Tooltip`
do recharts, que pega o ponto mais próximo e erra a semana nas pontas cortadas
do período. A semana é de segunda a domingo, com um valor por dia antes da média
(três pesagens no mesmo dia pesariam três vezes), e a medida da consulta fica
fora da média, como ponto à parte. **Leitura que volta cheia conta como falha**
e mostra `ErroSecao`: o Corpo lê o período inteiro (`getEvolucaoDoCorpo`, com
piso e teto de data e `.limit(1000)`), o Clínico lê os exames com `.limit(200)`
(e 200 linhas derrubam a aba toda, tratamento incluso). O PostgREST corta no
limite sem erro, e um ano desenhado cortado como se fosse inteiro, ou um
"anterior" que ficou fora da leitura, é o mesmo "Nunca registrou nada" de antes.
"Ainda não dá para ver tendência" só vale com leitura que deu certo.

**Comparativo dos exames.** Compara o último resultado de cada exame com o
anterior, um resultado por dia (vale o último da leitura, que por isso vem em
ordem de `date` e `created_at`). A faixa é a do laudo; a da tabela do app só
vale se a unidade do resultado for vazia ou igual à dela. Para dois nomes serem
o mesmo exame, `chaveDoExame` e `faixaDaTabela` (`lib/examRanges.ts`) exigem
nome igual a uma key da tabela, ou todas as palavras do nome nas keys de UMA
entrada **e** o nome contendo uma key inteira; palavra de amostra (soro, sérico,
plasma, sangue…) não conta. O casamento frouxo do `findDef` juntou o
VLDL-colesterol em "colesterol total" (o 24 do VLDL apagava o 190 do mesmo dia)
e a Vitamina K em potássio: juntar à toa inventa uma conclusão clínica, separar
à toa só dá duas linhas. Na unidade, o prefixo micro (u, μ, µ, mc) é um só, UI
e U são a mesma, e µUI/mL equivale a mUI/L (o TSH chega nas três grafias);
outra unidade diz "unidade diferente do anterior" em vez de comparar o número
cru. `parseReferenceRange`
trocava só a primeira vírgula decimal e lia "0,9 a 1,7" como 0,9 a 1; troca
todas, e isso vale também para a página Exames do paciente.

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

## Registro da consulta

Spec: `docs/superpowers/specs/2026-10-13-registro-da-consulta-design.md`.
Um prontuário por consulta, em `/app/pacientes/<id>/consultas/<consulta>`
(tema clínico pelo layout de `pacientes/[id]`; tela larga no `AppShell` pela
mesma regra do detalhe, `detalheDoPaciente`). `consultation_records` e
`consultation_addenda` têm **só política de leitura, e só do autor**, sem
exigir vínculo (o prontuário não some quando o paciente revoga); o paciente
não lê. Toda escrita é por função `SECURITY DEFINER` (`salvar_registro`,
`concluir_registro`, `descartar_rascunho`, `adicionar_adendo`), com
`{ ok, error, id? }` e o `updated_at` no salvar; o adendo é a única que não
pede vínculo ativo. Rascunho → concluído → adendo: descartar apaga o
rascunho; concluir copia nome e CRN (sem CRN no perfil, o diálogo pede e
grava em `profiles.crn`), marca a consulta realizada se ainda agendada e
trava; corrigir, só por adendo. `fechar_consulta` recusa falta e
cancelamento com registro. As faixas de medida e os limites de texto estão
na migração (`erro_das_medidas`, `erro_do_registro`) e em `lib/registro.ts`
(`FAIXAS`, `LIMITES`): mudou um, mude o outro. O `appointment_id` do
registro não tem cascata, de propósito (20 anos de guarda, pelos resumos; ver
Em aberto): apagar uma consulta com registro, mesmo rascunho, falha, e apagar
a conta do paciente ou do nutri dela também (a consulta cai em cascata com a
conta e esbarra na chave).

**Publicar: primeiro as duas migrações, depois o merge**, que dispara o
deploy da Vercel: código novo em esquema velho quebra a aba Corpo e o resumo
do paciente (leem `measured_by`), o salvar do perfil do nutri (`crn`) e a
página do registro, e faz o assistente duplicar o peso calado (o filtro em
`measured_by` falha e ele cai no insert). Antes de aplicar, em produção e só
lendo: o dono de `body_measurements` (`pg_class.relowner`) é o papel que
aplica a migração, dono das funções, e `relforcerowsecurity` é falso; senão
a RLS nova barra o insert de `concluir_registro` (a réplica local roda como
superusuário e não pega). Depois, `has_function_privilege('anon',
'public.salvar_registro(uuid,jsonb,timestamptz)', 'execute')` dá falso, e o
mesmo nas outras três.

**Medidas da consulta.** Concluir publica em `body_measurements`, com
`measured_by` (quem mediu; nulo é o paciente) e `appointment_id` (único), na
data da consulta em São Paulo. A `measurements_all_own` virou quatro: o
paciente lê todas as dele, mas cria só com as duas colunas nulas e edita e
apaga só as com `measured_by` nulo; `measurements_author_read` deixa quem
mediu ler depois do desvínculo. **Update e delete barrados pela RLS não dão
erro**: afetam zero linhas e o supabase-js devolve `error: null`, e o
assistente diria "peso atualizado" sem mudar nada. Por isso `atualizar_peso`
e `remover_ultimo` (peso) filtram `.is("measured_by", null)` antes de escolher
a linha, e o excluir da página Medidas, que marca "Medida na consulta" e não
oferece o botão nela, pede `count: "exact"` e avisa com zero. Escrita nova em
`body_measurements` precisa da mesma defesa. **A medida da consulta não é
registro do paciente**: contada, quem nunca registrou virava "N dias sem
registrar" desde a consulta. A triagem (`montarResumos`, `ultimosRegistros`)
conta só as com `measured_by` nulo, a linha do tempo a rotula "Medida na
consulta", e no peso do dia ela vence a de casa (`pesoDoDia`): no resumo (peso
atual e variação em 30 dias), no Peso atual do Corpo, no anel da meta e na
série. Antes só valia na série: o resumo e o Peso atual pegavam uma das duas
ao acaso, e o gráfico mostraria a outra. A exceção é a média semanal do gráfico,
que só conta as de casa (a da consulta é ponto à parte).

**O rascunho salva sozinho** (`useSalvarRascunho`), 1,5 s depois da última
tecla e ao sair do campo, sem cópia no navegador (computador compartilhado).
O `updated_at` da trava entre abas fica como o **texto exato** do banco
(`Date` corta os microssegundos, e toda gravação dava "mudou em outra aba");
**uma gravação por vez** (duas juntas mandariam o mesmo `updated_at`); e **ao
abrir, o editor confere o banco**: o cache do roteador do Next devolve no
Voltar a página com o rascunho velho.

O painel da consulta (`PainelConsulta`) dá "Registrar consulta", "Continuar
registro" ou "Ver registro" numa consulta que já começou e não é falta,
cancelamento nem pedido; sem saber o registro (leitura que falhou ou não
feita), só "Abrir registro" (`entradaDoRegistro`), nunca um "Registrar"
adivinhado. O "Observar no retorno" ali é o do registro concluído da
**consulta que começou por último**, não o concluído por último
(`ultimoObservarPorPaciente`): quem preenche hoje o registro de uma consulta
antiga faria a instrução velha passar por atual.

## Comandos

```bash
npm run dev      # desenvolvimento
npm test         # 570 testes unitários (vitest)
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
- **Prontuário de ex-paciente sem tela.** O registro concluído segue legível
  pelo autor no banco (as leituras do autor e `adicionar_adendo` não pedem
  vínculo), mas o perfil e a consulta (`appointments_nutri_read`) pedem vínculo
  ativo e não há lista de ex-pacientes: a página do registro mostra "Sem
  acesso". O dado não se perde; falta o caminho até ele.
- **A Resolução CFN 594/2017 não foi lida no texto oficial.** O registro foi
  desenhado pelos resumos do CONARQ, do CRN-3 e do CRN-5 (a guarda de 20
  anos inclusive); o texto de venda "atende ao CFN" não sai antes de conferir.
- No gráfico da página Medidas do paciente, o ponto da medida da consulta não
  se distingue; a marca "Medida na consulta" fica só na linha da lista.
- **A página Exames do paciente ainda classifica pelo casamento frouxo de nome
  (`findDef`) e pela tabela do app antes do laudo, sem conferir a unidade.**
  "Vitamina K" é julgada pela faixa do potássio, e a B12 em pmol/L pela tabela em
  pg/mL. O `status` gravado vem do `classifyExam` e é o selo "Último" do
  comparativo do nutri, que por isso pode discordar da faixa do laudo na mesma
  linha (B12 235 pmol/L: "Atenção" ao lado de uma faixa que o põe dentro). O
  comparativo já usa a regra nova (`chaveDoExame`, laudo primeiro, unidade
  conferida); falta o `classifyExam`. Tarefa à parte sugerida.
- **O `persist` de Hábitos (`app/app/habitos/page.tsx`) regrava a linha inteira
  do dia a partir do estado da tela e não confere o `error`.** O que mudou fora
  da tela (o assistente registrando água) pode voltar ao valor velho, e uma
  gravação que falha parece salva. Tarefa à parte sugerida.
