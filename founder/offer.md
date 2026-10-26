# Oferta: Pace Fit com implantação feita pelo fundador

Método: a lente das Ofertas (`.claude/skills/founder-board/lenses.md`), um
resumo do *$100M Offers*. Não são palavras do autor.

**Decisões do fundador (26/10):**

| decisão | escolha |
| --- | --- |
| implantação | feita por ele |
| vagas por mês | 10 |
| garantia | mais 30 dias e nova implantação |
| exportar os dados | não prometer; fica em análise |
| preço | R$ 69,90 |

O pitch antigo está em `pitch-v1.md`; o novo, em `pitch.md`.

## O que a oferta não pode prometer

Conferido no código em 26/10:

- **Não existe exportação de dados** nem política de privacidade no app.
- **Não existe integração** com Dietbox ou WebDiet: nada se importa.
- **Não existe push nem WhatsApp:** o paciente só vê o que o app mostra quando
  ele abre.
- **O que existe e pode ser dito:** a assistente de IA não consegue mudar as
  metas nem remover o treino que o nutricionista prescreveu. A trava está no
  código (`lib/aiActions.ts`, em `definir_metas` e na remoção de sessão), não só
  na instrução da IA.

## A lista de problemas

São os problemas na voz do comprador, tirados das 60 respostas dos painéis (base,
A e B) e das reclamações em `founder/competitors.md`. Nota de 1 a 5: valor é
quanto a solução importa ao comprador; custo é quanto custa entregar, em tempo do
fundador ou dinheiro. Sem o `/founder-cfo`, o custo é estimativa.

### Antes de comprar

| # | problema | de onde veio | solução | valor | custo | fica? |
| ---: | --- | --- | --- | ---: | ---: | --- |
| 1 | "Meu paciente não vai registrar todo dia num app" | 14, 10 e 17 compradores nas três rodadas | implantação: o fundador põe os primeiros pacientes para registrar | 5 | 3 | sim |
| 2 | "Se ele não registra, pago por uma fila vazia" | P006, P007, P010, P018 | garantia: menos de 3 registrando no dia 14 dá mais 30 dias e nova implantação | 5 | 2 | sim |
| 3 | "Não conheço nenhuma colega que use" | P001, P005, P009 e outros | não há prova para mostrar, e não se inventa; a implantação e a garantia põem a prova no consultório dela | 4 | 0 | em parte |
| 4 | "Já pago um sistema, não quero pagar dois" | 9 por rodada | "não precisa migrar ninguém para testar": 3 a 5 pacientes, o resto fica onde está | 3 | 0 | sim |
| 5 | "Trocar de sistema dá trabalho, e eu perco o histórico" | 9 por rodada | o mesmo do 4; importar fica em análise | 3 | 0 | em parte |
| 6 | "Empresa nova: e se sumir com os dados?" | 5 a 7 por rodada | exportar e política de dados ficam em análise; a oferta não responde a esta | 4 | ? | não |
| 7 | "R$ 79 pesa com poucos pacientes" | 5 de 6 do consultório começando | R$ 69,90 (decisão do fundador); cobrar por paciente ativo vai para o `/founder-pricing` | 3 | ? | em parte |
| 8 | "Prescrever treino é do personal" | 4 a 5 por rodada, todos com a frase na carta | "e, se quiser, treino" | 2 | 0 | sim |
| 9 | "Uma IA conversando com meu paciente sem eu saber" | P009, P011, P014 | "a IA não consegue mudar as metas nem o treino que você prescreveu", que é verdade no código | 3 | 0 | sim |
| 10 | "Meu paciente vive no WhatsApp" | 6 a 10 por rodada | mensagem pronta de convite para o WhatsApp; a conversa segue onde já está | 3 | 1 | sim |
| 11 | "Ia ter que lançar tudo duas vezes" | 12 na rodada B | a implantação lança as metas dos 3 a 5 pacientes junto com ela, na chamada | 3 | 1 | sim |
| 12 | "Convencer cada paciente a instalar mais um app" | 9 na B, vários nas outras | guia curto para o paciente, e o convite feito na chamada | 4 | 1 | sim |
| 13 | "Quem está por trás?" | P009 | a implantação é com o fundador, por chamada | 3 | 0 | sim |

### Durante o uso

| # | problema | de onde veio | solução | valor | custo | fica? |
| ---: | --- | --- | --- | ---: | ---: | --- |
| 14 | "Não tenho tempo de aprender outro sistema" | Nutrium: curva de aprendizado | a chamada do dia 1 monta tudo junto | 3 | 0 | sim, dentro da implantação |
| 15 | "Se der problema, fico sozinha" | P005; "suporte que não responde" no Dietbox e no WebDiet | as chamadas dos dias 7 e 14; suporte com prazo fica em análise | 3 | 2 | em parte |
| 16 | "O sistema cai e perde o que eu fiz" | Dietbox no Reclame Aqui | nenhuma promessa possível (o registro da consulta salva sozinho, mas isso não é garantia de que o sistema não cai) | 2 | ? | não |
| 17 | "A fila só me mostra o que eu já sei" | P007, P018 | a chamada do dia 14 abre a fila com ela, com os pacientes dela | 4 | 1 | sim |

