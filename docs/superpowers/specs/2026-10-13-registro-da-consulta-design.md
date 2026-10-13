# Registro da consulta (prontuário enxuto do nutricionista)

**Data:** 2026-10-13
**Situação:** desenho aprovado em três partes pelo dono do produto;
implementado pelo plano `docs/superpowers/plans/2026-10-14-registro-da-consulta.md`.
O que a execução decidiu diferente ou além do desenho vem marcado
"(decidido na execução)".
**Subprojeto:** 2 de 3 do acompanhamento (1: consultas e agenda, em
produção · 2: registro da consulta · 3: evolução).
**Maquetes:** canvas "Registro da consulta"
(https://claude.ai/artifact/DaH6LwfUBy4BUHKJoZCAiw): rascunho, concluído com
adendo, diálogo de concluir, entrada pela consulta e celular.

## Por que

A agenda sabe quando o nutricionista atende, mas não o que aconteceu na
consulta. Hoje isso vai para as "Notas privadas" (texto solto, que se edita
e se apaga) ou para fora do app. No Brasil esse registro é **prontuário**: a
Resolução CFN 594/2017 pede o registro da anamnese, do diagnóstico
nutricional, da prescrição e da evolução, com identificação do paciente e do
profissional, e guarda de 20 anos (o eletrônico, permanente). O subprojeto 3
(evolução) depende de ter, consulta a consulta, medidas e conduta guardadas
de forma comparável.

**O texto oficial da 594 não abriu daqui** (o site do CFN está fora da rede
do ambiente). As regras acima vêm do resumo do CONARQ, do CRN-3, do CRN-5 e
de um guia de terceiro. Precisam ser conferidas no texto oficial antes de
dizer ao nutricionista que o app "atende a 594".

## Critério de sucesso

Um nutricionista, sem explicação:

1. abre a consulta em andamento (pela agenda ou pela aba Consultas) e
   começa a registrar, vendo ao lado o que pediu para observar na consulta
   anterior;
2. escreve evolução, diagnóstico, conduta e o que observar no retorno, e
   lança as medidas, sem perder nada se fechar a aba no meio;
3. conclui o registro, conferindo as medidas, e a partir daí não consegue
   mais editar; corrige com um adendo datado;
4. vê na aba Consultas quais consultas realizadas estão sem registro, em
   rascunho ou registradas;
5. vê as medidas da consulta no gráfico da aba Corpo, junto das que o
   paciente lança.

E o paciente vê as medidas tiradas na consulta no histórico dele, marcadas
como "medida na consulta", e não consegue editá-las nem apagá-las.

## O que foi decidido, e por quem

| Decisão | Quem |
|---|---|
| Prontuário enxuto: poucas partes fixas, texto livre onde o conteúdo varia de nutri para nutri. Não competir com o prontuário completo dos concorrentes. | Dono do produto (recomendação aceita) |
| As medidas da consulta entram na mesma série das do paciente, marcadas como "medida na consulta". O paciente as vê. | Dono do produto (recomendação aceita) |
| Rascunho editável; depois de "Concluir", travado; correção só por adendo datado. Nada se apaga. | Dono do produto (recomendação aceita) |
| Cinco partes fixas: Anamnese (1ª consulta) ou Evolução (retorno); Medidas; Diagnóstico nutricional; Conduta; Observar no retorno. | Dono do produto (recomendação aceita) |
| Consulta realizada sem registro ganha **selo**, sem alerta na fila. | Dono do produto (recomendação aceita) |
| Página própria por consulta, com o contexto ao lado; tabela com colunas (não JSON). | Dono do produto (abordagem 1) |
| Telas e fluxo das maquetes; erros, testes e escopo da parte 3. | Dono do produto (aprovou as três partes) |
| **Ruling:** o registro abre a partir do início da consulta; concluir marca a consulta como realizada, se ainda agendada. | Meu |
| **Ruling:** consulta com registro (rascunho ou concluído) não vira faltou nem cancelada; o rascunho pode ser descartado, o concluído nunca. | Meu |
| **Ruling:** concluir exige o CRN; se o perfil não tem, o diálogo pede e grava no perfil. | Meu |
| **Ruling:** o autor continua lendo os registros e as medidas que tirou depois do desvínculo (é ele quem responde pela guarda). | Meu |
| **Ruling:** o paciente não vê o registro, só as medidas. | Meu (decorre do "prontuário enxuto", sem resumo) |
| **Ruling:** o "antes" de cada medida é a última tirada **em consulta**; a lançada em casa aparece à parte, na coluna. | Meu |
| **Ruling:** cada medida tem uma faixa plausível; fora dela, não conclui. O diálogo de concluir mostra as medidas para conferir. | Meu (achado no desenho: medida errada concluída só se corrige por adendo) |
| **Ruling:** a conduta é texto; mostra as metas em vigor e o link para a Alimentação, mas não grava as metas no registro. | Meu |
| **Ruling:** o rascunho só nasce quando o nutri começa a digitar, e salva sozinho; nada de cópia no armazenamento do navegador (texto clínico num computador compartilhado). | Meu |

**O que ainda não tem evidência:** nenhum nutricionista real usou. As cinco
partes, as faixas de medida e o que vai na coluna de contexto são palpite.

## Fora do escopo

- Assinatura digital certificada (ICP-Brasil). O registro guarda autor, CRN
  e data e hora. Se a 594, lida no original, exigir assinatura certificada
  para prontuário eletrônico, vira um item próprio.
- Imprimir ou exportar o prontuário em PDF. O paciente tem direito a cópia;
  é o próximo item natural.
- O paciente ver o registro ou um resumo dele.
- Anamnese em blocos e modelos por nutricionista.
- Corrigir no histórico uma medida já concluída (só adendo).
- Anexar arquivos ao registro.
- As notas privadas continuam como estão, separadas do registro.

## Dados

### `consultation_records` (nova)

Um registro por consulta.

| Coluna | Tipo | Regra |
|---|---|---|
| `id` | uuid | `gen_random_uuid()` |
| `appointment_id` | uuid | não nulo, **único**, referencia `appointments` |
| `nutritionist_id` | uuid | não nulo; o autor (= o nutri da consulta) |
| `patient_id` | uuid | não nulo |
| `anamnese` | text | até 20.000 caracteres; "Anamnese" na 1ª consulta, "Evolução" no retorno (o rótulo vem do `kind` da consulta) |
| `diagnostico` | text | até 5.000 |
| `conduta` | text | até 10.000 |
| `observar` | text | até 2.000 |
| `medidas` | jsonb | as medidas do **rascunho**; chaves = colunas de `body_measurements` (`weight_kg`, `body_fat_pct`, `waist_cm`, `hip_cm`, `chest_cm`, `arm_cm`, `thigh_cm`, `calf_cm`, `neck_cm`), valores numéricos |
| `measurement_id` | uuid | nulo até concluir; a linha publicada em `body_measurements` |
| `status` | text | `rascunho` ou `concluido` |
| `concluded_at` | timestamptz | só no concluído |
| `assinatura_nome`, `assinatura_crn` | text | cópia do nome e do CRN no momento de concluir; o perfil pode mudar depois, o prontuário não |
| `created_at`, `updated_at` | timestamptz | `updated_at` serve à trava de concorrência |

### `consultation_addenda` (nova)

| Coluna | Tipo | Regra |
|---|---|---|
| `id` | uuid | |
| `record_id` | uuid | não nulo, referencia `consultation_records` |
| `author_id` | uuid | não nulo |
| `body` | text | 1 a 5.000 caracteres |
| `assinatura_nome`, `assinatura_crn` | text | cópia, como no registro |
| `created_at` | timestamptz | |

### `body_measurements` (muda)

- Colunas novas: `measured_by uuid` (nulo = lançada pelo paciente) e
  `appointment_id uuid` (único quando não nulo).
- A política `measurements_all_own` (o paciente faz tudo nas dele) vira
  quatro: o paciente **lê** todas as dele; **cria** só com `measured_by` e
  `appointment_id` nulos; **edita e apaga** só as com `measured_by` nulo.
- A política `nutri reads patient` (nutri ativo lê) fica; entra
  `measurements_author_read`: quem mediu (`measured_by = auth.uid()`) lê,
  mesmo depois do desvínculo.
- Hoje não há índice único por (`user_id`, `date`): a medida da consulta e
  uma lançada em casa no mesmo dia convivem.

### `profiles` (muda)

- Coluna nova `crn text`, que o próprio nutri preenche (a política
  `profiles_update_own` já permite). Formato livre, até 30 caracteres
  ("CRN-3 12345").

### Quem lê

- `consultation_records` e `consultation_addenda`: só o autor
  (`nutritionist_id = auth.uid()`, e no adendo pelo registro), **sem**
  exigir vínculo ativo. O paciente não lê.
- Sem política de `insert`, `update` ou `delete`: toda escrita passa pelas
  funções abaixo.

### Funções (devolvem `{ ok, error?, id? }`, como as da agenda)

| Função | O que faz | Recusa quando |
|---|---|---|
| `salvar_registro(p_consulta, p_campos jsonb, p_visto_em timestamptz)` | cria o rascunho na primeira chamada, atualiza nas seguintes; devolve o `updated_at` novo | quem pede não é o nutri da consulta; vínculo inativo; a consulta ainda não começou; faltou ou cancelada; o registro já está concluído; `p_visto_em` diferente do `updated_at` gravado ("o rascunho mudou em outra aba") |
| `concluir_registro(p_consulta, p_visto_em, p_crn)` | grava o CRN no perfil se vier; marca a consulta realizada se ainda agendada; publica as medidas (se houver alguma) em `body_measurements` com `measured_by`, `appointment_id` e a data da consulta em São Paulo; copia nome e CRN; trava | as mesmas da anterior; sem CRN (no perfil e no parâmetro); medida fora da faixa; nenhuma parte preenchida |
| `descartar_rascunho(p_consulta)` | apaga o rascunho | não é o autor; já concluído |
| `adicionar_adendo(p_registro, p_texto)` | grava o adendo com nome e CRN | não é o autor; registro não concluído; texto vazio ou longo demais |

E muda `fechar_consulta`: recusa `faltou` e `cancelada` quando a consulta
tem registro (rascunho: "Descarte o rascunho do registro antes";
concluído: "Esta consulta tem registro concluído").

Primeira chamada de `salvar_registro` vai com `p_visto_em` nulo e cria o
rascunho. Se o rascunho já existe e `p_visto_em` vem nulo (duas abas
começaram a escrever na mesma consulta), recusa como concorrência.

Faixas de medida, as mesmas no banco e em `lib/registro.ts` (a tela avisa
antes, o banco garante; o teste SQL e o unitário usam estes números):

| Medida | Faixa |
|---|---|
| Peso | 20 a 400 kg |
| % gordura | 2 a 75 |
| Cintura, quadril, tórax | 30 a 250 cm |
| Coxa | 20 a 120 cm |
| Braço, panturrilha, pescoço | 10 a 80 cm |

`execute` só para `authenticated`, como na agenda.

## Telas

### Página do registro (`/app/pacientes/<id>/consultas/<consulta>`)

Tema clínico (o layout de `pacientes/[id]` já cobre a rota) e tela larga no
`AppShell`, como o detalhe do paciente.

Consulta sem direito a registro (futura, pedido, faltou, cancelada) e sem
rascunho mostra o motivo em vez do formulário, que o banco recusaria a cada
tecla; com rascunho, o editor abre, para o nutri poder descartar (uma
consulta remarcada para a frente depois de começar a escrever). (decidido na
execução)

- **Topo:** "← Nome · Consultas"; "Consulta de qua., 21/10 às 12:45";
  tipo, modalidade e duração; selo e linha de situação ("Rascunho · Salvo
  às 13:02" ou "Concluído em … por Nome · CRN"); "Descartar rascunho" e
  "Concluir registro".
- **Coluna principal, as cinco partes:**
  - Anamnese ou Evolução (com uma linha de ajuda);
  - Medidas: peso, % gordura, cintura e quadril à vista; "Mais medidas"
    abre tórax, braço, coxa, panturrilha e pescoço (já aberto se alguma
    estiver preenchida); embaixo de cada uma, o "antes" da última consulta
    com registro concluído (na primeira, sem "antes"); IMC calculado com a
    altura do perfil (sem altura, "altura não informada no perfil");
  - Diagnóstico nutricional;
  - Conduta, com as metas em vigor e o link "Ajustar na aba Alimentação";
  - Observar no retorno ("aparece no topo do próximo registro").
- **Coluna "Para esta consulta"** (a partir de `xl`; abaixo disso, um
  bloco recolhível no topo, com o "Observar" sempre à vista):
  - o "Observar no retorno" do registro concluído anterior;
  - "desde a última consulta" (o mesmo texto da agenda), que some quando a
    última realizada é esta própria consulta: falaria do que veio depois
    dela (decidido na execução);
  - a última medida lançada pelo paciente em casa;
  - os registros anteriores, com link.
- **Salvamento:** o rascunho nasce na primeira digitação e salva sozinho
  1,5 s depois da última tecla e ao sair de um campo, uma gravação por vez
  (a seguinte espera a anterior, com o `updated_at` que ela devolveu). Estados: "Salvando…", "Salvo
  às HH:MM", "Não foi possível salvar. Tentar de novo". Sair da página com
  alteração não salva cai no aviso do navegador. Decidido na execução:
  - ao abrir, o editor confere o rascunho no banco ("Conferindo o
    rascunho…", com o formulário travado; em 8 s sem resposta, segue com o
    que veio da página): o cache do roteador do Next devolve a página velha
    no Voltar e, em até 30 s, num link, e a primeira tecla seria recusada
    como "mudou em outra aba";
  - medida inválida (não é número, ou fora da faixa) mantém no envio o
    último valor válido, porque cada salvamento grava as medidas inteiras e
    omiti-la apagava a salva; vazio continua apagando. Enquanto ela está na
    tela, o status não diz "Salvo".
- **Concluir:** diálogo com o que muda (trava, medidas no histórico,
  consulta realizada), as medidas para conferir e, se o perfil não tem, o
  campo do CRN. Enquanto conclui, o diálogo não fecha (Esc, fundo, X): a
  conclusão não se cancela, e fechar parecia cancelar (decidido na execução).
- **Concluído:** as cinco partes só para leitura; medidas com a diferença
  para a consulta anterior; adendos embaixo, datados, com "Novo adendo". Sem
  a coluna "Registros desta paciente" da maquete 2 (decidido na execução).
- **Celular:** uma coluna; o contexto recolhido; os botões presos no rodapé.

### Por onde se chega

- **Painel da consulta** (agenda e aba Consultas): numa consulta que já
  começou e não é faltou nem cancelada, o botão "Registrar consulta",
  "Continuar registro" ou "Ver registro"; e o "Observar no retorno" do
  último registro concluído do paciente. Decidido na execução:
  - com "Registrar consulta" ou "Continuar registro", "Realizada" vira
    secundária (maquete 4): o painel não tem dois destaques;
  - o "Observar no retorno" aparece no painel de **qualquer** consulta que
    não seja faltou nem cancelada, inclusive futura e pedido: serve para
    preparar o retorno. O botão do registro continua só na que já começou;
  - "último registro concluído" é o da consulta que **começou** por último
    (o início da consulta do registro, não a hora da conclusão), a mesma
    chave da página do registro; a data mostrada é o dia dessa consulta.
    Preencher hoje o registro de uma consulta antiga não muda qual é o
    último. Na própria consulta desse registro, e nas anteriores a ela, o
    painel não mostra Observar;
  - se a leitura dos registros falha, o painel mostra o botão neutro "Abrir
    registro" (a página do registro lê o banco por conta própria); se a do
    Observar falha, a linha "Não foi possível carregar o Observar no
    retorno.", em vez de sumir calado.
- **Aba Consultas:** cada consulta que já começou e não é faltou nem
  cancelada (em andamento, sem desfecho ou realizada) ganha o selo "Sem
  registro", "Rascunho" ou "Registrada" e o link certo. O selo fica na linha
  do Histórico, sem link (seria conteúdo interativo dentro do `<summary>`), e
  o botão, no painel que a linha abre (decidido na execução).

### Paciente

- Página Medidas e gráficos: a medida da consulta aparece com a marca
  "medida na consulta" e **sem** o botão de excluir. A marca fica na linha
  da lista; o gráfico não distingue o ponto da consulta (decidido na
  execução).

### Mudanças em código que já existe

- **Assistente (`lib/aiActions.ts`):** "atualizar peso" procura o registro
  de hoje e o edita; "remover o último" de peso apaga o mais recente. Com a
  nova regra, a medida da consulta seria recusada **sem erro** (o
  supabase-js devolve zero linhas, não um erro) e o assistente diria que
  atualizou ou apagou. Os dois passam a olhar só as medidas com
  `measured_by` nulo.
- **Página Medidas (`app/app/medidas/page.tsx`):** sem excluir nas medidas
  da consulta, como acima.

## Erros

- Leitura que falha não é "não tem" (CLAUDE.md): a página do registro mostra
  o erro, não um formulário em branco; a aba Consultas, se os registros não
  carregam, mostra a lista sem selos e um aviso, não "Sem registro" em tudo.
- Salvamento que falha: o texto fica no formulário, com "Tentar de novo".
- Duas abas no mesmo rascunho: `p_visto_em` faz o banco recusar a segunda,
  com "O rascunho mudou em outra aba. Recarregue."
- Concluir depois que outra aba marcou faltou: o banco recusa.
- Vínculo encerrado: não salva nem conclui; o concluído segue legível pelo
  autor **no banco** (as políticas de leitura do autor não pedem vínculo, nem
  `adicionar_adendo`), mas não há tela por onde chegar: o perfil e a
  consulta (`appointments_nutri_read`) pedem vínculo ativo e não existe
  lista de ex-pacientes, então a página do registro mostra "Sem acesso".
  Ficou em "Em aberto" no CLAUDE.md (decidido na execução).

## Datas e fuso

A data da medida publicada é o dia da consulta em São Paulo
(`dataNoBrasil(starts_at)`, como `diaDaConsulta`), nunca
`starts_at::date` em UTC: uma consulta às 22h cairia no dia seguinte.

## Testes

- **SQL** (`ferramentas/testar-sql.sh`, Postgres local):
  - quem lê: paciente não lê registro nem adendo; outro nutri não lê; o
    autor lê depois do desvínculo;
  - cada função e cada recusa da tabela acima, inclusive a de concorrência
    e a de faixa;
  - `body_measurements`: o paciente cria, edita e apaga as dele; não edita
    nem apaga as da consulta; não cria com `measured_by`; o autor lê as que
    tirou depois do desvínculo;
  - `fechar_consulta` recusa faltou e cancelada com registro;
  - a data da medida publicada para uma consulta às 22h em São Paulo.
- **Unitários** (`lib/registro.ts`): situação de cada consulta (sem
  registro, rascunho, registrada, sem direito a registro); leitura de
  "71,8" e "71.8"; faixas; IMC; escolha do "antes".
- **Telas** (Supabase falso, `ferramentas/tirar-prints-nutri.cjs`):
  escrever e ver "Salvo às"; concluir pedindo o CRN; o concluído sem
  edição; adendo; selos na aba Consultas; o botão no painel; celular sem
  transbordo; o paciente vê a medida da consulta sem o excluir.

## Riscos

- **A regra de acesso de `body_measurements` muda para um app que já está
  em uso pelo paciente.** Os testes SQL cobrem o caminho do paciente, e o
  assistente e a página Medidas mudam junto (acima).
- **A 594 não foi lida no original.** Se ela pedir algo além (assinatura
  certificada, campos obrigatórios), o desenho aguenta acréscimos, mas o
  texto de venda "atende ao CFN" não pode sair antes de conferir.
- **Os campos são palpite sem um nutricionista real.** O texto livre nas
  partes reduz o custo de errar.
