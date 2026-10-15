# Ferramentas de inspeção visual

Servem para ver o app rodando **sem acesso ao Supabase de verdade** — é o caso
de qualquer ambiente de desenvolvimento com a saída de rede fechada, e era o
caso aqui: sem isto, não dava para olhar nenhuma tela logada.

Nada disto entra no build do app. O Next só compila `app/`, `components/` e
`lib/`, então esta pasta é inerte em produção.

## Como usar

```bash
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm i --no-save playwright
# `--no-save` (e não `-D`): a playwright não fica no package.json de
# propósito, porque o postinstall dela baixa navegadores e isso atrasaria (ou
# quebraria) o build na Vercel. Com `-D` o npm a escreveria lá. O preço é que
# QUALQUER `npm install` depois remove a playwright de novo (o npm poda o que
# não está declarado). Se os scripts daqui derem MODULE_NOT_FOUND, é isso:
# rode esta linha outra vez. O Chromium já vem instalado em /opt/pw-browsers;
# não rode `npx playwright install`.

node ferramentas/mock-supabase.cjs &        # Supabase de mentira na porta 54321

cat > .env.local <<'ENV'
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=anon-de-mentira
ENV

rm -rf .next && npm run dev &               # o .next guarda a URL antiga em
                                            # cache; sem limpar, o login
                                            # continua indo para o Supabase
                                            # anterior e não acontece nada

OUT=/tmp/prints node ferramentas/tirar-prints.cjs
```

Sai um PNG por tela × dispositivo × tema, e o script avisa no terminal quando
alguma página transborda a largura do viewport.

**Não rode `npm run build` com o `npm run dev` no ar.** Os dois escrevem na
mesma pasta `.next`, e o build apaga os chunks que o dev está servindo. O
sintoma é traiçoeiro: o navegador toma 404 nos scripts, o React não hidrata,
o formulário de login faz submit nativo e o script fotografa a tela de login
achando que é a Início. Se acontecer, pare o dev, `rm -rf .next` e suba de
novo.

## Cenários do mock

`CENARIO` escolhe os dados que o mock devolve. Sem ele, valem os de sempre (a
conta de teste da Maria), e é com esses que `tirar-prints.cjs`,
`conferir-inicio.cjs` e `conferir-dieta.cjs` rodam.

`conferir-inicio.cjs` confere a Início da Maria em 390 px e acusa com código de
saída 1: a ordem das seções, a saudação pela hora de São Paulo, a contagem do
"Para hoje" e o "Não deu para carregar tudo" com os recados falhando, o
"Calorias · limite" e o "acima do limite" (com uma refeição de 2.400 kcal que o
roteiro grava no mock), o centro dos anéis em `tabular-nums`, o Score que abre
nos quatro pilares, a sugestão de proteína, o "+250 ml" (sobe, "Desfazer",
uma gravação só com dois toques, e "Não deu para registrar a água" com a
escrita ou a leitura de `daily_logs` falhando), o "Não deu para carregar os
números de hoje" com `meals`, `daily_logs` ou `profiles` falhando, o Progresso
de 30 dias e o "Não deu para carregar o peso", os alvos de 44 px, os links, nenhuma caixa alta nem degradê, nenhuma rolagem lateral e a
Instrument Sans (também no `NutriHome`).

