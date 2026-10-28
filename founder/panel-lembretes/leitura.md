# Painel de 28/10: o reteste com o lembrete das refeições

O que mudou no pitch: uma frase (`founder/pitch-lembretes.md`, a partir de
`founder/pitch.md`). No horário de cada refeição do cardápio, o paciente recebe
"Almoço: você comeu?" e responde "Comi" ou "Não comi" na notificação (no
iPhone, só com o app na Tela de Início, e o toque abre a refeição); quem diz
"não comi" a 3 ou mais refeições do plano na semana aparece na fila. As mesmas
20 cartas das duas rodadas anteriores (seed 159337, `founder/ab/customer-b.json`).

## O resultado

**0 compras · 20 recusas (0%)**, contra 1 · 19 no painel do uso pretendido e
3 · 17 no reteste da oferta (em que duas "compras" eram só entrar no teste
grátis).

A única mudança de lado é P020, que comprava e agora não compra. A frase nova
não explica a troca: a carta é a mesma ("Testa ferramenta nova", "trocar de
sistema dá trabalho"), e a recusa fala de pagar dois sistemas e do treino que
já está no Strava. Com 20 compradores simulados, de 1 para 0 é ruído.

## O que o lembrete fez

- **Foi notado.** Oito dos vinte falam dele (P001, P004, P006, P007, P010,
  P011, P013, P014). P010 o acha mais fácil que um diário, e P007 diz que ele
  ajuda.
- **Mas trocou a objeção, não a resolveu.** Antes era "meu paciente não vai
  registrar"; agora é "por quanto tempo ele responde?". P007 espera metade
  silenciando na segunda semana, P010 no segundo mês. P006, P010 e P001 pedem
  números de outras nutricionistas com os pacientes ainda respondendo depois
  de 60 ou 90 dias. É pedido de prova, e nenhum pitch o atende: só um piloto
  de verdade.
- **Não tocou nas três que derrubam:**
  - **Confiança (7).** LGPD, onde ficam os dados, exportar tudo, o que
    acontece se a empresa fechar, e colegas usando. Pedida nas quatro rodadas.
  - **Dietbox (7).** Prescrever duas vezes e pagar dois sistemas; pedem
    importar o plano e o histórico, ou substituir de vez.
  - **Preço (4).** Entram no teste grátis e cancelam no dia 31; pedem uns
    R$ 29,90 enquanto têm poucos pacientes, ou cobrança por paciente ativo.
- **O preço segue acima do confortável**: a mediana de "começa a ficar caro"
  é R$ 57 e a de "caro demais" R$ 89,45, e quatro já põem R$ 69,90 no "caro
  demais".
- **"Treino é do personal"** aparece em seis respostas, como antes.

## O que fazer

1. **Parar de retestar o pitch com recurso novo.** Quatro rodadas com as
   mesmas cartas dizem a mesma coisa; o painel saturou, e outra rodada só
   muda se mudar confiança, Dietbox ou preço.
2. **A página de dados e a exportação** (onde ficam, LGPD, CNPJ, exportar tudo
   a qualquer hora, o que acontece se fechar): é o pedido que mais se repete
   desde a primeira rodada.
3. **Um piloto real com 3 a 5 nutricionistas, com o lembrete ligado** (os
   passos 3 a 5 do "Para ligar" no CLAUDE.md): é a única coisa que responde
   "o paciente continua respondendo depois de 60 dias".
4. Nada disso substitui uma nutricionista de verdade: o painel acha objeções,
   não mede conversão.
