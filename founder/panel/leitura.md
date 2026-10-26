# Painel de compradores: a leitura

**0 compram · 20 não compram.** São 20 compradores simulados, semente 159337,
com o pitch de `founder/pitch.md` a R$ 79 por mês e 30 dias grátis. A contagem
bruta está em `results.md`, e as respostas em `answers/`.

Compradores simulados não são clientes. Servem para achar objeções, não para
prever venda, e tendem a concordar: a taxa de compra é um teto. Aqui o teto é
zero. A leitura honesta é que **este pitch, a este preço, não vende**, e não que
ninguém compraria o produto.

## O que pesa, e se veio da carta ou do comprador

Cada carta trazia uma objeção sorteada. O tema que aparece em muito mais
compradores do que nas cartas é o que eles levantaram sozinhos. Esse vale mais.

| tema da objeção | nas cartas | levantaram |
| --- | ---: | ---: |
| o paciente não vai registrar, nem instalar mais um app | 3 | 14 |
| já pago um sistema, e trocar faz perder o histórico | 6 | 9 |
| R$ 79 pesa com poucos pacientes | 1 | 7 |
| empresa nova: e os dados dos pacientes? | 5 | 6 |
| o WhatsApp já resolve | 0 | 6 |
| prescrever treino é do personal | 5 | 4 |

- **O paciente que não registra é a objeção central**, e quase toda espontânea
  (14, contra 3 cartas). Quatro deles dizem o mesmo com outras palavras: se o
  paciente não registra, a fila fica vazia e o nutricionista paga por um painel
  sem dado. É o risco 2 do board, agora na boca do comprador.
- **"Treino é do personal" não é evidência.** Os quatro que levantaram tinham a
  frase na carta. Não dá para concluir nada sobre o nicho esportivo por aqui.
- **A fila de triagem não convenceu ninguém.** Só um comprador (P013) disse que
  ela interessa, e ainda assim não comprou.

## O preço

Medianas das quatro perguntas, em reais por mês:

| | mediana | faixa |
| --- | ---: | --- |
| barato demais para ser bom | 15 | 9 a 29 |
| uma pechincha | 37 | 25 a 49 |
| começa a ficar caro | 79 | 49 a 110 |
| caro demais, não compro | 120 | 69 a 190 |

Para seis compradores, R$ 79 já é "caro demais". Cinco deles são do consultório
começando, e esse é o segmento em que o preço trava (5 de 6). No consultório
consolidado e no esportivo, R$ 79 fica antes do "caro demais". Eles não compram
por confiança e por já ter um sistema, não por preço. O `/founder-pricing` faz a
conta de Van Westendorp com esses números.

## O que viraria um não

Contei à mão nas 20 respostas; um comprador pode pedir mais de uma coisa.

1. **Prova de que o paciente registra (9).** Números de nutricionistas
   parecidos depois de 30 dias, ou ver os próprios pacientes registrando no
   teste grátis.
2. **Importar do sistema atual (8).** Pacientes, planos e histórico do Dietbox,
   ou a planilha e os PDFs, sem redigitar.
3. **Colegas conhecidas usando (8).**
4. **Plano barato ou grátis enquanto há poucos pacientes (8).** Três falam em
   cobrar por paciente ativo, ou só a partir de certo número.
5. **Exportar tudo quando quiser (5),** com onde os dados ficam e o que
   acontece se a empresa fechar.
6. Três querem um plano sem a parte de treino, e três querem que o Pace Fit
   substitua o sistema atual em vez de somar a ele.

Uns sete compradores dizem que abririam os 30 dias grátis e cancelariam antes de
pagar. O teste grátis traz gente para dentro; o que decide é o que eles veem lá.

## Limites desta rodada

- **O perfil puxou para o lado cético.** Os seis comportamentos são de quem já
  tem solução ou desconfia. Nenhum é de quem perde paciente entre as consultas e
  procura uma saída. Esse comprador talvez exista, mas não há dado real que diga
  quantos são, e por isso ele não entrou com uma fatia inventada.
- **A ferramenta é em inglês.** A renda saiu como "$92,000" (o perfil avisa que é
  em reais) e os nomes são estrangeiros. A objeção é sorteada sem olhar o
  comportamento: P011 recebeu "Já pago um sistema" sendo de quem nunca pagou
  software, e resolveu a contradição sozinho.
- Com 20 compradores, todo grupo tem menos de 8 e é fino. Rodar 100 não muda um
  0 de 20; mudar o pitch muda.

## Próximo passo

Antes de gastar, a oferta precisa responder a três perguntas:

- como o paciente continua registrando;
- como os dados entram e saem;
- quanto custa para quem tem poucos pacientes.

O `/founder-offer` monta isso, e depois vale uma nova rodada de 20 com o pitch
novo. A prova que conta é o piloto com nutricionistas de verdade, que o board já
pedia.
