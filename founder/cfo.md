# CFO: Pace Fit

**Sem canal, o Pace Fit não se paga. Com ele, paga a operação a partir do mês 6.**
Cada nutricionista pagante deixa R$ 43,84 depois dos custos dela, e os custos
fixos são R$ 375 por mês. O ponto de equilíbrio é **9 nutricionistas
pagantes**. Com a rede de menos de 5 que você alcança hoje, o ano fecha com 2
pagantes e R$ 5.736 de prejuízo.

Unidades e símbolos:

- uma nutricionista pagante por mês;
- valores em reais (a ferramenta escreve "$");
- "a day" quer dizer "no mês".

De onde vem cada número: `founder/cfo-sources.md`. O cenário com canal:
`founder/cfo-canal.md`. Isto não é orientação financeira, fiscal nem jurídica: um
contador precisa conferir o anexo do Simples, o CNAE, o pró-labore e os impostos
antes de qualquer dinheiro sair.

## A margem

- **Contribuição: R$ 43,84 por nutricionista pagante, 63% do preço.** É o que
  sobra de R$ 69,90 depois de R$ 10,83 de imposto, R$ 2,58 de cartão e
  R$ 12,65 de IA.
- **Na rampa base (2 pagantes), a margem é -206%**: a receita (R$ 140 por mês) não
  paga nem um terço dos custos fixos.
- **Na rampa com canal, a margem no mês 12 (20 pagantes) é 35%.**
  - A operação passa a dar lucro no mês 6.
  - O ano 1 fecha com R$ 584 de lucro operacional, mas ainda R$ 1.616 abaixo
    depois do gasto inicial.

## A linha a olhar: o volume

O resultado depende quase só de quantas nutricionistas pagam, e isso depende de
um canal que não existe.

- **Sem canal:** 2 pagantes e prejuízo de R$ 3.536 na operação do ano 1. A
  ferramenta mostra que nem 10% a mais de preço nem 15% a menos de custo tiram
  do vermelho.
- **Com canal de 5 implantações por mês:** lucro de R$ 584 no ano 1.
- **A rampa com canal é frágil.** A ferramenta mostra que 20% menos volume leva
  o ano 1 a -R$ 433, e 10% menos de preço, a -R$ 227.
- **A segunda linha é o número de pacientes por nutricionista,** porque a IA é
  cobrada por paciente.
  - Com 30 pacientes em vez de 15, a contribuição cai para R$ 31,20 e o ponto de
    equilíbrio sobe para 13.
  - Na rampa com canal, o ano 1 vira -R$ 882.

## Caixa

- **Rampa base:** R$ 5.736 até o fim do ano 1, e o dinheiro não volta dentro do ano.
- **Rampa com canal:** R$ 3.427 no ponto mais fundo (mês 5), e o dinheiro também não volta no ano 1.
- **Nas duas:** R$ 2.200 de gasto inicial (todo estimativa) e R$ 375 por mês de
  custo fixo desde o mês 1.

Os custos fixos começam no dia em que alguém paga, não quando houver muitos
clientes:

- o plano Hobby da Vercel não permite uso comercial;
- a Supabase grátis pausa o projeto com pouco uso;
- e, segundo agregadores (a conferir na página do Google), o Gemini grátis pode
  usar o conteúdo enviado para melhorar os produtos do Google. Isso inclui foto
  de refeição e laudo de paciente, que é dado de saúde.

Ficar no grátis com cliente pagando não é economia; é risco.

## Três formas de melhorar a margem

Cada uma foi rodada na ferramenta, num arquivo com só aquele número trocado.

| mudança | contribuição | ponto de equilíbrio | ano 1, rampa com canal |
| --- | ---: | ---: | ---: |
| hoje | R$ 43,84 | 9 | R$ 584 |
| 1. imposto no Anexo III, 6% | R$ 50,48 | 8 | R$ 1.354 |
| 2. IA mandando só as ferramentas da conversa | R$ 48,16 | 8 | R$ 1.085 |
| 3. preço de R$ 79 | R$ 51,26 | 8 | R$ 1.444 |

1. **Imposto.** O anexo depende do CNAE e do Fator R. Pagar pró-labore para
   chegar a 28% de folha tem custo próprio (INSS) que esta conta não tem. É o
   contador quem decide.
2. **IA.** Hoje cada mensagem à Gaia manda as 16.926 letras de todas as
   ferramentas.
   - Mandar só as da área da conversa (um terço, estimativa) baixa a IA de
     R$ 12,65 para R$ 8,33 por nutricionista.
   - O `TOOL_AREAS` já existe em `lib/aiActions.ts`. É mudança de código e
     precisa de teste.
