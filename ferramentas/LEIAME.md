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
  aberto), mudou o plano de treino (aviso de plano aberto, que não é meta),
  faltou a um treino, deixou 2 mensagens sem resposta e tem **dois**
  tratamentos ativos: o antigo com a dose vencida e o novo em dia.
- **Joana Ferreira**: 12 dias sem registrar, com um exame alterado.
- **Pedro Alves**: acabou de chegar, nunca registrou nada, sem metas.
- **Luiza Prado**: em dia, sem nenhum alerta.

```bash
CENARIO=carteira node ferramentas/mock-supabase.cjs &
# o resto como acima: .env.local, rm -rf .next, npm run dev

OUT=/tmp/prints-nutri node ferramentas/tirar-prints-nutri.cjs
```

`tirar-prints-nutri.cjs` entra como nutricionista, tira os prints (paciente ×
celular 390 px / computador 1440 px × claro/escuro, mais Beatriz com "Editar
metas" aberto, a conversa em tela cheia no celular e Beatriz em 1100 px) e
**acusa**, com código de saída 1, quando alguma coisa não bate: transbordo de
largura, seção com erro, a fila de cada paciente, o rascunho de metas que
sobrevive ao envio de uma mensagem, o Voltar da conversa, o tratamento mais
recente, "Sem acesso", o Reaplicar e o que o editor de metas mostra, a
mudança do plano de treino no Treino (com a linha "Também dá baixa…" embaixo
do Reaplicar), o "Aplicando…" que segura o botão até a página nova chegar, o
"Fechar edição" desligado com a gravação em voo e a trava que o rascunho do
cardápio põe nas outras seções. Ele descobre os ids dos pacientes perguntando
ao mock (`/__cenario`), e recusa rodar se o mock subiu com outro cenário.
Sem `OUT`, os PNGs vão para `prints-nutri` no diretório temporário do
sistema.

O mock aceita `PATCH` e `DELETE` no CORS; sem isso o navegador recusava o
`PATCH` que marca a conversa como lida e o console enchia de erro. Ele não
guarda nada: um `POST` responde 201 e a consulta seguinte devolve os mesmos
dados de antes.

Os 1440 px do computador não são acaso: as duas colunas da página do paciente
só existem a partir de `xl` (1280 px). Abaixo disso a página é uma coluna.

## Guia de estilo

A rota `/estilo` (só em desenvolvimento, `notFound()` em produção) mostra cor,
tipografia, componentes e densidade nos dois temas, com a razão de contraste
calculada em cima de cada tom. Essa não precisa do mock: não consulta dado
nenhum.
