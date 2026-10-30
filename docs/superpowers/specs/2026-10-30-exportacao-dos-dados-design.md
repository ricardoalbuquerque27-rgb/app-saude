# Exportação dos dados dos pacientes

Spec de 30/10/2026. Aprovada em conversa com o dono do produto, parte por
parte. É a resposta à objeção que mais se repete nas recusas por confiança
das seis rodadas do painel (`founder/panel-*/`): "e se a empresa nova sumir
com os dados dos meus pacientes?", com o pedido "poder exportar tudo a
qualquer momento".

## O que é

Um botão para a nutricionista baixar, num `.zip`, tudo o que o Pace Fit tem
dos pacientes dela: planilhas (CSV, para guardar e levar a outro sistema) e,
para cada paciente, um prontuário legível (HTML que abre sem internet e
imprime em PDF). Pronto quer dizer: ela fica com arquivos que funcionam sem o
Pace Fit, e nenhum arquivo incompleto passa por completo.

**Não é:** cópia de segurança do app inteiro; migração automática para o
Dietbox ou outro sistema (a planilha ajuda, cada sistema importa do seu
jeito); exportação feita pelo paciente.

## Decisões

1. **Formato:** planilhas CSV e um prontuário legível por paciente, no mesmo
   `.zip`.
2. **Alcance:** "Exportar tudo" na lista de Pacientes (todos, um `.zip` com
   uma pasta por paciente, ex-pacientes inclusive) e "Exportar dados" no
   cabeçalho da página do paciente (só ele: a pasta dele e o LEIA-ME).
3. **Ativo e ex-paciente.** Do paciente com vínculo ativo vai tudo o que a
   nutricionista já lê no app. Do ex-paciente (vínculo `revoked`) vão só os
   registros e adendos que ela escreveu, que são o que a RLS ainda deixa ela
   ler (`consultation_records_author_read`), com o nome que ela deu no convite
   (`patient_links.patient_label`). O convite pendente (sem `patient_id`) fica
   de fora.
4. **Fica de fora:** as análises da IA para o paciente (`health_insights`,
   `reports`): não são dado clínico, e o histórico guardado ainda tem texto de
   antes do uso pretendido (ver CLAUDE.md, "Uso pretendido").
5. **Tudo ou nada.** Qualquer leitura que falha (erro, página cortada,
   contagem que não bate, teto) cancela a exportação inteira, e nada é
   baixado. Um `.zip` incompleto que parece completo é o pior resultado: ela o
   guardaria achando que está tudo ali. É a regra do app: leitura que falha
   não é "não tem".
6. **No navegador dela.** O navegador lê com o supabase-js e a sessão dela,
   pela RLS, monta os arquivos e baixa. Nada vai a servidor nem a rota da
   Vercel (que corta resposta acima de 4,5 MB e função longa), nada é
   guardado pelo Pace Fit e nada fica salvo no navegador (sem
   `localStorage`). Sem chave de serviço, como em todo o app.
7. **O aviso antes de baixar:** "O arquivo tem dados de saúde dos seus
   pacientes. Guarde num lugar seguro e não mande por WhatsApp nem por
   e-mail."
8. **A página de dados** (onde ficam os dados, LGPD, quem é a empresa, o que
   acontece se fechar) **não vai ao app agora.** Hoje ela teria de dizer que
   não há CNPJ, que o banco está no plano grátis da Supabase (sem cópia
   diária; conferido em 29/10), que os dados ficam nos EUA (Supabase
   `us-east-1`, Vercel `iad1`) e que a IA está no plano grátis do Gemini e da
   Groq. O dono do produto decidiu: "não vamos mentir". O texto vai como
   rascunho em `docs/pagina-de-dados-rascunho.md`, com o que já é fato e
   `[a confirmar]` no que depende dele ou do advogado. Vira página quando os
   fatos mudarem. Não vai como página escondida no código: um endereço não
   linkado ainda abre para quem o achar.

## O `.zip`

Nome: `pacefit-exportacao-AAAA-MM-DD.zip` (a data de hoje em São Paulo); no
"Exportar dados" de um paciente, `pacefit-<pasta-do-paciente>-AAAA-MM-DD.zip`.

