# O uso pretendido da IA: constatar e explicar, sem julgar exame nem orientar tratamento

Data: 27/10/2026. Desenho aprovado pelo dono do produto em conversa, em três
partes e uma revisão da Gaia. É o "passo 2" da conversa sobre a ANVISA: fazer o
app bater com o uso pretendido antes de declarar o uso pretendido.

## Por quê

- **O app julga exame para o paciente em seis lugares,** e quem deveria julgar é
  a nutricionista:
  - a leitura do laudo (`app/api/analyze-exam`) devolve "interpretação" e
    "recomendações";
  - o `classifyExam` (`lib/examRanges.ts`) põe a tabela do próprio app antes da
    faixa do laudo, com faixas por sexo e idade e o nível "atenção", e escreve
    "Vale acompanhar… confirme com um médico";
  - a página Exames pinta Normal, Atenção ou Alterado com essa tabela;
  - a Gaia responde "normal" ou "alterado" por curiosidade (`avaliar_exame`),
    recebe "Exames alterados recentes" no contexto e orienta quem usa a caneta
    GLP-1 ("priorize proteína…");
  - os insights da tela Saúde ligam "um exame alterado a um padrão da dieta" e
    dizem "o que fazer";
  - os Relatórios recebem os exames e mandam "procurar um médico" para as
    alterações.
- **A RDC 657/2022 separa o software de bem-estar do software destinado a
  prevenção, diagnóstico ou tratamento.** O que decide é o que o software faz, e
  não o aviso que o acompanha. Interpretar exame e recomendar conduta ao
  paciente é o que aproxima o app de um "software como dispositivo médico".
- **O produto que se vende já diz isso:** a fila mostra, a nutricionista decide.
  Nenhum comprador do painel pediu "a IA explica o meu exame".

## Decisões do dono do produto (26 e 27/10)

| decisão | escolha |
| --- | --- |
| até onde vai o corte | exames e tratamento, em todo lugar que o paciente vê; a dica de alimentação da Gaia fica para depois |
| a faixa na tela da nutricionista | a do laudo, e a tabela do app como apoio só para ela, quando o laudo não tem faixa (como o comparativo já faz) |
| insights da tela Saúde e Relatórios | ficam, sem exame e sem tratamento |
| a Gaia e o exame | pode constatar e explicar o que o exame mede; não pode diagnosticar |
| de onde vem a explicação | da IA, dentro das regras |
| onde a explicação aparece | na Gaia e nas telas (leitura do laudo e página Exames) |

## A regra

**Para o paciente, o app constata e explica; não julga nem orienta.**

| pode | não pode |
| --- | --- |
| mostrar o valor, a unidade, a data e a faixa impressa no laudo | dizer o que o resultado indica sobre a saúde dele: causa, doença, risco, "pode ser…" |
| dizer se o valor está dentro, acima ou abaixo da faixa do laudo | chamar o resultado de bom, ruim, normal, alterado ou preocupante |
| explicar, em termos gerais, o que o exame mede | sugerir conduta: comida, suplemento, remédio, exame novo |
| dizer que quem interpreta é a nutricionista (ou o médico que pediu) e oferecer mandar a pergunta a ela | orientar sobre o tratamento com remédio (a caneta GLP-1 inclusive) |

O juízo clínico fica com a nutricionista. A tela dela não muda.

## O que entra

### 1. Duas regras, uma para cada lado

**`situacaoNoLaudo(valor, referencia)`**, em `lib/examRanges.ts`, para o
paciente:

```ts
export type SituacaoNoLaudo = "dentro" | "acima" | "abaixo" | "sem faixa";
export function situacaoNoLaudo(
  valor: unknown,
  referencia: unknown
): { situacao: SituacaoNoLaudo; faixa: string | null };
export function textoDaSituacaoNoLaudo(s: { situacao: SituacaoNoLaudo; faixa: string | null }): string;
```

