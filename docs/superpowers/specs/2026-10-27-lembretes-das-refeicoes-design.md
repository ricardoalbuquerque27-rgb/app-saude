# Lembretes das refeições: a notificação que pergunta "comeu?"

Data: 27/10/2026. Desenho aprovado pelo dono do produto em conversa, em quatro
partes. **Fica montado e desligado**: ligar é um passo à parte (seção "Para
ligar"), com a migração, as chaves de push e o agendamento.

Exemplo de como chega: `2026-10-27-lembretes-das-refeicoes/exemplo-notificacoes.png`.

## Por quê

- **"O paciente não registra" é a recusa número um** nos dois painéis de
  compradores (`founder/panel-oferta/`, `founder/panel-uso/`): "já pedi diário
  alimentar e vi largar em duas semanas". Um toque na notificação é o registro
  mais barato que dá para pedir.
- **A nutricionista compra a fila.** "Pulou 3 refeições do plano" é o tipo de
  coisa que hoje ela só descobre no WhatsApp.
- **Metade já existe**, desligada: o envio de push (`lib/webpush.ts`), a
  inscrição (`lib/pushClient.ts`), o ajuste do lembrete diário
  (`components/PwaSettings.tsx`), a rota `/api/cron/reminders` e o agendamento
  `pacefit-reminders` no Supabase (pg_cron, a cada 15 minutos). Falta a chave
  privada de push e o segredo do agendador na Vercel, e a chave pública
  embutida no código não tem a privada correspondente em lugar nenhum.

## Decisões do dono do produto (27/10)

| decisão | escolha |
| --- | --- |
| o que a notificação mostra | o que o cardápio tem na refeição, com "Comi" e "Não comi", e o toque abre o app para editar o que comeu |
| refeição com mais de uma opção | o "Comi" grava só que comeu, e o app pergunta "Qual opção?" depois; com uma opção só, grava a refeição com as calorias |
| horários | o paciente, com horários sugeridos e editáveis |
| o lado da nutricionista | um alerta na fila e a semana por refeição na aba Alimentação |
| quem dispara | o agendador do Supabase (pg_cron), que já existe |

## O que o paciente vê

### A notificação

- **Quem recebe:** o paciente com os lembretes das refeições ligados, vínculo
  ativo com a nutricionista e cardápio ativo dela. Sem cardápio, não há
  lembrete (o app não lembra de comida que a nutricionista não prescreveu,
  como na sugestão de proteína).
- **Quais refeições:** só as que existem no cardápio dele (`MEAL_TYPES`, de
  `lib/cardapio.ts`).
- **Quando:** no horário de cada refeição, na hora de São Paulo, até 15
  minutos depois (o agendamento roda de 15 em 15).
- **Quando não chega:**
  - ele já respondeu essa refeição no dia;
  - já registrou uma refeição desse tipo no dia;
  - já foi enviada hoje;
  - o horário passou há mais de 1 hora (uma rodada perdida do agendador não
    manda o café às 15h).
- **O texto:**
  - título: a refeição ("Almoço");
  - corpo: a descrição da primeira opção do cardápio, cortada em 110
    caracteres numa palavra inteira, com "…"; com mais opções, " · ou mais 1
    opção" ou " · ou mais N opções";
  - o nome do app aparece em cima, pelo próprio celular.
- **Os botões:** "Comi" e "Não comi". O Android mostra os dois; o iPhone não
  mostra botão em notificação de app web.
- **O toque no texto** abre a Dieta no dia e na refeição
  (`/app/dieta?data=AAAA-MM-DD#refeicao-<nome>`, com o nome em minúsculas,
  sem acento e com hífen: `refeicao-cafe-da-manha`), para ver o cardápio e
  editar o que comeu. O nome, e não a posição em `MEAL_TYPES`, porque o
  cardápio pode ter um tipo fora da lista (a `lib/cardapio.ts` já o trata).
- **Uma notificação por refeição e por dia:** a `tag`
  `refeicao-<data>-<nome>` faz a do mesmo dia substituir a anterior.

### O que os botões gravam

- **"Comi", com uma opção só no cardápio:** grava a refeição em `meals`, com a
  descrição e as calorias da opção, como o "Comi isso" de hoje, e a resposta
  "comi" ligada a ela.
- **"Comi", com mais de uma opção:** grava só a resposta "comi", sem refeição.
  No app, essa refeição mostra "Qual opção?".
- **"Não comi":** grava a resposta "não comi".
- **Tudo ou nada:** se a refeição não grava, a resposta também não fica.
- **Trocar de resposta ou desfazer:** se a resposta tinha uma refeição ligada,
  ela é apagada junto. Nenhuma outra refeição do dia é tocada. É a regra do
  "Fui" do treino (`setPlanCheck`).
- **Se a marcação pela notificação falha** (sem internet, sessão vencida,
  gravação recusada): o celular mostra outra notificação, "Não deu para marcar
  sua resposta (Almoço). Toque para abrir o app.", que abre a refeição. A
  resposta nunca some calada.
- **Data aceita:** de hoje até 6 dias atrás, na hora de São Paulo. Fora disso a
  rota recusa com "Essa refeição é de mais de 7 dias." (uma notificação velha
  tocada uma semana depois não grava num dia que ele já não lembra).

### No app

- **Dieta e Meu plano** (o `MealPlanView`): cada refeição do plano ganha a
  resposta, numa regra só, como o `BotoesDoCheckIn` do treino:
  - **sem resposta, uma opção:** "Comi" sólido e "Não comi" secundário;
  - **sem resposta, mais de uma opção:** o "Comi isso" de cada opção (como
    hoje) e "Não comi" na refeição;
  - **"comi" com a opção:** a opção diz "comi", com "Desfazer";
  - **"comi" sem a opção** (veio da notificação): "Qual opção?", e cada opção
    ganha "Foi esta", que grava a refeição dela e a liga à resposta; embaixo,
    "Desfazer" (para trocar por "Não comi", desfaz e responde de novo);
  - **"não comi":** "Não comi" marcado, em `app-atencao`, e "Comi" secundário
    para trocar;
  - todos os botões com 44 px;
  - o "Comi isso" também grava a resposta "comi" ligada à refeição. O "comi"
    da opção passa a vir da resposta, e não mais da descrição igual (o item
    "O 'comi' do plano casa por descrição" do "Em aberto" fica resolvido para
    o que vier daqui).
  - Com a leitura das respostas falhando, a refeição não mostra botão (como o
    "Comi isso" com as refeições do dia falhando) e diz "Não deu para carregar
    as respostas das refeições.".
  - A gravação que falha diz "Não foi possível salvar. Tente de novo." embaixo
    dos botões, como o check-in do treino.
- **A Dieta aceita `?data=`** (até hoje) e rola até `#refeicao-<nome>`.
- **A Início:** a linha "N refeições ainda faltam" do "Para hoje"
  (`montarParaHoje`, `refeicoesFaltando`) passa a contar só as refeições do
  cardápio sem registro **e** sem resposta. "Não comi" também é resposta.

### Os horários, no Perfil

- **Um bloco novo, "Lembretes das refeições"** (`components/LembretesDasRefeicoes.tsx`),
  embaixo do `PwaSettings`:
  - uma chave para ligar e desligar;
  - um horário para cada refeição do cardápio dele, já preenchido com o
    sugerido, e editável;
  - "Voltar ao sugerido" em cada horário mudado.
- **Os sugeridos** (`HORARIOS_SUGERIDOS`, em `lib/lembretesDasRefeicoes.ts`):
  Café da manhã 08:00, Lanche da manhã 10:00, Almoço 12:30, Lanche da tarde
  16:00, Jantar 20:00, Ceia 22:00. Um tipo do cardápio fora de `MEAL_TYPES`
  não tem sugestão: o campo fica vazio, "sem lembrete", até ele escolher um
  horário.
- **Sem cardápio da nutricionista:** "Os lembretes das refeições seguem o
  cardápio da sua nutricionista." e nada mais.
- **Desligado no app inteiro (sem a chave pública de push):** "Os lembretes
  das refeições chegam em breve." e nada mais. Nada se inscreve.
- **No iPhone fora da tela inicial:** "No iPhone, os lembretes só chegam com o
  app na Tela de Início." e o passo a passo que o `PwaSettings` já tem.
- **Ligar** pede a permissão de notificação e cria a inscrição pelo
  `ensurePushSubscription`. Permissão negada: "As notificações estão
  bloqueadas neste celular. Libere nos ajustes do navegador." e a chave volta a
  desligada.

## O que a nutricionista vê

- **Na fila:**
  - um alerta novo, de tipo `refeicao`, nível 4 (o mesmo do "Faltou a 2
    treinos (7d)");
  - texto por `textoRefeicoesPuladas(n)`: "Pulou 1 refeição do plano (7d)" ou
    "Pulou N refeições do plano (7d)" (o singular existe pela regra das
    funções exportadas, embora a fila só alerte a partir de 3);
  - conta os "não comi" dos últimos 7 dias pela janela testada
    (`limitesDaJanela`);
  - aparece a partir de 3: com cinco ou seis refeições por dia, uma só na
    semana seria ruído;
  - o "sem resposta" não alerta.
- **No "dias sem registrar":** a resposta conta como registro do paciente
  (`ultimosRegistros`, em `montarResumos`).
- **Na aba Alimentação, um bloco "Refeições da semana":**
  - as refeições do cardápio nas linhas e os dias da semana (segunda a
    domingo) nas colunas;
  - cada casa é "comeu", "não comeu" (na cor de aviso do tema clínico) ou "sem
    resposta"; os dias que não chegaram ficam vazios;
  - cada casa tem o texto por extenso para leitor de tela ("Almoço, terça:
    não comeu");
  - a conta é `semanaDasRefeicoes`, em `lib/nutri.ts`, testada.
- **Leitura que falha:** o bloco diz "Não deu para carregar as refeições da
  semana." e não mostra a semana vazia; na fila, a falha entra no `falhou` do
  `resumirPacientes`, nunca como "nenhuma refeição pulada".
- **A tela clínica só ganha o alerta e o bloco**: o resto não muda, e o
  `tirar-prints-nutri.cjs` prova.

## Dados (uma migração)

`supabase/migrations/20261027120000_lembretes_das_refeicoes.sql`, testada no
Postgres local por `ferramentas/testar-sql.sh`. O `supabase/testes/base-local.sql`
ganha as tabelas que ela usa, copiadas do catálogo de produção: `meals`,
`meal_plans`, `meal_plan_items`, `push_subscriptions` e `app_config`.

**`meal_checks`**, a resposta:

| coluna | tipo |
| --- | --- |
| `id` | uuid, chave |
| `user_id` | uuid, o paciente, em cascata com a conta |
| `date` | date |
| `meal_type` | text, um de `MEAL_TYPES` |
| `status` | text, `done` ou `skipped` |
| `meal_id` | uuid, a refeição em `meals` que a resposta gravou ou escolheu; nulo se não há; `on delete set null` |
| `created_at`, `updated_at` | timestamptz |

- Única por (`user_id`, `date`, `meal_type`).
- RLS, como o `plan_completions`:
  - o paciente lê, cria, muda e apaga só as dele;
  - criar e mudar só com `meal_id` nulo ou de uma refeição dele;
  - a nutricionista com vínculo ativo lê (`is_active_nutri_of(user_id)`);
  - quem não está logado não lê nada.

**No `profiles`:**
- `meal_reminders_enabled` boolean, padrão falso;
- `meal_reminder_times` jsonb, padrão `{}`: só os horários que o paciente
  mudou (`{"Almoço": "13:00"}`); o que falta vale o sugerido.

**`meal_reminders_sent`**, o que já foi enviado: (`user_id`, `date`,
`meal_type`, `sent_at`), chave nos três primeiros. RLS ligada e nenhuma
política: só a função de envio escreve e lê.

**`refeicoes_devidas(p_secret text)`**, `SECURITY DEFINER`, no padrão do
`due_reminders`:
- segredo diferente do `app_config.cron_secret`: não devolve nada;
- escolhe (paciente, refeição) pelas regras de "Quando" e "Quando não chega",
  com a hora de São Paulo (`now() at time zone 'America/Sao_Paulo'`);
- horário salvo fora do formato HH:MM vale como o sugerido, e tipo fora de
  `MEAL_TYPES` sem horário salvo não é lembrado;
- os sugeridos estão também na função: mudou um, mude o outro, e um teste de
  vitest lê a migração e confere os seis;
- grava em `meal_reminders_sent` o que devolve;
- devolve `user_id`, `data`, `refeicao`, `itens` (jsonb com `id`, `description`,
  `calories`, `protein_g`, `carbs_g`, `fat_g`, na ordem de `position`) e a
  inscrição (`endpoint`, `p256dh`, `auth`), uma linha por inscrição;
- `anon` pode executar, como o `due_reminders` (a rota chama com a chave
  pública do Supabase, e quem protege é o segredo).

## Envio

- **A rota `/api/cron/reminders`**, que o agendamento `pacefit-reminders` já
  chama, manda também as notificações das refeições, depois das que já manda.
  O texto vem de `notificacaoDaRefeicao` (`lib/lembretesDasRefeicoes.ts`,
  testada). Inscrição vencida (404 ou 410) é apagada pelo `prune_push_endpoint`,
  como hoje. A resposta da rota ganha a contagem `refeicoes`.
- **O service worker** (`public/sw.js`):
  - o `push` passa os botões e os dados da refeição ao `showNotification`;
  - o `notificationclick` com o botão "Comi" ou "Não comi" chama
    `POST /api/refeicoes/marcar` (com o cookie da sessão), sem abrir o app; se
    a resposta não é 2xx ou a chamada falha, mostra a notificação "Não deu para
    marcar…";
  - o toque no texto abre a URL, como hoje;
  - o `CACHE` passa a `pacefit-v5`, para o celular trocar o service worker.
- **A rota `POST /api/refeicoes/marcar`**: `{ data, refeicao, resposta, itemId? }`,
  com `resposta` em `comi`, `nao_comi` ou `desfazer`. Sem sessão, 401; data ou
  refeição inválida, 400. Ela chama `marcarRefeicao` (`lib/refeicoesDoPlano.ts`),
  que lê o cardápio do paciente com a sessão dele e decide uma opção ou várias.
  O app usa a mesma função, então a regra é uma só.
- **A chave pública de push** sai do código: `lib/vapidPublicKey.ts` só lê
  `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, e `pushConfigurado()` diz se ela existe. É o
  interruptor do app inteiro.

## Para ligar

Fica no CLAUDE.md, com cada comando pronto:

1. **Aplicar a migração** no SQL Editor do Supabase. Antes do deploy: os
   botões do app leem `meal_checks`.
2. **Fazer o deploy.** Ainda desligado.
3. **As chaves:** `npx web-push generate-vapid-keys`. Na Vercel:
   `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` e `CRON_SECRET`. O mesmo
   segredo em `app_config` (`cron_secret`). Um deploy novo, porque a chave
   pública entra no build.
4. **Conferir o `pacefit-reminders`** no SQL Editor: que ele chama
   `https://app-saude-silk.vercel.app/api/cron/reminders` com
   `Authorization: Bearer <CRON_SECRET>`.
5. **Testar num celular:** ligar no Perfil, usar o "Enviar teste" do
   `PwaSettings`, e esperar uma refeição.

**Ao ligar, também passam a chegar** o lembrete diário que já existe ("Bora,
fulano 💪 …") e o da caneta, para quem os tiver ligado.

## Testes

**Unitários, escritos antes (vitest):**
- `notificacaoDaRefeicao`: título, corte em 110 caracteres numa palavra, "ou
  mais 1 opção" e "ou mais N opções", a `tag`, a URL e os dois botões.
- Os horários: `HORARIOS_SUGERIDOS` igual aos da migração (lendo o arquivo);
  `horarioValido`; `horariosDoPaciente` (o salvo vence o sugerido, o inválido
  não, e só as refeições do cardápio).
- `marcarRefeicao`, contra o `bancoEmMemoria`: "Comi" com uma opção (grava a
  refeição e a resposta ligada); com várias (só a resposta); a refeição que
  falha não deixa resposta; "Não comi" depois de "Comi" apaga a refeição
  ligada e só ela; "desfazer"; "Foi esta"; data fora da janela de 7 dias.
- A fila: `textoRefeicoesPuladas`; `montarResumos` com a janela de 7 dias, o
  mínimo de 3, a leitura que falha e a resposta contando no "dias sem
  registrar".
- `semanaDasRefeicoes`: segunda a domingo, os três estados e os dias futuros.
- `montarParaHoje`: a resposta conta como feita.

**SQL, no Postgres local:**
- RLS de `meal_checks`: o paciente só as dele; `meal_id` de outro recusado; a
  nutricionista só com vínculo ativo; `anon` nada.
- `meal_reminders_sent`: ninguém lê nem escreve pelo cliente.
- `refeicoes_devidas`: segredo errado não devolve nada; a janela de 1 hora;
  não reenvia; respeita a resposta e a refeição registrada; só com vínculo
  ativo e cardápio; horário salvo inválido vale o sugerido.

**De tela, com o mock:**
- o Perfil desligado ("chegam em breve");
- os botões, o "Qual opção?" e o "Foi esta" na Dieta e em Meu plano;
- o bloco "Refeições da semana" na aba Alimentação, e o `tirar-prints-nutri`
  passando como antes nas outras abas.

**O que não dá para testar aqui:** os botões dentro da notificação do
sistema. O navegador de teste não mostra notificação, então isso fica para o
passo 5 de "Para ligar". O trecho do service worker é mínimo: ele só chama a
rota, que é testada.

**Por fim:** `npm test`, o typecheck e o `npm run build`, com o dev parado.

## Fora do escopo

- As respostas na linha do tempo e o alerta novo na demonstração da página de
  entrada.
- Horário de refeição definido pela nutricionista no cardápio.
- Um resumo diário ou silêncio por período ("não me lembre no fim de semana").
- Os botões na notificação do iPhone, que o sistema não oferece a app web.

## Riscos

- **Notificação demais.** Cinco ou seis por dia cansam, e quem cansa desliga
  tudo. A chave do Perfil é por paciente e desliga as refeições sem desligar o
  resto. Se o piloto mostrar abandono, a próxima versão escolhe as refeições.
- **No iPhone, só com o app na tela inicial.** Quem não instala não recebe, e
  a nutricionista vê "sem resposta". O Perfil explica, mas é atrito.
- **15 minutos de atraso.** O agendamento roda de 15 em 15. Encurtar para 5 é
  trocar o `*/15` do `pacefit-reminders`, com três vezes mais chamadas.
- **A sessão vencida no celular** faz o botão falhar. A notificação "Não deu
  para marcar" leva ao app, que pede login.
- **"Comi" por reflexo.** Um toque é barato também para responder sem pensar.
  A semana na aba Alimentação mostra o padrão, não a verdade de cada refeição.
