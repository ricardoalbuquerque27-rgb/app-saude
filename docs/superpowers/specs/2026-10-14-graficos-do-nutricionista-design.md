# Gráficos do nutricionista (corpo e exames)

**Data:** 2026-10-14
**Situação:** desenho aprovado pelo dono do produto, com as maquetes.
**Maquetes:** canvas "Gráficos do nutricionista"
(https://claude.ai/artifact/WXDsmchTqtCuK3KLjJLXYC): aba Corpo com a
Evolução (computador), aba Clínico com o comparativo dos exames
(computador), aba Corpo no celular, e o que aparece com pouco dado ou com
leitura que falhou.
**Depende de:** registro da consulta em produção (a marca da medida da
consulta, `body_measurements.measured_by`, vem das migrações dele).

## Por que

A página do paciente do lado do nutricionista não tem nenhum gráfico: a aba
Corpo tem "Peso atual", "Variação em 30 dias", "Meta de peso" e uma tabela;
a aba Clínico, uma lista de exames, um por linha, do mais novo ao mais
velho. Para responder às duas perguntas que o nutri faz antes de cada
retorno — **o plano está funcionando?** e **os exames melhoraram?** — ele
precisa ler a tabela e a lista e fazer a conta de cabeça.

Só o lado do paciente tem gráficos hoje (`components/charts.tsx`, recharts,
na Início, em Medidas e em Treinos).

## Critério de sucesso

Um nutricionista, sem explicação, abrindo a página de um paciente que
acompanha há alguns meses:

1. na aba Corpo, diz em poucos segundos se o peso está caindo, parado ou
   subindo desde o início do acompanhamento, e o que aconteceu depois de
   cada consulta;
2. distingue o que o paciente pesou em casa do que ele mesmo mediu na
   consulta;
3. vê cintura e % de gordura do mesmo jeito, quando houver ao menos duas
   medidas;
4. na aba Clínico, vê primeiro o exame que piorou, e para cada exame o
   último resultado contra o anterior, dito em palavras ("entrou na faixa",
   "mais perto da faixa", "saiu da faixa").

E nenhuma leitura que falha vira "sem dado" (regra do CLAUDE.md).

## O que foi decidido, e por quem

| Decisão | Quem |
|---|---|
| Dois projetos separados: gráficos do nutri primeiro; o visual do app do paciente depois (o incômodo lá é aparência, não registro). | Dono do produto |
| Os gráficos respondem a duas perguntas: "o plano está funcionando?" (peso, cintura, % de gordura) e "os exames melhoraram?". Adesão, engajamento e calorias contra a meta ficam fora. | Dono do produto |
| Peso: linha da **média semanal** das pesagens de casa, com as medidas da consulta como pontos destacados. | Dono do produto (recomendação aceita) |
| Exames: **comparativo** (último contra o anterior, em palavras) com **minigráfico** quando houver 3 resultados ou mais. | Dono do produto (recomendação aceita) |
| Os gráficos ficam **nas abas que já existem** (Corpo e Clínico), não numa aba nova nem no Resumo. | Dono do produto (abordagem A) |
| O desenho das maquetes, inclusive os números rotulados ("Peso atual … na consulta" no topo e "média da semana" no gráfico). | Dono do produto ("está certo") |
| Período: desde o início do acompanhamento, com teto de 12 meses. Consulta realizada marcada no tempo. | Meu, apresentado e aceito |
| Semana de segunda a domingo; um valor por dia (a última pesagem de casa do dia) antes da média. | Meu (abaixo, com o porquê) |
| Faixa de referência: a do laudo; sem ela, a da tabela do app (`lib/examRanges.ts`). | Meu, apresentado e aceito |
| Anel de progresso (o mesmo desenho do anel de calorias do app do paciente) **só** no "Meta de peso" da aba Corpo: quanto do caminho do peso inicial até a meta já foi feito. Não na Alimentação (seria a pergunta "está comendo o prescrito?", fora deste projeto), nem em pizza de macros. | Dono do produto (recomendação aceita) |

## Fora do escopo

- Calorias, proteína e água contra a meta; constância de registro; treinos
  contra o plano (perguntas que o dono do produto não escolheu agora).
- Minigráficos no Resumo (abordagem C): só depois de ver estes em uso.
- Gráficos no app do paciente (é o projeto seguinte, o do visual).
- Escolher o período (3 meses, 6 meses, tudo): um período só, até alguém
  pedir.
- Exportar o gráfico ou imprimir.
- Normalizar nomes de exame no banco: o agrupamento é feito na leitura
  (abaixo), sem migração.

## Dados

Nenhuma migração. Tudo sai do que já existe:

| Gráfico | Fonte |
|---|---|
| Peso (média semanal) | `body_measurements` do paciente com `measured_by` nulo e `weight_kg` preenchido, entre o início do período e hoje (`limitesDaJanela`) |
| Peso (pontos da consulta) | `body_measurements` com `measured_by` preenchido |
| Cintura e % de gordura | `body_measurements` com `waist_cm` / `body_fat_pct` preenchido, de casa e da consulta |
| Marcas de consulta | `appointments` realizadas do paciente no período (`getConsultasDoPaciente`) |
| Meta | a mesma regra da aba Corpo hoje: a prescrita, ou a do perfil se nunca houve prescrição |
| Início do período | `accepted_at` do vínculo ativo (nulo: `created_at`); se for mais de 12 meses atrás, 12 meses atrás |
| Exames | `exams` do paciente: `date`, `title`, `result_value`, `unit`, `reference_range`, `status` |

**A leitura do corpo é nova e separada da tabela:** a de hoje traz as 60
linhas mais recentes, e um ano de pesagem diária passa disso. A nova lê só o
período, com teto e piso de data (nunca `>=` sozinho; armadilha "Janelas de
N dias"). O teto de 1.000 linhas do PostgREST cobre quase três pesagens por
dia por um ano; se vier exatamente 1.000, conta como falha, para não
desenhar um ano cortado como se fosse inteiro.

**A leitura dos exames passa de 40 para 200 linhas:** o comparativo precisa
do resultado anterior de cada exame, e com 40 o anterior de um exame raro
pode ficar de fora. Exatamente 200 também conta como falha, pelo mesmo
motivo.

### Média semanal do peso

- **Semana de segunda a domingo**, pela coluna `date` (já é dia de São
  Paulo; nada de `toISOString().slice(0,10)`).
- **Um valor por dia antes da média**: a pesagem de casa mais recente do dia
  (`created_at`). Sem isso, um dia com três pesagens pesaria três vezes na
  semana.
- **Semana sem pesagem não tem ponto**, e a linha para nela (não liga as
  duas pontas: inventaria um valor).
- **A semana em curso entra** com o que tiver, e a dica diz "semana em
  curso".
- Medida da consulta **não entra na média**: é ponto à parte. No dia em que
  houver as duas, a de casa conta na média e a da consulta aparece como
  ponto.

### Comparativo dos exames

- **Mesmo exame, grafias diferentes:** a chave de cada exame é a entrada da
  tabela de `lib/examRanges.ts` a que o nome corresponde ("Glicose",
  "Glicemia de jejum" e "glicose em jejum" caem na mesma); nome fora da
  tabela vira a própria chave, sem acento, maiúscula nem pontuação. Exige
  exportar de `examRanges.ts` a busca que hoje é interna (`findDef`).
- **Valor:** o número que `parseExamNumber` tira do texto. Resultado sem
  número ("reagente", "negativo") fica fora do comparativo e do
  minigráfico, e aparece só na lista completa.
- **Unidades diferentes não se comparam:** se o anterior está em outra
  unidade (mg/dL contra mmol/L, depois de tirar espaço e caixa), a linha diz
  "unidade diferente do anterior" no lugar da variação. Comparar o número
  cru daria uma "melhora" falsa.
- **Faixa:** a do último resultado (`parseReferenceRange` do laudo; sem ela,
  a da tabela do app para o sexo e a idade do paciente). A mesma faixa vale
  para os dois valores, para a comparação não mudar de régua.
- **O que mudou**, pela distância de cada valor até a faixa (zero dentro):

  | Anterior | Último | Texto |
  |---|---|---|
  | dentro | dentro | segue na faixa |
  | fora | dentro | entrou na faixa |
  | dentro | fora | **saiu da faixa** |
  | fora | fora, mais perto | mais perto da faixa |
  | fora | fora, mais longe | **mais longe da faixa** |
  | fora | fora, igual | igual ao anterior |
  | sem faixa | — | só a diferença, "sem faixa para comparar" |
  | só um resultado | — | "primeiro resultado" |

- **Situação** (Normal, Atenção, Alterado): a gravada no último resultado
  (`exams.status`), com o mesmo selo e as mesmas cores da lista de hoje.
- **Ordem:** primeiro o que piorou (saiu da faixa, mais longe), depois o que
  segue fora (mais perto, igual), depois o resto (entrou, segue), depois os
  de um resultado só; dentro de cada grupo, o resultado mais recente
  primeiro.
- **Linha de resumo** acima da tabela: quantos melhoraram ou estão na
  faixa, quantos pioraram, quantos têm um resultado só.
- **Minigráfico** só com 3 resultados numéricos ou mais na mesma unidade; a
  faixa sombreada, cortada na borda do gráfico quando passa do que os
  valores ocupam.

## Telas

### Aba Corpo (maquetes 1 e 3)

- O topo continua como é: Peso atual (a última medida, de casa ou da
  consulta, dizendo qual), Variação em 30 dias, Meta de peso. **No dia com
  pesagem de casa e medida da consulta, vale a da consulta** (`pesoDoDia`,
  `lib/nutri.ts`), no Peso atual e na Variação em 30 dias
  (`montarResumos`): hoje os dois pegam uma das duas ao acaso, e o gráfico
  logo abaixo mostraria a outra. Fecha a pendência deixada pela revisão
  final do registro da consulta (CLAUDE.md diz que a regra vale em todo
  lugar; hoje só vale na série).
- **Anel no "Meta de peso"** (no lugar do "faltam N kg"): o anel com a
  parte do caminho já feita, e ao lado "66 kg · 50%" e "4,3 de 8,6 kg desde
  12/05", mais o link "editar nas metas" de hoje.
  - **Peso inicial:** o primeiro dia com peso no período, pela regra de
    `pesoDoDia` (no dia com as duas, a da consulta). **Atual:** o Peso atual
    do topo. Os dois pela mesma regra, para "4,3 de 8,6" bater com o Peso
    atual ao lado.
  - **Direção pela meta:** meta abaixo do inicial é perder; acima, ganhar. A
    conta é a mesma nos dois sentidos (quanto do caminho foi feito).
  - **Foi para o lado errado** (mais pesado que o inicial, querendo perder,
    ou o contrário): anel vazio e o texto "acima do peso inicial (+1,2 kg)"
    (ou "abaixo"), em `clin-atencao`.
  - **Passou da meta:** anel cheio e "meta atingida"; passou mais de 0,5 kg,
    "passou da meta em N kg".
  - **Sem anel**, só o texto de hoje: sem meta ("—" e "definir nas metas"),
    sem peso no período, ou meta igual ao peso inicial.
  - A meta é a de agora, mesmo que tenha mudado no meio do período: é a que
    o nutri vai cobrar.
  - Cores: arco `clin-primaria` sobre trilho `clin-linha`; `role="img"` com
    "Progresso até a meta: 4,3 de 8,6 kg, 50%". O `ProgressRing` do paciente
    usa a paleta do app dele (`slate`, cor por classe): a versão do nutri
    usa as variáveis do tema clínico, sem copiar a conta do arco.
- **Bloco "Evolução"**, entre o topo e "Ver medidas registradas":
  - **Peso:** título com "média da semana X kg · ±Y kg desde a 1ª semana"
    (a primeira semana com pesagem no período); legenda com "média da
    semana (casa)", "medida na consulta" e "meta"; linha da média em
    `clin-primaria`; ponto da consulta cheio, escuro (`clin-texto`) com
    anel do fundo; meta em traço `clin-campo` com o rótulo "meta N kg" na
    ponta; uma linha vertical fraca, tracejada, em cada consulta realizada;
    o aviso "sem pesagem" sobre a falha da linha; meses no eixo X.
  - **A meta só entra na escala se estiver perto dos dados** (até 5 kg além
    do menor ou do maior valor). Mais longe, a linha da meta some e o
    rótulo vira "meta N kg ↓" (ou ↑) no canto: com a meta 30 kg abaixo, a
    escala achataria a linha do peso numa faixa fina.
  - **Cintura e % de gordura**, lado a lado no computador e um embaixo do
    outro no celular, cada um só com 2 medidas ou mais; ponto cheio para a
    da consulta, vazado para a de casa; título com o último valor e a
    variação desde a primeira medida do período ("−7 cm", "−3,6 pontos").
  - **Dica** ao passar o mouse (no celular, ao tocar): na semana, o
    intervalo de datas, a média, quantos dias com pesagem e o menor e o
    maior; no ponto da consulta, a data e o valor.
- **Celular:** os três gráficos empilhados, legenda curta ("semana (casa)",
  "consulta", "meta"), 3 marcas no eixo Y, sem a caixa de dica fixa.

### Aba Clínico (maquete 2)

- Tratamento e Efeitos colaterais como são hoje.
- **Exames:** a linha de resumo, a tabela do comparativo (Exame com a
  faixa embaixo; Último com o selo e a data; Anterior com a data; O que
  mudou; Tendência, com o minigráfico ou "N resultados"), a nota da ordem e
  "Ver todos os resultados (N)", que abre a lista de hoje.
- A tabela rola dentro da própria caixa no celular, com foco de teclado,
  como a de "Medidas registradas".

### Pouco dado e falha (maquete 4)

- **Peso com menos de 2 semanas de pesagem e menos de 2 medidas de
  consulta:** no lugar do gráfico, "Ainda não dá para ver tendência", com o
  que há até agora (a consulta e a semana, com os valores).
- **Cintura ou % de gordura com menos de 2 medidas:** o gráfico não
  aparece, e uma linha diz qual ficou de fora.
- **Exames com um resultado cada:** a frase "Sem comparação ainda" e a
  lista de sempre, com a situação.
- **Leitura que falha:** o `ErroSecao` da aba, como hoje; nunca o "Ainda não
  dá para ver tendência".

### Cor, tema e acessibilidade

- Cores só do tema clínico, por variável (`var(--clin-primaria)` etc.),
  para o escuro funcionar sem segunda lista. Os pares do gráfico que ainda
  não estão em `PARES_GRAFICO` (`lib/temaClinico.ts`) entram lá, com o
  contraste de 3:1 testado nos dois temas: a linha da média sobre o fundo,
  o ponto da consulta sobre o fundo, a faixa sombreada do exame contra o
  fundo e o traço da meta.
- Cada gráfico é uma `figure` com `figcaption`; o SVG tem `role="img"` e um
  `aria-label` que diz o que o gráfico mostra em uma frase (início, fim,
  quantas consultas, meta), gerado por função testada. A tabela "Medidas
  registradas" e a lista de exames continuam sendo a versão em texto.
- Identidade nunca só pela cor: casa é linha, consulta é ponto; selo de
  exame sempre com a palavra.

## Erros

- Qualquer leitura da aba que falha mostra o erro da aba, não um gráfico
  vazio nem "Ainda não dá para ver tendência".
- Leitura que volta cheia (1.000 linhas do corpo, 200 de exames) conta
  como falha, com o mesmo erro.
- Exame com valor sem número, unidade diferente do anterior ou sem faixa:
  dito na linha, nunca escondido nem comparado errado.

## Datas e fuso

- A semana e o eixo X saem da coluna `date` (dia de São Paulo).
- A marca da consulta usa `diaDaConsulta(starts_at)`, nunca
  `starts_at.slice(0,10)`.
- O início do período (`accepted_at`) é um instante: vira dia com
  `dataNoBrasil`.
- "Hoje" é `todayISO()`; a janela é `limitesDaJanela`.

## Testes

- **Unitários (vitest), lógica pura em `lib/`:**
  - semana de segunda a domingo nas bordas (domingo e segunda, virada de
    mês e de ano);
  - um valor por dia (o mais recente por `created_at`) antes da média;
  - semana sem pesagem vira lacuna, não zero nem interpolação;
  - medida da consulta fora da média e como ponto;
  - meta dentro ou fora da escala (5 kg);
  - o anel da meta: perder e ganhar, lado errado, meta atingida e passada,
    sem meta, meta igual ao inicial, peso inicial e atual pela regra de
    `pesoDoDia`;
  - "desde a 1ª semana" e a variação de cintura e % de gordura;
  - a frase do `aria-label`;
  - chave do exame (grafias da tabela juntas; nome fora da tabela pela
    forma normalizada);
  - as oito linhas da tabela "O que mudou", unidade diferente, valor sem
    número, sem faixa;
  - a ordem do comparativo e a linha de resumo;
  - minigráfico só com 3 resultados na mesma unidade.
- **Contraste:** os pares novos em `lib/temaClinico.test.ts`.
- **Tela (`ferramentas/tirar-prints-nutri.cjs`, uma Verificação nova):**
  o anel da meta com a porcentagem e o "N de M kg"; o bloco Evolução com a
  linha, os pontos da consulta, a lacuna e a meta;
  cintura e % de gordura; a dica no hover; o comparativo na ordem certa; o
  minigráfico só onde há 3 resultados; pouco dado; leitura que falha
  (`/__falhar`); celular sem transbordo; tema escuro. O Supabase falso
  ganha um paciente com meses de pesagem, lacuna e consultas, e exames com
  histórico (inclusive grafias diferentes e unidade diferente), sem mexer
  nos números que as verificações antigas conferem.

## Riscos

- **Nenhum nutricionista real usou** (CLAUDE.md, Em aberto). Os dois
  gráficos foram escolhidos pelo dono do produto, não por quem atende.
- **Nome de exame fora da tabela** não se junta com outra grafia: "Vit D"
  e "Vitamina D 25-OH" só se juntam se a tabela tiver as duas. O efeito é
  um exame aparecer duas vezes, cada um com um resultado.
- **Faixa do laudo mal escrita** (texto que `parseReferenceRange` não lê)
  cai na faixa da tabela, que pode diferir da do laboratório.
- **recharts** já está no projeto, mas entra pela primeira vez na página do
  nutri: o peso do pacote cai só nas abas Corpo e Clínico, que são as que
  montam os gráficos.
