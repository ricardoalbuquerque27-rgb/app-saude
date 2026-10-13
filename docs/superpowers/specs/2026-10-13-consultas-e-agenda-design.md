# Consultas e agenda (lado do nutricionista e do paciente)

**Data:** 2026-10-13
**Situação:** aprovada para construir ("pode construir a agenda"), com as
decisões em aberto tomadas por mim e marcadas como **Ruling** abaixo.
**Subprojeto:** 1 de 3 do acompanhamento (1: consultas e agenda · 2: registro
da consulta · 3: evolução). O dono do produto pediu "um em seguida do outro".

## Por que

O dono do produto acha o acompanhamento "muito cru". Ao decompor, a peça que
falta primeiro é a consulta: hoje o app não sabe quando o nutricionista
atende cada paciente. Sem isso não existe "retorno", nem "o que aconteceu
desde a última consulta", nem agenda. O registro detalhado da consulta
(anamnese, avaliação física, conduta) fica para o subprojeto 2.

## Critério de sucesso

Um nutricionista, sem explicação:

1. marca uma consulta para um paciente e vê o aviso se o horário bate com
   outra;
2. abre a agenda e diz quem atende hoje, nesta semana e neste mês;
3. responde um pedido de consulta de um paciente (aceita ou marca outro
   horário) sem sair da Início ou da agenda;
4. fecha uma consulta que passou (realizada, faltou ou cancelada) e já marca
   o retorno;
5. abre um paciente e lê, em uma linha, o que aconteceu desde a última
   consulta.

E o paciente, sem explicação: vê a próxima consulta, cancela, pede para
remarcar e pede uma consulta nova.

## O que foi decidido, e por quem

| Decisão | Quem |
|---|---|
| O nutri marca direto; o paciente também pode pedir pelo app. | Dono do produto |
| Pedido que não serve: o nutri marca outro horário direto, sem vai-e-volta de aceite. | Dono do produto |
| Viram alerta na fila só "pedido aguardando" e "consulta sem desfecho". | Dono do produto |
| O paciente vê, cancela e pede remarcação. | Dono do produto |
| A agenda tem Mês, Semana e Dia, com troca entre as três; tocar num dia do mês abre o dia. | Dono do produto |
| O estilo do protótipo da agenda serve; tudo numa página só ficou "bagunçado". | Dono do produto |
| A página do paciente em abas, com a aba Consultas. | Dono do produto (protótipo testado) |
| **Ruling:** a agenda abre no Dia e lembra a última vista usada. | Recomendação aceita |
| **Ruling:** sem coluna "Precisa de você" na agenda. Pendência aparece tracejada no calendário e numa linha de aviso no topo; a lista completa é a fila da Início. | Recomendação aceita |
| **Ruling:** modalidade só "presencial" ou "online", sem campo de endereço ou link. O link vai pela conversa. | Meu |
| **Ruling:** tipo "1ª consulta" ou "retorno"; vem "retorno" se o paciente já tem consulta realizada. | Meu |
| **Ruling:** duração 30, 45, 60 ou 90 min; padrão 60 na 1ª e 45 no retorno. | Meu |
| **Ruling:** choque de horário **avisa, não impede**. O nutri pode encaixar de propósito. | Meu |
| **Ruling:** ao marcar "Realizada", o painel oferece "Marcar retorno", com a data sugerida em +30 dias no mesmo horário. Sem alerta de "sem retorno marcado" (o dono do produto não escolheu). | Meu |
| **Ruling:** o paciente tem no máximo um pedido aberto e não pede no passado. Cancela uma agendada só antes do início, mas cancela um pedido mesmo com o horário pedido vencido (o nutri não respondeu, e o pedido prenderia o próximo). | Meu (revisto na revisão de código) |
| **Ruling:** nada é apagado; cancelar guarda quem cancelou. | Meu |
| **Ruling:** realizada e faltou desde o início da consulta (não só no fim); o desfecho se corrige entre realizada e faltou, ou para cancelada, mas cancelada não volta: um pedido recusado nunca foi consulta. | Meu (revisto na revisão de código) |
| **Ruling:** quando o vínculo deixa de ser ativo, pedidos e consultas futuras com aquele nutri são cancelados (gatilho no banco); as passadas ficam. | Meu (achado da revisão de código) |

**O que ainda não tem evidência:** nenhum nutricionista real usou. As
durações padrão e o retorno em 30 dias são palpite.

## Fora do escopo

- Registro da consulta (anamnese, medidas, conduta): subprojeto 2.
- Gráficos e comparativos entre consultas: subprojeto 3.
- Avisos fora do app (push, e-mail, WhatsApp) e lembretes: falta VAPID, e o
  dono do produto não pediu.
