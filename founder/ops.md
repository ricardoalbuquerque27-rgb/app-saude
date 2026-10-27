# Operação: como o Pace Fit roda no dia 1

Pesquisado em 26/10/2026, só por busca na web: nenhuma página foi aberta. Cada
preço tem link e é **a conferir na página oficial** antes de pagar. Isto não é
orientação jurídica nem contábil: as regras mudam e dependem da cidade, e cada
item da seção 6 se confirma com o órgão, o contador ou um advogado.

**Leitura:** `founder/idea.md`, `founder/offer.md`, `founder/numbers.json`,
`founder/cfo-sources.md` e `founder/marketing.md`.

## O resumo, com o que trava primeiro

1. **"1 hora por dia" não fecha a conta.** O recrutamento sozinho já usa essa
   hora (`founder/marketing.md`). Com as 10 vagas cheias, a operação pede de
   **11 a 12 horas por semana, mais de 2 horas por dia útil**, sem contar o
   trabalho no produto. Há três saídas:
   - abrir 5 vagas por mês até a primeira pagante;
   - parar de recrutar enquanto as implantações rodam;
   - aceitar as 2 horas.
2. **Os e-mails de cadastro e de senha podem não chegar a ninguém.**
   - O app manda e-mail para confirmar a conta e para redefinir a senha, e
     trata o "Confirme seu e-mail antes de entrar." (`app/login/page.tsx`).
   - Segundo guias, o envio padrão da Supabase só entrega a endereços da equipe
     do projeto e manda 2 a 4 e-mails por hora
     ([makerkit](https://makerkit.dev/docs/next-supabase-turbo/going-to-production/authentication),
     [sendlayer](https://sendlayer.com/blog/supabase-custom-smtp-and-email-configuration-guide/)).
   - Se o projeto não tem SMTP próprio, o primeiro paciente de verdade não
     confirma a conta. **Conferir antes do D** (veja a seção 2, e-mail).
3. **Três trocas antes do primeiro paciente real**, não depois do piloto:
   - **A IA paga.** No plano grátis do Gemini, o conteúdo enviado pode ser usado
     para melhorar os produtos do Google, e o app manda para ele foto de refeição
     e laudo de exame
     ([Google, cobrança](https://ai.google.dev/gemini-api/docs/billing)).
   - **Supabase e Vercel no plano pago.**
     - O Supabase grátis pausa o projeto depois de 7 dias de pouca atividade
       ([Supabase](https://supabase.com/docs/guides/platform/free-project-pausing)).
     - O Pro guarda uma cópia do banco por dia, por 7 dias
       ([Supabase, preços](https://supabase.com/pricing)).
     - O Hobby da Vercel não permite uso comercial (`founder/cfo-sources.md`).
   - **Conflito entre documentos.** O `founder/marketing.md` deixa os planos
     pagos "para cobrar, depois do piloto". O `founder/numbers.json` já conta os
     dois desde o mês 1, então a conta do CFO não muda.
4. **O fundador não vê os dados dos pacientes, e é bom que seja assim.** A RLS só
   mostra o paciente à nutricionista dele. Por isso a garantia ("menos de 3
   registrando no dia 14") se confere na chamada, com a nutricionista mostrando
   a fila dela, e não numa consulta ao banco.
5. **A LGPD pesa mais do que parece.**
   - Dado de saúde é dado sensível.
   - O alívio para empresa pequena (Resolução CD/ANPD nº 2/2022) se perde no
     tratamento de alto risco, e o dado sensível é um dos critérios.
   - Um advogado decide se o Pace Fit precisa de encarregado e de relatório de
     impacto (seção 6).

## 1. O ciclo de um dia

O Pace Fit não tem estoque nem entrega. O "serviço" é o app no ar, a
implantação e o suporte. ● marca o que a nutricionista ou o paciente veem.

| hora | passo | quem vê |
| --- | --- | --- |
| começo do dia, 10 min | conferir se o app está no ar (monitor), os erros da Vercel e as mensagens que chegaram | |
| manhã, 1 h | 10 mensagens de recrutamento, uma a uma (`founder/marketing.md`) | ● a nutricionista que recebe |
| no horário que ela marcar | chamada de implantação: 30 min no dia 1; 15 min nos dias 7 e 14 | ● |
| logo depois de cada chamada, 10 min | anotar na planilha: pacientes convidados, data das próximas chamadas, o que travou | |
| duas vezes por dia, 5 min | responder WhatsApp e e-mail de suporte | ● |
| fim do dia, 5 min | anotar os três números da semana (respostas, implantações, pacientes registrando no dia 14) | |
| quando houver correção | mexer no app, testar e publicar (fora das horas acima) | ● o que muda na tela |

**Por semana:** a revisão de sexta (seção 4.6).

**Por mês, depois que cobrar:**
- emitir as notas fiscais;
- pagar o Simples;
- conferir as cobranças que falharam;
- mandar ao contador o que ele pedir.

## 2. Fornecedores

Para cada custo do `founder/numbers.json` e cada ferramenta que falta.

### IA (custo variável: R$ 12,65 por nutricionista, estimativa)

| fornecedor | preço público | o que importa | fonte |
| --- | --- | --- | --- |
| Groq (Llama 3.3 70B; conversa, resumos, relatório) | US$ 0,59 por milhão de tokens de entrada e US$ 0,79 de saída | por padrão não guarda o conteúdo das chamadas; dá para ligar a "Zero Data Retention" nas configurações | [cloudprice](https://cloudprice.net/models/groq/llama-3.3-70b-versatile), [Groq, seus dados](https://console.groq.com/docs/your-data) |
| Google Gemini 2.0 Flash (foto de refeição e laudo) | US$ 0,10 e US$ 0,40 | **o plano grátis pode usar o conteúdo**; com cobrança ligada no projeto, não usa | [cloudprice](https://cloudprice.net/models/gemini-2.0-flash), [Google, cobrança](https://ai.google.dev/gemini-api/docs/billing), [fórum do Google](https://discuss.ai.google.dev/t/clarification-on-gemini-api-free-tier-vs-paid-tier-after-billing-activation/96995) |

- **Pedido mínimo e pagamento:** os dois cobram em dólar por uso, no cartão
  internacional.
- **Limite por usuário:** não achei limite de mensagens por usuário em
  `app/api/chat/route.ts`. Um paciente que use demais encarece a conta (risco 8).
- **Alternativas:** outros provedores não foram cotados.

### Cobrança (custo variável: R$ 2,58 por nutricionista)

| fornecedor | preço público | o que importa | fonte |
| --- | --- | --- | --- |
| **Asaas** (o do `numbers.json`) | cartão: 2,99% + R$ 0,49 por cobrança recebida, sem mensalidade | assinatura com cartão, Pix e boleto; se o cartão falha, tenta mais 2 vezes, uma a cada 24 h | [Asaas, preços](https://www.asaas.com/precos-e-taxas), [Asaas, assinaturas](https://docs.asaas.com/docs/assinaturas-recorrência) |
| Mercado Pago | sem mensalidade; crédito "a partir de 3,99%" num site não oficial | assinatura semanal a anual, com recobrança automática | [Mercado Pago](https://www.mercadopago.com.br/blog/link-pagamento-recorrencia-servicos-assinatura), [calculadora (não oficial)](https://calculadoradetaxas.com.br/mercado-pago/) |
| Stripe | 3,99% + R$ 0,39 por cartão nacional, segundo fonte secundária | há relatos conflitantes sobre a assinatura no Brasil | [quasa.io](https://quasa.io/pt/media/stripe-ou-mercado-pago-o-prazo-de-recebimento-vira-parte-da-taxa) |

- **A conta em R$ 69,90:** o Asaas segue o mais barato. Fica em R$ 2,58, contra
  uns R$ 2,79 a R$ 3,18 nos outros dois.
- **Prazo de recebimento:** não foi pesquisado. É pergunta em aberto.

### Hospedagem e banco (fixo: R$ 226,80 por mês nos dois)

| fornecedor | preço | o que importa | fonte |
| --- | --- | --- | --- |
| Supabase Pro | US$ 25 por mês | cópia diária por 7 dias; voltar a um minuto exato (PITR) custa mais US$ 100 por mês, e não faz falta no começo | [Supabase, preços](https://supabase.com/pricing) |
| Vercel Pro | US$ 20 por pessoa por mês | registro de acesso por 1 dia (30 com o Observability Plus); para guardar mais, um "log drain" para um serviço externo | [Vercel, logs](https://docs.vercel.com/docs/functions/logs), [comunidade Vercel](https://community.vercel.com/t/logs-and-backups/22483) |

Trocar de fornecedor não compensa: o app inteiro foi feito sobre esses dois.

### E-mail de cadastro e de senha (hoje fora do `numbers.json`)

| fornecedor | preço | fonte |
| --- | --- | --- |
| **Resend** | grátis até 3.000 e-mails por mês (100 por dia); Pro a US$ 20 por 50 mil | [Resend](https://resend.com/docs/knowledge-base/what-is-resend-pricing.md) |
| SendGrid, Mailgun | não cotados; aparecem nos guias como opção | [sendlayer](https://sendlayer.com/blog/supabase-custom-smtp-and-email-configuration-guide/) |

- **O que pede:** um domínio próprio para o remetente, que já está no
  orçamento.
- **O que cabe:** no piloto, o grátis da Resend sobra.
- **Depois de ligar o SMTP próprio:** o limite padrão da Supabase sobe para
  uns 30 por hora, e dá para ajustar
  ([sendlayer](https://sendlayer.com/blog/supabase-custom-smtp-and-email-configuration-guide/)).

### Contabilidade, certificado e domínio (fixos e de abertura)

| item | fornecedores e preços | fonte | no `numbers.json` |
| --- | --- | --- | --- |
| contador online | Contajá a partir de R$ 137 por mês; Contabilidade.com a partir de R$ 189; o mercado vai de R$ 120 a R$ 400 para prestador de serviço no Simples | [Contajá](https://contaja.com.br/lp/contabilidade-simples-nacional/), [Contabilidade.com](https://contabilidade.com/blog/quanto-custa-a-contabilidade-online-em-2026-guia-de-precos-e-o-que-esta-incluso/), [Meu Contador Online](https://www.meucontadoronline.com.br/blog/quanto-custa-contador-pequenas-empresas/), [Agilize](https://agilize.com.br/artigos/?p=4660) | R$ 137: fica |
| certificado e-CNPJ A1 (1 ano) | R$ 159 foi o menor preço numa cotação pública de junho de 2026 (Certisign e Serpro entre as fontes); as tabelas dão R$ 180 a R$ 280 | [TRT-9](https://www.trt9.jus.br/transparencia/proadDocumento/487495), [Omie](https://www.omie.com.br/blog/qual-e-o-valor-do-certificado-digital-a1-e-a3-em-2026/), [Rolmyjun](https://rolmyjuncontabilidade.com.br/certificado-digital/certificado-digital-preco/) | R$ 200: fica, está na faixa |
| domínio .com.br | Registro.br, R$ 40 por ano, por até 10 anos | [Teletime](https://teletime.com.br/14/10/2026/br-6-milhoes/) | R$ 3,33 por mês: confirmado |

### Advogado e seguro (sem preço público)

| item | com quem falar | fonte |
| --- | --- | --- |
| **política de privacidade, termos de uso e contrato de operador com a nutricionista** | escritório de proteção de dados; não há tabela pública, é orçamento por escopo | [busca sem preço](https://www.migalhas.com.br/depeso/358098/dados-pessoais-e-a-startup-como-evitar-problemas) |
| **seguro cyber para PME** | Bradesco Seguros com Swiss Re, Akad com PSafe, BS2 com Latú; cotação por corretor | [Revista Apólice](https://revistaapolice.com.br/2023/10/bradesco-seguros-e-swiss-re-corporate-solutions-lancam-seguro-cyber-para-pmes/), [Canaltech](https://canaltech.com.br/seguranca/novo-seguro-cobre-riscos-ciberneticos-para-pequenas-e-medias-empresas-no-brasil-228527/) |
| **RC profissional (E&O)** | allseg com Catulus, AIG | [CQCS](https://cqcs.com.br/noticia/allseg-amplia-portfolio-e-entra-no-mercado-de-responsabilidade-civil-profissional/) |

O advogado segue com a estimativa de R$ 2.000 do `numbers.json`. O seguro não
está na conta. Os dois ficam nas perguntas em aberto.

### Equipamento

Supõe que o fundador já tem computador e celular.

- **Atendimento sem o número pessoal:** o app WhatsApp Business é gratuito (a
  conferir na loja de aplicativos), e um segundo chip resolve.
- **O chip:** o preço é o da operadora e não foi pesquisado.

### O `numbers.json` mudou?

**Não.** Nada do que foi conferido mudou os números:
- **Confirmados:** o domínio, o contador e o certificado estão dentro das faixas
  achadas.
- **O que entra de novo:**
  - grátis no piloto: o e-mail da Resend, o monitor e a chamada;
  - sem preço público: o advogado (fica a estimativa) e o seguro (fica fora, a
    cotar).

O CFO não precisa rodar de novo. Ele roda quando chegarem as cotações do
advogado e do seguro.

**Há uma divergência para o contador.** O CFO usou IOF de 3,5% nas faturas em
dólar; um guia do Google Workspace fala em 6,38%
([eesel](https://www.eesel.ai/pt/blog/google-workspace-pricing)). A diferença é
de uns R$ 6,50 por mês.

## 3. Pessoas

Só o fundador, sem salário no ano 1 (resposta de 26/10, `founder/cfo-sources.md`).
Não há folha.

### As horas

| atividade | mês 1 (piloto, umas 5 implantações) | volume planejado (10 por mês) | de onde |
| --- | ---: | ---: | --- |
| recrutamento | 5 h por semana | 5 h por semana | `founder/marketing.md` |
| implantações (90 min cada) | ~1,8 h por semana | ~3,5 h por semana | `founder/offer.md` |
| garantia refeita (30% a 60% delas) | ~0,5 a 1 h | ~1 a 2 h | `founder/offer.md` |
| suporte e monitor (15 min por dia útil) | 1,25 h | 1,25 h | estimativa |
| revisão semanal | 0,5 h | 0,5 h | estimativa |
| **total** | **~9 a 9,5 h por semana** | **~11 a 12 h por semana** | |
| preparo único (mensagem, guia, roteiro) | 4 h, antes do D | | `founder/offer.md` |

**Fora da conta:** o trabalho no produto. Push ou check-in, exportação de dados
e política no app são horas de desenvolvimento, e são elas que respondem às
objeções que travam a compra (`founder/offer.md`).

### A semana

| | manhã | almoço ou noite (horário dela; suposição) | fim do dia |
| --- | --- | --- | --- |
| segunda a quinta | 10 min de abertura e 1 h de recrutamento | até 2 chamadas de implantação | 10 min: suporte e números |
| sexta | 10 min de abertura e 1 h de recrutamento | chamadas | 30 min de revisão semanal (4.6) |
| sábado | | chamada, só se for o único horário dela | |

**Duas regras:**
- **No máximo 2 chamadas por dia.** Com mais, a implantação que atrasa é a que
  mais pesa na garantia.
- **Uma pessoa só.** Nas férias e na doença, nada roda, e o que se faz está no
  risco 2.

### Salário e encargos

Para o contador.

- **Sem pró-labore, o Fator R fica abaixo de 28%** e o Simples cai no Anexo V,
  de 15,5%. Com uma folha de 28% ou mais da receita, iria para o Anexo III, de
  6% ([Agilize](https://agilize.com.br/artigos/?p=4180)).
- **O pró-labore tem encargos próprios.** O contador faz a conta de quando ele
  compensa.

## 4. Rotinas

Cada uma cabe numa página. Em toda chamada, o fundador nunca abre os dados dos
pacientes: só vê o que a nutricionista mostrar na tela dela.

### 4.1 Abrir o dia (10 min)

1. Abrir o monitor e conferir que `/` e `/login` respondem.
2. Na Vercel, abrir "Runtime Errors" das últimas 24 h. Erro novo vira anotação, e
   se trava a nutricionista ou o paciente, vira a tarefa do dia.
3. Ler as mensagens que chegaram no WhatsApp e no e-mail. A que for de quem está
   em implantação responde primeiro.
4. Olhar a agenda das chamadas do dia e preparar cada uma (4.2, passo 1).

### 4.2 A implantação, dia 1 (30 min de chamada, com 15 de preparo)

**Antes:**
1. Confirmar o horário pelo WhatsApp e mandar o link da chamada (Google Meet).
2. Ter à mão o roteiro, a mensagem de convite e o guia do paciente.
3. Saber o público dela (online ou consultório).

**Na chamada:**

4. Ela cria a conta como nutricionista, com nome e CRN. O fundador guia; não
   digita por ela.
5. Ela escolhe de 3 a 5 pacientes que vão topar, de preferência os que
   conversam com ela pelo WhatsApp toda semana.
6. Para cada um, ela cria o convite em Pacientes e cola no WhatsApp a mensagem
   pronta ("Oi! Vou acompanhar você entre as consultas…").
7. Ela lança as metas de pelo menos um paciente, para ver como se faz.
8. Mostrar a fila (a conta de demonstração, marcada como demonstração, se os
   pacientes dela ainda não entraram).
9. Marcar com ela as chamadas dos dias 7 e 14.

**Depois:**

10. Na planilha: data, pacientes convidados, chamadas marcadas e o que travou.
11. No dia seguinte, mandar a ela uma mensagem curta perguntando se os
    pacientes conseguiram entrar.

### 4.3 Dias 7 e 14 (15 min cada)

1. Ela abre a fila e mostra a tela dela.
2. Contar com ela quantos dos pacientes convidados registraram algo nos últimos
   7 dias, e anotar **só o número**.
3. No dia 7: se algum convidado nem entrou, ela manda de novo o convite, na hora.
4. No dia 14:
   - **com 3 ou mais registrando,** perguntar se ela agiu por algo da fila (é o
     teste do board) e pedir uma indicação;
   - **com menos de 3,** aplicar a garantia:
     - mais 30 dias anotados na planilha, porque ainda não há cobrança para
       adiar;
     - uma implantação nova marcada.
5. Anotar o resultado nos três números da semana.

### 4.4 Uma reclamação ou um problema

1. Responder no mesmo dia, mesmo que seja só "vi, estou olhando".
   - É prazo interno, não promessa: o suporte com prazo está "em análise"
     (`founder/offer.md`).
2. Separar o tipo:
   - dúvida de uso: responder;
   - erro do app: reproduzir, corrigir, testar e publicar;
   - pedido de função: anotar.
3. Se envolve dado (alguém viu o que não devia, sumiu algo, acesso estranho), ir
   para a 4.5.
4. Reclamação pública (Instagram, Reclame Aqui): responder em público uma vez,
   com o fato e o que vai ser feito, e continuar no privado. Não apagar.
5. Anotar a causa na planilha. A mesma causa duas vezes vira tarefa do produto.

### 4.5 Incidente com dados

1. Conter: tirar o acesso, trocar a chave, derrubar a função, o que parar o
   vazamento.
2. Registrar o que se sabe: o quê, quando, quantos titulares e quais dados.
3. Avisar o advogado no mesmo dia.
4. **Prazo:**
   - comunicar o incidente relevante à ANPD e aos titulares em **3 dias úteis**,
     contados de quando se soube que atingiu dado pessoal; o regulamento
     considera relevante o que envolve dado sensível;
   - o agente de pequeno porte tem o prazo em dobro, segundo uma fonte, e o
     advogado confirma se vale aqui;
   - fontes: [Mattos Filho](https://www.mattosfilho.com.br/unico/regulamento-incidente-seguranca/),
     [Confidata](https://confidata.com.br/blog/plano-resposta-incidentes-dados-pessoais).
5. Avisar as nutricionistas afetadas, que respondem pelos pacientes delas (veja
   "controlador e operador" na seção 6).
6. Depois: a causa, a correção e um teste que prove a correção.

### 4.6 A revisão de sexta (30 min)

É o "pedido da semana" deste negócio: em vez de estoque, conferem-se cotas e
contas.

1. **Os três números da semana:**
   - respostas ÷ mensagens;
   - implantações iniciadas;
   - nutricionistas com 3 ou mais pacientes registrando no dia 14.
   - Aplicar as regras de mudança do `founder/marketing.md`.
2. **Gasto de IA da semana** no painel da Groq e do Google, comparado com os
   R$ 0,84 por paciente por mês da estimativa.
3. **Uso da Supabase** (banco, armazenamento de fotos e laudos, e-mails) contra o
   limite do plano.
4. **Cópia do banco:** a última cópia diária existe (no Pro).
5. **Chamadas da semana seguinte:** todas marcadas e confirmadas.
6. **Erros da semana na Vercel:** algum se repete?

### 4.7 O fim do mês, depois que cobrar

1. Conferir as cobranças que falharam no Asaas, que já tenta de novo duas vezes,
   e mandar uma mensagem a quem não pagou.
2. Emitir a nota de cada mensalidade. Para empresa do Simples, o Emissor
   Nacional da NFS-e é obrigatório a partir de 1º/11/2026, segundo fontes
   secundárias (seção 6).
3. Pagar o Simples no vencimento que o contador informar.
4. Mandar ao contador o que ele pedir.

## 5. Ferramentas

A menor pilha que roda o negócio.

| para quê | ferramenta | preço | por quê | fonte |
| --- | --- | --- | --- | --- |
| cobrar | Asaas | 2,99% + R$ 0,49 por cartão, sem mensalidade | o mais barato dos três, com assinatura, Pix, boleto e nova tentativa automática | [Asaas](https://www.asaas.com/precos-e-taxas) |
| a "loja" | o próprio app e a página de entrada | já pagos (Vercel e Supabase) | a página `/` é da nutricionista desde 26/10 | `app/page.tsx` |
| e-mail de cadastro e de senha | Resend, ligado ao SMTP da Supabase | grátis até 3.000 por mês | o envio padrão da Supabase não serve para cliente | [Resend](https://resend.com/docs/knowledge-base/what-is-resend-pricing.md) |
| chamadas | Google Meet, conta grátis | R$ 0 | com 2 pessoas, a chamada vai até 24 h; com 3 ou mais, cai para 60 min, o que ainda cobre os 30 | [tl;dv](https://tldv.io/pt-br/blog/google-meet-time-limit/) |
| agendar e falar com elas | WhatsApp Business num segundo chip | o app é grátis; o chip, não pesquisado | é onde a nutricionista já está, sem expor o número pessoal | |
| saber que o app caiu | Better Stack, grátis | R$ 0: 10 monitores, a cada 3 min | o grátis do UptimeRobot tem 50 monitores a cada 5 min, mas há relatos de que proíbe uso comercial | [notifier](https://notifier.so/guides/better-stack-vs-uptimerobot/), [UptimeRobot](https://uptimerobot.com/pricing.md) |
| os números e as implantações | uma planilha | R$ 0 | são umas 10 linhas por mês; ferramenta de CRM não se paga | |
| contabilidade e notas | contador online, mais o Emissor Nacional da NFS-e (do governo) | a partir de R$ 137 por mês | o contador já é obrigatório: software não pode ser MEI (seção 6) | [Contajá](https://contaja.com.br/lp/contabilidade-simples-nacional/) |
| e-mail profissional (opcional) | Google Workspace Business Starter | ~US$ 7 por usuário por mês no plano anual (a conferir em reais) | só se o recrutamento por e-mail pedir um endereço do domínio | [eesel](https://www.eesel.ai/pt/blog/google-workspace-pricing) |

## 6. Registro, licenças, impostos e dados

Rodar uma empresa de software de saúde no Brasil pede, em geral, o que vem
abaixo. **Cada linha se confirma** com a prefeitura, a Receita, o contador ou um
advogado: as regras mudam e dependem da cidade.

**Empresa e impostos**

- [ ] **CNPJ como ME, não MEI.** Desenvolvimento e licenciamento de software não
  pode ser MEI, segundo contadores
  ([Contabilizei](https://www.contabilizei.com.br/contabilidade-online/profissional-de-ti-pode-ser-mei/),
  [Agilize](https://agilize.com.br/artigos/?p=5008)). Confira na lista oficial
  do Portal do Empreendedor.
- [ ] **O CNAE.** Para SaaS, costuma ser o 6203-1/00. Mas há quem aponte o
  6319-4/00 para acesso a programa pela internet. O contador escolhe pelo que o
  contrato diz que o cliente recebe
  ([Contajá](https://contaja.com.br/blog/cnae-saas/),
  [Contabilidade.com](https://contabilidade.com/blog/simples-nacional-para-empresas-de-tecnologia-cnae-anexo-e-armadilhas-comuns/)).
- [ ] **O Simples Nacional:** Anexo III ou V, pelo Fator R
  ([Agilize](https://agilize.com.br/artigos/?p=4180)), com base no art. 18 da LC
  123/2006.
- [ ] **A inscrição municipal e o ISS**, na prefeitura da sede.
- [ ] **A nota fiscal de serviço.**
  - Para ME e EPP do Simples, o Emissor Nacional da NFS-e é obrigatório a partir
    de 1º/11/2026: a Resolução CGSN nº 191/2026 adiou a data de setembro.
  - As fontes divergem e são secundárias; confirme no Diário Oficial ou com o
    contador
    ([Senior](https://documentacao.senior.com.br/exigenciaslegais/noticias/federal/2026/2026-08-11-simples-nacional-resolucao-cgsn-no-191-2026-utilizacao-do-emissor-da-nfs-e-de-padrao-nacional-sera-a-partir-de-novembro),
    [COAD](https://www.coad.com.br/home/noticias-detalhe/137522/nfs-e-de-padrao-nacional-sera-obrigatoria-para-empresas-do-simples-nacional)).
- [ ] **O certificado e-CNPJ**, para emitir nota e falar com a Receita (seção 2).
- [ ] **O alvará.** Atividade de baixo risco feita de casa pode dispensar alvará
  pela Lei da Liberdade Econômica
  ([Lei 13.874/2019](https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2019/lei/l13874.htm)).
  Quem classifica o risco é a prefeitura.

**Dados pessoais (LGPD)**

- [ ] **Dado de saúde é dado sensível** e tem regras próprias de base legal
  ([LGPD, arts. 5º e 11](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm)).
  O app guarda peso, refeições, exames, medicamento e o registro da consulta.
- [ ] **Agente de pequeno porte.**
  - A Resolução CD/ANPD nº 2/2022 troca o encarregado (DPO) por um canal de
    contato com o titular
    ([Mattos Filho](https://www.mattosfilho.com.br/unico/resolucao-lgpd-agentes/),
    [Felsberg](https://www.felsberg.com.br/?p=39730)).
  - **Mas a regra não vale no tratamento de alto risco.** Alto risco é um
    critério geral (larga escala, ou algo que possa afetar significativamente
    direitos) somado a um específico, e o dado sensível é um dos específicos.
  - A própria ANPD diz que o dado sensível, sozinho, não basta
    ([ANPD](https://www.gov.br/anpd/pt-br/assuntos/noticias-periodo-eleitoral/aberta-consulta-publica-sobre-tratamento-de-dados-pessoais-de-alto-risco),
    [Mattos Filho](https://www.mattosfilho.com.br/unico/consulta-tratamento-dados-pessoais/)).
  - **O advogado decide** se o Pace Fit precisa de encarregado e de relatório de
    impacto (RIPD).
- [ ] **Controlador e operador.** Do paciente, a nutricionista provavelmente é a
  controladora e o Pace Fit, o operador.
  - Isso pede um contrato de operador nos termos de uso.
  - Dos dados da própria nutricionista, o Pace Fit é o controlador.
  - O advogado confirma.
- [ ] **Política de privacidade e canal do titular.** Hoje não existem, e são a
  objeção "e os dados?" de 5 compradores do painel (`founder/offer.md`).
- [ ] **O plano de incidente** (rotina 4.5): 3 dias úteis.
- [ ] **A IA paga antes do primeiro paciente real** (veja o resumo).

**Internet e consumidor**

- [ ] **Registros de acesso por 6 meses.**
  - O Marco Civil (art. 15) manda o provedor de aplicação que é pessoa jurídica,
    com fins econômicos, guardar os registros de acesso por 6 meses
    ([texto e comentário](https://modeloinicial.com.br/lei/27460/marco-civil-internet/art-15)).
  - A Vercel Pro guarda 1 dia, e 30 com o Observability Plus
    ([Vercel](https://docs.vercel.com/docs/functions/logs)).
  - A retenção da Supabase não foi conferida.
  - Seis meses pedem um "log drain" para um serviço externo
    ([comunidade Vercel](https://community.vercel.com/t/logs-and-backups/22483)).
    Vale a partir do CNPJ.
- [ ] **Código de Defesa do Consumidor.** O paciente usa de graça, mas é
  consumidor. A nutricionista pode ser tratada como consumidora numa contratação
  online.
  - O arrependimento em 7 dias vale para contrato fora do estabelecimento
    ([CDC, art. 49](https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm)).
  - Os 30 dias grátis sem cartão já cobrem isso. Os termos devem dizer como se
    cancela.

**Saúde**

- [ ] **ANVISA, software como dispositivo médico.**
  - A RDC 657/2022 cobre software para prevenção, diagnóstico, tratamento ou
    reabilitação de doença
    ([RDC 657/2022](https://antigo.anvisa.gov.br/documents/10181/5141677/RDC_657_2022_COMP.pdf/d2da154d-bd76-40ba-87ee-3d9baadb5dd3),
    [Mattos Filho](https://www.mattosfilho.com.br/unico/anvisa-softwares-dispositivos/)).
  - Um app de registro para o profissional acompanhar provavelmente fica fora.
    Mas a IA que lê laudo (`app/api/analyze-exam`) e o alerta "exame fora da
    referência" são o que mais se aproxima. A ANVISA também prepara uma revisão
    para IA.
  - Confirmar com um especialista regulatório antes de vender.
  - O passo 2 (o app constata e explica, sem julgar exame nem orientar
    tratamento) está feito em
    `docs/superpowers/specs/2026-10-27-uso-pretendido-da-ia-design.md`: a
    leitura do laudo só transcreve, o paciente vê só a posição na faixa do
    laudo e a Gaia não tem ferramenta que julgue. O parecer formal segue em
    aberto.
- [ ] **CFN.** O "atende ao CFN" não sai antes de ler o texto oficial da
  Resolução CFN 594/2017 (`founder/board.md`).

**Marca e seguro**

- [ ] **Marca:** a busca no INPI antes de investir no nome (`founder/brand.md`).
- [ ] **Seguro cyber e RC profissional:** não é obrigatório. Cotar com corretor
  quando houver pagante (seção 2).

## 7. Riscos

| # | o que dá errado | chance | estrago | o plano |
| ---: | --- | --- | --- | --- |
| 1 | **O paciente não registra**, porque não há push | alta: é a objeção nº 1 das três rodadas | alto: a fila fica vazia e a garantia vira regra | implantação com paciente escolhido a dedo; conferir no dia 7; se menos da metade das nutricionistas chega a 3 no dia 14, **parar de recrutar e fazer push ou check-in semanal** (`founder/marketing.md`) |
| 2 | **O fundador adoece ou some por uma semana** | média | alto: as chamadas param e a garantia vence | no máximo 2 chamadas por dia e nunca mais de 10 implantações abertas; uma mensagem pronta de remarcação; as datas na planilha, para refazer a agenda em 10 min |
| 3 | **E-mail de cadastro ou de senha não chega** | média a alta, se o SMTP for o padrão | alto: o paciente convidado não entra, e a implantação morre no dia 1 | SMTP próprio (Resend) antes do D; testar com um endereço de fora da equipe |
| 4 | **O app cai** (Vercel ou Supabase) | baixa | alto durante uma chamada | monitor grátis; página de status dos dois fornecedores; mensagem pronta "estamos fora, volta em…"; nada de prazo prometido |
| 5 | **O banco grátis pausa ou perde dado** | média enquanto estiver no grátis | muito alto: dado de saúde real e sem cópia diária | Supabase Pro antes do primeiro paciente real (cópia diária por 7 dias) |
| 6 | **Vazamento de dado de saúde** | baixa: toda a segurança é pela RLS, testada | muito alto: ANPD, titulares, confiança | rotina 4.5; nenhuma chave de serviço no app; o fundador não lê dado de paciente |
| 7 | **A IA grátis usa o conteúdo dos pacientes** | certa, se ficar no grátis | alto: dado sensível usado por terceiro | cobrança ligada no projeto do Gemini e "Zero Data Retention" na Groq, antes do D |
| 8 | **O custo de IA dispara** (um paciente que conversa demais) | média: não há limite por usuário no código | médio: a conta de R$ 0,84 por paciente sobe | revisão de sexta; alerta de gasto nos painéis, se houver; um limite de mensagens por dia na rota do chat |
| 9 | **Mês sem nenhuma implantação** | média: são 190 mensagens por umas 7 implantações, todas as taxas estimadas | alto: o caixa só sai (`founder/cfo.md`) | as regras do marketing: trocar gancho ou público depois de 50 mensagens abaixo de 10% de resposta |
| 10 | **Reclamação pública** (Reclame Aqui, Instagram) | baixa no piloto | médio: o comprador confia em colega e em reputação | rotina 4.4: responder no mesmo dia, em público uma vez, sem apagar |

**E dois que não são de operação, mas param a operação:**

- **O nome.** O conflito do "PaceFit" (`founder/brand.md`) pode virar pedido para
  trocar de nome se a marca crescer antes da busca no INPI. Por isso o nome mora
  num lugar só no código.
- **A cobrança que falha** depois de começar a cobrar. O Asaas tenta de novo
  duas vezes, e uma mensagem e o Pix como alternativa resolvem a maioria.

## Perguntas em aberto

1. **O SMTP da produção.** Existe SMTP próprio no Supabase (Authentication →
   SMTP)? Sem ele, o e-mail de confirmação e o de senha não chegam ao paciente.
   É o primeiro a conferir.
2. **As horas.** 10 vagas por mês com "1 hora por dia" não cabem. Quantas vagas,
   ou quantas horas?
3. **Advogado.**
   - Cotar política, termos e contrato de operador com 2 ou 3 escritórios.
   - Decidir encarregado e relatório de impacto (alto risco).
   - Confirmar o prazo em dobro de pequeno porte no incidente.
4. **ANVISA:** um especialista confirma se o app fica fora da RDC 657/2022,
   agora que a leitura de laudo pela IA só transcreve e o juízo do exame é da
   nutricionista (o passo 2, feito).
5. **Contador.**
   - O CNAE: 6203-1/00 ou 6319-4/00.
   - A data do Emissor Nacional da NFS-e.
   - A alíquota de IOF no cartão internacional: 3,5% ou 6,38%.
   - Quando o pró-labore compensa pelo Fator R.
6. **Registros de 6 meses:** a retenção dos registros da Supabase, e qual
   destino de logs usar a partir do CNPJ.
7. **Seguro:** cotação de cyber e de RC profissional com corretor.
8. **Cobrança:** o prazo de recebimento do Asaas, do Mercado Pago e da Stripe, e
   se a assinatura da Stripe funciona no Brasil.
9. **Monitor:** confirmar se o grátis da Better Stack (ou do UptimeRobot) permite
   uso comercial.
10. **IA:** se a Groq e o Google têm alerta ou teto de gasto, e o limite de
    mensagens por paciente no app.

Próximo: `/founder-launch`, para montar o teste real e a contagem até o D.
