# Detalhe do paciente (lado do nutricionista): estrutura nova e piloto visual

**Data:** 2026-10-09
**Situação:** aguardando revisão
**Subprojeto:** A de 4 (A: detalhe do paciente · B: navegação do paciente · C: identidade visual no app inteiro · D: landing para nutricionista)

## Por que

O dono do produto quer melhorar o design e a organização das informações
por três motivos ao mesmo tempo: vender para nutricionistas (demonstração),
paciente que se perde em muitas telas, e visual que parece amador. Quem paga
é o nutricionista, e ele decide também olhando o que o paciente dele vai
usar. A ordem escolhida foi a **fatia da demonstração**: primeiro a tela onde
o nutricionista passa o tempo numa consulta, já com a direção visual nova
como piloto, antes de levar o visual para o resto do app.

A tela de hoje (`app/app/pacientes/[id]/page.tsx`, 1.283 linhas) tem estes
problemas, encontrados lendo o código:

- é organizada por tipo de dado (7 abas), não pelo que o nutricionista faz;
- a mesma coisa mora em duas abas: plano semanal e rotinas (leitura em
  Treino, edição em Prescrição), metas (Visão geral e Prescrição), peso
  (Visão geral e Corpo);
- a aba Prescrição tem mais 5 abas internas (Metas, Alimentação, Treino,
  Conversa, Notas), e a conversa com mensagens não lidas fica a dois níveis
  de abas da entrada;
- a meta de calorias fica longe das calorias que o paciente comeu, que é a
  comparação central de uma consulta.

## Critério de sucesso

Um nutricionista que nunca viu o app, numa demonstração, sem explicação:

1. diz em até 5 segundos por que o paciente está na fila;
2. resolve uma mudança de meta feita pelo paciente;
3. responde uma mensagem;
4. troca um treino da semana;
5. registra uma nota privada.

Cada tarefa a um toque da entrada da tela, ou dentro da seção onde a
informação já está.

## O que já foi decidido, e com que evidência

| Decisão | Evidência |
|---|---|
| A tela atende dois motivos de entrada: resolver um alerta vindo da fila e preparar ou fazer a consulta. | Escolha do dono do produto. |
| Editar onde se lê, em vez de uma aba Prescrição separada. | Escolha do dono do produto. Muda a regra do `CLAUDE.md` "a aba Prescrição é a única onde ele age". |
| Estrutura A (uma rolagem por assunto) no celular e C (duas colunas, conversa ao lado) no computador. | Comparada com B (abas por assunto) em mockup e testada pelo dono do produto em protótipo clicável. |
| Direção visual 1 (Clínico sereno), com a tabela real × meta da direção 2 no computador. | Comparada com as direções 2 e 3 em claro e escuro, com contraste calculado. |
| Limites de "atenção": calorias fora de ±10% da meta; proteína e água abaixo de −10%. | Proposta aceita pelo dono do produto. É palpite, não regra clínica validada. |

**O que ainda não tem evidência:** nenhum nutricionista real viu a estrutura
nem o visual. O protótipo e os mockups estão no canvas
`https://claude.ai/artifact/KwB9h6BYJEgaKTL1aMuz53`, que é privado; para
mostrar a alguém, ele tem de ser compartilhado pelo menu Share.

## Fora do escopo

- O lado do paciente, a Início do nutricionista (`NutriHome`), a lista de
  pacientes e o resto do app continuam no visual atual. Durante o piloto o
  app tem duas caras, e isso foi aceito.
- O botão "visto" para alertas que não somem sozinhos.
- A regra que conta o treino de hoje como "sem resposta" desde a manhã
  (`computeAdherence`).
- Exame refeito com resultado normal não limpar o alerta de exame.
- Separar o peso alvo do editor de metas (ver Seção 2).

## Seção 1: estrutura

Uma página só em `/app/pacientes/[id]`. Saem as 7 abas e as 5 abas internas
da Prescrição. A ordem, de cima para baixo:

1. **Cabeçalho:** nome, idade, sexo e altura; botões Mensagem (com a contagem
   de não lidas) e Nota privada; link para a linha do tempo.
2. **"Por que está na sua fila":** os alertas do resumo, na ordem de
   gravidade que já existe (`montarResumos`), cada um com a sua ação:

   | Alerta | Ação |
   |---|---|
   | dose atrasada | Conversar |
   | mudança na prescrição | Reaplicar metas, Conversar |
   | dias sem registrar, nunca registrou | Conversar |
   | faltas, treinos sem confirmação | Ver semana (rola até Treino) |
   | exame fora da referência | Ver clínico (rola até Clínico) |

   Paciente sem alerta não mostra a seção.
3. **Três números:** dias com registro (7 dias), treinos confirmados de
   previstos (7 dias), variação de peso (30 dias).
4. **Alimentação:** metas contra o real (média de 7 dias) e cardápio.
   Editável.
5. **Treino:** semana com os check-ins, plano e rotinas, adesão de 4 semanas.
   Editável.
6. **Corpo:** peso atual, variação, meta de peso (só leitura, com link
   "editar nas metas"), medidas.
7. **Clínico:** tratamento, próxima dose, exames, efeitos colaterais. Só
   leitura.
8. **Conversa e notas privadas:** no celular, seção no fim, e o botão do
   cabeçalho abre a conversa em tela cheia; no computador, coluna fixa à
   direita (ver Seção 3).

As listas longas de hoje (refeições recentes, treinos de 30 dias, medidas
registradas) ficam atrás de "Ver histórico" dentro da própria seção.

**A linha do tempo vira página própria:** `/app/pacientes/[id]/linha-do-tempo`,
usando `getPatientActivity` e `montarLinhaDoTempo` como hoje.

**Saem sem substituto:**
- "Score de Saúde de hoje": é um número do paciente, não uma ferramenta do
  nutricionista;
- "Registros por dia (14 dias)": repete a linha do tempo e os dias com
  registro.

**Links antigos:** só a própria página usa `?t=`. O parâmetro passa a ser
ignorado, e `?t=atividade` redireciona para a linha do tempo.

## Seção 2: edição

**Leitura por padrão, edição explícita.** Alimentação (metas e cardápio) e
Treino (plano da semana e rotinas) têm um botão Editar que troca a seção pelo
formulário, com Salvar e Cancelar. Só uma seção fica em edição por vez:
enquanto houver mudança não salva, os outros botões Editar ficam desativados,
com o aviso "Salve ou cancele a edição de <seção>".

**Nenhum caminho de gravação novo.** O `components/PrescricaoClient.tsx`
(968 linhas) é desmontado em componentes por assunto:

| Componente novo | Vem de | Grava |
|---|---|---|
| `EditorMetas` | `AbaMetas` | RPC `set_patient_goals` |
| `MealPlanEditor` | reaproveitado como está | o mesmo de hoje |
| `EditorTreino` | `AbaTreino` | as mesmas tabelas de rotinas e plano |
| `Conversa` | `AbaConversa` | `patient_notes` (visibilidade compartilhada) |
| `NotasPrivadas` | `AbaNotas` | `patient_notes` (privadas) |

A segurança continua por RLS, sem service role. A página busca os dados no
servidor e passa para os componentes.

**"Reaplicar metas":** chama `set_patient_goals` com os valores da **última
prescrição** (tabela `prescriptions`, que a tela passa a buscar) e depois
recarrega a página (`router.refresh()`), para o alerta sumir.

**Peso alvo continua no editor de metas,** dentro de Alimentação. A função
grava as quatro metas juntas (calorias, proteína, água, peso), e não se sabe
se mandar um campo vazio apaga a meta ou mantém a anterior.

**Conversa e notas no celular** abrem em tela cheia por parâmetro de URL
(`?conversa=1`, `?notas=1`), para o Voltar do celular fechar a conversa e
não sair da página. As mensagens do paciente continuam contando como não
lidas até o nutricionista **responder**, como hoje: o código atual marca
como lidas ao enviar, não ao abrir. Assim "não lida" quer dizer "ainda não
respondida", que é o que importa para a fila.