- Lê a faixa com `parseReferenceRange` e compara com `dentroDaFaixa`; o "<" e o
  ">" são estritos, como hoje.
- Dá "sem faixa" quando:
  - a referência não é texto;
  - a referência é, letra por letra, um texto da tabela do app (`ehTextoDaTabela`);
  - a referência vem em níveis (sexo, idade, fase, risco), e o
    `parseReferenceRange` devolve nulo;
  - o valor não é número.
- **Os textos:**
  - "dentro da faixa do laudo (70 a 99 mg/dL)";
  - "acima da faixa do laudo (…)" e "abaixo da faixa do laudo (…)";
  - "sem faixa do laudo".
- Nunca usa a tabela do app.

**`situacaoParaANutricionista(resultado, ctx)`**, em `lib/exames.ts`, para a
nutricionista:

```ts
export function situacaoParaANutricionista(
  r: { titulo: string; valor: unknown; unidade: string | null; referencia: string | null },
  ctx: ExamContext
): { situacao: ExamLevel | null; faixa: string | null; fonte: "laudo" | "tabela" | null };
```

- É a regra do `faixaDoUltimo` de hoje, tirada para fora:
  1. primeiro a faixa do laudo (se não for texto da tabela), com dentro
     "normal" e fora "alterado";
  2. senão, a tabela do app (`faixaDaTabela`), na unidade dela e com o sexo
     quando o exame depende dele, com os três níveis da entrada;
  3. senão, nenhuma.
- O `faixaDoUltimo` passa a chamá-la. O comparativo do Clínico não muda na
  tela.

**O `classifyExam` sai.** Os três que o chamam (a página Exames, a rota do laudo
e a Gaia) passam a usar as duas regras acima. Sai junto o `explain` e o texto
"Isto é uma orientação geral — confirme com um médico". A regra estrita de nome
(`entradaDaTabela`, `chaveDoExame`, `faixaDaTabela`) fica.

### 2. O que se grava num exame novo

**`exameParaGravar(entrada, ctx)`**, em `lib/exames.ts`. É a linha que as três
entradas gravam (o laudo lido, o formulário e a Gaia):

```ts
export function exameParaGravar(
  e: { titulo: string; valor: string | null; unidade: string | null; referencia: string | null;
       data: string; tipo: string | null; notas: string | null },
  ctx: ExamContext
): { title: string; result_value: string | null; unit: string | null; reference_range: string | null;
     status: ExamLevel | null; notes: string | null; date: string; exam_type: string | null };
```

- **`reference_range`:** a faixa como veio do laudo ou como a pessoa digitou,
  aparada. Nunca o texto da tabela por cima. Hoje a IA sobrescreve a faixa do
  laudo; isso está no "Em aberto".
- **`status`:** a `situacaoParaANutricionista`, com nulo quando não há faixa.
  - A fila conta `status` diferente de "normal" (`lib/nutri.ts`), e o nulo não
    entra.
  - É o que mantém a fila dizendo "exame fora da referência".
- **`notes`:** só o que a pessoa escreveu. Nenhuma explicação automática.
- O `user_id` fica com quem chama.

### 3. A leitura do laudo (`app/api/analyze-exam`)

- **O prompt pede só a transcrição**, para cada resultado: nome, valor, unidade e
  a faixa como está impressa. Não pede resumo, interpretação, recomendação nem
  `status`.
- **O servidor passa a resposta por `transcricaoDoLaudo(json)`,** em
  `lib/laudo.ts`:

  ```ts
  export type ItemTranscrito = { nome: string; valor: string | null; unidade: string | null; referencia: string | null };
  export function transcricaoDoLaudo(json: unknown): ItemTranscrito[];
  ```

  - fica só com esses quatro campos, em texto (número vira texto, o resto vira
    nulo);
  - descarta o item sem nome;
  - qualquer coisa que não seja `{ itens: [...] }` vira lista vazia.
