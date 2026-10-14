# Visual do app: calmo e confiável

Data: 14/10/2026. Mockups aprovados pelo dono do produto:
https://claude.ai/artifact/7SmiUSxW7mjpUYdNpdpqRS (Início reorganizada, a
linguagem nova e a Dieta, no celular).

## Por quê

O dono do produto achou o app do paciente "genérico/amador" e
"carregado/bagunçado". As causas, medidas no código:

- **Cor sem função.** Fora da página clínica há violeta, azul, âmbar e rosa
  decorativos em 30 arquivos: o anel de água é azul, o de proteína é rosa, o
  relatório é roxo e os macros são três cores sem relação.
- **Caixa dentro de caixa.** O "Hoje" é um cartão tingido com faixa à
  esquerda, e dentro dele há outros cartões com borda. Cada nível soma borda
  e come largura numa tela de 390 px.
- **Efeito em vez de hierarquia.** O botão principal tem degradê com brilho
  verde, os cartões têm sombra dupla, o fundo tem um brilho radial, e os
  rótulos vêm em CAIXA ALTA pequena.
- **Duas letras.** Inter no texto e Sora nos títulos, enquanto o lado clínico
  já usa Instrument Sans.

A direção escolhida foi "calmo e confiável", com a abordagem A: a
linguagem nova no app inteiro mais a Início reorganizada. A letra muda nos
dois lados ("pode trocar nos dois lados").

## Decisões