```
LEIA-ME.txt
pacientes.csv
<pasta do paciente ativo>/
  prontuario.html
  cadastro.csv
  medidas.csv
  refeicoes.csv
  respostas-das-refeicoes.csv
  dia-a-dia.csv
  exames.csv
  prescricoes.csv
  cardapios.csv
  plano-de-treino.csv
  treinos.csv
  confirmacoes-de-treino.csv
  rotinas.csv
  tratamento.csv
  consultas.csv
  conversa.csv
  notas-privadas.csv
<pasta do ex-paciente>/
  prontuario.html
```

Arquivo de tabela vazia sai com o cabeçalho e nenhuma linha: "não tem" é um
fato que a planilha mostra, diferente de "não veio".

### Pastas

`pastaDoPaciente(nome, id, usadas)`: o nome em minúsculas, sem acento, com
hífen no lugar do resto (`Maria Souza` → `maria-souza`), até 40 caracteres;
sem nome, `paciente`. Se a pasta já foi usada nesta exportação, acrescenta os
4 primeiros caracteres do id (`maria-souza-3f2a`), e depois mais, até ficar
única. Ex-paciente leva o prefixo `ex-paciente-`.

### As planilhas

- UTF-8 com BOM (sem ele, o Excel brasileiro mostra "Ã§" no lugar de "ç"),
  separador `;` (o Excel com vírgula decimal espera `;`), fim de linha CRLF.
- Célula com `;`, aspas, quebra de linha ou espaço nas pontas vai entre
  aspas, com as aspas dobradas. Célula que começa com `=`, `+`, `-` ou `@`
  ganha um `'` na frente: sem isso o Excel a executa como fórmula (o paciente
  escreve o texto das refeições e das mensagens).
- Número com vírgula decimal e sem separador de milhar (`1234,5`); vazio para
  nulo. Data `dd/mm/aaaa`; instante `dd/mm/aaaa hh:mm`, na hora de São Paulo
  (`dataNoBrasil` e companhia; nunca `slice(0,10)`, ver "Fuso horário" no
  CLAUDE.md).
- Cabeçalhos em português. Ids ficam de fora, menos onde ligam uma planilha a
  outra (`cardapio`, `treino`, `rotina`, `consulta`).

| arquivo | de onde | colunas |
| --- | --- | --- |
| `pacientes.csv` | `patient_links` + `profiles` | pasta, nome, situação (ativo / ex-paciente), vínculo desde, CPF, nascimento |
| `cadastro.csv` | `profiles` | nome, CPF, nascimento, sexo, altura (cm), meta de peso, meta de calorias, meta de proteína, meta de água (ml) |
| `medidas.csv` | `body_measurements` | data, peso (kg), % de gordura, cintura, quadril, peito, braço, coxa, pescoço, panturrilha (cm), observação, origem (em casa / na consulta) |
| `refeicoes.csv` | `meals` | data, refeição, descrição, kcal, proteína, carboidrato, gordura (g) |
| `respostas-das-refeicoes.csv` | `meal_checks` | data, refeição, resposta (comi / não comi) |
| `dia-a-dia.csv` | `daily_logs` | data, água (ml), sono (h), passos, humor, energia, estresse, dor, observação |
| `exames.csv` | `exams` | data, exame, valor, unidade, faixa do laudo, observação |
| `prescricoes.csv` | `prescriptions` | data, meta de calorias, meta de proteína (g), meta de água (ml), meta de peso (kg), observação |
| `cardapios.csv` | `meal_plans` + `meal_plan_items` | cardápio, ativo (sim / não), criado em, refeição, opção, descrição, kcal, proteína, carboidrato, gordura, observação |
| `plano-de-treino.csv` | `workout_plan` | dia da semana, título, esporte, observação, rotina, prescrito pela nutricionista (sim / não) |
| `treinos.csv` | `workouts` + `exercises` | treino, data, nome, categoria, duração (min), observação, exercício, séries, repetições, carga (kg), RPE |
| `confirmacoes-de-treino.csv` | `plan_completions` | data, sessão do plano, resposta (fui / não fui) |
| `rotinas.csv` | `routines` + `routine_exercises` | rotina, nome, prescrita pela nutricionista (sim / não), exercício, séries, repetições, carga (kg), descanso (s), observação |
| `tratamento.csv` | `treatments`, `dose_logs`, `side_effects` | tipo (tratamento / dose / efeito), data, medicamento, dose, frequência (dias), náusea, apetite, fadiga, outro, observação |
| `consultas.csv` | `appointments` | consulta, início, duração (min), tipo, modo, situação, quem cancelou, mensagem do paciente |
| `conversa.csv` | `patient_notes` com `visibility = 'shared'` | instante, quem escreveu (você / paciente), mensagem |
| `notas-privadas.csv` | `patient_notes` com `visibility = 'private'` | instante, nota |

