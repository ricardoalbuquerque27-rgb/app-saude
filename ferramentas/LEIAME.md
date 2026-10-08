# Ferramentas de inspeção visual

Servem para ver o app rodando **sem acesso ao Supabase de verdade** — é o caso
de qualquer ambiente de desenvolvimento com a saída de rede fechada, e era o
caso aqui: sem isto, não dava para olhar nenhuma tela logada.

Nada disto entra no build do app. O Next só compila `app/`, `components/` e
`lib/`, então esta pasta é inerte em produção.

## Como usar

```bash
npm i -D playwright            # não fica no package.json de propósito:
                               # o postinstall dela baixa navegadores e isso
                               # atrasaria (ou quebraria) o build na Vercel

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

## Guia de estilo

A rota `/estilo` (só em desenvolvimento, `notFound()` em produção) mostra cor,
tipografia, componentes e densidade nos dois temas, com a razão de contraste
calculada em cima de cada tom. Essa não precisa do mock: não consulta dado
nenhum.
