# De onde vem cada número (CFO, 26/10/2026)

Estimativa está escrita como estimativa. Os preços em dólar usam a PTAX de
venda de 23/10/2026, **R$ 5,0377**, arredondada para R$ 5,04
([piranot.com.br](https://www.piranot.com.br/2026/10/23/noticias/economia/dolar-ptax-fecha-em-r-50377-nesta-sexta-feira-23-10-2026-veja-a/),
a conferir no Banco Central). Nenhuma página foi aberta: os preços vêm de
resultados de busca e da documentação da Supabase. Confira cada um na página
oficial antes de pagar.

## Do fundador (respostas de 26/10)

| dado | resposta |
| --- | --- |
| preço | R$ 69,90 por mês (`founder/pitch.md`) |
| empresa | ainda não tem |
| nutricionistas que alcança pelo nome | menos de 5 |
| salário no ano 1 | nenhum |
| IA hoje | Groq e Gemini no plano grátis |

## Por nutricionista pagante, por mês

| linha | R$ | fonte |
| --- | ---: | --- |
| imposto | 10,83 | **Estimativa.** Simples Nacional, Anexo V, alíquota inicial de 15,5% ([Agilize](https://agilize.com.br/artigos/?p=4155)). Sem pró-labore, o Fator R (folha ÷ receita) fica em 0%, abaixo dos 28% que levariam ao Anexo III, de 6%. Qual anexo vale para SaaS depende do CNAE: o contador decide. |
| cartão | 2,58 | Asaas, cartão à vista: 2,99% + R$ 0,49 por cobrança recebida, sem mensalidade ([Asaas, preços e taxas](https://www.asaas.com/precos-e-taxas)). Os 3 primeiros meses têm taxa promocional de 1,99%, não usada aqui. O provedor ainda não foi escolhido; é um exemplo. |
| IA | 12,65 | **Estimativa.** 15 pacientes por nutricionista, a R$ 0,84 cada. A conta está abaixo. |

### A conta da IA, por paciente e por mês

Plano pago, que é o que vale com cliente pagando.

- **Preços públicos, por agregadores** (a conferir nas páginas da Groq e do Google):
  - Groq, Llama 3.3 70B: US$ 0,59 por milhão de tokens de entrada e US$ 0,79 de saída ([cloudprice.net](https://cloudprice.net/models/groq/llama-3.3-70b-versatile));
  - Gemini 2.0 Flash: US$ 0,10 e US$ 0,40 ([cloudprice.net](https://cloudprice.net/models/gemini-2.0-flash)).
- **Tamanho de cada chamada da Gaia, medido no código em 26/10:**
  - prompt fixo de 6.254 caracteres (`app/api/chat/route.ts`);
  - definição das ferramentas de 16.926 caracteres (`lib/aiActions.ts`, `AI_TOOLS`), mandada inteira em toda chamada;
  - dados do paciente e histórico (até 20 mensagens): uns 5.000 caracteres, **estimativa**.
  - Total de uns 28.000 caracteres, ou 8.051 tokens a 3,5 caracteres por token (**estimativa**).
- **Uso, todo estimativa:**
  - 1,5 rodada por mensagem (metade chama uma ferramenta);
  - 250 tokens de saída por rodada;
  - 20 mensagens à Gaia por mês;
  - 15 fotos de refeição (Gemini, 1.500 tokens de entrada e 400 de saída cada);
  - 4 resumos (Groq, 4.000 e 1.500).
- **Resultado:**
  - US$ 0,0074 por mensagem;
  - **US$ 0,167, ou R$ 0,84, por paciente por mês**;
  - com 30 mensagens, R$ 1,22.

O script da conta foi rodado à parte, na pasta temporária da sessão. As
fórmulas estão nesta seção e podem ser refeitas à mão.

## Custos fixos, por mês

| linha | R$ | fonte |
| --- | ---: | --- |
| Supabase Pro | 126,00 | US$ 25 por mês, e o crédito de US$ 10 cobre o banco no tamanho Micro ([Supabase, billing FAQ](https://supabase.com/docs/guides/platform/billing-faq)). A organização está hoje no plano **grátis**, conferido em 26/10. O grátis pausa o projeto depois de 7 dias de pouca atividade ([Supabase, project pausing](https://supabase.com/docs/guides/platform/free-project-pausing)), e a proteção contra senhas vazadas é só do Pro. |
| Vercel Pro | 100,80 | US$ 20 por pessoa por mês. O Hobby, de graça, não permite uso comercial ([makerkit.dev](https://makerkit.dev/blog/saas/vercel-cost), [schematichq.com](https://schematichq.com/blog/vercel-pricing); a conferir em vercel.com/pricing). |
| IOF | 7,94 | **A conferir.** 3,5% sobre os US$ 45 das duas faturas pagas em cartão internacional. A alíquota não foi buscada nesta sessão. |
| contador | 137,00 | Contajá, contabilidade online para o Simples Nacional, a partir de R$ 137 por mês ([Contajá](https://contaja.com.br/lp/contabilidade-simples-nacional/)). As outras ficam entre R$ 119 e R$ 259 ([Empresas do Brasil](https://www.empresasdobrasil.com.br/artigo/melhores-contabilidades-online-para-mei-e-pequenas-empresas-em-2026-comparativo-de-precos)). |
| domínio .com.br | 3,33 | **Estimativa:** R$ 40 por ano. O app hoje está num endereço da Vercel. |

## Gasto antes de abrir

| linha | R$ | fonte |
| --- | ---: | --- |
| abrir a empresa | 0 | Grátis no plano Contajá Total ([Contajá](https://contaja.com.br/lp/contabilidade-simples-nacional/)). Taxas da junta comercial não foram conferidas. |
| política de privacidade e termos de uso | 2.000 | **Estimativa, sem cotação.** É o que falta para responder à objeção "e os dados dos meus pacientes?" (`founder/offer.md`, em análise) e para tratar dado de saúde pela LGPD. |
| certificado digital e-CNPJ | 200 | **Estimativa, sem cotação.** Serve para emitir nota fiscal. |

## As rampas (nutricionistas pagantes em cada mês)

- **Base (`numbers.json`), a rede pessoal.**
  - O fundador alcança menos de 5 nutricionistas. São 4 no piloto do mês 1, que ainda é teste grátis.
  - Metade vira pagante no mês 2. Os 50% são **estimativa**: o board pediu 3 de 5 no piloto, e o painel deu 0 de 20 com intenção de pagar.
  - Ficam 2 pagantes pelo ano, porque não há canal para trazer mais.
- **Com canal (`numbers-canal.json`), um canal que ainda não existe.**
  - 5 implantações por mês a partir do mês 3, metade das 10 vagas.
  - Metade vira pagante um mês depois, e 5% cancelam por mês. Tudo **estimativa**.
  - O canal, o custo dele e as duas taxas são o que o `/founder-marketing` tem de dar.

## Como a ferramenta foi usada

- A unidade é uma nutricionista pagante por mês, com `days_per_month: 1`.
- Nos relatórios da ferramenta, "a day" quer dizer "no mês", e "$" quer dizer real.
- O `--price` da ferramenta não recalcula o imposto nem o cartão, que são
  porcentagem do preço. Os cenários de preço da nota foram rodados em arquivos à
  parte, com esses dois custos recalculados.
