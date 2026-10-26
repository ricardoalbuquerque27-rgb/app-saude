# Teste A/B do pitch: cuidado e complemento

**Os dois deram 0 de 20, como a primeira rodada.** As cartas foram as mesmas 20
nas três rodadas (semente 159337). Só mudou o pitch:

- **base** (`founder/pitch.md`): o produto inteiro, a R$ 79;
- **A** (`pitch-a.md`): o mesmo produto e o mesmo preço, com o texto de "feito
  para o cuidado do nutricionista com cada paciente";
- **B** (`pitch-b.md`): um complemento ao sistema que o nutricionista já usa,
  só para o acompanhamento entre as consultas, sem plano e prontuário, a R$ 39.

Na B, a carta do P018 trocou "R$ 79 por mês pesa" por "O preço pesa", para não
citar um preço diferente do pitch. São compradores simulados: servem para achar
objeções, e a taxa de compra é um teto.

## O que mudou nas objeções

Contei à mão, lendo cada objeção e cada razão. Um comprador pode cair em mais de
um tema.

| tema | base | A | B |
| --- | ---: | ---: | ---: |
| o paciente não vai registrar, ou não vai abrir mais um app | 14 | 10 | 17 |
| lançar as metas em dois lugares | 1 | 0 | 12 |
| já pago um sistema, e migrar faz perder o histórico | 9 | 9 | 2 |
| empresa nova: e os dados dos pacientes? | 6 | 5 | 5 |
| a IA conversando com o meu paciente | 0 | 1 | 2 |
| R$ do pitch igual ou acima do "caro demais" | 6 | 6 | 0 |

- **A não mudou nada.** As três objeções principais são as mesmas, na mesma
  ordem, e nenhum comprador comentou o enquadramento de cuidado. A diferença de
  14 para 10 no registro cabe no ruído de 20 compradores.
- **B tirou o preço e a migração do caminho.** Ninguém achou R$ 39 caro demais,
  e "perco o histórico" quase sumiu, porque não há o que migrar.
- **Mas B criou uma objeção nova e piorou a principal.** Doze compradores não
  querem lançar as metas de novo além do Dietbox. Dezessete apontam o paciente
  com dois apps: o plano num, o registro no outro. Sete pedem que o Pace Fit
  puxe as metas do sistema atual sozinho, uma integração que ele não tem.
  - P008: "meu paciente ia ter dois apps, o do Dietbox e esse."
  - P018: "R$ 39 por mês parece pouco, mas se o paciente não registra eu pago
    por uma fila vazia."

## O preço

Medianas, em reais por mês:

| | base (R$ 79) | A (R$ 79) | B (R$ 39) |
| --- | ---: | ---: | ---: |
| barato demais | 15 | 19 | 10 |
| pechincha | 37 | 39 | 19 |
| começa a ficar caro | 79 | 67 | 49,5 |
| caro demais | 120 | 109,5 | 85 |

Como complemento, o produto vale uns 30% a 50% menos para o comprador. Parte
disso pode ser âncora: comprador simulado puxa a resposta para o preço que leu.
Esta rodada não separa um efeito do outro.

## O que fica das três rodadas (60 respostas)

1. **O bloqueio não é a mensagem, nem o preço.** Com o preço fora do caminho
   (B), ninguém comprou. O que sobra em todas as rodadas é o paciente: se ele
   não registra num app, a fila fica vazia, e o nutricionista paga por uma tela
   sem dado.
2. **A decisão acontece dentro do teste grátis.** Nas três rodadas, o pedido
   mais repetido para virar o não é ver três a cinco pacientes do próprio
   nutricionista registrando sozinhos durante os 30 dias. P014 na B: "Se isso
   acontecer, eu pago os R$ 39 sem pensar."
3. **Complemento só funciona com um app só para o paciente.** Sem integração com
   o Dietbox e o WebDiet, o complemento empurra o paciente para dois apps, e a
   objeção principal piora.

## O que isso aponta

São duas decisões de produto e uma de operação, nenhuma de texto:

- **Os dados chegam sem o paciente abrir um app todo dia.** Os concorrentes da
  faixa de R$ 29,90 a R$ 79 fazem um check-in por semana pelo WhatsApp ou por
  e-mail (`founder/competitors.md`). O Pace Fit não tem push nem WhatsApp.
- **O produto é inteiro ou é complemento.** Inteiro, enfrenta a migração e a
  confiança. Complemento, enfrenta os dois apps e a digitação em dobro.
- **O teste grátis mostra a fila funcionando na segunda semana.** Isso pode ser
  feito à mão, sem código: o fundador ajuda cada nutricionista a pôr os
  primeiros pacientes para registrar. Foi a implantação que o board sugeriu e
  que ficou fora do pitch.

O teste que decide é com gente de verdade: cinco nutricionistas, cada uma com
três a cinco pacientes, por quatro semanas.