**Erro ao salvar:** o formulário continua aberto com os valores digitados e
a mensagem aparece embaixo dele, na própria seção. Hoje há um único aviso
no topo da Prescrição.

## Seção 3: visual (piloto, só nesta página)

**Escopo do visual:** `app/app/pacientes/[id]/layout.tsx` carrega a
Instrument Sans por `next/font/google` e envolve o conteúdo na classe
`tema-clinico`. O resto do app não carrega a fonte nem muda de cor.

**Cores como variáveis, em par claro e escuro:** definidas uma vez em
`.tema-clinico` e de novo em `.dark .tema-clinico`, e expostas no Tailwind
como `clin-*` (`bg-clin-chao`, `text-clin-texto`…). O par fica num lugar só,
em vez de `dark:` repetido em cada componente.

| Variável | Claro | Escuro | Menor contraste (texto ≥ 4,5:1; gráfico ≥ 3:1) |
|---|---|---|---|
| `chao` / `texto` | `#ffffff` / `#111827` | `#0c1210` / `#e7ece9` | 15,8:1 |
| `texto-2` | `#4b5563` | `#a3b1aa` | 6,9:1 |
| `linha` | `#e5e7eb` | `#24302b` | decorativo |
| `primaria` / `sobre-primaria` | `#0e5d34` / `#ffffff` | `#3fd27b` / `#062e1a` | 7,6:1 |
| `atencao-fundo` / `atencao` | `#fff7ed` / `#9a3412` | `#24180c` / `#fdba74` | 6,9:1 |
| barras: `ok` / `fora` sobre o trilho `linha` | `#0e5d34` / `#9a3412` | `#3fd27b` / `#fdba74` | 5,9:1 |

A paleta entra na rota `/estilo`, com a razão calculada, como o resto da
escala.

**Tipografia:** Instrument Sans para tudo, com algarismos de largura fixa
(`tabular-nums`) nos números. Título do paciente 24 px, título de seção
18 px, texto 14–15 px, rótulos 13 px.

**Componentes do piloto** (`components/clinico/`):
- `Secao`: título e ação (Editar, Ver histórico);
- `AlertaFila`;
- `Numeros`: os três números separados por linha fina, sem caixa;
- `BarraMeta`: real contra meta, no celular;
- `TabelaRealMeta`: Item | Real | Meta | Δ, no computador. Vem da direção 2
  só a estrutura; a fonte continua a Instrument Sans;
- `SemanaTreino`: os 7 dias com os estados do check-in.

**Responsivo:** abaixo de 1024 px, uma coluna (estrutura A); a partir de
1024 px (`lg:`), conteúdo mais uma coluna lateral de 360 px com Conversa e
Notas privadas (estrutura C).

**Custos aceitos:**
- o menu lateral e a barra de baixo continuam na Inter e na Sora: duas
  fontes na mesma tela durante o piloto;
- a página fica mais comprida que a atual, porque o visual tem mais respiro.

## Seção 4: dados, estados vazios, erros e testes

**Dados novos:**
1. **Última prescrição** (`prescriptions`, a mais recente do paciente): é o
   "prescrito" e o valor de "Reaplicar".
2. **Médias de 7 dias** de calorias, proteína e água: função pura
   `mediasDaSemana` em `lib/nutri.ts`, com a janela de `naJanela`. A média é
   sobre **os dias com registro** daquele item, e a tela diz "média de N dias
   com registro". Dia sem registro não conta como zero, porque não quer dizer
   que a pessoa comeu 0 kcal.

**Alertas com tipo:** `alertar()` em `montarResumos` passa a registrar
também o tipo (`dose`, `prescricao`, `parado`, `treino`, `exame`), no mesmo
ponto em que gera o texto. `parado` cobre "dias sem registrar" e "nunca
registrou"; `treino` cobre faltas e treinos sem confirmação. A ação de cada
alerta sai do tipo, nunca do texto.

