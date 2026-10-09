# Pace Fit

SaaS B2B para **nutricionistas acompanharem pacientes**. O nutricionista
convida, prescreve e acompanha; o paciente usa de graça. Quem paga é o
profissional — logo, o lado dele é o produto, não um extra.

Next.js 14 (App Router) · TypeScript · Tailwind · Supabase · Vercel.
Interface e commits em português do Brasil.

## Como o app se divide

**A mesma rota serve duas interfaces.** `/app` devolve o painel do
paciente ou o `NutriHome` conforme `profiles.role` — não existe `/nutri`.
Isso não é óbvio lendo a árvore de arquivos.

- **Paciente:** `app/app/page.tsx` (Início), `nutricionista/` ("Meu plano":
  metas, cardápio, treino, conversa), `dieta/`, `treinos/`, `habitos/`,
  `medidas/`, `exames/`, `tratamento/`, `treino/[id]` (leitura do treino).
- **Nutricionista:** `components/NutriHome.tsx`, `app/app/pacientes/` e o
  detalhe em `pacientes/[id]`, cuja aba **Prescrição** é a única onde ele
  age — as outras são leitura.
- **Lógica testada:** `lib/date.ts` (datas e janelas), `lib/planCheckIn.ts`
  (adesão), `lib/foods.ts` (tabela TACO) e, em `lib/nutri.ts`, a conta do
  resumo, da fila de triagem e da linha do tempo do nutri
  (`montarResumos`, `filaDeTriagem`, `montarLinhaDoTempo`). As consultas
  ao banco não têm teste, nem `lib/perfil.ts`, que é só uma consulta.

Toda segurança é por **RLS no Postgres**, nunca por service role no app.
Ao mexer em política, teste com `BEGIN ... ROLLBACK` e
`set_config('request.jwt.claims', ...)` antes de `set local role
authenticated` — nessa ordem.

## Comandos

```bash
npm run dev      # desenvolvimento
npm test         # 75 testes unitários (vitest)
npm run build    # produção
```

Testes visuais e de tela: veja `ferramentas/LEIAME.md`. Eles sobem um
Supabase falso e dirigem o Chromium — é a única forma de ver as telas
logadas num ambiente sem acesso ao banco.

## Armadilhas que já custaram caro

Cada uma destas quebrou em produção. Estão listadas porque voltam.

**Janelas de N dias.** `data >= addDaysISO(hoje, -7)` com comparação `>=`
abrange **oito** dias, não sete. E sem teto, um registro com data futura
entra na conta. Isso apareceu em **quatro** lugares diferentes e produziu
"Adesão: 114% — 8 de 7 dias". Use `naJanela` / `diasNaJanela` de
`lib/date.ts`, que têm teste. Não escreva a conta à mão.

**Fuso horário.** O app conta datas em `America/Sao_Paulo` (`lib/date.ts`),
mas o servidor da Vercel roda em UTC. `toLocaleDateString` **sem**
`timeZone` num componente de servidor mostra a data de amanhã entre 21h e
meia-noite. Use `hojeLongo()` / `todayISO()`. Pelo mesmo motivo,
`toISOString().slice(0,10)` não serve para aritmética de data — use
`addDaysISO` / `avancarDia`.

**`profiles` sem filtro por id.** A RLS deixa o paciente ver também o
perfil do nutricionista vinculado, então
`from("profiles").select(...).maybeSingle()` devolve **duas** linhas e
falha. Quebrava seis telas, e só para quem TEM acompanhamento — o caso de
uso principal. Use `meuPerfil()` de `lib/perfil.ts`.

**`vercel.json`.** O plano Hobby recusa cron abaixo de diário **na criação
do deploy**, com HTTP 400, antes de qualquer build. Foi o que travou todos
os deploys por semanas sem mensagem de erro visível.

**`npm run build` com o `npm run dev` no ar** apaga os chunks que o dev
está servindo. O sintoma engana: 404 nos scripts, React não hidrata,
formulário faz submit nativo.

**`playwright` fica fora do `package.json`** de propósito (o postinstall
baixa navegadores e atrasa o build na Vercel). Qualquer `npm install`
remove ele. `MODULE_NOT_FOUND` nos scripts de `ferramentas/` é isso.

## Convenções

- Comentário explica **por quê**, não o quê — de preferência citando o bug
  que motivou o código. Veja `lib/date.ts` e `lib/perfil.ts`.
- Cor sempre em par claro/escuro: **não existe um tom da marca que sirva
  aos dois temas** (no claro só `brand-700+` passa em contraste; no escuro
  só `brand-600` para trás). A rota `/estilo`, só em desenvolvimento,
  mostra a escala com a razão de contraste calculada.
- Campo de data que registra algo já acontecido leva `max={todayISO()}`. A
  exceção é "próxima aplicação", que é futura por definição.

## Em aberto

- **Nenhum nutricionista real usou o produto.** É a maior incerteza, e
  nenhuma ferramenta resolve.
- A landing fala com consumidor final, não com nutricionista.
- Sem Web Push (falta VAPID) e sem cobrança.
- Conta de teste (`Maria Souza (teste)`) e a rota `/estilo` precisam sair
  antes de usuários reais.
- No painel do Supabase, falta ligar a proteção contra senhas vazadas.