| Decisão | Origem | Custo se estiver errada |
|---|---|---|
| Instrument Sans no app inteiro, uma família só. Sai Inter + Sora. | Dono do produto | Quebras de linha mudam em todas as telas. As fotos de tela pegam. |
| Uma cor principal (#0e5d34 claro / #3fd27b escuro), a mesma do lado clínico. Neutros, aviso e perigo. Sem cor decorativa. | Mockup aprovado | Telas ficam "verdes demais" ou monótonas. Ajusta-se no token, não tela a tela. |
| Cartão de um nível só: borda fina, cantos de 14, sem sombra, sem degradê, sem faixa à esquerda. Dentro, linhas separadas por traço, nunca outro cartão. | Mockup aprovado | — |
| **A consulta sobe para o topo da Início, como uma linha só.** As ações (pedir, remarcar, cancelar) ficam em "Meu plano". Isso muda a spec da agenda, que punha o cartão inteiro "na Início e em Meu plano", e o comentário que o punha "depois do Hoje". | Mockup aprovado; a mudança das ações é decisão desta spec | Cancelar ou remarcar custa um toque a mais. A data, que é o que se procura, fica à vista sem rolar. |
| Sem consulta marcada, a Início não mostra a linha. "Pedir consulta" fica em "Meu plano". | Esta spec | Quem quer pedir tem de achar "Meu plano", que é o segundo item da barra. |
| O cardápio de hoje vira uma linha que leva à Dieta, onde o plano mostra "Comi isso". Hoje ele abre no lugar, num `<details>`. | Mockup aprovado | Um toque a mais para registrar a refeição a partir da Início. |
| Saem da Início o cartão "Treinos recentes", o cartão do relatório (roxo) e o "Fale com a Gaia". Os dois primeiros viram links. A Gaia fica só no botão flutuante. | Mockup aprovado | Some a frase que explica o que a Gaia faz ("registra treino, refeição, água e peso por você"). |
| Saem do bloco Progresso "Treinos (7 dias)" e "Sono hoje". Entra a variação de 30 dias. | Mockup aprovado | O sono do dia só fica em Hábitos. |
| "Acima da meta" em cor de aviso **só nas calorias**. Água e proteína acima da meta fecham o anel sem aviso. | Esta spec, refinando o mockup ("passou da meta: aviso") | — Beber mais água do que a meta não é problema, e pintar isso de laranja ensinaria o contrário. |
| "Recado de Ricardo" na Início e "de Ricardo, seu nutricionista" na Dieta, com **de**, não do/da. | Esta spec, corrigindo o mockup ("Recado do Ricardo") | — O app não sabe o gênero de quem prescreve e não o adivinha pelo nome. |
| A landing só recebe a letra. Seus degradês e animações ficam até ela ser reescrita para nutricionistas (Em aberto no CLAUDE.md). | Esta spec | Por um tempo, a landing e o app falam visuais diferentes. |

## A linguagem

### Letra

- **Família:** Instrument Sans, pesos 400, 500, 600 e 700, carregada uma vez
  no layout raiz (`app/layout.tsx`, `next/font`). `font-sans` e
  `font-display` apontam para ela; `font-display` continua existindo só para
  a landing compilar e deixa de significar Sora.
- **O lado clínico:** `TemaClinico` deixa de carregar a fonte própria
  (`--font-clinico` passa a ser a mesma da raiz). A regra
  `:where(.tema-clinico) :is(h1, h2, h3)` sai, porque o título global passa a
  ser igual a ela (Instrument Sans, `letter-spacing: -0.01em`, sem
  `font-feature-settings`). O lado clínico não muda na tela. As 527
  verificações de `tirar-prints-nutri.cjs` continuam passando.
- **Tamanhos:** título da tela 24, título de seção 17 (semibold), texto e
  lista 15, apoio, datas e unidades 13.
- **Sem caixa alta.** Rótulo é frase normal. A classe `.eyebrow` é refeita
  sem `uppercase` nem `tracking`, e os `uppercase tracking-*` soltos nas telas
  do app saem. A landing fica como está, inclusive o menu dela
  (`MobileMenu`).

### Cor

A paleta mora em `lib/temaApp.ts`, como a clínica: em TypeScript para o
contraste ser testável, e servida como variáveis CSS `--app-*` em `:root` e
`.dark`. Com o par dentro da variável, a classe não precisa de `dark:`. O
Tailwind gera `app.*` (`bg-app-pagina`, `text-app-texto-2`...) a partir da
lista de nomes, como já faz com `clin.*`. Os papéis comuns aos dois lados
**importam os valores de `TEMA_CLINICO`** (import relativo, pelo mesmo
motivo do `tailwind.config.ts`). Assim, "a mesma principal do lado do
nutricionista" fica garantida pelo código, e não por duas listas que
concordam por enquanto.

| Nome | Claro | Escuro | Uso |
|---|---|---|---|
| `pagina` | #f6f7f6 | #070b09 | fundo da página (o "chão" do mockup) |
| `cartao` | = clínico `chao` (#ffffff) | = clínico `chao` (#0c1210) | superfície do cartão, da barra e do menu |
| `texto`, `texto-2`, `linha`, `campo` | = clínico | = clínico | texto, apoio, divisória, borda de campo |
| `primaria`, `sobre-primaria`, `primaria-fundo` | = clínico (#0e5d34, #ffffff, #e7f3ec) | = clínico (#3fd27b, #062e1a, #16291f) | ação, dado, selo |
| `atencao`, `atencao-fundo`, `atencao-texto-2` | = clínico | = clínico | atrasado, acima da meta |
| `perigo`, `perigo-fundo` | = clínico | = clínico | erro |
| `macro-proteina`, `macro-carbo`, `macro-gordura` | #0e5d34, #5c9a76, #b9dbc6 | #3fd27b, #2a8a55, #1d5538 | barra de macros |

**Pares testados** (`lib/temaApp.test.ts`, nos dois temas, com
`razaoContraste` de `lib/contraste.ts`):

- **Texto, 4,5:1:** `texto`, `texto-2` e `primaria` sobre `cartao` **e sobre
  `pagina`**. Há texto direto no chão: a data, o "Bom dia" e os títulos de
  seção fora do cartão. Também `sobre-primaria` sobre `primaria`;
  `primaria` e `texto-2` sobre `primaria-fundo`; `atencao`, `texto` e
  `atencao-texto-2` sobre `atencao-fundo`; `atencao` sobre `cartao`; e
  `perigo` sobre `perigo-fundo` e sobre `cartao`.
- **Gráfico, 3:1:** `primaria` sobre `linha`, que é o anel sobre o trilho.
  Também `campo` sobre `cartao` e sobre `pagina`.
- **Macros:** entre vizinhos (proteína com carbo, carbo com gordura), 2:1,
  para se distinguirem um do outro. Contra o fundo os tons claros não passam
  de 3:1 (#b9dbc6 dá 1,5:1 sobre branco), e isso é aceito de propósito: a
  barra é redundante, porque a legenda ao lado dá nome e gramas de cada
  macro em texto. O teste registra a exceção num comentário, como os pares
  clínicos.

Conferidos à mão antes de escrever a spec: `texto-2` sobre `pagina` dá 7,04
no claro e 8,89 no escuro; `campo` sobre `pagina` dá 3,12 e 3,46. **A
armadilha:** `text-slate-500`, usado hoje em todo texto de apoio, dá 4,76
sobre branco, mas **4,43 sobre a `pagina` clara**, abaixo de 4,5. Texto
direto no chão usa `app-texto-2`, nunca `slate-500` (e `slate-400` já
reprova hoje, com 2,56 sobre branco).

**Cor com função, e só ela.** Sai a cor que só decora: os ícones em
quadrado violeta e azul, os `accent` do `StatCard` (todos passam a ser
`primaria-fundo` e `primaria`), os anéis de água e proteína em azul e rosa,
os macros em rosa, azul e âmbar, o número do Score colorido por faixa, os
pontinhos rosa e âmbar das pendências, e todo `bg-gradient-*`, sombra
colorida e brilho. **Fica a cor que significa algo**: erro (rosa) e aviso
(âmbar). Nas telas que esta spec reescreve (Início e Dieta), erro e aviso
passam aos tokens `perigo` e `atencao`. Nas outras, os pares rosa e âmbar
que já passam no contraste podem ficar nesta rodada.

**O corpo da página:** fundo `app-pagina`, sem o brilho radial (claro e
escuro), e seleção de texto em `primaria-fundo`. `themeColor` do viewport e
`theme_color` do manifesto passam a #0e5d34; `background_color` do
manifesto, que é a tela de abertura do app instalado, passa a #f6f7f6.

### Cartão, linha, botão, campo

As classes globais de `app/globals.css` são refeitas com as variáveis
`--app-*`, na mesma `@layer components`. As cópias clínicas sob
`:where(.tema-clinico)` continuam depois e continuam vencendo lá dentro.

- `.card`: `app-cartao`, borda de 1 px `app-linha`, cantos de 14 px, sem
  sombra, com o mesmo `padding` de hoje.
- `.card-accent` **sai** (a classe e os cinco usos).
- `.card-interactive`: sem subir nem fazer sombra no hover. No hover, a
  borda vira `app-campo`. O afundar ao toque (`tappable`) fica.
- `.btn-primary`: `app-primaria` sólido, texto `app-sobre-primaria`, sem
  degradê nem sombra. No hover, `filter: brightness(0.94)`. `min-height` de
  44 px.
- `.btn-ghost` (o secundário): fundo `app-cartao`, borda `app-campo`, texto
  `app-texto`, `min-height` de 40 px.
- `.input`: fundo `app-cartao`, borda `app-campo` e cantos de 10. Hoje a
  borda é `slate-300`, que dá 1,48:1 sobre branco e reprova o WCAG 1.4.11.
  No foco, a borda vira `app-primaria`, com anel `app-primaria-fundo`.
- `.label` e `.eyebrow`: 13 px, `app-texto-2`, frase normal.
- `.section-title`: 17 px semibold, `app-texto`, **sem ícone**. O
  `icon-badge` sai dos títulos de seção do paciente; a classe fica, refeita
  em `primaria-fundo` e `primaria`, onde o ícone diz algo (estado vazio,
  linha de lista).
- `.chip`: borda `app-linha`, fundo `app-cartao`, texto `app-texto-2`.
- `.pf-skel`: o cinza do esqueleto passa a `app-linha`.

### Anel e macros

- **`ProgressRing`:** o anel é sempre `app-primaria` sobre trilho
  `app-linha`. Some o `colorClass` por anel. Uma nova prop `avisoAcima`
  (padrão `false`) faz o rótulo dizer "acima da meta", em `app-atencao`,
  quando `pct > 1`. Só as calorias passam `avisoAcima`.
- **Barra de macros:** três segmentos com 2 px entre eles, nas cores
  `macro-*`. A legenda dá nome e gramas de cada macro ("Proteína 45 g").

## A casca: menu, barra de baixo e Gaia

Vale para os dois lados (`AppShell`).

- **Menu lateral:** fundo `app-cartao` sólido (sem translucidez nem
  `backdrop-blur`), borda `app-linha`. A marca vira um quadrado `primaria`
  sólido, sem degradê nem sombra. Os rótulos de grupo saem da caixa alta.
- **Barra de baixo (celular):** fundo `app-cartao`, borda de cima
  `app-linha`, item ativo em `app-primaria` e semibold. Os itens não mudam:
  Início, Meu plano, Treinos, Dieta, Hábitos e Mais.
- **Gaia (`ChatWidget`):** o botão flutuante fica em `app-primaria` sólido,
  sem degradê nem sombra colorida, com o mesmo lugar, o mesmo
  `aria-label="Abrir a Gaia"` e o mesmo esconder ao rolar para baixo. O
  cabeçalho da conversa sai do degradê e fica `app-cartao`, com título em
  `app-texto` e borda de baixo `app-linha`.

## Início (paciente)

De cima para baixo, numa coluna só, no celular e no computador. A área de
conteúdo tem 720 px a partir de `lg`, e a grade de duas colunas do fim da
página sai.

1. **Data e saudação.** A data longa ("Sexta-feira, 9 de outubro") vem em
   `app-texto-2`. Abaixo, "Bom dia, Maria", "Boa tarde, Maria" ou "Boa
   noite, Maria", sem emoji. A saudação sai de `saudacao(agora: Date)`, nova
   em `lib/date.ts` e testada, pela **hora de São Paulo**: das 5h às 11h59,
   "Bom dia"; das 12h às 17h59, "Boa tarde"; fora disso, "Boa noite". O
   servidor roda em UTC: sem o fuso, às 21h de São Paulo ele daria "Bom dia".
2. **A consulta, numa linha** (só para quem tem nutricionista ativo). É um
   link para `/app/nutricionista#consulta`, onde fica o `CartaoConsulta`
   inteiro, com as ações. O texto depende da situação:
   - agendada: "Próxima consulta" e "qua., 21/10 às 12:45 · presencial";
   - agendada com remarcação pedida: o mesmo, mais "· remarcação pedida";
   - pedido aberto: "Consulta pedida" e "ter., 20/10 às 14:00 · aguardando
     Ricardo";
   - nenhuma: a linha não aparece;
   - leitura que falhou: "Não deu para carregar a consulta", e nunca o
     silêncio do "nenhuma".

   A situação e os textos de data saem de `lib/consultas.ts`, das mesmas
   funções do cartão; a linha não refaz a conta. O `CartaoConsulta` sai da
   Início e fica só em "Meu plano", onde ganha `id="consulta"`.
3. **Para hoje.** Um cartão só. O título "Para hoje" vem com "N pendentes" à
   direita (ou "em dia"). Dentro, linhas separadas por traço, nesta ordem:
   1. recado não lido: "Recado de {primeiro nome}" e "· seu
      nutricionista", com o texto e "Li o recado" e "Ver Meu plano". A
      lógica do `NutriNotes` compacto não muda; muda só o visual;
   2. treino prescrito para hoje: o nome, "{categoria} · do seu
      nutricionista", e "Fui" e "Não fui" (`PlanCheckIn`);
   3. treino próprio de hoje: o nome, "{categoria} · seu treino", e
      "Fiz";
   4. aplicação do dia ou atrasada: "Aplicação de hoje" ou "Aplicação
      atrasada" (esta em `app-atencao`), o remédio e a dose, e um botão
      "Registrar" que leva a `/app/tratamento`. Não grava nada no lugar;
   5. cardápio com refeições faltando: "Cardápio de hoje" e "N refeições
      ainda faltam", em link para `/app/dieta`;
   6. demais pendências de `getPending` (perfil, metas): título, descrição e
      seta, sem o pontinho colorido. A única pendência urgente é a da dose,
      e ela não aparece quando a linha 4 já aparece (a deduplicação de
      hoje); se aparecer, o título vem em `app-atencao`.

   Sem o nome do nutricionista (perfil sem nome), a linha 1 diz só "Recado"
   e "· seu nutricionista". A frase "Seu nutricionista vê essa confirmação"
   aparece **uma vez** no cartão, como hoje.

   **Quais linhas entram e a contagem** saem de uma função pura,
   `montarParaHoje`, em `lib/paraHoje.ts` e testada. Ela decide ordem,
   contagem e deduplicação; a página só desenha. A contagem não inclui o
   treino já confirmado.

   **"Em dia" só com certeza.** Se alguma leitura que alimenta o cartão
   falhou (recados, plano, check-ins, cardápio, refeições, tratamento), o
   cartão não diz "em dia". Ele diz "Não deu para carregar tudo. Recarregue
   a página." e mostra as linhas que carregaram. É a regra do CLAUDE.md:
   "leitura que falha não é 'não tem'". Hoje a página faz `data ?? []` e
   diria "em dia".
4. **Registrar.** O título e uma grade de 2×2 no celular (4×1 a partir de
   `sm`) com Refeição (`/app/dieta?novo=1`), Foto do prato
   (`/app/dieta?foto=1`), Treino (`/app/treinos`) e Peso (`/app/medidas`).
   Os destinos são os de hoje. São botões secundários com "+", e saem de
   dentro do "Hoje".
5. **Seu dia.** O título vem com "score 72 · bom" à direita, em
   `app-texto-2`, com o número sem cor por faixa. Abaixo, três anéis:
   Calorias (com `avisoAcima`), Água e Proteína. O "Definir metas", a dica
   do Score (`topTip`) e o texto de sem-dados continuam como hoje.
6. **Progresso.** O peso atual em destaque ("65,8 kg"), a variação ("−2,8 kg
   em 30 dias", por `textoVariacaoPeso`), uma linha fina de 30 dias em
   `app-primaria`, sem eixos nem grade, com a primeira e a última data nas
   pontas, e "Ver medidas". A linha tem `role="img"` e um `aria-label` com o
   que ela mostra ("Peso dos últimos 30 dias, de 68,6 para 65,8 kg."). O estado vazio fica como hoje ("Registre seu peso algumas
   vezes…").
   - **A conta é a do nutricionista.** O peso de 30 dias que
     `montarResumos` calcula por dentro (`naJanela`, um valor por dia por
     `pesoDoDia`, teto em hoje) sai para uma função exportada e testada,
     `pesoDe30Dias(linhas, hoje) → { pontos, atual, variacao }`, em
     `lib/nutri.ts`. A Início e `montarResumos` usam essa função, e os
     testes atuais de `weightDelta30` continuam passando. Assim o paciente e
     o nutricionista não veem dois "−2,8 kg" diferentes.
   - **A leitura muda.** Hoje ela é `order(date asc).limit(60)`, o que pega
     as **60 mais antigas**: com mais de 60 pesagens, o "Peso atual" mostra
     uma de meses atrás. Passa a ser a janela de 30 dias com
     `limitesDaJanela`, com `measured_by` e `created_at`. Sem peso na
     janela, entra a última pesagem antes dela, com "em dd/mm".
   - Leitura que falhou dá "Não deu para carregar o peso", não o estado
     vazio.
7. **Links**, numa lista de linhas com seta:
   - "Próxima aplicação · em N dias" (`/app/tratamento`), só quando a dose
     não é de hoje nem está atrasada, porque nesses casos ela já está no
     "Para hoje". Hoje isso é um cartão;
   - "Treinos recentes" (`/app/treinos`);
   - "Relatório para levar à consulta" (`/app/relatorios`).

## Dieta (paciente)

1. **Cabeçalho:** o título "Dieta", a navegação de dia e "Registrar
   refeição" (`btn-primary`, largura toda no celular).
   - A navegação tem as setas e, no meio, o rótulo "Hoje, sex. 9/10" (ou
     "qua. 7/10"). Tocar no rótulo abre o seletor de data nativo: o
     `input type="date"` continua lá, com `max` em hoje, sem a cara de
     campo.
   - O chip "Hoje" fica para voltar.
   - Sai o subtítulo "Acompanhe suas refeições e macros."
2. **Resumo do dia:** dois anéis, Calorias (com `avisoAcima`) e Proteína, e
   a barra de macros com legenda. O "Definir metas" fica.
3. **Plano alimentar** (`MealPlanView`, quando há cardápio): um cartão só,
   com o título do plano e "de {primeiro nome}, seu nutricionista · ver em
   Meu plano". Depois vem a observação do plano, se houver. Por fim, as
   refeições: o nome de cada uma como subtítulo ("Café da manhã · feito"
   quando registrada), as opções em linhas, cada uma com descrição,
   "380 kcal · 20 g prot" e "Comi isso" (secundário) ou "comi" (texto
   `app-primaria`, quando já foi). Saem as caixas por opção e os rótulos em
   caixa alta.
4. **Refeições registradas:** um cartão com uma linha por refeição (tipo,
   itens, kcal e macros, e o excluir). Sem refeição, o texto "Nenhuma
   refeição neste dia." e o link "Registrar refeição", no lugar do
   `EmptyState` com ícone grande.

O modal de refeição e a análise por foto mudam só pela linguagem.

## As outras telas

Só a linguagem, sem mudar a ordem nem o conteúdo: as classes globais
refeitas, a cor decorativa trocada pela principal ou pelo neutro, a caixa
alta tirada, os degradês tirados e o texto de apoio direto no chão em
`app-texto-2`.

- **Do paciente:** Meu plano, Treinos, a leitura do treino, Hábitos,
  Medidas, Exames, Tratamento, Relatórios, Saúde, Perfil, Integrações,
  Diagnóstico e Assistente.
- **Componentes:** `MealPlanView`, `PlanCheckIn`, `NutriNotes`,
  `CartaoConsulta`, `WorkoutSession`, `RestTimer`, `PlateCalculator`,
  `FoodSearch`, `TemplateBar`, `Onboarding`, `ConectarNutri`,
  `RevogarNutri`, `PwaSettings`, `ui.tsx`, `Skeleton`, e `charts.tsx`
  (linha e barra em `primaria`, grade em `linha`).
- **Do nutricionista, fora do tema clínico:** `NutriHome`, `PacientesClient`
  e o perfil.
- **Entrada:** `login` e `redefinir-senha`.
- **`/estilo`**, só em desenvolvimento, passa a mostrar a paleta do app ao
  lado da clínica, com a razão de contraste.

## Fora do escopo

- A página do paciente do nutricionista e a agenda: nada muda na tela.
- A landing (`app/page.tsx`, `components/landing.tsx`, `recursos`): só a
  letra.
- Trocar os pares rosa e âmbar que já passam no contraste fora da Início e
  da Dieta.
- O texto em masculino genérico que o app já usa ("seu nutricionista").
  Mudar isso pede um campo no perfil, e não é visual.

## Testes e verificações

- **vitest:**
  - `lib/temaApp.test.ts`: os pares acima e a exceção dos macros.
  - `saudacao`: as fronteiras 4h59, 5h, 11h59, 12h, 17h59 e 18h, em São
    Paulo, com um instante UTC de outro dia de calendário.
  - `montarParaHoje`: ordem, contagem, deduplicação da dose, treino
    confirmado fora da conta, e nunca "em dia" com leitura que falhou.
  - `pesoDe30Dias`: dia com as duas medidas, janela de 30 dias contada por
    `naJanela`, data futura fora e um dia só sem variação. Os testes atuais
    de `weightDelta30` também passam.
  - `ProgressRing`: `avisoAcima` só com `pct > 1`.
- **`ferramentas/conferir-inicio.cjs`**, com o Supabase falso:
  - continuam a data, a frase da confirmação uma vez, a dose citada no
    máximo duas vezes e o botão da Gaia que some ao descer e volta ao subir;
  - a verificação do rótulo "Recado" troca para o título "Recado de
    {primeiro nome}";
  - entram: a ordem das seções (consulta, Para hoje, Registrar, Seu dia,
    Progresso, links); nenhum elemento com `text-transform: uppercase` no
    `main` da Início e da Dieta; nenhum `background-image` em `.card` e
    `.btn-primary`; `font-family` com "Instrument Sans" no corpo e nos
    títulos, no paciente e no `NutriHome`; nenhuma rolagem horizontal em
    390 px; e o aviso de leitura falha no "Para hoje" e no Progresso.
- **`ferramentas/conferir-consulta-paciente.cjs`:** as ações (pedir,
  remarcar, cancelar) passam a ser dirigidas em "Meu plano". Na Início,
  confere a linha em cada situação: agendada, remarcação pedida, pedido,
  nenhuma (sem linha) e falha.
- **`ferramentas/tirar-prints-nutri.cjs`:** as 527 verificações continuam
  passando.
- **Fotos de tela:** Início e Dieta em 390 e 1280 px, claro e escuro. Mais
  uma foto de cada tela da lista "as outras telas", em 390 px claro, antes e
  depois, para comparar.
- `npm test`, `npx tsc --noEmit` e `npm run build` limpos.

## Riscos

- **É uma troca global.** As classes de `globals.css` atingem todas as
  telas, inclusive formulários que ninguém abriu nesta spec. As fotos de
  antes e depois de cada tela são a rede; a troca das classes vem
  **primeiro**, sozinha, para a diferença aparecer isolada.
- **Texto de apoio no chão.** O `slate-500` reprova sobre a `pagina` clara
  (4,43). A varredura procura `text-slate-400` e `text-slate-500` fora de
  cartão.
- **A largura da letra.** Instrument Sans e Inter não ocupam o mesmo
  espaço. Rótulos que mal cabiam em 390 px (abas, botões da fila,
  `CartaoConsulta`) podem quebrar; as fotos e a verificação de rolagem
  horizontal pegam.
- **Ninguém de fora viu.** Como o resto do produto, isto foi aprovado pelo
  dono, não por um paciente nem por um nutricionista.

## Ordem

Começa depois do plano dos gráficos, no mesmo branch. Se o PR do registro e
dos gráficos já tiver sido mesclado, entra num PR novo. Dentro do plano,
a ordem é:

1. paleta e testes;
2. letra e classes globais, com as fotos de antes e depois;
3. a casca;
4. as funções puras da Início;
5. a Início;
6. a Dieta;
7. as outras telas;
8. as verificações e a documentação, incluindo a seção nova no CLAUDE.md e
   a nota na spec da agenda sobre a consulta da Início.