3. **Preço.** R$ 79 fica abaixo da mediana de "começa a ficar caro" no reteste
   da oferta (R$ 84,50). Mas, para 5 de 6 do consultório começando, R$ 79 já era
   "caro demais" na primeira rodada. O caminho inverso pesa: a R$ 49,90, a
   contribuição cai para R$ 27,54 e o ponto de equilíbrio sobe para 14.

Nenhuma das três resolve o volume: com 2 pagantes, todas seguem no prejuízo.

## As condições de dinheiro do board

- [x] **Quanto custa um paciente grátis.**
  - R$ 0,84 por mês com 20 mensagens à Gaia, R$ 1,22 com 30. É estimativa,
    no plano pago.
  - Antes da IA, uma assinatura deixa R$ 56,49. Cabem uns 67 pacientes (20
    mensagens) ou 46 (30 mensagens) antes de a nutricionista dar prejuízo por
    conta própria.
  - Nisso a conta ainda não divide os custos fixos.
- [ ] **Um canal com custo medido.** Não existe. Com menos de 5 nutricionistas
      ao alcance, o piloto esgota a rede. É a condição que decide o resultado, e
      é do `/founder-marketing`.
- [ ] **Cobrança de verdade.** O app não cobra. O Asaas entrou na conta só como
      exemplo de taxa.
- [~] **Uma garantia que o CFO aprove.** A garantia (mais 30 dias e nova
      implantação) não muda a contribuição, só adia a receita: uma mensalidade
      (R$ 69,90) e uns 90 minutos seus por pedido. Com caixa de R$ 3 mil a
      R$ 6 mil, dá para bancar. A sugestão é valer uma vez por nutricionista,
      para não virar teste grátis sem fim.

## O que não tem preço aqui

Suas horas não entram na conta, porque não são dinheiro. Ainda assim:

- cada implantação leva uns 90 minutos;
- na rampa com canal, são umas 7,5 horas por mês, mais as refeitas da garantia;
- o canal, quando existir, vai pedir as suas horas também.

---

# Unit economics: Pace Fit (unidade: uma nutricionista pagante por mês; valores em R$)

Every number below comes from the input file. Nothing is looked up or guessed.

## One nutricionista pagante

| line | per nutricionista pagante |
| --- | ---: |
| Price | $69.90 |
| Simples Nacional, Anexo V, 15,5% (sem pró-labore o Fator R fica abaixo de 28%; estimativa) | -$10.83 |
| Asaas, cartão: 2,99% + R$ 0,49 por cobrança | -$2.58 |
| IA (Groq e Gemini, plano pago): 15 pacientes a R$ 0,84 cada (estimativa) | -$12.65 |
| **Contribution** (what each nutricionista pagante leaves to pay the fixed costs) | **$43.84** (63%) |

## The margin that matters

Fixed costs: $375 a month (Supabase Pro (US$ 25; o crédito de US$ 10 cobre o banco Micro) $126, Vercel Pro (US$ 20 por pessoa; o Hobby não permite uso comercial) $101, IOF de 3,5% nas faturas em dólar (a conferir) $8, Contador online, Simples Nacional (Contajá, a partir de) $137, Domínio .com.br (R$ 40 por ano; estimativa) $3).

- **Break-even: 9 nutricionista pagantes a day.** Below that you lose money every month.
- **Profit margin at your plan** (2 a day): **-206%** of every sale, after every cost.

## Year 1, month by month

| month | nutricionista pagantes a day | revenue | profit | cumulative (after $2,200 startup) |
| ---: | ---: | ---: | ---: | ---: |
| 1 | 0 | $0 | -$375 | -$2,575 |
| 2 | 2 | $140 | -$287 | -$2,862 |
| 3 | 2 | $140 | -$287 | -$3,150 |
| 4 | 2 | $140 | -$287 | -$3,437 |
| 5 | 2 | $140 | -$287 | -$3,725 |
| 6 | 2 | $140 | -$287 | -$4,012 |
| 7 | 2 | $140 | -$287 | -$4,299 |
| 8 | 2 | $140 | -$287 | -$4,587 |
| 9 | 2 | $140 | -$287 | -$4,874 |
| 10 | 2 | $140 | -$287 | -$5,162 |
| 11 | 2 | $140 | -$287 | -$5,449 |
| 12 | 2 | $140 | -$287 | -$5,736 |

- **Year 1 operating profit: -$3,536** on $1,538 of revenue.
- After the $2,200 startup spend: -$5,736.
- Startup money earned back: not within year 1.
- Cash you need before it pays for itself: **$5,736**.

## What if

| scenario | margin at plan | break-even a day | year 1 profit |
| --- | ---: | ---: | ---: |
| Base plan | -206% | 9 | -$3,536 |
| Price -10% | -240% | 11 | -$3,690 |
| Volume -20% | -273% | 9 | -$3,729 |
| Unit costs +15% | -211% | 10 | -$3,622 |

## Red flags

- Year 1 loses money on operations (-$3,536).
- The startup spend is not earned back within year 1.