### Depois

| # | problema | de onde veio | solução | valor | custo | fica? |
| ---: | --- | --- | --- | ---: | ---: | --- |
| 18 | "E se o paciente parar depois do primeiro mês?" | P002, P006, P010 | é o que a fila mostra; não há promessa além dos 14 dias | 3 | 0 | não |
| 19 | "Cobrança surpresa na renovação" | WebDiet no Reclame Aqui (4 títulos) | preço travado por um prazo fica em análise | 3 | ? | não |
| 20 | "Se eu cancelar, perco tudo" | P003, P009, P012, P017 | exportar fica em análise | 4 | ? | não |

## A pilha

- **O núcleo, pelo resultado:** em 14 dias, uma fila que mostra quais dos seus
  pacientes estão saindo do plano entre as consultas.
- **A implantação,** que é a peça nova e ataca os problemas 1, 10, 11, 12, 13, 14
  e 17:
  - dia 1, chamada de 30 minutos: conta criada, 3 a 5 pacientes convidados, mensagem pronta para o
    WhatsApp, guia curto para o paciente;
  - dias 7 e 14, 15 minutos cada: abrir a fila juntos.
- **Três frases que tiram objeções sem custo:**
  - "Não precisa migrar ninguém para testar" (4 e 5);
  - "a IA não consegue mudar as metas nem o treino que você prescreveu" (9);
  - "e, se quiser, treino" (8).
- **A garantia:** se no dia 14 menos de 3 desses pacientes estiverem registrando,
  mais 30 dias grátis e a implantação refeita (1 e 2).
- **A escassez, verdadeira:** 10 vagas de implantação por mês, porque cada uma é
  feita pelo fundador. Não há urgência de prazo, e nenhuma foi inventada.
- **O nome:** "Pace Fit com implantação: sua fila funcionando em 14 dias".

O que o fundador precisa preparar antes de vender: a mensagem de convite para o
WhatsApp, o guia curto do paciente e o roteiro das três chamadas.

## Quanto custa

Sem o `founder/numbers.json`, a conta é feita à mão, e é estimativa.

- **Uma implantação:** uns 90 minutos do fundador, que são 60 de chamadas e uns
  30 de preparo e acompanhamento.
  - 10 por mês dão umas 15 horas.
  - O preparo único (mensagem, guia, roteiro) leva umas 4 horas.
- **A garantia:** cada pedido custa uma nova implantação (uns 90 minutos) e
  adia uma mensalidade (R$ 69,90).
  - Não se sabe quantos vão pedir. A objeção principal das três rodadas é
    justamente o paciente não registrar, e não há push, então a conta usa 30% e
    60%.
  - Com 30%: 3 pedidos por mês, mais 4,5 horas e R$ 209,70 de receita adiada.
  - Com 60%: 6 pedidos por mês, mais 9 horas e R$ 419,40 de receita adiada.
- **O que ninguém mediu:** quanto custa um paciente grátis, porque a
  assistente de IA cobra por uso, e quanto custam a hospedagem e o banco. É o
  `/founder-cfo`.

## A equação de valor

Notas de 1 a 10. Nas quatro linhas, mais alto é melhor para o comprador:
"tempo" alto é resultado rápido, e "esforço" alto é pouco esforço.

| | antes (`pitch-v1.md`) | depois | o que mexe |
| --- | ---: | ---: | --- |
| resultado sonhado | 5 | 6 | o resultado dito com prazo: "em 14 dias" |
| chance de dar certo, aos olhos dela | 2 | 5 | a implantação e a garantia; sem prova de colegas, não passa de 5 |
| tempo até o resultado | 4 | 7 | o dia 14 marcado, com chamada |
| esforço e sacrifício | 3 | 6 | não migrar ninguém, o fundador monta, a mensagem e o guia prontos |

## O reteste

(a preencher com o resultado do painel `founder/panel-oferta`)

## Em análise

O que o fundador decidiu não prometer agora, e o que precisa existir para
prometer:

- **Os dados são dela:** exportar pacientes, registros e consultas, a pedido ou
  por um botão, também depois de cancelar. Hoje não existe. Responde aos
  problemas 6 e 20.
- **Onde ficam os dados e quem vê:** uma política de privacidade e um termo de
  LGPD. Hoje não existe. Responde ao 6.
- **Sem fidelidade e preço travado:** responde ao 19 e às reclamações de
  renovação do WebDiet.
- **Importar do Dietbox e do WebDiet:** responde ao 5 e ao 11, mas depende de
  existir um jeito de tirar os dados de lá.
- **Suporte com prazo de resposta:** responde ao 15.