- **Sai a reclassificação pela tabela.** A rota devolve `{ itens }` e mais nada.
- **Na tela, antes de salvar:**
  - a lista transcrita, cada linha com o `textoDaSituacaoNoLaudo` e um "O que
    é?" (seção 5);
  - saem o resumo, a "Interpretação", as "Recomendações" e o selo de situação.
- **Ao salvar:** cada linha passa por `exameParaGravar`, com o sexo e a idade do
  perfil.

### 4. A página Exames do paciente (`app/app/exames/page.tsx`)

**A lista:**
- cada exame mostra nome, valor, unidade, data, a faixa do laudo e o
  `textoDaSituacaoNoLaudo`;
- "acima" e "abaixo" vão em `app-atencao`; "dentro" e "sem faixa", em
  `app-texto-2`;
- e um "O que é?".

**O que sai:**
- o selo Normal, Atenção ou Alterado;
- a contagem por selo;
- o `status` gravado. A página não lê mais esse campo, e os exames antigos
  também passam a ser mostrados pela faixa do laudo, calculada na hora.

**As notas antigas.** Os exames gravados antes podem ter em `notes` a
explicação automática do `classifyExam` ("Resultado acima da faixa de
referência (…). Vale acompanhar. Isto é uma orientação geral — confirme com um
médico.").
- A página mostra as notas pela função `semExplicacaoAutomatica(notes)`, em
  `lib/exames.ts`.
- Ela tira as frases desses modelos, que eram fixos:
  - "Resultado dentro/acima/abaixo da faixa de referência (…).", com o "Vale
    acompanhar." que podia vir depois;
  - "Resultado … da referência informada (…).", com o "Confirme com um médico."
    que podia vir depois;
  - "Isto é uma orientação geral — confirme com um médico para avaliação.";
  - "Para avaliar … eu preciso saber o sexo …";
  - "Dica: informe seu sexo no perfil para uma faixa mais precisa.";
  - "Atenção: faixas de adulto; …".
- Também tira o " — " que ligava a nota do paciente à explicação. O que a pessoa
  escreveu fica.

**O formulário:**
- sai o seletor de situação, que o paciente marcava;
- sai o preenchimento da referência com o texto da tabela, que foi o que criou a
  necessidade do `ehTextoDaTabela`;
- a faixa é a que o paciente digitar, e embaixo aparece o
  `textoDaSituacaoNoLaudo` enquanto ele digita;
- grava por `exameParaGravar`.

**O aviso** "não substitui a avaliação de um médico" fica.

### 5. "O que é?": a explicação do exame nas telas

**A rota nova `app/api/explicar-exame`** (POST `{ nome }`):
- pede usuário logado e um nome de 1 a 80 caracteres;
- **manda à IA só o nome do exame**, montado por `pedidoDaExplicacao(nome)`
  (`lib/explicacaoDeExame.ts`), uma função que só recebe o nome. A explicação
  não tem como falar do resultado do paciente, porque a IA não o conhece;
- o pedido diz:
  - uma ou duas frases, para leigo, sobre o que o exame mede;
  - sem valores, doenças, causas, riscos, nem o que fazer;
  - se não reconhecer o nome, responder exatamente "NÃO RECONHEÇO";
- usa a Groq (Llama 3.3 70B), como a Gaia;
- devolve `{ texto }`.

**A checagem `explicacaoAceitavel(texto)`,** em `lib/explicacaoDeExame.ts`:
- recusa o texto que tenha, sem diferenciar maiúscula nem acento: "risco",
  "doença", "pode indicar", "indica", "sinal de", "diagnóst", "tratament",
  "remédio", "medicament", "suplement", "deve", "recomend", "procure", "normal",
  "alterad";
- a lista é conservadora de propósito: perde uma explicação boa de vez em
  quando, mas não mostra uma ruim.

**O que a rota devolve:**

| caso | texto |
| --- | --- |
| a IA respondeu "NÃO RECONHEÇO" | "Não reconheço este exame pelo nome. Pergunte à sua nutricionista." (`TEXTO_NAO_RECONHECIDO`) |
| a explicação foi recusada | "Não deu para explicar este exame agora." (`TEXTO_SEM_EXPLICACAO`) |
| senão | a explicação, aparada |

**O componente `components/OQueEOExame.tsx`** (cliente):
- um botão "O que é?", com 44 px de altura, que abre a explicação embaixo da
  linha;
- embaixo da explicação, em `app-texto-2`: "Explicação geral, escrita por IA. Não
  fala do seu resultado.";
- enquanto carrega, "Carregando…";
- se a rota falhar, "Não deu para carregar a explicação.", e tocar de novo tenta
  outra vez;
- **nada é gravado:** cada toque pede de novo. Guardar as explicações pediria
  uma tabela e uma migração;
- a nutricionista não vê o componente.

### 6. A Gaia (`app/api/chat/route.ts` e `lib/aiActions.ts`)

**O `avaliar_exame` vira `ler_exame`,** uma ferramenta de leitura que não grava:
- **parâmetros:** `nome` (obrigatório), `valor`, `unidade` e `referencia`
  (opcionais);
- **com `valor`:** responde sobre o valor que o paciente digitou, sem salvar,
  pela `situacaoNoLaudo` com a referência que ele deu, ou "sem faixa do laudo";
- **sem `valor`:** lê os exames do paciente cujo nome casa com o pedido (pela
  `chaveDoExame`, ou pelo nome contido no título) e devolve os 3 mais recentes,
  cada um no formato: "LDL-c: 180 mg/dL em 12/03/2026, acima da faixa do laudo
  (até 130)";
- **sem nenhum:** "Não achei esse exame nos seus registros.";
- **a constatação sai do código,** e a tabela do app nunca entra.

**O `registrar_exame`:**
- grava por `exameParaGravar`, com o sexo e a idade do perfil, sem perguntar;
- perde os parâmetros `sexo` e `idade`, que só serviam para julgar;
- responde "Exame "X" registrado na aba Exames.", sem "Normal" nem "Alterado".

**O contexto e o tratamento:**
- sai o "Exames alterados recentes" e a leitura de exames que o alimentava;
- o bloco da caneta continua dizendo o remédio, a dose e a frequência, porque a
  Gaia registra as doses;
- o "ORIENTE de acordo: priorize proteína…" troca por: "Não oriente sobre o
  tratamento; dúvidas sobre ele vão ao médico que acompanha."

**O prompt:**
- sai "Exames, saúde e tratamento: tom calmo e confiável de especialista —
  explique simples e reforce procurar um profissional";
- sai a regra de "EXAMES" com o `avaliar_exame`;
- entra a regra da seção "A regra", com os dois exemplos:
  - **pode:** "O LDL é uma das formas de colesterol que circula no sangue. O seu
    deu 180 mg/dL, acima da faixa que o laudo traz (até 130). Quem interpreta é
    a sua nutricionista. Quer que eu mande a pergunta para ela?";
  - **não pode:** "Seu LDL está alto, isso aumenta o risco cardiovascular; corte
    as frituras.";
- diante de dúvida sobre resultado ou tratamento, ela oferece o
  `falar_com_nutricionista`. Sem nutricionista, diz para levar ao médico que
  pediu o exame.

**O que fica:** a dica de alimentação (porções, substituições) e os treinos que
ela monta sem prescrição ficam como estão. Vão para o "Em aberto".

### 7. Insights da tela Saúde e Relatórios

- **`app/api/insights`:**
  - deixa de ler `exams` e `treatments`;
  - o prompt perde o "exames" e o "tratamento" da lista de áreas e o exemplo
    "ligar um exame alterado a um padrão da dieta";
  - as áreas ficam "Dieta|Treino|Hábitos|Peso|Geral".
- **`app/api/report`:**
  - deixa de ler `exams`;
  - o prompt perde o "Para alterações em exames, recomende procurar um
    médico/nutricionista";
  - as áreas ficam "Dieta|Treino|Hábitos|Medidas|Geral".
- **A regra nova nos dois prompts:** "Não fale de exames nem de medicamentos e
  não tire conclusão sobre a saúde da pessoa: fale de hábitos, registros e
  metas."
- **As telas:**
  - **Saúde:** o subtítulo vira "A IA conecta sua dieta, treino e hábitos e
    mostra o que importa.", e saem os ícones de "Exames" e "Tratamento" do
    `AREA_ICON`;
  - **Relatórios:** o texto vira "A IA analisa seus treinos, dieta, hábitos e
    medidas dos últimos…";
  - o rodapé "exames alterados ou dúvidas sobre medicação, procure seu médico"
    fica.

## O que não muda

- **A tela da nutricionista:**
  - o comparativo do Clínico (só passa a chamar a função extraída);
  - a fila, que conta o `status` gravado;
  - a linha do tempo e o "Ver todos os resultados", que mostram o `status`
    gravado.
- **O banco:** não há migração.
- **A estimativa de calorias pela foto do prato** (`app/api/analyze-meal`), que é
  bem-estar.
- **A página Tratamento**, que só registra doses e efeitos.

## Testes

**Unitários, escritos antes (vitest):**
- **`situacaoNoLaudo` e `textoDaSituacaoNoLaudo`:**
  - dentro, acima e abaixo, com o "<" e o ">" estritos e o "a–b" inclusivo;
  - dão "sem faixa": a referência em níveis, o texto da tabela, o valor sem
    número, a referência que não é texto e a referência vazia;
  - nunca a tabela.
- **`situacaoParaANutricionista`:**
  - os testes do `classifyExam` que ainda valem passam para ela: o nome pela
    regra estrita, a unidade e a referência que não são texto, a falta do sexo;
  - os que supunham a tabela antes do laudo mudam para o laudo primeiro, como a
    B12 de 235 pmol/L com laudo de 148 a 664, que fica "normal";
  - os testes do comparativo passam sem mudança.
- **`exameParaGravar`:**
  - grava a faixa do laudo, nunca o texto da tabela;
  - o `status` vem da regra da nutricionista, e é nulo sem faixa;
  - `notes` só com o que a pessoa escreveu.
- **`transcricaoDoLaudo`:**
  - fica só com os quatro campos;
  - número vira texto;
  - descarta o item sem nome e joga fora resumo, interpretação, recomendação e
    `status`;
  - o que não é `{ itens: [...] }` vira lista vazia.
- **`semExplicacaoAutomatica`:**
  - tira cada uma das frases-modelo e o " — " que ligava;
  - mantém a nota do paciente;
  - a nota sem frase-modelo volta igual.
- **`explicacaoAceitavel`:**
  - aceita "O LDL é uma das formas de colesterol que circula no sangue.";
  - recusa as frases com risco, doença, "pode indicar", "procure" e "normal",
    com e sem acento.
- **`pedidoDaExplicacao(nome)`:** o pedido tem o nome e as proibições; a função
  não recebe valor nem faixa (garantido pelo tipo).
- **A Gaia, contra um banco falso:**
  - o `ler_exame` devolve a situação pelo laudo, "sem faixa do laudo" sem faixa,
    nunca a tabela, e "Não achei…" sem exame;
  - o `registrar_exame` grava por `exameParaGravar` e responde sem "Normal" nem
    "Alterado";
  - o `avaliar_exame` dá "Ação desconhecida.";
  - o `AI_TOOLS` não tem `avaliar_exame` e não tem `sexo` nem `idade` no
    `registrar_exame`.
- **Uma guarda de texto, `lib/usoPretendido.test.ts`,** como a do nome: nenhum
  arquivo de `app/api/` nem o `lib/aiActions.ts` (onde moram as ferramentas da
  Gaia) contém "avaliar_exame", "interpretacao", "recomendacoes" nem "ORIENTE de
  acordo". Hoje elas aparecem na rota do laudo, na do chat e no
  `lib/aiActions.ts`.

**De tela:**
- `tirar-prints.cjs` nas telas Exames, Saúde e Relatórios do paciente, com os
  prints olhados: sem selo, com "O que é?" e os textos novos;
- o "O que é?" aberto com a rota no ar, olhado no print. Sem a chave da Groq no
  ambiente de teste, a tela mostra "Não deu para carregar a explicação.", e esse
  caso também se olha;
- `tirar-prints-nutri.cjs` passando como hoje, o que prova que o Clínico não
  mudou.

**Por fim:** `npm test`, o typecheck e o `npm run build`, com o dev parado.

## Documentação

**No `CLAUDE.md`:**
- **uma seção curta, "Uso pretendido",** com "A regra" desta spec:
  - o app constata e explica e não julga exame nem orienta tratamento para o
    paciente;
  - o juízo é da nutricionista;
  - IA nova segue essa regra;
  - a explicação das telas só recebe o nome do exame;
- a parte dos exames atualizada: sai o `classifyExam`; entram
  `situacaoNoLaudo`, `situacaoParaANutricionista` e `exameParaGravar`; "a faixa
  gravada é a do laudo";
- a lista de lógica testada;
- **no "Em aberto":**
  - o item dos exames antigos diminui: o paciente já não vê o `status` antigo,
    mas a nutricionista vê;
  - entram a dica de alimentação e os treinos da Gaia (decidir), a explicação
    sem cache, o risco da Gaia em texto livre e o parecer da ANVISA.

**No `founder/ops.md`:** o item da ANVISA diz que o passo 2 está feito e que o
parecer formal segue em aberto.

## Fora do escopo

- **A dica de alimentação da Gaia** (porções, substituições) e os treinos que ela
  monta sem prescrição. Pedem uma spec própria, que também olhe a atribuição
  privativa do nutricionista.
- **Recalcular o `status` dos exames antigos**, que pede uma migração.
- **A data de hoje que a IA grava** quando não acha a do laudo.
- **Guardar as explicações** do "O que é?".
- **Os termos de uso e o parecer da ANVISA** (os passos 1 e 3).

## Riscos

- **A Gaia pode ainda escrever uma interpretação em texto livre**, porque o
  prompt orienta, mas não garante.
  - O que fica garantido em código: ela não tem ferramenta que julgue, a
    constatação vem calculada e os valores dos exames não estão no contexto.
  - Mas, ao ler um exame pelo `ler_exame`, ela vê o valor.
  - As telas não têm esse risco: a explicação delas só recebe o nome.
- **A checagem de palavras não pega tudo.** "LDL alto entope as artérias" passa
  pela lista. É uma rede, não uma garantia, e a lista se aumenta quando aparecer
  um caso.
- **Nos exames antigos, paciente e nutricionista podem ver juízos diferentes.** O
  paciente vê pelo laudo; a nutricionista vê o `status` antigo, que veio da
  tabela.
- **Custo:** cada "O que é?" é uma chamada à Groq, de centavos, sem limite por
  usuário. Entra na revisão de sexta (`founder/ops.md`, 4.6).

## Apêndice: o texto de uso pretendido, para os termos de uso

Para o advogado (o passo 1), e só depois que esta spec estiver no ar:

> O Pace Fit é uma ferramenta de registro e acompanhamento entre consultas. O
> paciente registra o que come, a água, o peso, o treino e os exames, e a
> nutricionista vê esses registros. O app mostra cada resultado de exame com a
> faixa impressa no laudo e explica, em termos gerais, o que cada exame mede. O
> app não faz diagnóstico, não interpreta resultados, não trata nem prescreve:
> metas, cardápio e treino são definidos pela nutricionista, e a assistente
> registra o que o paciente informa, sem mudar o que ela prescreveu.

O nome vem de `lib/marca.ts` quando o texto for para o app.