Nas planilhas que juntam duas tabelas (`cardapios`, `treinos`, `rotinas`)
vai uma linha por item filho, repetindo as colunas do pai; o pai sem filho
sai numa linha só, com as colunas do filho vazias. O `tratamento.csv` junta
três tabelas numa coluna `tipo`, uma linha por registro.

O `status` gravado dos exames fica de fora: pode ter vindo da tabela pelo
casamento frouxo antigo (ver "Comparativo dos exames" no CLAUDE.md), e a
faixa do laudo vai na coluna dela.

### O prontuário legível

`prontuario.html`, um arquivo só, CSS dentro, sem script, sem fonte nem
imagem de fora. No topo: o nome do paciente e, do ativo, CPF, nascimento e
sexo; a nutricionista (nome e CRN do perfil) e a data da exportação. Depois
os registros do mais antigo para o mais novo, cada um com:

- a data da consulta (o `starts_at` da consulta, quando ela é legível; do
  ex-paciente, que perdeu a leitura da agenda, "registro criado em …");
- anamnese, diagnóstico nutricional, conduta, observar no retorno e as
  medidas da consulta, com os nomes e as unidades de `lib/registro.ts`;
- concluído: "Concluído em dd/mm/aaaa hh:mm por <assinatura_nome>, CRN
  <assinatura_crn>"; rascunho: uma faixa "RASCUNHO — não concluído", que não
  passa por registro assinado;
- os adendos, na ordem em que foram escritos, cada um com instante, nome e
  CRN.

Sem registro, o prontuário diz "Nenhuma consulta registrada." Todo texto
passa por escape de HTML (`&`, `<`, `>`, `"`, `'`). `@media print` quebra
página entre registros e não corta um registro ao meio quando cabe.

### O LEIA-ME

A data e a hora da exportação, a nutricionista (nome e CRN), quantos
pacientes ativos e ex-pacientes, o que é cada arquivo (uma linha por
arquivo), o formato das planilhas (`;`, vírgula decimal, datas em
dd/mm/aaaa, hora de São Paulo), que do ex-paciente vêm só os registros e por
quê, o que ficou de fora e por quê, e o aviso de dado de saúde.

## Como funciona

### As peças

- `lib/exportacao/planilha.ts`: `celula`, `planilha(colunas, linhas)` (o texto
  com BOM) e os formatos de número, data e instante. Puro, testado.
- `lib/exportacao/pastas.ts`: `pastaDoPaciente`. Puro, testado.
- `lib/exportacao/prontuario.ts`: `prontuarioHtml(dados)`. Puro, testado.
- `lib/exportacao/ler.ts`: `lerExportacao(supabase, { nutriId, pacienteId? },
  aoAvancar)`. Lê os vínculos da nutricionista; de cada paciente ativo, cada
  tabela por `lerEmPaginas` (`lib/paginacao.ts`), com `count: "exact"` na 1ª
  página, ordem que desempata terminando no `id` e o teto
  `TETO_DA_EXPORTACAO = 50_000` linhas por tabela por paciente (chegar a ele é
  falha, e a mensagem diz qual tabela); de todos, os registros e adendos dela.
  Devolve `{ ok: true, dados }` ou `{ ok: false, oQue }`, em que `oQue` é a
  leitura que falhou em português ("as refeições de Maria Souza"). Chama
  `aoAvancar(feitos, total)` a cada paciente. Testado contra o
  `bancoEmMemoria`.
- `lib/exportacao/montar.ts`: `arquivosDaExportacao(dados, agora)` →
  `Record<caminho, string>` e `zipar(arquivos)` → `Uint8Array`. Testado
  abrindo o `.zip` de volta.
