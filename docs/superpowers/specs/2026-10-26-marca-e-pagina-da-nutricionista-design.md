# A marca no app e a página da nutricionista

Data: 26/10/2026. Desenho aprovado pelo dono do produto em conversa, em três
partes. A marca vem de `founder/brand.md`; a oferta, de `founder/pitch.md` e
`founder/offer.md`.

## Por quê

- **A página de entrada fala com o consumidor**, não com quem paga: "Começar
  grátis", treinos, fotos externas, fundo preto e degradês que o dono do produto
  já tirou do app. O board e o mapa de concorrentes apontaram isso
  (`founder/board.md`, `founder/competitors.md`).
- **O ícone do app é um haltere.** Ele diz academia e reforça a objeção "treino é
  do personal", que apareceu em todas as rodadas do painel (`founder/brand.md`).
- **O nome não vai ser Pace Fit**, e o definitivo ainda não existe. Hoje "Pace
  Fit" está escrito à mão em 23 arquivos. Trocar o nome depois tem de custar uma
  linha.
- **O convite do paciente** ("Você foi convidado(a) para acompanhar sua saúde
  comigo…") não diz o que o paciente vai fazer nem que é de graça.

## Decisões do dono do produto (26/10)

| decisão | escolha |
| --- | --- |
| a página de entrada | vira a da nutricionista; a de consumidor e a `/recursos` saem |
| o botão "Quero uma vaga" | abre o WhatsApp do fundador com a mensagem pronta |
| o ícone | o conceito A, "a lista com um marcado" |
| o preço na página | não aparece: só "30 dias grátis, sem cartão" |
| o nome | não muda agora; continua "Pace Fit" na tela até o definitivo, mas mora num lugar só |
| a abordagem | página reescrita do zero na linguagem do app (não troca de textos na página antiga, nem o tema clínico) |

## O que entra

### 1. O nome e o contato num lugar só: `lib/marca.ts`

```ts
export const NOME = "Pace Fit";
export const SLOGAN = "Quem precisa de você, antes do retorno.";
export function linkDaVaga(numero: string | undefined): string | null;
export function textoDoConvite(codigo: string, link: string): string;
```

- **`linkDaVaga`** recebe o número de `process.env.NEXT_PUBLIC_WHATSAPP_VAGAS`.
  - Fica só com os dígitos.
  - Com 10 ou 11 dígitos (DDD e número), põe o 55 na frente. Com 12 ou 13
    começando com 55, usa como está. Qualquer outra coisa, ou vazio, dá `null`.
  - Devolve `https://wa.me/<dígitos>?text=<mensagem>`, com a mensagem passada por
    `encodeURIComponent`:

    ```
    Oi! Quero uma vaga de implantação do <NOME>.
    Meu nome:
    CRN:
    Atendo online: sim / não
    ```

- **`textoDoConvite`** devolve, com o `NOME`, o código e o link:

  ```
  Oi! Vou acompanhar você entre as consultas pelo <NOME>, um app de graça.
  Abra o link, crie sua conta e registre o que comer, a água e o peso; eu
  acompanho daqui. Se pedir um código, é este: <codigo>. <link>
  ```

  O "leva um minuto por dia" do `brand.md` ficou de fora: é promessa que ninguém
  mediu.

- **Todo lugar que escreve "Pace Fit" passa a ler `NOME`:**
  - os metadados (`app/layout.tsx` e os títulos de página da agenda, do paciente
    e do registro);
  - as telas de entrar e de redefinir senha;
  - o `AppShell` e o `Onboarding`;
  - o `PwaSettings`, o Tratamento e as Integrações;
  - os prompts da IA (`app/api/insights`, `app/api/report`) e o lembrete do
    `app/api/cron/reminders`;
  - o `alt` dos ícones (`app/apple-icon.tsx` e as rotas dos PNG).
  - O comentário de `lib/types.ts` deixa de citar o nome.
- **O manifesto vira `app/manifest.ts`,** que lê `NOME`. O Next o serve no mesmo
  endereço, `/manifest.webmanifest`. O `app/manifest.webmanifest` estático sai.
  - **name:** "`NOME`: acompanhamento entre consultas".
  - **short_name:** `NOME`.
  - **description:** "O acompanhamento entre uma consulta e outra, da
    nutricionista ao paciente."
  - **categories:** `["health", "medical"]` ("fitness" e "lifestyle" saem).
  - O resto fica como está.
- **O único lugar à mão é o `public/sw.js`:** o comentário do topo e o título
  padrão da notificação push. Ele é estático e não lê código. Ganha um comentário
  que manda trocar junto com `lib/marca.ts`, e o `CLAUDE.md` registra isso.

### 2. O ícone A

- **Desenho:** fundo `#0e5d34` (a `primaria` do app, 7,97:1 com o branco), cantos
  de 112 em 512. Três barras brancas com pontas redondas:
  - a de cima e a de baixo largas e com 55% de opacidade;
  - a do meio mais curta, com um ponto cheio à esquerda.
- **O SVG aprovado** é o `a-lista.svg` da prévia:
  - barras de 248 × 44 em y 142 e 326;
  - ponto de raio 30 em (154, 256);
  - barra do meio de 172 × 44 em x 208.
- **Onde entra:**
  - `lib/appIcon.ts` (`ICON_SVG` e a versão maskable, com a mesma margem de
    segurança de hoje), que gera o ícone do app, os PNG de 192, 512 e maskable, e
    o da Apple;
  - `public/icon.svg`.
- **O símbolo pequeno de marca** é um componente novo, `components/MarcaIcone.tsx`:
  - o mesmo desenho, em SVG, com tamanho por propriedade;
  - fica no lugar do `Dumbbell` onde ele faz papel de marca: a tela de entrar
    (duas vezes), a de redefinir senha, o `AppShell` (duas vezes) e o
    `Onboarding`;
  - o `Dumbbell` de Treinos fica onde está.
- **O cache do service worker** passa de `pacefit-v3` a `pacefit-v4`, como o
  `CLAUDE.md` manda quando o `sw.js` muda, para o ícone velho sair do cache.

### 3. A página da nutricionista: `app/page.tsx`, reescrita

**Regras da página:**

- **Visual:** a linguagem do app.
  - Instrument Sans; cores só por `app-*`, sem `dark:`;
  - `.card` de um nível; botão primário sólido de 44 px; nenhum `uppercase`.
- **Proibido:** degradê, foto ou imagem externa.
- **Estática e sem banco:** é componente de servidor e não lê o banco.
- **Tamanho:** desenhada para 390 px primeiro, sem rolagem lateral, e com a
  largura de leitura limitada no computador.
- **O que a página não tem:**
  - preço;
  - depoimento;
  - número de usuários;
  - "atende ao CFN";
  - promessa de resultado de saúde.
- **Metadados:** título "`NOME`: acompanhamento entre consultas", descrição
  `SLOGAN`.

**As seções, na ordem:**

1. **Topo:** `MarcaIcone` e `NOME` à esquerda; "Entrar" (`/login`) à direita.
2. **Abertura:**
   - **título (h1):** `SLOGAN`;
   - **parágrafo:** "Em 14 dias, uma fila mostra quais dos seus pacientes estão
     saindo do plano entre as consultas. A implantação é feita comigo, sem migrar
     ninguém.";
   - **botão primário:** "Quero uma vaga de implantação", com o `href` de
     `linkDaVaga(...)`, abrindo em nova aba (`target="_blank"`, `rel="noopener"`);
   - **linha de baixo:** "30 dias grátis, sem cartão.";
   - **sem número:** com `linkDaVaga` nulo, o botão dá lugar ao texto "As vagas
     de implantação abrem em breve." Não aparece link quebrado.
3. **A demonstração da fila:** um `.card` com o rótulo visível "Demonstração, com
   pacientes fictícios", e quatro linhas na ordem de gravidade que a fila usa:

   | paciente fictício | texto | nível |
   | --- | --- | ---: |
   | Ana R. | `textoDesvios(1)`: "1 mudança na sua prescrição" | 2 |
   | Bruno M. | `textoParado(5)`: "5 dias sem registrar" | 3 |
   | Carla S. | `textoFaltas(2)`: "Faltou a 2 treinos (7d)" | 4 |
   | Diego T. | `textoExames(1)`: "1 exame fora da referência" | 5 |

4. **Como funciona,** em três passos curtos:
   - "Dia 1: uma chamada de 30 minutos. Criamos a sua conta e convidamos de 3 a 5
     pacientes seus, com a mensagem pronta para o WhatsApp."
   - "Dia 7: 15 minutos para abrir a fila juntos."
   - "Dia 14: mais 15 minutos, e a fila já mostra quem precisa de você."
5. **A garantia:** "Se no dia 14 menos de 3 desses pacientes estiverem
   registrando, você ganha mais 30 dias grátis e a implantação é refeita."
6. **O que você tem:** "Não precisa migrar ninguém para testar: os outros
   pacientes seguem onde estão. Você prescreve metas, cardápio e, se quiser,
   treino, e tem agenda, conversa e o registro de cada consulta, concluído com o
   seu CRN."
7. **O paciente:** "Seu paciente usa um app de graça, no celular ou no navegador.
   Ele registra comida, água, peso e treino, e pode fazer isso conversando com uma
   assistente. Ela não muda a meta que você deu. Cada paciente só aparece, no app,
   para você e para ele mesmo."
   - A última frase é verdade pela RLS. É o máximo que se diz até existir a
     política de privacidade (`founder/offer.md`, em análise).
8. **As vagas:** "São 10 vagas de implantação por mês, porque cada uma é feita
   pelo fundador.", e o botão de novo, com a mesma regra do número.
9. **Rodapé:**
   - "Recebi um convite do meu nutricionista: entrar", que leva ao `/login`;
   - "© <ano> `NOME`".

**O que sai com a página antiga:**

- `app/recursos/page.tsx` vira só um `permanentRedirect("/")` (de
  `next/navigation`), sem mexer no `next.config`;
- `components/landing.tsx` e `components/MobileMenu.tsx` saem, se nada mais os
  usar;
- a pasta `public/landing` (só o `COMO-ADICIONAR-FOTOS.txt`) também.

### 4. Os textos de alerta, numa função cada: `lib/nutri.ts`

Hoje o `montarResumos` escreve os textos dentro do laço. Passam a ser funções
exportadas, usadas pela fila e pela demonstração:

```ts
export const TEXTO_DOSE_ATRASADA = "Dose atrasada";
export function textoDesvios(n: number): string;      // "1 mudança na sua prescrição", "2 mudanças …"
export function textoParado(dias: number | null): string; // null → "Nunca registrou nada"; n → "n dias sem registrar"
export function textoFaltas(n: number): string;       // "Faltou a 1 treino (7d)", "Faltou a 2 treinos (7d)"
export function textoSemConfirmacao(n: number): string; // "n treinos sem confirmação (7d)"
export function textoExames(n: number): string;       // "1 exame fora da referência", "2 exames …"
```

Os textos e a ordem não mudam. Quem garante são os testes do `montarResumos`,
que já cobrem esses textos.

### 5. A tela de entrar e as outras telas

- **O painel lateral da tela de entrar,** que aparece no computador, fala com os
  dois públicos:
  - **título:** "O acompanhamento entre uma consulta e outra.";
  - **parágrafo:** "Para a nutricionista, a fila de quem precisa de atenção. Para
    o paciente, o plano e os registros do dia.";
  - **os três destaques** trocam o Modo Caneta, a IA e a foto do prato por:
    - "A fila de quem precisa de atenção, para a nutricionista"
    - "O plano, as metas e os registros do dia, para o paciente"
    - "Cada paciente só aparece para a nutricionista que o acompanha"
  - Os selos "Dados isolados por conta" e "Conexão criptografada" ficam.
- **O convite** (`components/PacientesClient.tsx`) usa `textoDoConvite`.
  - O texto do modal ("Convite criado! Envie o código (ou o link)…") não muda.

## O que não muda

- **O visual:** as cores (`lib/temaApp.ts`, `lib/temaClinico.ts`) e a letra.
- **As telas por dentro:** o lado clínico (página do paciente e agenda) e o app do
  paciente, a não ser o símbolo de marca no menu.
- **A Gaia,** o nome e o comportamento.
- **O fluxo do convite:** o código, o link `/app/nutricionista?code=` e o
  `accept_patient_invite`.
- **O banco:** não há migração.

## Testes

- **Unitários, escritos antes (vitest):**
  - `lib/marca.test.ts`:
    - `linkDaVaga` com 11 dígitos formatados ("(11) 91234-5678") dá o link com
      55 e só dígitos;
    - com "5511912345678" usa como está;
    - vazio, `undefined`, 9 dígitos ou 14 dígitos dão `null`;
    - a mensagem decodificada traz o `NOME` e "CRN:".
    - `textoDoConvite` traz o código, o link e o `NOME`, e não traz "convidado(a)".
  - `lib/nutri.test.ts`: cada função de texto, no singular e no plural, e
    `textoParado(null)`. Os testes do `montarResumos` seguem passando sem mudança.
- **De tela, script novo `ferramentas/conferir-entrada.cjs`** (Chromium, com o
  mock, pelo PID, como o `LEIAME` manda). Em 390 × 844 e 1280 × 800:
  - o `h1` é o `SLOGAN`;
  - o rótulo "Demonstração, com pacientes fictícios" e as quatro linhas aparecem;
  - com `NEXT_PUBLIC_WHATSAPP_VAGAS` definido, os dois botões levam a
    `https://wa.me/`; sem ele, aparece "As vagas de implantação abrem em breve." e
    nenhum link do `wa.me`;
  - sem rolagem lateral (`scrollWidth <= innerWidth`);
  - `/recursos` responde com redirecionamento para `/`;
  - a tela de entrar não tem mais o ícone de haltere no lugar da marca;
  - `/manifest.webmanifest` responde com o `NOME` e sem "fitness";
  - `/icon-192.png` responde 200 com imagem.
  - Os prints vão para a pasta temporária e são olhados, não só contados.
- **Os scripts que já existem:**
  - `tirar-prints-nutri.cjs` e `conferir-inicio.cjs` provam que o lado clínico e
    o app do paciente não mudaram;
  - o `conferir-inicio` já tem uma falha conhecida e documentada (a Gaia no canto
    do "Registrar"), que segue igual.
- **Por fim:** `npm test`, o typecheck e o `npm run build`, com o `npm run dev`
  parado, porque o build com o dev no ar apaga os chunks.

## Documentação

- **No `CLAUDE.md`:**
  - uma seção curta, "Marca e página de entrada":
    - o nome em `lib/marca.ts`;
    - o `sw.js` à mão;
    - o número do WhatsApp em `NEXT_PUBLIC_WHATSAPP_VAGAS`, configurado na
      Vercel, que entra no código no build;
    - a página de entrada é da nutricionista;
    - os textos da demonstração saem das funções da fila;
  - o item "A landing fala com consumidor final" sai do "Em aberto";
  - o `/estilo` deixa de citar a landing entre os lugares com `brand-*`.
- **No `ferramentas/LEIAME.md`:** o `conferir-entrada.cjs`.

## Fora do escopo

- **O nome e o logo definitivos,** que dependem da busca no INPI (`founder/brand.md`).
- **Publicar.** Antes do deploy, a `NEXT_PUBLIC_WHATSAPP_VAGAS` precisa estar na
  Vercel. Sem ela, a página vai ao ar com "As vagas de implantação abrem em
  breve.".
- **Dados e contratos:** a política de privacidade, a exportação de dados e a
  cobrança.
- **O guia do paciente e o roteiro das chamadas,** que são material do fundador e
  não do app.
- **Push e WhatsApp** dentro do produto.

## Riscos

- **Número pessoal na página:** o número do WhatsApp do fundador fica visível no
  link, para quem abrir. É o efeito pedido. O número fica fora do git, mas não
  fica secreto.
- **Variável do tipo `NEXT_PUBLIC_`:** é lida no build. Trocar o número pede um
  deploy novo.
- **Quem já instalou o app** pode ver o ícone velho até o sistema atualizar o
  atalho. O cache novo do service worker ajuda no navegador, mas o ícone instalado
  depende do sistema do celular.
