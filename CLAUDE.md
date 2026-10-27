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
- **Lógica testada:** `lib/date.ts` (datas e janelas, `dataNoBrasil`, e a
  `saudacao` pela hora de São Paulo),
  `lib/planCheckIn.ts` (adesão, `estadosDaSemana`, e o `setPlanCheck`, contra o
  `bancoEmMemoria`), `lib/treinoAoVivo.ts` (`gravarTreinoAoVivo`, o "Finalizar"
  da sessão ao vivo), `lib/treinos.ts` (`gravarTreino`, o treino com as séries,
  e `salvarRotina`), `lib/foods.ts` (tabela
  TACO), `lib/edicao.ts` (`reduzirEdicao`, a regra de uma edição por vez,
  e `oQueSeguraATroca`), `lib/abas.ts` (a aba que o endereço pede),
  `lib/consultas.ts` (situação de cada consulta, hora de São Paulo, choque,
  grade do mês e da semana, o que cabe num dia do Mês, alertas de consulta,
  `resumoDaConsulta`; `estadoDaConsulta`, que escolhe entre a próxima, o pedido
  e a cancelada pelo nutri para o cartão e para a linha da Início; e
  `rotuloDoDia`, o rótulo da Dieta), `lib/desdeConsulta.ts` ("desde a última
  consulta"),
  `lib/registro.ts` (o registro da consulta: faixas e leitura das medidas,
  `lerMedida`, `medidasValidas`, `errosDasMedidas`; `situacaoDoRegistro`; o
  botão do painel, `entradaDoRegistro`; o Observar, `observarDaConsulta` e
  `ultimoObservarPorPaciente`; o "antes" de cada medida, `anteriores`),
  `lib/aiActions.ts` (só `atualizar_peso` e `remover_ultimo` de peso, que não
  podem pegar a medida da consulta, o `definir_metas`, que não grava por cima
  da prescrição nem quando a leitura dela falha, e os exames da Gaia,
  `registrar_exame` e `ler_exame`; veja "Uso pretendido"),
  `lib/evolucao.ts` (a conta dos gráficos do Corpo: o período,
  `inicioDoPeriodo` e `limitadoEmUmAno`; a média semanal, `semanasDePeso`; os
  pontos da consulta e as séries de medida, `variacaoDaMedida`; o anel da meta,
  `pesoInicialDoPeriodo`, `progressoDaMeta` e as frases dele, `textoDoAnel`; a
  escala, o eixo e as frases de título, `rotuloDoPeso`, e de `aria-label`),
  `lib/exames.ts` (o comparativo dos exames: `compararExames`,
  `resumoDoComparativo`, `descricaoDaSerie`, `avisosDaLinha`,
  `fraseSemComparacao`, `dataDoComparativo`; a regra da nutricionista,
  `situacaoParaANutricionista`; a linha gravada, `exameParaGravar`; e as
  notas que o paciente vê, `semExplicacaoAutomatica` e `notasDoExame`), a
  faixa, o nome e a unidade de exame em `lib/examRanges.ts`
  (`parseReferenceRange`, `dentroDaFaixa`, `chaveDoExame`, `faixaDaTabela`,
  `unidadeDoExame`, `ehTextoDaTabela`; e a regra do paciente,
  `situacaoNoLaudo`, `textoDaSituacaoNoLaudo` e `linhaDoLaudo`), a leitura
  do laudo em `lib/laudo.ts` (`transcricaoDoLaudo`), o "O que é?" em
  `lib/explicacaoDeExame.ts` (`nomeValido`, `pedidoDaExplicacao`,
  `explicacaoAceitavel`, `respostaDaExplicacao`), o histórico da IA sem os
  cartões de exame e tratamento em `lib/historicoDaIa.ts`
  (`semExameNemTratamento`), os números em pt-BR em `lib/numeros.ts` (`numeroBR` e
  `numeroFixo`, que mantém o zero: "66,0"), a leitura em
  páginas em `lib/paginacao.ts` (`lerEmPaginas`),
  `lib/temaClinico.ts` e `lib/temaApp.ts` com `lib/contraste.ts` (as duas
  paletas e a razão de contraste), a regra de senha nova em `lib/senha.ts`
  (`problemaDaSenha`, `ehErroDeSenhaFraca`), a marca em `lib/marca.ts`
  (`linkDaVaga`, `textoDoConvite`, e a guarda do nome) e o desenho do ícone em
  `lib/appIcon.ts`, as contas da Início e da Dieta do
  paciente (`lib/paraHoje.ts`, `montarParaHoje`; `lib/cardapio.ts`,
  `sugestaoDeProteina`, `partesDaSugestao` e `textoDaSugestao`; `lib/anel.ts`,
  `rotuloDoAnel` e `avisoDoAnel`; `lib/healthScore.ts`, `computeHealthScore`,
  com `semRegistro` e `topPilar`; `lib/agua.ts`, `adicionarAgua`, contra um
  banco falso no próprio arquivo)
  e, em `lib/nutri.ts`, a conta do resumo, da fila de triagem e da linha do
  tempo do nutri (`montarResumos`, `filaDeTriagem`, `montarLinhaDoTempo`),
  os textos da fila (`textoDesvios`, `textoParado`, `textoFaltas`,
  `textoSemConfirmacao`, `textoExames`, `TEXTO_DOSE_ATRASADA`),
  as médias da semana e a comparação com a meta (`mediasDaSemana`,
  `compararComMeta`), os textos de meta e de desvio (`textoDaMeta`,
  `textoDoDesvio`, `textoDoDesvioDoPlano`), a divisão dos avisos entre meta
  e plano de treino (`separarDesvios`), o peso que vale num dia com duas
  medidas (`pesoDoDia`), o peso de 30 dias (`pesoDe30Dias`, o mesmo número no
  resumo do nutri e na Início do paciente), o último peso sem janela
  (`pesoMaisRecente`: a Dieta e o "em dd/mm" da Início) e o papel das calorias
  (`papelDasCalorias`). As
  consultas ao banco não têm teste (nem
  `lib/perfil.ts`, que é só uma consulta), menos as que rodam contra um
  Supabase em memória: as leituras do resumo, da linha do tempo e da série
  em `lib/nutri.test.ts`, o "antes" das medidas em `lib/registroDb.test.ts`,
  as leituras em páginas do Corpo e dos exames em `lib/evolucaoDb.test.ts`
  e `lib/examesDb.test.ts`, e as de Treinos (`lerTreinos`) em
  `lib/treinosDb.test.ts`. O banco delas, `lib/bancoEmMemoria.ts`, tem `range`,
  `count: "exact"` e o `max-rows` do projeto, e devolve `error` quando o teste
  pede; grava também, com `insert`, `upsert`, `update`, `delete` e `in`, para
  os testes do check-in, do treino ao vivo e das rotinas.

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

**Gráficos.** Os desenhos moram em `components/clinico/graficos/` (as peças
comuns em `base.tsx`) e só desenham: o anel da meta e a Evolução (peso,
cintura, % de gordura) na aba Corpo, e o minigráfico dos exames. A tabela do
comparativo é do `Clinico.tsx`. A conta é de `lib/evolucao.ts` e
`lib/exames.ts`, testadas. Cor só por `var(--clin-*)`, nunca hex (é o que faz o
escuro funcionar sem segunda lista), e par novo entra em `PARES_GRAFICO`
(`lib/temaClinico.ts`), testado a 3:1 nos dois temas. A faixa do minigráfico é
`primaria-fundo`, que contra a página dá 1,1 a 1,2:1; por isso o limite dela é
uma linha de 1 px em `campo`, como a linha vertical de cada consulta no peso
(em `linha` ela dava 1,24:1 e sumia). O `GraficoPeso` tem dica própria e não o
`Tooltip` do recharts, que pega o ponto mais próximo e erra a semana nas
pontas cortadas do período. A semana é de segunda a domingo, com um valor por
dia antes da média (três pesagens no mesmo dia pesariam três vezes), e a
medida da consulta fica fora da média, como ponto à parte.

**Leitura em páginas, e só o teto é falha.** O PostgREST corta no limite sem
erro, e um ano desenhado cortado como se fosse inteiro, ou um
"anterior" que ficou fora da leitura, é o mesmo "Nunca registrou nada" de
antes. Os exames e o período do Corpo (`getExamesDoPaciente`,
`getEvolucaoDoCorpo`) leem em páginas de 1.000 com `.range()` até vir uma
página curta (`lerEmPaginas`, `lib/paginacao.ts`), com teto de 5.000: só o
teto, ou erro numa página, é falha. Era `.limit(200)` nos exames com "vir
cheio é falha": numa leitura que só cresce, oito laudos derrubavam a aba
Clínico para sempre, tratamento junto. A falha dos exames mostra o erro só no
bloco Exames. "Ainda não dá para ver tendência" só vale com leitura que deu
certo. **O tamanho da página supõe o `max-rows` padrão da Supabase (1.000).**
Se o projeto o baixasse, o PostgREST cortaria a página sem erro e a leitura
pararia nela, tomada por "curta"; por isso a 1ª página pede `count: "exact"`
(a consulta recebe `contar`) e a soma das páginas tem de bater com ele, senão
é falha (só na 1ª, porque o `count` custa uma contagem por pedido). Resposta
sem contagem não tem o que conferir, e vale o que veio. Leitura nova em
páginas pede a contagem do mesmo jeito.

**Comparativo dos exames.** Compara o último resultado de cada exame com o
anterior, um resultado por dia (vale o último da leitura, que por isso vem em
ordem de `date` e `created_at`; com valores diferentes no mesmo dia a linha
avisa "mais de um resultado em dd/mm", e o resultado sem número que veio
depois do último aparece como "depois: …"). A faixa é a do laudo; a da tabela
do app só vale se a unidade do resultado for vazia ou da entrada. **O
`status` e a `reference_range` gravados podem ter vindo da tabela**, pelo
casamento frouxo antigo: o VLDL-colesterol tem "< 190 mg/dL" (do colesterol
total) e a B12 em pmol/L tem "atencao" (julgada pela tabela em pg/mL). Por
isso a referência que é, letra por letra, um texto de faixa da tabela
(`ehTextoDaTabela`) vale como a tabela e não como laudo, e o selo do Último
sai da faixa da linha (`situacao`: tabela, os três níveis da entrada; laudo,
normal ou alterado), nunca do `status` gravado. `parseReferenceRange` lê "<"
e ">" como estritos (o 190 com "< 190" está fora; "≤", "até", "≥" e o
intervalo "a–b" são inclusivos) e devolve nulo para referência em níveis (mais
de uma faixa fora de parênteses, ou palavra de sexo, idade, fase, risco ou
nível): lida pela primeira faixa, a glicada que subiu "entrava na faixa". O
que está entre parênteses é comentário, menos quando o texto TODO é
"(70 a 99)": aí vale o de dentro. A regra do selo é uma função só,
`situacaoParaANutricionista` (`lib/exames.ts`): o laudo antes da tabela, e
unidade e referência que não são texto valem como ausentes. É ela que dá o
`status` gravado num exame novo (`exameParaGravar`, a linha das três
entradas: o laudo lido, o formulário e a Gaia), e **a faixa gravada é a do
laudo**, como veio ou como a pessoa digitou: nunca mais o texto da tabela
por cima. O `classifyExam`, que punha a tabela antes do laudo e julgava o
exame para o paciente, saiu (veja "Uso pretendido").
Para dois nomes serem o mesmo exame, `chaveDoExame`, `faixaDaTabela` e a
`situacaoParaANutricionista` exigem nome igual a uma key da tabela, ou
todas as palavras do nome nas keys de UMA entrada **e** o nome contendo uma
key inteira; palavra de amostra (soro, sérico, plasma, sangue…) e de método
(calculado, Friedewald, ultrassensível, basal, hemograma, transaminase) não
contam contra o nome, mas nunca bastam: sem uma palavra que conte e uma key
inteira, "Basal" ou "Calculado" não são exame. O casamento frouxo antigo
(`findDef`, que saiu) juntou o VLDL-colesterol em "colesterol total" e a
Vitamina K em potássio: juntar à toa inventa uma conclusão clínica, separar à
toa só dá duas linhas. O estrito, por sua vez, perdeu grafias que o laudo
escreve todo dia ("LDL-c", "Colesterol LDL calculado", "PCR-US", "25-Hidroxi
Vitamina D"), e o chat chegou a gravar "normal" para elas (o LDL-c de 180 saía da fila
de triagem): grafia comum nova entra como key da entrada, ou como palavra de
método quando é só o jeito de medir. A palavra que juntaria exame diferente
fica como key, não como neutra: "e frações" é key do colesterol total porque
"Hemoglobina e frações" é a eletroforese. Cada grafia nova leva um teste em
`lib/examRanges.test.ts`, junto dos que separam (VLDL, não-HDL, Vitamina K,
HCM, pós-prandial, capacidade de ligação do ferro, "T4", "Jejum"). Na unidade,
o prefixo micro (u, μ, µ, mc) é um só, UI, IU e U são a mesma, e µUI/mL
equivale a mUI/L (o TSH chega de um jeito ou do outro); mEq/L ≡ mmol/L só no
potássio e no sódio (no cálcio a conta é outra), declarado na entrada. Outra
unidade diz "unidade diferente do anterior" em vez de comparar o número cru.

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
horário avisa e não impede. O paciente vê a consulta no visual do app dele:
na Início, **uma linha no topo** (`components/LinhaDaConsulta.tsx`) que leva a
"Meu plano" (`#consulta`), onde mora o cartão inteiro, com as ações
(`components/CartaoConsulta.tsx`; pedir, remarcar, cancelar). A linha e o
cartão escolhem a situação pela mesma `estadoDaConsulta`: quando a conta
morava dentro do cartão, uma linha refeita à mão podia dizer "nenhuma"
enquanto o cartão mostrava uma consulta cancelada pelo nutri. Ele não recebe
aviso fora do app (sem Web Push).

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

## Visual do app (paciente)

Spec: `docs/superpowers/specs/2026-10-14-visual-do-app-do-paciente-design.md`.
O dono do produto achou o app do paciente "genérico" e "carregado": cor sem
função em 30 arquivos, caixa dentro de caixa, degradê e brilho, duas letras. A
linguagem nova ("calmo e confiável") vale no app inteiro; foram redesenhadas a
Início, a Dieta e a página de entrada (ver "Marca e página de entrada"). **O lado clínico não muda na tela** (página do
paciente e agenda): quem prova é `tirar-prints-nutri.cjs`, e é por isso que
as cópias de `.card`, `.input` e companhia sob `:where(.tema-clinico)` seguem
em `globals.css`.

**A paleta é `lib/temaApp.ts`**, e vale fora de `.tema-clinico`: variáveis
`--app-*` em `:root` e `.dark` (`cssDoTemaApp()`, num `<style>` do layout
raiz) e as classes `bg-app-*`, `text-app-*`, `border-app-*`. O par claro e
escuro está dentro da variável, então a classe **não leva `dark:`**; o
`clin-*`, ao contrário, só existe dentro do tema clínico. Os papéis comuns aos
dois lados são importados de `TEMA_CLINICO`, não copiados: a principal do
paciente é a do nutricionista por construção. Próprios do app: `pagina`,
`cartao` (o `chao` do clínico) e as três cores de macro. Hex só em
`lib/temaApp.ts` (o `tailwind.config.ts` o importa, e o carregador de config
não resolve `@/`: o import é relativo). Cor com função, e só ela: erro em
`app-perigo` e aviso em `app-atencao` (as telas fora da Início e da Dieta ainda
têm rosa e âmbar de erro e de aviso que passam no contraste), nada de violeta,
azul ou degradê. Par novo entra em `PARES_TEXTO_APP` ou `PARES_GRAFICO_APP`,
testado nos dois temas em `lib/temaApp.test.ts`. Os tons claros da barra de
macros não passam 3:1 contra o fundo, de propósito: a legenda ao lado dá nome e
gramas em texto.

**Uma letra só.** Instrument Sans (400 a 700) por `next/font` no layout raiz,
variável `--font-sans`; `font-sans`, `font-display` e `font-clinico` apontam
para ela (`font-display` ficou sem classe que o use quando a landing saiu, mas
segue no seletor dos títulos em `globals.css`). Saíram Inter e Sora. A página
de entrada foi reescrita na linguagem do app em 26/10. O `next/font` renomeia a família
(`__Instrument_Sans_…`): quem confere o `font-family` usa
`/Instrument[ _]Sans/`.

**Cartão de um nível.** `.card` é borda de 1 px `app-linha`, cantos de 14,
sem sombra, sem degradê e sem faixa à esquerda (o `.card-accent` saiu). Dentro
dele, linhas separadas por traço (`divide-y divide-app-linha`), nunca outro
cartão: cada nível soma borda e come largura em 390 px. Botão primário sólido
em `app-primaria` (44 px de altura mínima), secundário `.btn-ghost` (40 px).
Rótulo em frase normal: nada de `uppercase` nem `tracking-wide` no app do
paciente. O `.eyebrow` do lado clínico **segue em caixa alta** (a cópia sob
`:where(.tema-clinico)` em `globals.css`), porque o clínico não muda na tela:
não é para "corrigir". Título de seção sem ícone; o `.icon-badge` fica onde o
ícone diz algo (estado vazio, linha de lista).

**Texto direto no chão é `app-texto` ou `app-texto-2`.** Nunca `text-slate-500`
nem `slate-400` (ver "Armadilhas"): o slate-500 dá 4,76:1 sobre o branco do
cartão, mas **4,43:1 sobre a `pagina` clara**, abaixo de 4,5.

**`.tabular` no dado.** Na Instrument Sans o algarismo é proporcional (o "1"
ocupa 391 unidades e o "0", 666), então o número que muda "dança" e a coluna
não alinha. A classe `.tabular` vai no número que é dado (centro dos anéis,
peso e a variação dele, o número do "score 72", kcal e gramas), **não** no
número dentro de frase ("1 refeição ainda falta"), onde o "1" tabular abre um
buraco. Casas e vírgula saem de `lib/numeros.ts`, nunca do número cru: a página
Medidas mostrou "Quadril: 99.89999999999999cm", e a água de Hábitos e de Meu
plano, "1.2 / 2.5 L". A água é `numeroBR(ml / 1000, 2)` em toda parte (o passo
de um copo é 0,25 L), "kg" e "cm" levam espaço e o "%" vem colado ("30,0%",
`comUnidade`, que com `fixas` escreve o zero: "66,0 kg").

**Variação sem cor.** O app não sabe a direção boa do peso (não guarda o
objetivo; ver "Meta ou limite"): a variação vai em `texto-2`, com o sinal no
número e sem seta colorida, na Início, no `StatCard` e em Medidas, onde o ganho
era `app-perigo` com seta para cima e a perda, verde. `comSinal` escreve "0"
quando o número arredonda a zero ("+0" diria que subiu). O Tratamento ainda
pinta (ver "Em aberto").

**Meta ou limite.** Proteína e água são sempre meta: passar delas fecha o anel
sem aviso. As calorias são *limite* quando a meta de peso está abaixo do peso
atual (passar dá "acima do limite", em `app-atencao`), *meta* quando está
acima, e neutras sem meta de peso ou na manutenção (±0,5 kg):
`papelDasCalorias`. O app não guarda o objetivo do paciente, então a meta de
peso é o que diz a direção; avisar sempre nas calorias dava um aviso laranja
a quem quer ganhar massa e comeu o que devia. O peso atual da Dieta vem de
`pesoMaisRecente` (o do dia mais recente com peso, até hoje). A Início usa o
`atual` de `pesoDe30Dias` quando há peso nos 30 dias e `pesoMaisRecente` só
fora dessa janela; os dois passam por `pesoDoDia` (no dia com duas medidas, a
da consulta vence a de casa), então concordam. Cada conta tem de ter uma
função só: a Início chegou a ter a sua à mão, e duas cópias acabam
discordando, como nas janelas de N dias.

**Água.** `adicionarAgua` (`lib/agua.ts`) lê o total do dia e grava só
`water_ml`; é a gravação do assistente (`registrar_agua`) e do "+250 ml" da
Início, com "Desfazer". Com a leitura do total falhando ela **não grava**: o
`registrar_agua` antigo tratava o total como 0 e escrevia só os `ml` por cima
do dia. **Hábitos não a usa**: `addWater`, em `app/app/habitos/page.tsx`, grava
pelo `persist` próprio (ver "Em aberto"), e a água tem duas contas até alguém
trocá-lo.

**O Score se explica.** Tocar em "score 72 · bom" abre os quatro pilares
(`ScoreExplicado`), e o pilar sem registro diz "sem registro hoje · conta N":
o sono sem horas conta 60, a nutrição sem refeição conta 40 e a hidratação
sem água, humor nem energia, 24. `computeHealthScore` devolve `semRegistro` por
pilar e `topPilar` (o mais fraco), e a Início decide a dica por ele, não
comparando texto: com a sugestão de proteína na tela e a Nutrição como pilar
mais fraco, as duas diriam "faltam N g", e a dica sai.

**A sugestão é só do plano.** `sugestaoDeProteina` (`lib/cardapio.ts`) diz
quanto falta de proteína e qual refeição **do cardápio do nutricionista** cobre
parte disso. Sem plano, sem meta de proteína ou com o vínculo revogado, não há
sugestão: o app sugerir comida por conta própria seria prescrever. Não há
sugestão de calorias ("faltam 600 kcal" empurra quem emagrece a comer sem
fome; o excesso já aparece no anel). Opção de 0 g não conta: o nutricionista
lança 0 para fruta, e "lanche da tarde, 0 g (1 maçã)" para fechar 40 g seria
absurdo. Na Dieta, só com a data em hoje.

**A Gaia, no celular, fica encaixada na barra de baixo.** O balão
(`ChatWidget`, 44×44 px) afunda 10 px na borda de cima da barra do `AppShell`,
à direita, e não flutua mais sobre o conteúdo: a 80 px do fundo e com 56 px ele
cortava o "Registrar" da Início ("Regis") e cobria o "ver em Meu plano" da
Dieta, e um toque ali abria a Gaia em vez da ação (decisão do dono do produto,
17/10). Os 10 px saem da folga de cima dos ícones (o ícone do "Mais" começa a
11 px da borda: 1 de borda e 10 de folga), então o "Mais" e o "Hábitos" mantêm
44×44 sem balão por cima, e o topo do balão ficava abaixo do pé do "Registrar"
em 390×844 no dia em que foi medido (17/10); em outro dia, com mais coisa antes
dele, o balão tapa o canto (ver "Em aberto"). **A barra tem altura fixa**: `--barra-h` (61,5 px, em
`globals.css`) mais `env(safe-area-inset-bottom)`, e o balão e o painel aberto
leem a mesma variável, porque o CSS não lê a altura de outro elemento e uma
barra que cresce com o conteúdo desencaixaria o balão. Por isso o rótulo da
barra não quebra linha (`whitespace-nowrap`: em 320 px o "Meu plano" quebrava, e
com a altura fixa a segunda linha caía para fora da tela). Mexeu no padding, no
ícone ou no rótulo da barra? Mude `--barra-h` (o `sticky bottom-[61px]` do
`EditorRegistro` também conta com ela) e rode `conferir-inicio`, que mede o
encaixe, o `elementFromPoint` no "Mais" e o caso de 34 px de safe area. O `env`
vale 0 hoje, porque o `viewport` do layout raiz não pede `viewport-fit: cover`.
Quem ligar o `cover` confira o "Registrar" de novo: com 34 px de safe area o
balão sobe com a barra e volta a cobri-lo em 390×844, e o `conferir-inicio` só
mede o "Registrar" sem safe area.
No computador (`lg`) o balão é o de sempre, 56 px em `bottom-6 right-6`. Só o
paciente tem a Gaia (`!isNutri`); a barra do nutricionista só ganhou a altura
fixa.

**A consulta é uma linha** (`LinhaDaConsulta`, a situação por
`estadoDaConsulta`; veja "Consultas e agenda"), e o cartão com as ações mora
em "Meu plano".

**Leitura que falha, aqui também.** Nas telas novas, o erro do supabase-js vira
mensagem e nunca estado vazio: o "Para hoje" diz "Não deu para carregar tudo."
e não "em dia", e sem o "N pendentes" (a contagem seria só do que chegou); o
"Seu dia" diz "Não deu para carregar os números de hoje." em vez de anéis e
Score com 0; o Progresso diz "Não deu para carregar o peso."; a linha da
consulta e o cartão de Meu plano, "Não deu para carregar a consulta.", em
`app-atencao`; e o plano, na Dieta e em Meu plano, não oferece "Comi isso"
(convidaria a registrar de novo o que talvez já esteja registrado) e diz que
não carregou as refeições do dia. Toda frase "Não deu para …" termina com
ponto. O que ficou de fora está em "Em aberto".

**O check-in tem uma regra só.** `BotoesDoCheckIn`, em
`components/PlanCheckIn.tsx`, desenha os botões nas três telas: a Início (o
`PlanCheckIn` em `linha`, uma linha do "Para hoje"), a leitura do treino em
`treino/[id]` (`compact`, só os botões) e a semana de Treinos (só os
`BotoesDoCheckIn`). Sem resposta, "Fui" sólido e "Não fui" secundário; feito,
"Feito" com o check no fundo `primaria-fundo`; não fui, "Fui" secundário e
"Não fui" no aviso (`app-atencao`). Todos com 44 px. Antes eram três regras:
o mesmo "Fui" sólido queria dizer "sem resposta" na Início e "respondido" em
Treinos, e o "Não fui" marcado era âmbar num lado e rosa sólido no outro.
Nenhuma classe de botão do check-in fica fora desse arquivo. Prescrito é
`prescribed_by` **com vínculo ativo** (`montarParaHoje`; Treinos e a leitura
do treino leem `patient_links`, e com essa leitura falhando vale o
`prescribed_by`): só ele tem "Não fui"; o treino próprio tem só "Fiz", em toda
parte, menos quando um "não fui" já está gravado nele (de quando Treinos
oferecia "Não fui" a todo treino, ou de antes de o paciente revogar o vínculo):
aí o "Não fui" aparece marcado, para poder ser desfeito. Sem ele, a resposta
gravada virava um "Fiz" secundário sem nada dizendo que ele não foi. A forma
da Início mora numa prop própria, e o `compact` mantém a estrutura:
redesenhá-lo lá punha um `<li>` fora de lista e repetia o nome e a nota. O
lado clínico não o usa. Em Treinos, "Iniciar treino" (o primário da
sessão, na largura toda) vem acima do check-in, e no dia sem resposta os dois
são sólidos (ver "Em aberto"). O check-in que não grava diz "Não foi possível
salvar. Tente de novo." (`ERRO_DO_CHECKIN`) embaixo dos botões, nas três telas:
em Treinos o retorno do `setPlanCheck` era ignorado, e a resposta sumia sem
mensagem. E o "Fui" que falha apaga o treino que tinha acabado de criar.

**O treino ao vivo** (`gravarTreinoAoVivo`, `lib/treinoAoVivo.ts`) fica com a
data de hoje, que é quando foi feito, e o "Feito" vai no dia da sessão do plano
de onde ele saiu, como o "Fui" tocado depois. Os dois iam em hoje: quem iniciava
no sábado o treino de segunda gravava o "Feito" com o id da sessão de segunda e a
data de sábado, e nenhum dia da semana o mostrava. Dia que ainda não chegou não
recebe "Feito" (o treino adiantado fica só no Histórico); um "não fui" no dia
vira "feito"; um "Fui" já respondido fica como está. Se o treino não grava, a
sessão **fica aberta**, com as séries e "Não deu para salvar o treino. Tente de
novo.": antes ela fechava e o treino sumia calado. Se as séries falham, o treino
é apagado, para o novo "Finalizar" não o duplicar. Se só o check-in falha, o
treino fica e o topo de Treinos avisa. **Desfazer o "Feito" não apaga o treino
ao vivo**: o `setPlanCheck` só apaga os treinos que uma resposta cria
(`NOTA_DO_FUI` e `NOTA_DA_GAIA`, pelas notas); antes, tocar no "Feito" de uma
sessão ao vivo apagava o treino com todas as séries.

**As outras gravações de Treinos** seguem a mesma regra: ou grava tudo, ou
desfaz o que gravou e avisa, e o formulário fica aberto com o que foi digitado.
O "Novo treino" e o treino ao vivo gravam por `gravarTreino` (`lib/treinos.ts`),
que apaga o treino quando as séries falham; antes o "Novo treino" fechava o
formulário e limpava o que foi digitado mesmo sem gravar. Editar uma rotina
(`salvarRotina`) grava os exercícios novos **antes** de apagar os antigos e
muda o nome por último: apagava primeiro, e um insert que falhasse deixava a
rotina vazia. Excluir um treino, uma rotina ou uma sessão do plano só tira da
tela depois de excluir, e o aviso vai embaixo do item tocado (`AvisoDoItem`),
não no topo, que pode estar fora da tela. Quem prova é o `conferir-treinos.cjs`,
com cada escrita derrubada.

**As leituras de Treinos** são uma só, `lerTreinos` (`lib/treinosDb.ts`), que
devolve `falhou` por área (plano, respostas, rotinas, histórico) e a área que
falhou vazia. Eram `data ?? []`: o plano que não carregava dizia "Nada
planejado." na semana toda, e as respostas que não carregavam punham o "Fui"
sólido em dia já respondido. Agora cada aba diz "Não deu para carregar …" com
"Tentar de novo" (`FalhaDeLeitura`); sem as respostas, a semana aparece sem os
botões do check-in e sem o "Confirmados na semana"; sem as rotinas, a Semana
avisa (o "Iniciar treino" depende delas); sem o histórico, o Histórico e a
Progressão avisam e o "Repetir último" sai. O histórico (treinos e séries) lê
em páginas, por `lerEmPaginas`: sem elas, o PostgREST cortava em 1.000 linhas
sem erro, e as séries eram pedidas com a lista de todos os treinos no endereço.
As rotinas passaram a trazer o `prescribed_by`, e o selo "do nutri" das rotinas,
que nunca aparecia, aparece.

## Senha

Senha **nova** (criar conta e redefinir) tem pelo menos 8 caracteres, com uma
letra ASCII (a–z, A–Z) e um número: `lib/senha.ts`, com `minLength` 8 e a
ajuda sob o campo. **A mesma regra está ligada no Supabase Auth** (Email:
mínimo 8, "Letters and digits"): mude uma, mude a outra, senão o servidor
recusa em inglês, depois do envio, o que o app aceitou (`weak_password`, que
`ehErroDeSenhaFraca` reconhece e as duas telas traduzem). A letra é ASCII
porque o "Letters and digits" confere ASCII: com `\p{L}`, "ãéíõ1234" passava no
app e o servidor a recusava. **O "Entrar" não usa a regra** (`minLength` 6):
quem tem senha antiga de 6 ou 7 caracteres precisa continuar entrando, e o
caminho dela é o "Esqueci a senha", que já pede a regra nova. Que o Supabase siga
deixando entrar essas contas com a regra ligada não foi conferido contra o
servidor de verdade. A proteção contra senhas vazadas é só do plano Pro e está
desligada (ver "Em aberto").

## Marca e página de entrada

Spec: `docs/superpowers/specs/2026-10-26-marca-e-pagina-da-nutricionista-design.md`.
O nome definitivo ainda não existe, e o atual vai mudar: ele mora em
`lib/marca.ts` (`NOME`, com `SLOGAN`, `TITULO` e `DESCRICAO`), e a guarda de
`lib/marca.test.ts` acusa o nome escrito em qualquer outro arquivo de `app/`,
`components/` ou `lib/` (chegou a estar em 23). À mão ficam só o
`public/sw.js` (o comentário e o título padrão do push; o arquivo é estático e
não lê código) e os títulos de página que o `tirar-prints-nutri.cjs` confere:
trocou o `NOME`, troque os dois. O manifesto é `app/manifest.ts`, servido em
`/manifest.webmanifest`.

**O ícone é a lista com um marcado** (era um haltere, que dizia academia e
reforçava "treino é do personal"). A geometria é `FORMAS_DA_MARCA`, em
`lib/appIcon.ts`, com as cores do `TEMA_APP`: dela saem os PNG e o
`MarcaIcone`, o símbolo das telas (entrar, redefinir senha, menu, Onboarding).
O `public/icon.svg` é cópia, conferida por teste. O haltere ficou só em
Treinos.

**A página `/` é da nutricionista**, estática e sem banco (a de consumidor e a
`/recursos` saíram; `/recursos` responde 308 para `/`, e é dinâmica de
propósito: estática, o build guardava o 308 sem o `Location`, e o dev não mostra
isso). Os textos da
demonstração da fila saem das funções da fila (`textoDesvios` e companhia, em
`lib/nutri.ts`), para a página nunca mostrar um alerta que a fila não
escreve. Não tem preço, depoimento, número de usuários, "atende ao CFN" nem
promessa de resultado. O botão "Quero uma vaga de implantação" abre o WhatsApp
do fundador pelo `NEXT_PUBLIC_WHATSAPP_VAGAS`, configurado na Vercel:
- aceita 10 ou 11 dígitos (DDD e número) ou 12 ou 13 começando com 55, escritos
  de qualquer jeito (`linkDaVaga`);
- qualquer outra coisa (o 0 de tronco, "011 9…", por exemplo) dá "As vagas de
  implantação abrem em breve.", **sem erro em lugar nenhum**: depois de mudar a
  variável, olhe o botão na página publicada;
- é `NEXT_PUBLIC_`, então entra no código no build: trocar o número pede um
  deploy novo;
- o número fica visível no link, para quem abrir: não é segredo.

O convite do paciente (`textoDoConvite`, em `PacientesClient`) diz o que ele
vai fazer e que o app é de graça.

## Uso pretendido

Spec: `docs/superpowers/specs/2026-10-27-uso-pretendido-da-ia-design.md`. A
RDC 657/2022 separa o software de bem-estar do software de diagnóstico ou
tratamento pelo que ele **faz**, não pelo aviso que o acompanha. Por isso,
**para o paciente, o app constata e explica; não julga exame nem orienta
tratamento.** O juízo clínico é da nutricionista, e a tela dela não muda
(o comparativo calcula igual). Num exame **novo**, duas coisas que ela vê
mudam, como a spec decidiu: o `status` gravado segue o laudo antes da tabela
(uma vitamina D de 25 com laudo "20 a 100" já não entra na fila, onde a
tabela a punha), e o exame sem faixa nenhuma vai sem selo no "Ver todos os
resultados", em vez de "Normal".

- **Pode:** mostrar o valor, a unidade, a data e a faixa impressa no laudo;
  dizer dentro, acima ou abaixo da faixa do laudo; explicar em termos gerais
  o que o exame mede; dizer que quem interpreta é a nutricionista (ou o
  médico que pediu) e oferecer mandar a pergunta a ela.
- **Não pode:** dizer o que o resultado indica (causa, doença, risco, "pode
  ser"); chamar de bom, ruim, normal, alterado ou preocupante; sugerir
  conduta (comida, suplemento, remédio, exame novo); orientar sobre o
  tratamento com remédio (a caneta GLP-1 inclusive).

Duas regras, uma para cada lado: `situacaoNoLaudo` (só o laudo, nunca a
tabela do app) e a linha dela, `linhaDoLaudo`, para o paciente, na página
Exames, na leitura do laudo, no formulário e na Gaia; e
`situacaoParaANutricionista` (laudo, depois a tabela) para o comparativo, a
fila e o `status` gravado. A leitura do laudo (`analyze-exam`) só transcreve
nome, valor, unidade e faixa (`transcricaoDoLaudo`). O "O que é?"
(`app/api/explicar-exame`, `components/OQueEOExame.tsx`) **só manda à IA o
nome do exame**, entre aspas e como dado, e a resposta passa pela checagem
de palavras (`explicacaoAceitavel`, que recusa também doença, hipótese e
qualquer faixa numérica: "o ideal é abaixo de 100 mg/dL" embaixo do valor do
paciente seria a tabela voltando por outra porta): a explicação das telas não
tem como falar do resultado. A linha do paciente só afirma o que dá para
afirmar: título ("1/40"), milhar escrito de um lado só ("4500" contra "4.000
a 11.000") e valor com operador que pode cair dos dois lados ("< 20" contra
"10 a 50") ficam "sem faixa do laudo". A Gaia não tem ferramenta que julgue (o `avaliar_exame`
virou `ler_exame`, que constata pelo laudo, calculado no código, e com a
leitura cheia não diz que o exame não existe), não recebe
os exames no contexto e não orienta quem usa a caneta. Os insights da Saúde
e os Relatórios não leem exames nem tratamento, e o histórico guardado
deles não mostra mais os cartões de "Exames" e "Tratamento"
(`semExameNemTratamento`). Os textos de tela também não prometem mais
"ajustar as faixas de referência dos seus exames": sexo e idade servem às
metas e à nutricionista.

**IA nova segue a regra.** A guarda `lib/usoPretendido.test.ts` acusa nas
rotas de `app/api/` e em `lib/aiActions.ts` os textos que eram as portas do
juízo ("avaliar_exame", "interpretacao", "recomendacoes", "ORIENTE de
acordo"); a regra em si é maior que a guarda.

## Comandos

```bash
npm run dev      # desenvolvimento
npm test         # 1195 testes unitários (vitest)
ferramentas/testar-sql.sh   # migrações e testes SQL num Postgres local
npm run build    # produção
```

Testes visuais e de tela: veja `ferramentas/LEIAME.md`. Eles sobem um
Supabase falso e dirigem o Chromium — é a única forma de ver as telas
logadas num ambiente sem acesso ao banco. Para a página do paciente do
nutricionista, o mock com `CENARIO=carteira` e
`ferramentas/tirar-prints-nutri.cjs`. Para o app do paciente, o mock sem
cenário e `tirar-prints.cjs`, `conferir-inicio.cjs`, `conferir-dieta.cjs`,
`conferir-consulta-paciente.cjs` e `conferir-treinos.cjs`. Para a página de
entrada e a tela de entrar, `conferir-entrada.cjs`, sem login nem cenário.
Esses processos se param e se esperam pelo PID, nunca por `pkill -f` nem
`until ! pgrep -f` (o laço casa consigo mesmo e não termina): veja o LEIAME.

**Skills de negócio** (`.claude/skills/founder-*`, `/founder-board`, `/founder-cfo`
e mais nove): o pacote Founder, de terceiros (MIT, origem e commit em
`.claude/skills/LICENSE-founder-skill`), copiado sem mudança, para testar ideias
de negócio. Não faz parte do app: grava numa pasta `founder/` na raiz, e os
quatro scripts são Python da biblioteca padrão, sem rede. Para atualizar,
copie de novo as pastas `skills/founder-*` do repositório de origem.

## Armadilhas que já custaram caro

Cada uma destas quebrou em produção, ou só não quebrou porque a conferência
de tela pegou antes. Estão listadas porque voltam.

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

**`text-slate-500` direto sobre a página.** O slate-500 dá 4,76:1 sobre o branco
do cartão, e por isso parecia seguro, mas sobre o fundo `app-pagina` claro
(#f6f7f6) dá **4,43:1**, abaixo dos 4,5 do WCAG. Texto no chão usa
`text-app-texto-2` (7,04:1 no claro); o `slate-400` já reprovava (2,56:1 sobre
branco). O contraste de cada par do app está em `lib/temaApp.test.ts`.

**`animation-fill-mode: both` numa animação de entrada** (`.pf-in`). O fim da
animação (`transform: none`) ficava aplicado como uma matriz identidade, e um
elemento com `transform` vira o bloco de contenção dos filhos `position:
fixed`: todo `Modal` dentro de uma página se posicionava em relação a ela, não
à janela (358×1256 em vez de 390×844 numa tela de 390 px; em Medidas a folha
caía 1.100 px abaixo da dobra). Use `backwards`, que só segura o estado inicial
durante o atraso: o estado final dos quadros-chave já é o natural. Vale também
para `.pf-modal`, `.pf-stagger`, `.pf-backdrop`, `.pf-panel`, `.pf-sheet` e
`.pf-drawer` (a gaveta "Mais" do `AppShell`): nenhuma entrada usa `both`.
Modal fora do lugar: procure um `transform` num ancestral.

## Convenções

- Comentário explica **por quê**, não o quê — de preferência citando o bug
  que motivou o código. Veja `lib/date.ts` e `lib/perfil.ts`.
- Cor sempre em par claro/escuro: **não existe um tom da marca que sirva
  aos dois temas** (no claro só `brand-700+` passa em contraste; no escuro
  só `brand-600` para trás). No app do paciente o par já está dentro das
  variáveis `app-*` (ver "Visual do app"), sem `dark:`; o par `brand-*` com
  `dark:` sobra na `/estilo` e em poucos
  componentes: os editores clínicos (`MealPlanEditor`, `TemplateBar`,
  `clinico/EditorTreino` e `clinico/Conversa`) e o `FoodSearch` (que a Dieta do
  paciente também usa). A rota `/estilo`, só em desenvolvimento, mostra a escala
  com a razão de contraste calculada.
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
- Sem Web Push (falta VAPID) e sem cobrança.
- Conta de teste (`Maria Souza (teste)`) e a rota `/estilo` precisam sair
  antes de usuários reais.
- **Sem proteção contra senhas vazadas.** É só do plano Pro do Supabase e está
  desligada; vale a regra de 8 caracteres com letras e números (ver "Senha").
  Liga-se quando o plano subir.
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
- **Exames gravados antes guardam o julgamento antigo.** As linhas gravadas
  antes do `exameParaGravar` guardam o `status` e a `reference_range` do
  casamento frouxo e do `classifyExam` (a Vitamina K pode seguir "alterado"
  pela faixa do potássio) e, nas notas, a explicação automática. O paciente
  já não vê nada disso (a página Exames não lê o `status`, calcula a linha
  pelo laudo e passa as notas por `notasDoExame`), mas a nutricionista vê: a
  lista "Ver todos os resultados" e a fila contam o `status` gravado, e por
  isso o selo do comparativo pode discordar da lista na mesma tela. Nos
  exames antigos, paciente e nutricionista podem ver juízos diferentes.
  Recalcular pede migração. A IA não sobrescreve mais a faixa do laudo, mas o
  `ehTextoDaTabela` continua necessário pelas linhas antigas: e por ele um
  laudo real escrito, letra por letra, como o texto da tabela ("< 150 mg/dL",
  com a unidade) aparece ao paciente como "sem faixa do laudo". A data
  `today` que a IA grava quando não acha a do laudo (dois laudos no mesmo
  dia) também segue em aberto.
- **O texto livre do histórico da Saúde e dos Relatórios mostra o que foi
  gerado antes.** Os cartões de "Exames" e "Tratamento" já não aparecem, mas
  o resumo, as prioridades e os passos das análises guardadas de antes do uso
  pretendido (`health_insights`, `reports`) podem falar do exame alterado, e
  seguem aparecendo até o paciente apagar ou gerar outra. Esconder por data é
  decisão do dono do produto.
- **A dica de alimentação e os treinos da Gaia** (porções, substituições, o
  treino que ela monta sem prescrição) ficaram como estavam: pedem uma spec
  própria, que olhe também a atribuição privativa do nutricionista.
- **A Gaia ainda pode escrever uma interpretação em texto livre.** O prompt
  orienta e o código garante o resto (não há ferramenta que julgue, a
  constatação vem calculada e os exames não estão no contexto), mas ao ler um
  exame pelo `ler_exame` ela vê o valor. A checagem de palavras do "O que é?"
  também não pega tudo ("LDL alto entope as artérias" passa): é uma rede, e a
  lista cresce com os casos.
- **O "O que é?" não guarda as explicações** e não tem limite por usuário:
  cada toque é uma chamada à Groq (guardar pediria tabela e migração). Entra
  na revisão de custo de sexta (`founder/ops.md`, 4.6).
- **O parecer formal sobre a ANVISA** (RDC 657/2022) e o texto de uso
  pretendido nos termos de uso (o apêndice da spec, para o advogado) seguem
  por fazer.
- **O `persist` de Hábitos (`app/app/habitos/page.tsx`) regrava a linha inteira
  do dia a partir do estado da tela e não confere o `error`.** O que mudou fora
  da tela (o assistente ou o "+250 ml" da Início registrando água) pode voltar
  ao valor velho, e uma gravação que falha parece salva. A água de Hábitos
  (`addWater`) grava por ele, e não por `adicionarAgua`: soma ao estado da tela,
  não ao total do banco, e com a gravação falhando não diz nada.
- **O `save` e o `remove` da Dieta ignoram o erro de gravação.** Uma exclusão
  que falha não avisa (a refeição só continua na lista), e um registro que
  falha fecha o formulário como se tivesse salvo.
- **As outras telas do paciente ainda leem no navegador com `data ?? []`**
  (Medidas, Exames, Tratamento, Relatórios, Saúde e o histórico de Hábitos): leitura que falha vira "não tem", a regra que a Início e a Dieta
  (e as refeições e a consulta de Meu plano) já seguem. O resto de Meu plano
  (`nutricionista/page.tsx`: prescrição, plano, itens do cardápio, sessões,
  notas e rotinas) também ignora o `error`.
- **Se a leitura do papel falha, um nutricionista cai no painel do paciente.**
  É o `roleRow` do começo de `DashboardPage`, em `app/app/page.tsx`: vem nulo e
  a página segue como se fosse paciente; falta conferir o `error` e mostrar a
  falha.
- **O "comi" do plano casa por descrição.** `MealPlanView` marca a opção como
  "comi" quando há uma refeição do mesmo tipo com o mesmo texto; se a descrição
  é editada, ou o nutricionista troca a opção, a marca some e o "Comi isso"
  volta (nunca aparece "comi" sem ter comido). Só fica robusto com um
  `meal_plan_item_id` em `meals`, que pede migração.
- **Em Treinos, "Iniciar treino" e o "Fui" sólido ficam um sobre o outro** na
  sessão com rotina, em todo dia que já chegou e ainda sem resposta (no
  celular e nas três colunas do computador). A regra do check-in vale igual
  nas três telas, e "Iniciar treino" segue o primário da sessão; a ordem
  (iniciar em cima, check-in embaixo) é porque terminar o treino ao vivo já
  marca "Feito", e o check-in é de quem treinou sem o cronômetro. Os dois
  sólidos juntos pedem decisão do dono do produto.
- **Treinos lê o histórico inteiro a cada vez** (todos os treinos e todas as
  séries, em páginas de 1.000), para o Histórico, a Progressão e as sugestões da
  sessão ao vivo. Passando de 5.000 treinos ou 30.000 séries (`TETO_DE_TREINOS`,
  `TETO_DE_SERIES`), o Histórico diz que não carregou, para sempre. Falta ler
  só o recente e paginar a lista.
- **O Tratamento ainda pinta a variação de peso** (perda verde, ganho em
  `app-perigo`), ao contrário da Início, do `StatCard` e de Medidas.
- **"do nutri" em Treinos e "Prescrito por" na leitura do treino vêm só de
  `prescribed_by`.** Depois que o paciente revoga, a sessão segue com o selo,
  mas os botões já são os do treino próprio ("Fiz").
- **O balão da Gaia ainda cobre o que rola por baixo dele**, 34 px acima da
  barra na margem da direita (some ao descer e volta ao subir). O que fica sob
  ele na primeira tela depende do que vem antes, e isso muda com o dia: no
  sábado (17/10) o "Registrar" da Início ficava livre em 390×844; na quinta
  (22/10), com o "Treino A — Superiores" no "Para hoje", o balão tapa o canto
  direito dele, e o `conferir-inicio` acusa. O "Remover" de Treinos e um campo
  do Perfil também ficam sob ele (já ficavam), e a 320×800 ele encosta no "Fiz"
  da Início.
- **A barra de baixo não cresce com o texto ampliado.** A altura é fixa em px
  (`--barra-h`, o que mantém a Gaia encaixada), e com o tamanho de texto da
  acessibilidade do Chrome no Android perto de 180% o rótulo de 11 px é cortado
  na borda de baixo. Antes a barra crescia com ele.
- **Com a leitura do vínculo falhando, a mesma sessão do nutri tem dois
  check-ins**: "Fiz" na Início (`montarParaHoje` a trata como sem vínculo) e
  "Fui/Não fui" em Treinos e na leitura do treino (que caem no
  `prescribed_by`). A Início avisa "Não deu para carregar tudo." nesse caso.
- **A Início perde o "limite" ou "meta" do anel de Calorias quando a leitura
  do peso falha.** Os números do anel estão certos e o Progresso diz "Não deu
  para carregar o peso"; aceito, porque a falha já aparece ali.