`conferir-dieta.cjs` faz o mesmo com a Dieta da Maria (mock sem cenário, dev no
ar): o rótulo do dia ("Hoje, qui. 15/10") que abre o seletor de data pelo
`showPicker()` e o `input type="date"` escondido (`max` em hoje, data futura e
campo limpo sem efeito), as setas, o chip "Hoje", os alvos de 44 px (medidos
com `elementFromPoint`, porque o "Comi isso" tem 40 px visíveis e 44 de
toque), "Calorias · limite" e "· meta" pelo peso e pela meta de peso, a barra de
macros (três segmentos, 2 px entre eles, a legenda com gramas), a sugestão de
proteína só em hoje, o plano num cartão só (`#plano`, "de Ricardo, seu
nutricionista", "· feito", "comi", "Comi isso" com a gravação falhando), as
refeições registradas (excluir incluído) e o "Nenhuma refeição neste dia.". Com
`meals`, `profiles`, `body_measurements`, `patient_links`, `meal_plans` e
`meal_plan_items` falhando (`/__falhar`, sempre por `comFalha`, que desfaz no
`finally`), confere que nenhum anel vira "0", nenhum papel das calorias nem
sugestão é inventado e que o plano diz que não carregou. Também a rolagem até
`#plano` (direto e pelo link da sugestão da Início), o cardápio de Meu plano
(sem o "ver em Meu plano"), o formulário de refeição (só a linguagem mudou), os
atalhos `?novo=1` e `?foto=1`, nenhuma caixa alta nem classe da paleta antiga e
nenhuma rolagem lateral.

| `CENARIO`  | Quem entra          | Para quê |
|------------|---------------------|----------|
| (nenhum)   | `maria.teste@…` (paciente) ou `nutri.teste@…` | telas do paciente, Início |
| `carteira` | só o nutricionista (e-mail com "nutri") | o detalhe do paciente e a Início do nutri |

O e-mail do login decide quem entra: qualquer um que contenha "nutri" entra
como o nutricionista, o resto como a Maria.

A `carteira` traz seis pacientes, cinco para uma situação cada e a Helena, dos
gráficos, e dois convites pendentes. As datas saem do dia em que o mock sobe,
então os alertas valem em qualquer dia:

- **Carlos Mendes**: dose atrasada, e mais nada.
- **Beatriz Rocha**: usa 2.200 kcal onde a prescrição diz 1.800 (aviso de meta
  aberto, `kind` 'meta'), apagou uma sessão "Treino B — Inferiores" do plano
  (aviso de plano aberto, `kind` 'plano', com o nome da sessão no `field` e
  `current_value` 'removido pelo paciente', como o gatilho do banco grava),
  faltou a um treino, deixou 2 mensagens sem resposta e tem **dois**
  tratamentos ativos: o antigo com a dose vencida e o novo em dia.
- **Joana Ferreira**: 12 dias sem registrar, com um exame alterado.
- **Pedro Alves**: acabou de chegar, nunca registrou nada, sem metas.
- **Luiza Prado**: em dia, sem nenhum alerta.
- **Helena Duarte**: em dia, sem nenhum alerta (e por isso a fila dos outros
  fica como estava). É a paciente dos gráficos das abas Corpo e Clínico, logo
  abaixo.

**Helena, os gráficos.** Os dados dela existem para dar o que ver aos gráficos do
nutricionista (a Evolução da aba Corpo e o comparativo de exames da aba Clínico),
e saem todos de `dias(n)`:

- **Corpo.** O vínculo começou há 154 dias (22 semanas). Pesagens de casa de 2 a
  4 dias por semana, a média semanal caindo de 74,4 (a primeira semana com
  pesagem) para 70,1 kg (a última). **A 8ª semana não tem pesagem nenhuma**, e a
  2ª consulta cai nela. Seis consultas realizadas (`ap-h1` a `ap-h6`), cada uma
  com a medida de peso, cintura e % de gordura (74,6 / 92 / 34,0 até 70,3 / 85 /
  30,4); a primeira é no dia do vínculo, e por isso o peso inicial do anel é o
  dela, 74,6 (o anel diz 4,3 de 8,6 kg, 50%, com a meta de 66 kg). **Ontem é o
  único dia com as duas medidas**: a consulta (70,3) e uma pesagem de casa (um
  pouco abaixo), e é o último dia com peso, então o "Peso atual" diz "na
  consulta". Cintura e % de gordura de casa aparecem em quatro semanas do meio
  (os pontos vazados), nunca antes da primeira consulta nem depois da última: a
  variação (−7 cm, −3,6 pontos) é a das consultas.
- **Clínico.** Três laudos e um resultado sem número, todos de **mais de 180
  dias atrás**: a fila conta como "N exames fora da referência" qualquer exame
  de status diferente de "normal" dos últimos 180 dias, e triglicerídeos 168 ou
  LDL 132 são "atencao" de verdade (é o que o app grava); mais novos, a Helena
  entraria na fila. São 18 resultados: triglicerídeos 141 → 168 mg/dL (saiu da
  faixa), com um 165 lançado antes no mesmo dia do 168 (a linha avisa "mais de
  um resultado em dd/mm"), LDL 145 → 132 (mais perto), vitamina D 18 → 24 → 38
  ng/mL (entrou, com minigráfico), "Glicose" 101 e "Glicemia de jejum" 98 e 92
  mg/dL (uma linha só, com minigráfico) e, 7 dias depois do 92, uma "Glicemia
  de jejum" sem número, "Amostra hemolisada" (a linha diz "depois: Amostra
  hemolisada em dd/mm"), colesterol total 200 → 190 mg/dL (ref. "< 190": o "<"
  é estrito, o 190 ainda está fora, e a linha diz "mais perto da faixa") e
  VLDL-colesterol 24 mg/dL **no mesmo dia do 190**, que tem de continuar uma
  linha à parte, ferritina 45 ng/mL (um resultado, a data mais antiga das
  linhas de um resultado só, para ficar por último) e vitamina B12 310 pg/mL →
  235 pmol/L (unidade diferente entre os dois resultados). A faixa de cada
  exame em `reference_range` é a do laudo, menos a do VLDL: "< 190 mg/dL", o
  texto da tabela do colesterol total, que o app antigo gravava pelo casamento
  frouxo de nome; o comparativo não a toma por laudo, e o VLDL fica sem faixa
  nem selo. A B12 de 235 pmol/L está gravada "atencao", como o app antigo a
  julgava (pela tabela em pg/mL); o selo do comparativo sai da faixa do laudo
  (148 a 664) e diz "Normal".
- **Dias da semana.** A 8ª semana fica sem pesagem em qualquer dia, mas as
  pontas dependem do dia em que o mock sobe: no domingo a 1ª semana é só o dia do
  vínculo (a consulta, sem pesagem de casa), e na segunda a semana em curso é só
  hoje (sem pesagem). No sábado a 1ª semana tem uma pesagem só, e na terça a
  semana em curso também. Por isso a Verificação 20 não conta quantas semanas
  dizem "sem pesagem": confere que há ao menos uma e que a linha da média tem
  duas partes. As consultas do meio nunca caem no fim de semana.
- **O mock devolve a linha inteira**, qualquer que seja a lista de colunas do
  `select` (veja "O mock ignora a lista de colunas", abaixo): uma coluna
  esquecida ou escrita errada numa leitura nova do Corpo ou do Clínico passa
  nos dados da Helena e só aparece no banco de verdade. A ordem
  (`order=date.asc&order=created_at.asc`, ou as duas numa lista) o mock já
  entende, e o `offset` também: as leituras dos exames e do Corpo pedem em
  páginas (`.range()`), e sem ele a 2ª página repetiria a 1ª. A 1ª página
  pede `Prefer: count=exact` (`lerEmPaginas` confere a soma com o total), e o
  mock o devolve no `Content-Range`, como o PostgREST.

E as consultas (`appointments`), uma situação por paciente sem mudar os
alertas acima:

- **Luiza**: realizada há 14 dias (tem "desde a última consulta"), uma em
  andamento agora (começou há 10 minutos) e a próxima daqui a 2 dias, às 10:00,
  online.
- **Beatriz**: pediu consulta online daqui a 2 dias, às 10:15, com recado, em
  cima da consulta da Luiza (para o aviso de choque do "Aceitar").
- **Carlos**: agendada amanhã às 09:00, com pedido de remarcação.
- **Joana**: agendada há 5 dias e nunca fechada (sem desfecho).
- **Pedro**: 1ª consulta amanhã às 11:00.
- **Helena**: as seis realizadas, todas no passado (a 1ª há 154 dias, a última
  ontem), sem registro de prontuário; a medida de cada uma está em
  `body_measurements` com `measured_by` e `appointment_id`.

E os registros da consulta (prontuário: `consultation_records`, os adendos em
`consultation_addenda` e a avaliação física em `body_measurements`):

- **Luiza**: a consulta de 14 dias atrás tem registro **concluído**, com as cinco
  partes (anamnese, diagnóstico, conduta, "observar no retorno" e a medida de
  peso, 66,4 kg, publicada na série dela e ligada à consulta; é a única medida
  desse dia), assinado como "Ricardo Albuquerque / CRN-3 12345", e **um adendo**.
  A consulta em andamento **não** tem registro.
- **Joana**: a consulta sem desfecho tem um **rascunho** só com a anamnese.
- O perfil do nutri **não tem CRN** (`crn` nulo): é o que faz o diálogo de
  concluir pedir o número. Concluir com um CRN digitado grava no perfil, e o
  `POST /__reset` apaga de novo.

No cenário padrão, a Maria tem uma consulta realizada há 20 dias e a próxima
daqui a 3, para o cartão de consulta do lado do paciente. A medida de 20 dias
atrás (67,7 kg) é a que o nutri tirou nessa consulta (`measured_by` dele,
`appointment_id` `ap-m1`): a página Medidas dela mostra a marca "Medida na
consulta" e não oferece o excluir nessa linha. Com o mock **sem** `CENARIO` e o
dev no ar, `node ferramentas/conferir-consulta-paciente.cjs` confere esse lado:
o cartão de consulta (Início e "Meu plano"), a página Medidas (a marca, o excluir
só nas medidas dela, "Este registro não pode ser apagado." quando o banco recusa
sem erro e o aviso de erro no DELETE) e que o Perfil do paciente não mostra o CRN.

```bash
CENARIO=carteira node ferramentas/mock-supabase.cjs &
# o resto como acima: .env.local, rm -rf .next, npm run dev

OUT=/tmp/prints-nutri node ferramentas/tirar-prints-nutri.cjs
```

`tirar-prints-nutri.cjs` entra como nutricionista, tira os prints (a página do
paciente é em abas, `?aba=`: Beatriz em todas as abas e os outros no Resumo ×
celular 390 px / computador 1440 px × claro/escuro, mais Beatriz com "Editar
metas" aberto, a conversa em tela cheia no celular e Beatriz em 1100 px),
confere erro e transbordo em todas as abas de todos os pacientes e
**acusa**, com código de saída 1, quando alguma coisa não bate: transbordo de
largura, seção com erro, a fila de cada paciente, o rascunho de metas que
sobrevive ao envio de uma mensagem, o Voltar da conversa, o tratamento mais
recente, "Sem acesso", o Reaplicar e o que o editor de metas mostra, a
mudança do plano de treino no Treino (com a linha "Também dá baixa…" embaixo
do Reaplicar), o "Aplicando…" que segura o botão até a página nova chegar, o
"Fechar edição" desligado com a gravação em voo, a trava que o rascunho do
cardápio põe nas metas e as abas (aba padrão, só a aba aberta montada, os
botões da fila que abrem abas, a pergunta antes de descartar um rascunho
pela barra de abas, a troca segurada com gravação em voo
e a aba que a tela cheia do celular guarda). Também fotografa a agenda nas três
vistas e confere as consultas (Verificação 15): a vista padrão e a última
usada, a linha de aviso, o pedido tracejado na semana, a pendência no mês,
o aviso de choque e o "Aceitar" do pedido da Beatriz, "Manter horário" do
Carlos, Realizada e Faltou já na consulta em andamento da Luiza, fechar a da
Joana como realizada (e o "Sem retorno marcado" que aparece), o aviso de
choque ao marcar em cima da Luiza e a seta que mostra a sexta aba no
celular. As Verificações 16 a 18 conferem o registro da consulta: o rascunho
(16: "Salvando…" e "Salvo às", o texto que volta ao recarregar e no Voltar do
navegador, o "antes" do peso e o IMC, a medida inválida que não apaga a salva,
a gravação que falha e o "Tentar de novo", a coluna "Para esta consulta", o
celular, "Sem acesso", a consulta de outro paciente, a leitura que falha e o
descarte); o concluir (17: o prazo da conferência ao abrir, o diálogo com o
CRN e a faixa, o concluído travado e o rótulo do IMC, o que ficou no mock, o
adendo e o aviso do navegador com um adendo não salvo, o campo do CRN quando
o banco o pede de novo e as recusas do banco no diálogo); e as entradas (18: o botão no painel da agenda e da aba
Consultas, os selos, o "Faltou" recusado com rascunho, o Observar da consulta
que começou por último, a aba sem selos quando os registros não carregam e o
celular). A Verificação 19 confere a medida da consulta na aba Corpo
da Luiza (a marca "na consulta" só na linha do prontuário, e sem transbordo no
celular) e o campo "CRN (aparece no prontuário)" do Perfil do nutri: aparece, aceita até 30
caracteres, salva sem os espaços das pontas, reaparece ao recarregar e grava nulo
quando em branco. A Verificação 20 confere as abas Corpo e Clínico. No Corpo, a
da Helena (o anel com 50% e "4,3 de 8,6 kg", a média semanal com a lacuna e o
"sem pesagem", os seis pontos de consulta, a meta, a dica ao passar o mouse e ao
tocar, cintura e % de gordura, o contraste da linha e dos pontos nos dois temas e
o celular sem transbordo), o "Ainda não dá para ver tendência" do Pedro e o erro
da aba quando `body_measurements`, `patient_links` ou `appointments` falham
(`/__falhar`), as linhas das consultas em `campo` com 3:1 e o "definir nas
metas" do Pedro, que não tem meta. No Clínico, a da Helena (a linha de resumo e
a tabela do comparativo na ordem, uma linha por exame: "Glicose" e "Glicemia de
jejum" numa só, o Colesterol total e o VLDL-colesterol do mesmo dia em duas, o
Colesterol total "mais perto da faixa" com o "<" estrito, o selo de cada Último
pela faixa da linha (a B12 "Normal", não o "atencao" gravado; o VLDL, com a
referência da tabela gravada, sem faixa nem selo), a B12 em "unidade diferente
do anterior" sem o número antigo, a data com o ano quando não é o de hoje, os
avisos "mais de um resultado" e "depois: Amostra hemolisada" com o contraste; o
minigráfico só nas duas linhas com 3 resultados, com o tamanho, as bordas da
faixa e o contraste da linha e dos pontos nos dois temas; a nota da ordem; a
caixa da tabela com foco e rolagem por teclado no celular, sem transbordo da
página; e "Ver todos os resultados (18)", que abre a lista de sempre, do mais
novo ao mais velho), a da Joana ("Sem comparação ainda", com a lista aberta e
sem tabela nem minigráfico), a do Pedro ("Nenhum exame registrado.") e o erro
quando `exams` falha (`/__falhar`): a tela diz "Não foi possível carregar os
exames" só no bloco Exames, com o Tratamento na tela, e não "Sem comparação
ainda", "Nenhum exame registrado" nem tabela. A Verificação 19 confere também
que o Peso atual da Luiza, que é de casa, diz "em dd/mm/aaaa, em casa". Ele descobre os
ids dos pacientes perguntando ao mock (`/__cenario`), e recusa rodar se o mock
subiu com outro cenário.
Sem `OUT`, os PNGs vão para `prints-nutri` no diretório temporário do
sistema.

O mock aceita `PATCH` e `DELETE` no CORS; sem isso o navegador recusava o
`PATCH` que marca a conversa como lida e o console enchia de erro. Ele não
guarda nada: um `POST` responde 201 e a consulta seguinte devolve os mesmos
dados de antes. **A exceção são as consultas e os registros**: as seis funções
de consulta (`marcar_consulta`, `pedir_consulta`…) e as do registro
(`salvar_registro`, `concluir_registro`, `descartar_rascunho`,
`adicionar_adendo`, mais as duas recusas novas de `fechar_consulta`) têm estado
no mock, com as mesmas regras e mensagens da migração e na mesma ordem de
conferência, para dar para aceitar um pedido, salvar um rascunho e concluir e
ver a tela mudar. O `updated_at` do rascunho é a trava de concorrência: o mock o
devolve com microssegundos, como o banco, e ele sempre anda. Quem vale é o
banco: as regras de verdade são testadas em SQL (abaixo).

**O mock ignora a lista de colunas do `select`**: devolve a linha inteira,
peça o que pedir. Um erro de digitação numa lista de colunas
(`COLUNAS_REGISTRO`, `COLUNAS_MEDIDA`, `COLUNAS_CONSULTA`…) ou uma coluna
esquecida passa em todas as verificações de tela e só aparece no banco de
verdade: coluna que não existe dá 400 no PostgREST, e a esquecida chega
ausente. Filtro numa coluna que a tabela não tem também passa aqui e dá 400
lá. Nenhuma ferramenta daqui confere que a lista existe na tabela. O que chega
mais perto são os Supabases em memória dos testes. O de `lib/nutri.test.ts` (as
leituras do resumo, da linha do tempo e da série de `lib/nutri.ts`) e o de
`lib/bancoEmMemoria.ts` (as leituras em páginas do Corpo e dos exames, em
`lib/evolucaoDb.test.ts` e `lib/examesDb.test.ts`) devolvem só as colunas
pedidas no `select`, então a coluna esquecida chega ausente, e só aparece se um
teste depender do valor dela. Nenhum dos dois sabe quais colunas a tabela tem:
a escrita errada volta `undefined`, sem o 400 do PostgREST, e no de
`lib/nutri.test.ts` um filtro `is` ou `not` numa coluna que não existe também
passa sem erro (lê a coluna como nula). Nenhum aplica a RLS. O de `lib/nutri.test.ts` nunca devolve `error`; o
de `lib/bancoEmMemoria.ts` devolve quando o teste pede (é como os testes veem a
página que falha), tem `range` e anota cada chamada com os filtros. Os dois só
cobrem as leituras que têm teste; a tabela "Medidas registradas" do Corpo, por
exemplo, não tem. O de `lib/registroDb.test.ts` é mais simples: o `select`
ignora a lista de colunas, e ele só confere filtro, ordem e `limit`.

Quatro escritas pelo PostgREST também têm estado (o `/__reset` desfaz):

- `PATCH` e `DELETE` em `body_measurements` seguem a RLS do paciente: só enxergam
  a linha dele com `measured_by` nulo. Numa linha da consulta o banco **não dá
  erro**: afeta zero linhas, e é isso que o mock devolve (204, e `Content-Range:
  */0` com `Prefer: count=exact`, que é o que `.delete({ count: "exact" })`
  manda). Um `PATCH` que tentasse pôr `measured_by` ou `appointment_id` numa
  linha dele leva 403, como o `with check` do banco.
- `POST` em `profiles` (o upsert da página Perfil) grava no perfil de quem pede,
  com o check do CRN (até 30 caracteres): é por isso que o CRN salvo reaparece ao
  recarregar.
- `POST` em `daily_logs` (o upsert de `adicionarAgua`) junta as colunas enviadas
  à linha do dia, como o `merge-duplicates` do PostgREST, e cria a linha que não
  existe: sem isto o "+250 ml" da Início gravava e o anel não subia.
- `POST` em `meals` guarda a refeição (o "Comi isso" da Dieta também fica), e
  o `DELETE` a apaga (o excluir da Dieta). Como no banco, o `DELETE` só enxerga
  a refeição de quem pede: a dos outros afeta zero linhas, sem erro.
  Nos `POST`, linha de outro usuário leva 403.

Dois endereços que não são do Supabase (além do `/__cenario`):

- `POST /__reset` volta as consultas, os registros, os adendos, as medidas, os
  perfis (o CRN), a água do dia e as refeições ao que o cenário subiu, e desliga
  o `/__falhar`; o roteiro chama no começo e no fim.
- `POST /__falhar` com `{ "tabela": "consultation_records" }` faz os `GET` nessa
  tabela devolverem 500 até o próximo `/__reset`. As leituras da página são do
  servidor do Next, que o `page.route` do Playwright não intercepta; sem isto
  não há como ver a tela de "não carregou". Com `"escrita": true` (`{ "tabela":
  "daily_logs", "escrita": true }`) só as escritas (`POST`, `PATCH`, `DELETE`)
  dão 500 e as leituras seguem: é a gravação que falha numa tela que, com a
  leitura falhando, nem mostraria o botão (o "+250 ml" da Início).

## Funções e regras do banco (SQL)

As migrações novas ficam em `supabase/migrations/` e são testadas num Postgres
**local**, nunca no de produção:

```bash
pg_ctlcluster 16 main start          # o container já tem o Postgres 16
ferramentas/testar-sql.sh            # todas as migrações e todos os testes
```

`supabase/testes/base-local.sql` imita o que a Supabase já tem (o
`auth.uid()` lido do JWT, os papéis `anon` e `authenticated`, `profiles`,
`patient_links` e as funções de vínculo copiadas de produção), e cada teste
troca de usuário como a Supabase faz: o JWT em `request.jwt.claims` e depois
o papel, nessa ordem. Tudo numa transação que termina em `ROLLBACK`.

Os 1440 px do computador não são acaso: as duas colunas da página do paciente
só existem a partir de `xl` (1280 px). Abaixo disso a página é uma coluna.

## Guia de estilo

A rota `/estilo` (só em desenvolvimento, `notFound()` em produção) mostra cor,
tipografia, componentes e densidade nos dois temas, com a razão de contraste
calculada em cima de cada tom. Essa não precisa do mock: não consulta dado
nenhum.