- Grade de horários livres para o paciente reservar sozinho, consultas
  recorrentes, sincronizar com Google Agenda, link de vídeo.

## Dados

Uma tabela nova, `appointments`, e funções no banco para todas as escritas.

| Coluna | Tipo | Regra |
|---|---|---|
| `id` | uuid | `gen_random_uuid()` |
| `nutritionist_id` | uuid | não nulo |
| `patient_id` | uuid | não nulo |
| `starts_at` | timestamptz | não nulo; no pedido, o horário que o paciente quer |
| `duration_min` | int | 15 a 240 |
| `kind` | text | `primeira` ou `retorno` |
| `mode` | text | `presencial` ou `online` |
| `status` | text | `pedido`, `agendada`, `realizada`, `faltou`, `cancelada` |
| `patient_message` | text | recado do paciente no pedido ou na remarcação, até 500 caracteres |
| `reschedule_requested_at` | timestamptz | não nulo = o paciente pediu para remarcar esta agendada |
| `cancelled_by` | text | `nutri` ou `paciente`, só quando cancelada |
| `created_at`, `updated_at` | timestamptz | |

Um gatilho em `patient_links` (`patient_links_cancela_consultas`) cancela,
quando o vínculo deixa de ser ativo (o paciente revoga, o nutri remove), os
pedidos e as consultas futuras com aquele nutricionista. Sem isso o paciente
via a consulta de um nutri que já não vê nada, e um pedido aberto com ele
prendia o paciente pelo índice de um pedido por vez.

"Sem desfecho" **não é um status gravado**: é uma agendada cujo fim
(`starts_at + duration_min`) já passou. Gravar exigiria um cron, e o plano
Hobby da Vercel só aceita cron diário (CLAUDE.md, "vercel.json").

### Quem lê

RLS com só `select`:
- o nutri lê as consultas em que `nutritionist_id = auth.uid()` **e**
  `is_active_nutri_of(patient_id)`;
- o paciente lê as dele (`patient_id = auth.uid()`).

Sem política de `insert`, `update` ou `delete`: toda escrita passa pelas
funções abaixo, `SECURITY DEFINER`, que conferem quem pede e a transição.
Assim o paciente não consegue se marcar como "realizada", nem trocar o
`nutritionist_id`.

### Funções (todas devolvem `{ ok, error?, id? }`, como `set_patient_goals`)

| Função | Quem | O que faz |
|---|---|---|
| `marcar_consulta(p_patient, p_inicio, p_duracao, p_tipo, p_modo)` | nutri do paciente | cria agendada |
| `remarcar_consulta(p_id, p_inicio, p_duracao, p_tipo, p_modo)` | nutri da consulta | pedido ou agendada → agendada no horário dado; limpa o pedido de remarcação. "Aceitar" é chamar com os mesmos valores |
| `fechar_consulta(p_id, p_desfecho)` | nutri da consulta | `realizada`/`faltou` só de agendada (ou para corrigir outro desfecho) e só depois do início; `cancelada` de qualquer situação, inclusive pedido ("Recusar"), com `cancelled_by = 'nutri'` |
| `pedir_consulta(p_inicio, p_modo, p_mensagem)` | paciente com nutri ativo | cria pedido; recusa no passado ou com outro pedido aberto |
| `pedir_remarcacao(p_id, p_mensagem)` | paciente da consulta | agendada futura ganha `reschedule_requested_at` e o recado |
| `cancelar_consulta(p_id)` | paciente da consulta | pedido ou agendada futura → cancelada (`cancelled_by = 'paciente'`) |

`execute` só para `authenticated` (revogado de `public` e `anon`), igual à
migração `harden_function_grants`.

## Telas

### Agenda do nutri (`/app/agenda`, item novo no menu)

- Topo: título do período, ‹ › e Hoje, troca Mês | Semana | Dia, botão
  "Marcar consulta".
- Endereço `?vista=dia|semana|mes&data=AAAA-MM-DD`. Sem `vista`, vale a
  última usada (cookie `agenda_vista`); sem cookie, Dia. Sem `data`, hoje.
- **Dia:** lista por horário: hora, nome, tipo, modalidade, situação; numa
  linha menor, "desde a última consulta" do paciente (só retorno).
- **Semana:** grade por horário (7 colunas) no computador; no celular, a
  lista dos 7 dias. Tocar no nome do dia abre o Dia.
- **Mês:** calendário; tocar num dia abre o Dia. No computador, cada dia
  mostra as consultas com hora e primeiro nome, no visual dos blocos da
  Semana, até duas e depois "+N" (âmbar se uma pendência ficou de fora). No
  celular, a contagem num círculo cheio e o ponto da pendência. (Era só a
  contagem em cinza; o dono do produto pediu a consulta mais visível.)