**Real contra meta:** função pura `compararComMeta`, que devolve o Δ em
porcentagem e o status de cada item:

| Item | Status "atenção" quando |
|---|---|
| Calorias | Δ fora de ±10% |
| Proteína | Δ abaixo de −10% |
| Água | Δ abaixo de −10% |

Sem meta, devolve só o real, e a tela mostra "Definir metas".

**Carregamento:** cada seção é um componente de servidor separado dentro de
`Suspense`, com o esqueleto que o app já tem (`components/Skeleton.tsx`).
Cabeçalho, alertas e números chegam primeiro. A página inteira faz por volta
de 30 consultas em paralelo; hoje cada aba faz só as suas.

**Estados vazios:**

| Situação | A tela mostra |
|---|---|
| sem plano de treino | "Prescrever plano", que abre o editor |
| sem cardápio | "Montar cardápio" |
| sem metas | "Definir metas" |
| sem registro nenhum | "—" nos números |
| sem tratamento ativo | "Sem tratamento ativo" |
| conversa vazia | só a caixa de escrever |

**Erros de leitura:** hoje uma consulta que falha vira lista vazia, sem
aviso. No piloto, cada seção separa "não tem" de "falhou" e, se falhar,
mostra "Não foi possível carregar <seção>" com um botão de tentar de novo.

**Testes:**
- **TDD nas partes puras:** `mediasDaSemana` (janela de 7 dias, dia sem
  registro fora da conta, data futura fora), `compararComMeta` (Δ, status por
  item, sem meta) e o tipo de cada alerta em `montarResumos`.
- **Suíte e build:** os 75 testes atuais e o `npm run build` continuam
  verdes.
- **Prints com o Supabase falso** (`ferramentas/`): celular e computador,
  claro e escuro, em quatro casos: paciente com alertas, sem alertas,
  recém-chegado sem nada, e editor aberto. Os cenários de carteira (vários
  pacientes, desvio, dose atrasada, convites) entram no mock de
  `ferramentas/mock-supabase.cjs`, porque B e C vão precisar deles.

## Riscos e o que confirmar primeiro

1. **`set_patient_goals` — confirmado no banco em 2026-10-09** (leitura
   autorizada, só `pg_get_functiondef` e `pg_policies`):
   - A função confere `is_active_nutri_of(p_patient)`, **insere uma linha em
     `prescriptions`** e grava as quatro metas em `profiles`.
   - **Campo nulo apaga a meta:** o `update` grava o valor recebido, inclusive
     nulo. Por isso "Reaplicar" manda os quatro valores da última prescrição,
     nunca só o campo que mudou.
   - **A baixa nos avisos é feita por gatilho:** `prescriptions_ack_deviations`
     (`AFTER INSERT ON prescriptions`) preenche `acknowledged_at` em todos os
     avisos abertos do paciente. "Reaplicar" não precisa de outra gravação.
   - **Reaplicar não gera aviso novo:** `detect_goal_deviation`
     (`AFTER UPDATE ON profiles`) só registra quando quem mudou foi o
     próprio paciente (`auth.uid() = new.id`).
2. **~30 consultas por abertura:** o `Suspense` esconde a espera, mas não
   reduz a carga. Se ficar lento com pacientes reais, juntar consultas por
   seção.
3. **Validação:** a estrutura e o visual foram aprovados pelo dono do
   produto, não por um nutricionista. O roteiro de 5 tarefas do critério de
   sucesso serve para o primeiro teste com um nutricionista real.
4. **Limites de atenção:** palpite. Se um nutricionista discordar, são
   constantes em `compararComMeta`.

## O que muda no `CLAUDE.md` junto com a implementação

- "aba **Prescrição** é a única onde ele age — as outras são leitura" passa
  a descrever a página única, com edição em Alimentação e Treino;
- a lista de lógica testada ganha `mediasDaSemana` e `compararComMeta`;
- as variáveis `clin-*` e o escopo `tema-clinico` entram em Convenções;
- a contagem de testes.