- `components/BotaoExportar.tsx`: o botão, o aviso, o andamento, o download
  (`Blob` e um `<a download>` temporário, revogado depois) e a mensagem de
  falha. Recebe `pacienteId?`.

**O `.zip` sai do `fflate`** (`zipSync`; MIT, sem dependências). Um ZIP
escrito à mão é pouco código, mas nomes com acento pedem a flag UTF-8 e o
CRC tem de bater, e um erro ali só aparece quando o arquivo não abre no
computador dela.

### Onde ficam

- `components/PacientesClient.tsx`: "Exportar tudo", no cabeçalho da lista,
  ao lado de "Convidar". Só aparece com pelo menos um vínculo ativo ou
  revogado.
- `app/app/pacientes/[id]/secoes/Cabecalho.tsx`: "Exportar dados", nas ações
  do cabeçalho, no estilo `ACAO_SECUNDARIA` do tema clínico.

### As telas

1. O clique abre o aviso (item 7 das decisões), com "Exportar" e "Cancelar".
2. Exportando: "Lendo os dados… 3 de 12 pacientes", numa região
   `aria-live="polite"`; "Exportar" desabilitado e "Cancelar" interrompe (a
   leitura para no próximo paciente e nada é baixado).
3. Pronto: "Pronto. O arquivo foi baixado." e o nome do arquivo.
4. Falha: "Não deu para exportar: a leitura de <oQue> falhou. Nada foi
   baixado." com "Tentar de novo", em `app-atencao` no app e em
   `clin-atencao` no tema clínico.

Botões com 44 px. O texto segue o app: frase normal, sem caixa alta, toda
frase "Não deu para …" termina em ponto.

## Testes

- `planilha`: a vírgula decimal, nulo vazio, data e instante em São Paulo
  (inclusive um instante das 22h, que em UTC já é o dia seguinte), `;`, aspas
  e quebra de linha dentro da célula, a fórmula (`=1+1` sai `'=1+1`), o BOM e
  o CRLF.
- `pastaDoPaciente`: acento, símbolos, nome vazio, os 40 caracteres, dois
  nomes iguais e a colisão também nos 4 caracteres do id.
- `prontuarioHtml`: o escape (um `<script>` na anamnese sai como texto), o
  rascunho marcado, a ordem dos registros e dos adendos, "Nenhuma consulta
  registrada.", o ex-paciente sem CPF nem consulta legível.
- `lerExportacao`, contra o `bancoEmMemoria`: 2.500 refeições com `max-rows`
  de 1.000 vêm inteiras; erro numa página, contagem que não bate e o teto
  são falha com o `oQue` certo; o ex-paciente vem só com os registros; o
  convite pendente fica de fora; o "Exportar dados" lê só aquele paciente.
- `arquivosDaExportacao` e `zipar`: o `.zip` aberto de volta (`unzipSync`)
  tem os caminhos da árvore acima, o LEIA-ME e o BOM nas planilhas.
- Tela, com o Supabase falso em `CENARIO=carteira`
  (`ferramentas/conferir-exportacao.cjs`): "Exportar tudo" e "Exportar dados"
  baixam, o `.zip` abre e tem as pastas da carteira; com `/__falhar` numa
  tabela, aparece a mensagem de falha e nenhum download; o aviso, o andamento
  e o "Pronto" na tela; o botão some para o paciente.

## O que fica para depois (vai ao "Em aberto")

- **O nome do ex-paciente.** O registro não guarda o nome do paciente; do
  ex-paciente, a exportação usa o `patient_label` do convite, que pode estar
  vazio ("Paciente sem nome no convite"). Para o prontuário identificar o
  paciente para sempre, `concluir_registro` teria de copiar o nome dele, como
  copia o da nutricionista: pede migração.
- **Registro de quem exportou e quando:** ajuda a mostrar cuidado na LGPD
  (art. 37), mas pede tabela e migração.
- **O paciente baixar os dados dele** pelo app (portabilidade, LGPD art. 18).
  Hoje o pedido dele chega à nutricionista, que atende pelo "Exportar dados";
  quem é controlador de quê o advogado confirma (`founder/ops.md`, seção 6).
- **Importar no Dietbox ou noutro sistema.**
- **A página de dados**, quando os fatos de `docs/pagina-de-dados-rascunho.md`
  mudarem.