- Pendência (pedido, pedido de remarcação, sem desfecho) aparece tracejada.
  No topo, uma linha "2 pedidos aguardando · 1 consulta sem desfecho" com
  cada item abrindo o painel da consulta.
- Tocar numa consulta abre o **painel da consulta**, com as ações da
  situação dela:
  - pedido: Aceitar · Outro horário · Recusar, com o aviso de choque do
    horário pedido (o paciente não vê a agenda);
  - agendada com pedido de remarcação: o recado, Remarcar · Manter horário;
  - agendada futura: Remarcar · Cancelar;
  - agendada que já começou: Realizada · Faltou · Remarcar;
  - sem desfecho: Realizada · Faltou · Cancelada;
  - "Realizada" leva direto ao formulário do retorno (+30 dias);
  - realizada: Marcar retorno; corrigir desfecho;
  - sempre: Abrir paciente.
- **Formulário de marcar/remarcar:** paciente (só na nova), data, hora (passo
  de 15 min), duração, tipo, modalidade. Embaixo, as consultas do dia
  escolhido, e o aviso de choque se houver.

### Página do paciente

- Aba nova **Consultas**, depois de Clínico: pendência no topo (com as mesmas
  ações do painel), próxima consulta ou, sem nenhuma, "Sem retorno marcado"
  com a última realizada e o "Marcar retorno", histórico com o desfecho de
  cada uma, "Marcar consulta" já com o paciente escolhido.
- Cabeçalho: "Próxima consulta: ter., 20/10 às 14:00 · online" embaixo de
  idade e altura, quando houver. É texto, não link: o cabeçalho fica em todas
  as abas, e um link para outra aba pularia a pergunta de descartar rascunho.
- Resumo: linha "Desde a última consulta (29/9): …" embaixo dos números.
- Fila do Resumo e da Início: alertas novos de tipo `consulta`:
  - "Pediu uma consulta" / "Pediu para remarcar" — nível 2;
  - "Consulta de 09/10 sem desfecho" — nível 4.
  A ação no Resumo é "Ver consultas" (abre a aba).

### "Desde a última consulta"

A partir do dia seguinte à última consulta realizada, até hoje, no máximo 90
dias (passando disso diz "nos últimos 90 dias"):
- dias com registro: "9 de 14 dias com registro";
- peso: diferença entre a última medida até o dia da consulta e a mais
  recente depois dela ("−1,2 kg"); some se faltar uma das duas;
- treinos do plano: "treinos 7 de 8" (confirmados de previstos, a mesma conta
  de `computeAdherence`); some sem plano;
- mudanças: "2 mudanças na prescrição" (avisos criados no período); some se
  zero.
Sem consulta realizada, a linha não aparece. Sem nenhum registro no período:
"Nenhum registro desde então".

### Lado do paciente

Na Início e em "Meu plano", um cartão **Consulta**, só para quem tem
nutricionista ativo:
- com agendada futura: data, hora, modalidade; "Pedir para remarcar" (pede um
  recado: "Qual horário fica melhor?") e "Cancelar" (com confirmação); se já
  pediu para remarcar, "Pedido de remarcação enviado";
- com pedido aberto: "Pedido enviado para ter., 20/10 às 14:00 · aguardando o
  nutricionista" e "Cancelar pedido";
- sem nada: "Pedir consulta" (data, hora, modalidade, recado opcional).

## Datas e fuso

Tudo em `America/Sao_Paulo`, como `lib/date.ts`. O formulário recebe data e
hora de São Paulo e converte para o instante com o deslocamento daquele dia
(não um `-03:00` fixo). O dia de uma consulta é `dataNoBrasil(starts_at)`,
nunca `starts_at.slice(0,10)` (CLAUDE.md, "Fuso horário").

## Testes

- `lib/consultas.ts`, puro, com vitest: situação de cada consulta (inclusive
  sem desfecho no minuto exato do fim), choque de horário, conversão de
  horário de São Paulo, grade do mês e da semana, texto de "desde a última
  consulta", textos de data e hora.
- A migração testada num Postgres 16 local com `auth.uid()` simulado:
  cada função, cada transição proibida, e a RLS dos dois lados, com
  `BEGIN ... ROLLBACK`.
- Telas: o Supabase falso (`CENARIO=carteira`) ganha consultas e as funções
  com estado, e o roteiro de prints confere a agenda nas três vistas, o
  painel, a aba Consultas e o cartão do paciente, no celular e no computador.
