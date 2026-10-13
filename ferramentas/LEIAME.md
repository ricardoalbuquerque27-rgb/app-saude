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
conta de teste da Maria), e é com esses que `tirar-prints.cjs` e
`conferir-inicio.cjs` rodam.

| `CENARIO`  | Quem entra          | Para quê |
|------------|---------------------|----------|
| (nenhum)   | `maria.teste@…` (paciente) ou `nutri.teste@…` | telas do paciente, Início |
| `carteira` | só o nutricionista (e-mail com "nutri") | o detalhe do paciente e a Início do nutri |

O e-mail do login decide quem entra: qualquer um que contenha "nutri" entra
como o nutricionista, o resto como a Maria.

A `carteira` traz cinco pacientes, um para cada situação, e dois convites
pendentes. As datas saem do dia em que o mock sobe, então os alertas valem em
qualquer dia:

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
daqui a 3, para o cartão de consulta do lado do paciente.

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
celular. Ele descobre os ids dos pacientes perguntando
ao mock (`/__cenario`), e recusa rodar se o mock subiu com outro cenário.
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

Dois endereços que não são do Supabase (além do `/__cenario`):

- `POST /__reset` volta as consultas, os registros, os adendos, as medidas e os
  perfis (o CRN) ao que o cenário subiu, e desliga o `/__falhar`; o roteiro
  chama no começo e no fim.
- `POST /__falhar` com `{ "tabela": "consultation_records" }` faz os `GET` nessa
  tabela devolverem 500 até o próximo `/__reset`. As leituras da página são do
  servidor do Next, que o `page.route` do Playwright não intercepta; sem isto
  não há como ver a tela de "não carregou".

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
