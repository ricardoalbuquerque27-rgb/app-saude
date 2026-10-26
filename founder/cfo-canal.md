# Unit economics: Pace Fit com um canal hipotético (5 implantações por mês a partir do mês 3)

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
- **Profit margin at your plan** (20 a day): **35%** of every sale, after every cost.

## Year 1, month by month

| month | nutricionista pagantes a day | revenue | profit | cumulative (after $2,200 startup) |
| ---: | ---: | ---: | ---: | ---: |
| 1 | 0 | $0 | -$375 | -$2,575 |
| 2 | 2 | $140 | -$287 | -$2,862 |
| 3 | 2 | $133 | -$292 | -$3,154 |
| 4 | 4 | $301 | -$187 | -$3,341 |
| 5 | 7 | $461 | -$86 | -$3,427 |
| 6 | 9 | $612 | $9 | -$3,418 |
| 7 | 11 | $756 | $99 | -$3,319 |
| 8 | 13 | $893 | $185 | -$3,134 |
| 9 | 15 | $1,023 | $267 | -$2,867 |
| 10 | 16 | $1,147 | $344 | -$2,522 |
| 11 | 18 | $1,264 | $418 | -$2,104 |
| 12 | 20 | $1,376 | $488 | -$1,616 |

- **Year 1 operating profit: $584** on $8,107 of revenue.
- After the $2,200 startup spend: -$1,616.
- Startup money earned back: not within year 1.
- Cash you need before it pays for itself: **$3,427**.

## What if

| scenario | margin at plan | break-even a day | year 1 profit |
| --- | ---: | ---: | ---: |
| Base plan | 35% | 9 | $584 |
| Price -10% | 28% | 11 | -$227 |
| Volume -20% | 29% | 9 | -$433 |
| Unit costs +15% | 30% | 10 | $130 |

## Red flags

- The startup spend is not earned back within year 1.
