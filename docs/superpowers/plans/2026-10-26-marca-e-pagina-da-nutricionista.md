# A marca no app e a página da nutricionista: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Objetivo:** pôr o nome num lugar só, trocar o ícone de haltere pelo ícone A, e
fazer de `/` a página da nutricionista, com o botão da vaga indo ao WhatsApp do
fundador.

**Arquitetura:** `lib/marca.ts` guarda o nome, os textos fixos e as duas funções
puras (link da vaga e convite). Os textos da fila saem do `montarResumos` para
funções exportadas, que a página usa na demonstração. O ícone ganha uma geometria
só (`FORMAS_DA_MARCA`), da qual saem o SVG dos PNG e o componente `MarcaIcone`.
A página nova é um componente de servidor estático, sem banco.

**Tecnologia:** Next.js 14 (App Router), TypeScript, Tailwind com as classes
`app-*`, vitest, Playwright pelos scripts de `ferramentas/`.

**Spec:** `docs/superpowers/specs/2026-10-26-marca-e-pagina-da-nutricionista-design.md`

## Regras de todas as tarefas

- Tela, comentários e commits em português do Brasil. Nenhum identificador de
  modelo em commit nem em código.
- Os commits terminam com:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` e
  `Claude-Session: https://claude.ai/code/session_017NRAjF3WaQYDiVpyJ6nub9`.
  Push só para `claude/friendly-keller-rxl7qb`, com `git push -u origin
  claude/friendly-keller-rxl7qb`.
- Os textos da spec entram **letra por letra**, com a pontuação dela.
- **Cores:** só `app-*`, sem `dark:`. Hex só em `lib/temaApp.ts`. Há duas
  exceções, que já existiam: o `public/icon.svg`, estático e conferido por teste
  na Task 3, e o `themeColor` do `app/layout.tsx`.
- **Na página `/`:**
  - nada de `uppercase`, `tracking-wide`, degradê, `<img>` ou imagem externa;
  - `.card` de um nível, botão primário `.btn-primary` (44 px) e secundário
    `.btn-ghost`;
  - título de seção sem ícone.
- **Fora do escopo:** banco, migração e a tela do lado clínico, a não ser o
  símbolo de marca no menu do `AppShell`.
- **Comentário** explica por quê, citando o motivo (ver `lib/date.ts`).
- **Processos dos scripts de tela:**
  - pare-os pelo PID (`kill -- -$DEV_PID`, `kill $MOCK_PID`), nunca por
    `pkill -f` nem `until ! pgrep -f`;
  - a `playwright` fica fora do `package.json` (`npm i --no-save`, ver
    `ferramentas/LEIAME.md`);
  - `npm run build` só com o `npm run dev` parado.
- **Typecheck:** `npx tsc --noEmit`. **Testes:** `npm test`.

## Decisões deste plano (o que a spec não fixou)

1. **Mais duas constantes em `lib/marca.ts`.** `TITULO` é
   `` `${NOME}: acompanhamento entre consultas` `` e `DESCRICAO` é "O
   acompanhamento entre uma consulta e outra, da nutricionista ao paciente.".
   - O manifesto, o layout e a página usam o mesmo texto, que assim mora num
     lugar só.
   - O layout passa a ter `title: TITULO` e `description: DESCRICAO`. O "Treinos,
     Dieta e Saúde" de consumidor sai também dali.
2. **`app/api/push/test/route.ts` entra na troca do nome** ("Seus lembretes do
   Pace Fit estão funcionando!"), embora a spec não o liste.
   - O `app/api/cron/reminders` não escreve o nome: só tem as tags `pacefit-*`.
   - Essas tags e o `CACHE` do `sw.js` são identificadores, não nome na tela, e
     ficam.
3. **`MarcaIcone` desenha o ícone inteiro,** fundo incluído.
   - Ele toma o lugar do quadrado verde e do `Dumbbell` juntos.
   - As cores são `fill-app-primaria` e `fill-app-sobre-primaria`, e por isso
     seguem o tema escuro.
4. **A geometria do ícone mora num lugar só,** `FORMAS_DA_MARCA` em
   `lib/appIcon.ts`.
   - O SVG dos PNG tira as cores de `TEMA_APP.claro`.
   - O `public/icon.svg` é cópia do `ICON_SVG`, conferida por teste.
5. **O singular dos textos da fila** dá "1 dia sem registrar" e "1 treino sem
   confirmação (7d)". A fila nunca chama esses dois com 1: o parado só aparece a
   partir de 3 dias e o sem confirmação a partir de 2. Mas a função é exportada.
6. **Saem com a página antiga** o `components/Reveal.tsx` e o bloco "Movimento
   (landing)" de `app/globals.css`, porque só ela os usava (conferido com
   `grep`). O `font-display` fica, porque está no seletor de `h1`–`h3` e no
   `tailwind.config.ts`.
7. **O aviso do rodapé antigo sai.** Era "não substitui a avaliação de um
   profissional" e falava com o consumidor. O do Tratamento fica.
8. **No rodapé, a frase inteira** "Recebi um convite do meu nutricionista:
   entrar" é o link, com 44 px de altura: o alvo de toque fica maior.
9. **O ano do rodapé é o do build,** porque a página é estática. Aceito.
10. **As cores do manifesto vêm do `TEMA_APP.claro`** (`pagina` e `primaria`),
    com os mesmos valores de hoje.
11. **O `conferir-entrada.cjs` lê `NOME` e `SLOGAN` de `lib/marca.ts`** por
    expressão regular, para não quebrar quando o nome mudar.
    - Ele também confere a rolagem lateral em 320 px.
    - Os títulos que o `tirar-prints-nutri.cjs` confere seguem com "Pace Fit"
      escrito, e o `CLAUDE.md` registra isso.

## Review Focus

1. **O número da Vercel escrito de outro jeito.**
   - Com "+55", espaço, traço ou parênteses, o link sai normal.
   - Com o 0 de tronco ("011 91234-5678"), o número fica com 12 dígitos sem o
     55 e dá `null`: a página diz "abrem em breve", sem link quebrado.
   - Um DDD 55 (Santa Maria, RS) com 11 dígitos ganha o 55 do país na frente. Uma
     regra "começa com 55" o estragaria.
   - Os testes estão na Task 1.
2. **Celular de 320 px:** sem rolagem lateral e com o botão inteiro. Conferido
   na Task 4.
3. **O escuro herdado.** Sair do app com o tema escuro ligado deixa o `.dark` no
   `<html>`, e a navegação do cliente o leva ao `/login` e ao `/`. A página tem
   de seguir legível e só com `app-*`. A Task 4 varre as classes e tira o print
   escuro.
4. **O paciente deslogado que abre o site** em vez do link do convite: o rodapé
   leva ao `/login`. Conferido na Task 4.
5. **O singular dos textos exportados da fila** não pode dizer "1 dias". Os
   testes estão na Task 2.

---

### Task 1: O nome, o link da vaga e o convite em `lib/marca.ts`

**Arquivos:**
- Criar: `lib/marca.ts`, `lib/marca.test.ts`
- Modificar: `components/PacientesClient.tsx:87-88` (o `copyInvite`)

**Interfaces:**
- Produz: as constantes e as funções abaixo, todas exportadas de
  `@/lib/marca`.

  | nome | tipo | valor ou o que faz |
  | --- | --- | --- |
  | `NOME` | `string` | `"Pace Fit"` |
  | `SLOGAN` | `string` | `"Quem precisa de você, antes do retorno."` |
  | `TITULO` | `string` | `` `${NOME}: acompanhamento entre consultas` `` |
  | `DESCRICAO` | `string` | `"O acompanhamento entre uma consulta e outra, da nutricionista ao paciente."` |
  | `linkDaVaga(numero: string \| undefined)` | `string \| null` | o link do WhatsApp da vaga |
  | `textoDoConvite(codigo: string, link: string)` | `string` | o texto do convite do paciente |

- [ ] **Step 1: Escrever os testes que falham** em `lib/marca.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { NOME, SLOGAN, TITULO, DESCRICAO, linkDaVaga, textoDoConvite } from "./marca";

const MENSAGEM = `Oi! Quero uma vaga de implantação do ${NOME}.\nMeu nome:\nCRN:\nAtendo online: sim / não`;

describe("textos da marca", () => {
  it("título, slogan e descrição", () => {
    expect(SLOGAN).toBe("Quem precisa de você, antes do retorno.");
    expect(TITULO).toBe(`${NOME}: acompanhamento entre consultas`);
    expect(DESCRICAO).toBe("O acompanhamento entre uma consulta e outra, da nutricionista ao paciente.");
  });
});

describe("linkDaVaga", () => {
  it.each([
    ["(11) 91234-5678", "5511912345678"],      // celular com DDD: ganha o 55
    ["11 3456-7890", "551134567890"],          // fixo de 10 dígitos
    ["5511912345678", "5511912345678"],        // já tem o 55: como está
    ["+55 (11) 91234-5678", "5511912345678"],
    ["55 99123-4567", "5555991234567"],        // DDD 55 (Santa Maria) com 11 dígitos
  ])("%s vira wa.me/%s", (numero, digitos) => {
    expect(linkDaVaga(numero)?.startsWith(`https://wa.me/${digitos}?text=`)).toBe(true);
  });
  it.each([[""], [undefined], ["912345678"], ["55119123456789"], ["011 91234-5678"]])(
    "%s não serve: null",
    (numero) => expect(linkDaVaga(numero)).toBeNull()
  );
  it("a mensagem pede nome, CRN e se atende online", () => {
    const link = linkDaVaga("11912345678")!;
    expect(new URL(link).searchParams.get("text")).toBe(MENSAGEM);
  });
});

describe("textoDoConvite", () => {
  it("diz o que o paciente faz, que é de graça, o código e o link", () => {
    const link = "https://exemplo.com/app/nutricionista?code=AB12CD";
    const texto = textoDoConvite("AB12CD", link);
    expect(texto).toBe(
      `Oi! Vou acompanhar você entre as consultas pelo ${NOME}, um app de graça. Abra o link, crie sua conta e registre o que comer, a água e o peso; eu acompanho daqui. Se pedir um código, é este: AB12CD. ${link}`
    );
    expect(texto).not.toContain("convidado(a)");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar.**
  - Comando: `npx vitest run lib/marca.test.ts`.
  - Esperado: FAIL, porque o `./marca` não existe.
- [ ] **Step 3: Implementar `lib/marca.ts`.**
  - **`linkDaVaga`:**
    - tira tudo que não é dígito;
    - com 10 ou 11 dígitos, põe `55` na frente;
    - com 12 ou 13 dígitos começando com `55`, usa como está;
    - em qualquer outro caso, devolve `null`;
    - devolve `` `https://wa.me/${digitos}?text=${encodeURIComponent(MENSAGEM)}` ``,
      com a mensagem de quatro linhas separadas por `\n` (como no teste).
  - **Comentário do topo:** trocar o nome é trocar o `NOME`; à mão ficam só o
    `public/sw.js` e os títulos que o `tirar-prints-nutri.cjs` confere.
  - **Comentário no `linkDaVaga`:** por que o 0 de tronco dá nulo. Ele faria
    o link abrir uma conversa com um número que não existe.
- [ ] **Step 4: Rodar e ver passar.** Comando: `npx vitest run lib/marca.test.ts`. Esperado: PASS.
- [ ] **Step 5: Usar no convite.**
  - Em `PacientesClient.tsx`, o `copyInvite` passa a montar o texto com
    `textoDoConvite(code, inviteLink(code))`.
  - O texto do modal não muda.
- [ ] **Step 6:** `npm test && npx tsc --noEmit`: tudo passa.
- [ ] **Step 7: Commit e push.** Mensagem: "Marca: nome, link da vaga e
  convite em lib/marca.ts".

### Task 2: Os textos da fila numa função cada (`lib/nutri.ts`)

**Arquivos:**
- Modificar: `lib/nutri.ts`, no bloco de alertas do `montarResumos`
  (`alertar(...)`, hoje nas linhas 383–416).
- Testar: `lib/nutri.test.ts`.

**Interfaces:**
- Produz:
  - `TEXTO_DOSE_ATRASADA: string`;
  - `textoDesvios(n: number): string`;
  - `textoParado(dias: number | null): string`;
  - `textoFaltas(n: number): string`;
  - `textoSemConfirmacao(n: number): string`;
  - `textoExames(n: number): string`.
- Todos são exportados de `@/lib/nutri`.

- [ ] **Step 1: Escrever os testes que falham.** Acrescente os nomes ao
  `import` do topo de `lib/nutri.test.ts`, e no fim do arquivo:

```ts
describe("textos da fila", () => {
  it("dose", () => expect(TEXTO_DOSE_ATRASADA).toBe("Dose atrasada"));
  it("mudanças na prescrição", () => {
    expect(textoDesvios(1)).toBe("1 mudança na sua prescrição");
    expect(textoDesvios(2)).toBe("2 mudanças na sua prescrição");
  });
  it("parado", () => {
    expect(textoParado(null)).toBe("Nunca registrou nada");
    expect(textoParado(1)).toBe("1 dia sem registrar");
    expect(textoParado(5)).toBe("5 dias sem registrar");
  });
  it("faltas", () => {
    expect(textoFaltas(1)).toBe("Faltou a 1 treino (7d)");
    expect(textoFaltas(2)).toBe("Faltou a 2 treinos (7d)");
  });
  it("sem confirmação", () => {
    expect(textoSemConfirmacao(1)).toBe("1 treino sem confirmação (7d)");
    expect(textoSemConfirmacao(2)).toBe("2 treinos sem confirmação (7d)");
  });
  it("exames", () => {
    expect(textoExames(1)).toBe("1 exame fora da referência");
    expect(textoExames(2)).toBe("2 exames fora da referência");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar.**
  - Comando: `npx vitest run lib/nutri.test.ts -t "textos da fila"`.
  - Esperado: FAIL, porque os nomes não são exportados.
- [ ] **Step 3: Implementar as seis exportações** perto do tipo `Alerta`.
  - O `montarResumos` passa a chamá-las no lugar dos textos escritos no laço.
  - A ordem dos `alertar` não muda.
  - Comentário: a demonstração da página de entrada usa as mesmas funções, para
    a página nunca mostrar um texto que a fila não escreve.
- [ ] **Step 4: Rodar e ver passar.**
  - Comando: `npx vitest run lib/nutri.test.ts`.
  - Esperado: PASS no arquivo inteiro, com os testes antigos do `montarResumos`
    sem mudança.
- [ ] **Step 5:** `npm test && npx tsc --noEmit`: tudo passa.
- [ ] **Step 6: Commit e push.** Mensagem: "Fila: cada texto de alerta numa
  função exportada".

### Task 3: O ícone A e o símbolo de marca

**Arquivos:**
- Modificar:
  - `lib/appIcon.ts`;
  - `public/icon.svg`;
  - `public/sw.js` (linhas 1–5);
  - os seis lugares de marca, listados no Step 5.
- Criar: `lib/appIcon.test.ts`, `components/MarcaIcone.tsx`.

**Interfaces:**
- Produz em `@/lib/appIcon`:
  - **`FORMAS_DA_MARCA`**, nova:

    ```ts
    export const FORMAS_DA_MARCA = {
      cantos: 112,
      barras: [
        { x: 132, y: 142, width: 248, height: 44, opacity: 0.55 },
        { x: 208, y: 234, width: 172, height: 44, opacity: 1 },
        { x: 132, y: 326, width: 248, height: 44, opacity: 0.55 },
      ],
      ponto: { cx: 154, cy: 256, r: 30 },
    } as const;
    ```

    As barras têm pontas redondas, com `rx` igual à metade da altura (22).
  - **`ICON_SVG`, `ICON_DATA_URI`, `ICON_MASKABLE_SVG` e
    `ICON_MASKABLE_DATA_URI`**, com os mesmos nomes de hoje (as quatro rotas de
    ícone não mudam).
- Produz `components/MarcaIcone.tsx`:
  - `export default function MarcaIcone({ tamanho = 36, className = "" }: { tamanho?: number; className?: string })`;
  - desenha `<svg data-marca="" aria-hidden="true" viewBox="0 0 512 512" width={tamanho} height={tamanho}>`;
  - não usa hooks, então serve em componente de servidor e de cliente.

- [ ] **Step 1: Escrever os testes que falham** em `lib/appIcon.test.ts`:

```ts
import fs from "node:fs";
import { describe, it, expect } from "vitest";
import { ICON_SVG, ICON_MASKABLE_SVG } from "./appIcon";
import { TEMA_APP } from "./temaApp";

describe("ícone do app", () => {
  it("fundo na principal do app, com cantos de 112", () => {
    expect(ICON_SVG).toContain(`<rect width="512" height="512" rx="112" fill="${TEMA_APP.claro.primaria}"/>`);
  });
  it("é a lista com um marcado, não o haltere", () => {
    expect(ICON_SVG).toContain('<circle cx="154" cy="256" r="30"/>');
    expect(ICON_SVG).not.toContain("M150 200");
  });
  it("o maskable ocupa o quadrado inteiro e guarda a margem de hoje", () => {
    expect(ICON_MASKABLE_SVG).not.toContain('rx="112"');
    expect(ICON_MASKABLE_SVG).toContain("translate(256 256) scale(0.72) translate(-256 -256)");
    expect(ICON_MASKABLE_SVG).toContain('<circle cx="154" cy="256" r="30"/>');
  });
  it("o public/icon.svg é o mesmo desenho", () => {
    expect(fs.readFileSync("public/icon.svg", "utf8").trim()).toBe(ICON_SVG.trim());
  });
});
```

- [ ] **Step 2: Rodar e ver falhar.**
  - Comando: `npx vitest run lib/appIcon.test.ts`.
  - Esperado: FAIL, porque o fundo ainda é `#0c964b` e o desenho é o haltere.
- [ ] **Step 3: Reescrever o desenho em `lib/appIcon.ts`.**
  - **O `ICON_SVG`** monta o SVG a partir de `FORMAS_DA_MARCA`:
    - um `<rect>` de fundo com `fill` em `TEMA_APP.claro.primaria`;
    - um `<g fill>` com `TEMA_APP.claro["sobre-primaria"]`, com as barras
      (`<rect … rx="22" opacity="…"/>`) e o `<circle …/>`.
  - **O maskable** tem o fundo sem `rx` e as formas no mesmo `transform` de
    hoje.
  - **O `public/icon.svg`** recebe exatamente o texto do `ICON_SVG`.
  - **O comentário do topo** diz por que o haltere saiu: ele dizia academia e
    reforçava "treino é do personal" (`founder/brand.md`).
- [ ] **Step 4: Rodar e ver passar.** Comando: `npx vitest run lib/appIcon.test.ts`. Esperado: PASS.
- [ ] **Step 5: Criar o `MarcaIcone` e trocar os seis símbolos de marca.**
  - **O componente:**
    - o fundo é um `<rect rx={cantos} className="fill-app-primaria"/>`;
    - as formas ficam num `<g className="fill-app-sobre-primaria">`, mapeadas de
      `FORMAS_DA_MARCA`.
  - **Onde o `MarcaIcone` entra,** no lugar do `<div>` com o `Dumbbell` dentro:

    | lugar | tamanho |
    | --- | --- |
    | `app/login/page.tsx`, painel lateral (`~146`) | 36 |
    | `app/login/page.tsx`, link do celular (`~199`) | 36 |
    | `app/redefinir-senha/page.tsx` (`~91`) | 36 |
    | `components/AppShell.tsx`, menu lateral (`~203`) | 36 |
    | `components/AppShell.tsx`, barra do celular (`~272`, hoje o `Dumbbell` solto em `text-app-primaria`) | 28 |
    | `components/Onboarding.tsx` (`~137`) | 32 |

  - **O import do `Dumbbell`:**
    - sai do login, da redefinir-senha e do Onboarding;
    - fica no `AppShell`, porque o item Treinos usa o haltere.
- [ ] **Step 6: Atualizar o `public/sw.js`.**
  - `const CACHE = "pacefit-v4";`
  - O comentário do topo deixa de dizer "do Pace Fit" e explica duas coisas:
    - o título padrão do push, lá embaixo, está escrito à mão, porque o arquivo
      é estático e não lê `lib/marca.ts`: trocou o `NOME`, troque aqui;
    - "v4: o ícone trocou, e o `/icon.svg` em cache era o do haltere".
- [ ] **Step 7:** `npm test && npx tsc --noEmit`: tudo passa.
- [ ] **Step 8:** `grep -rn "Dumbbell" app/login app/redefinir-senha components/Onboarding.tsx`.
  - Esperado: nada.
  - No `AppShell`, sobram só o import e os dois itens de Treinos.
- [ ] **Step 9: Commit e push.** Mensagem: "Marca: o ícone A no lugar do
  haltere".

### Task 4: A página da nutricionista em `/`

**Arquivos:**
- Criar: `ferramentas/conferir-entrada.cjs`.
- Reescrever: `app/page.tsx`, `app/recursos/page.tsx`.
- Apagar:
  - `components/landing.tsx`, `components/MobileMenu.tsx`,
    `components/Reveal.tsx`;
  - a pasta `public/landing/`;
  - o bloco `/* ---- Movimento (landing) ---- */` de `app/globals.css`, do
    comentário até o fim do `@media (prefers-reduced-motion: reduce)` que vem
    logo depois (linhas 33–78).

**Interfaces:**
- Consome:
  - de `@/lib/marca`: `NOME`, `SLOGAN`, `TITULO` e `linkDaVaga`;
  - de `@/lib/nutri`: `textoDesvios`, `textoParado`, `textoFaltas` e
    `textoExames`;
  - o `MarcaIcone` (Task 3).
- Produz: `ferramentas/conferir-entrada.cjs`, que a Task 5 amplia.

- [ ] **Step 1: Escrever o `ferramentas/conferir-entrada.cjs`.**
  - **A estrutura:** a mesma do `conferir-treinos.cjs`:
    - comentário de topo (para quê, do que precisa);
    - `OUT`, `APP` e `CHROME` por variável de ambiente;
    - `ok(passou, msg, detalhe)` e `etapa(nome, fn)`;
    - saída 1 se algo falhar e 2 se `APP + "/"` não responder.
  - **O que ele lê antes:** `NOME` e `SLOGAN`, de `lib/marca.ts`, por expressão
    regular (`/export const NOME = "([^"]+)"/`). `VAGAS` vem do ambiente (os
    dígitos esperados no link) e pode faltar.
  - **Em 390×844 e 1280×800, no claro,** o script confere em `/`:
    - o `h1` é o `SLOGAN`;
    - "Demonstração, com pacientes fictícios" está visível, e as quatro linhas
      aparecem em ordem, cada uma com o nome e o texto: "Ana R." com "1 mudança
      na sua prescrição", "Bruno M." com "5 dias sem registrar", "Carla S." com
      "Faltou a 2 treinos (7d)" e "Diego T." com "1 exame fora da referência";
    - "30 dias grátis, sem cartão." aparece.
  - **O link da vaga, com `VAGAS` no ambiente:**
    - há exatamente 2 `a[href^="https://wa.me/"]`;
    - cada um começa com `https://wa.me/${VAGAS}?text=`;
    - cada um tem `target="_blank"` e `rel` com `noopener`;
    - o `text` decodificado contém `` `do ${NOME}.` `` e "CRN:";
    - não aparece "As vagas de implantação abrem em breve.".
  - **Sem `VAGAS`:** nenhum link para `wa.me`, e a frase "As vagas de
    implantação abrem em breve." aparece duas vezes.
  - **Links para `/login`:**
    - "Entrar" (`a[href="/login"]`) no topo;
    - no rodapé, um `a[href="/login"]` com "Recebi um convite do meu
      nutricionista".
  - **Sem rolagem lateral** (`document.documentElement.scrollWidth <=
    innerWidth`) em 390, em 1280 e em **320×800**.
  - **As regras visuais, varrendo as classes de todos os elementos:**
    - nenhuma classe casa com
      `/(^|\s)([a-z0-9-]+:)*(bg|text|border|from|via|to|fill|stroke)-(slate|gray|zinc|neutral|stone|brand|emerald|green|white|black)(-|\s|$)/`;
    - nenhuma `uppercase`, `tracking-wide` ou `bg-gradient`;
    - nenhum `<img>`.
  - **No escuro:** o script põe a classe `.dark` no `<html>` e repete o print e a
    varredura. É o escuro herdado do app (Review Focus 3).
  - **O `/recursos`,** pedido por `fetch(APP + "/recursos", { redirect: "manual" })`:
    - o status é 308;
    - o `location` resolve para o caminho `/`.
  - **Os prints:** `entrada-<390|1280>-<claro|escuro>.png` em `OUT`.
- [ ] **Step 2: Subir o ambiente do `LEIAME`** com o número da vaga.
  - Antes, copie o `.env.local` atual para
    `/tmp/claude-0/-home-user-app-saude/2de2b795-044e-5d5c-b844-ede9e764785a/scratchpad/env.local.antes`.
    Ele volta no fim da Task 6.
  - Escreva o `.env.local` do `LEIAME` com mais uma linha:
    `NEXT_PUBLIC_WHATSAPP_VAGAS=(11) 91234-5678`.
  - Suba o mock sem cenário e rode `rm -rf .next`.
  - Suba o dev com `setsid npm run dev & DEV_PID=$!` e espere o `/login`
    responder.
- [ ] **Step 3: Rodar e ver falhar.**
  - Comando: `VAGAS=5511912345678 node ferramentas/conferir-entrada.cjs`.
  - Esperado: saída 1. A página antiga tem outro `h1`, não tem a demonstração e
    tem classes `slate`/`white`; o `/recursos` responde 200.
- [ ] **Step 4: Escrever o `app/page.tsx` novo.**
  - **O tipo:** componente de servidor, sem `"use client"` e sem banco, com
    `export const metadata: Metadata = { title: TITULO, description: SLOGAN }`.
  - **Antes do JSX:**
    - `const link = linkDaVaga(process.env.NEXT_PUBLIC_WHATSAPP_VAGAS);`;
    - a lista da demonstração, `[{ nome: "Ana R.", texto: textoDesvios(1) }, { nome: "Bruno M.", texto: textoParado(5) }, { nome: "Carla S.", texto: textoFaltas(2) }, { nome: "Diego T.", texto: textoExames(1) }]`.
  - **`BotaoDaVaga({ link }: { link: string | null })`,** uma função local:
    - com link, desenha
      `<a className="btn-primary" href={link} target="_blank" rel="noopener">Quero uma vaga de implantação</a>`;
    - sem link, desenha `<p>` em `text-app-texto-2` com "As vagas de implantação
      abrem em breve.".
  - **O contêiner:** `mx-auto max-w-2xl px-4`, com 16 px de margem no celular e a
    leitura limitada no computador.
  - **As seções, na ordem e com os textos letra por letra** (são os da spec,
    seção 3):
    1. **Topo:** `MarcaIcone` e `NOME`; "Entrar" em `.btn-ghost`, para `/login`.
    2. **Abertura:**
       - o `h1` é o `SLOGAN`;
       - o parágrafo: "Em 14 dias, uma fila mostra quais dos seus pacientes
         estão saindo do plano entre as consultas. A implantação é feita comigo,
         sem migrar ninguém.";
       - o `BotaoDaVaga`;
       - "30 dias grátis, sem cartão." fica embaixo, com ou sem link.
    3. **A demonstração:** um `.card`.
       - O rótulo "Demonstração, com pacientes fictícios" vai em
         `text-app-texto-2`.
       - Embaixo, uma `<ul>` com `divide-y divide-app-linha`, uma linha por
         paciente fictício, com o nome em `text-app-texto` e o texto em
         `text-app-texto-2`.
    4. **As seções 4 a 8,** cada uma com um `h2` e o texto:

       | `h2` | texto |
       | --- | --- |
       | Como funciona | uma `<ol>` com três passos: "Dia 1: uma chamada de 30 minutos. Criamos a sua conta e convidamos de 3 a 5 pacientes seus, com a mensagem pronta para o WhatsApp.", "Dia 7: 15 minutos para abrir a fila juntos." e "Dia 14: mais 15 minutos, e a fila já mostra quem precisa de você." |
       | A garantia | "Se no dia 14 menos de 3 desses pacientes estiverem registrando, você ganha mais 30 dias grátis e a implantação é refeita." |
       | O que você tem | "Não precisa migrar ninguém para testar: os outros pacientes seguem onde estão. Você prescreve metas, cardápio e, se quiser, treino, e tem agenda, conversa e o registro de cada consulta, concluído com o seu CRN." |
       | O paciente | "Seu paciente usa um app de graça, no celular ou no navegador. Ele registra comida, água, peso e treino, e pode fazer isso conversando com uma assistente. Ela não muda a meta que você deu. Cada paciente só aparece, no app, para você e para ele mesmo." |
       | As vagas | "São 10 vagas de implantação por mês, porque cada uma é feita pelo fundador.", e o `BotaoDaVaga` de novo |

       - A última frase de "O paciente" é verdade pela RLS. É o máximo que se
         diz até existir a política de privacidade: não acrescente nada.
       - A página não tem preço, depoimento, número de usuários, "atende ao CFN"
         nem promessa de resultado de saúde.
    5. **O rodapé:**
       - um `Link` para `/login` com a frase inteira "Recebi um convite do meu
         nutricionista: entrar", com `min-h-[44px]`;
       - embaixo, `© {new Date().getFullYear()} {NOME}`.
  - **O comentário do topo:**
    - a página fala com quem paga, a nutricionista, porque a antiga falava com o
      consumidor (`founder/board.md`);
    - os textos da demonstração saem das funções da fila;
    - o número entra no build (`NEXT_PUBLIC_`).
- [ ] **Step 5: Reescrever o `app/recursos/page.tsx`:**

```tsx
import { permanentRedirect } from "next/navigation";

// A página de recursos falava com o consumidor e saiu com a página de
// entrada antiga (26/10): quem guardou o link cai na página nova.
export default function Recursos() {
  permanentRedirect("/");
}
```

- [ ] **Step 6: Apagar os arquivos da lista acima** com `git rm`, e o bloco
  "Movimento (landing)" do `globals.css`.
  - Rode
    `grep -rn "components/landing\|MobileMenu\|components/Reveal\|pf-reveal\|animate-\(float\|pulse-glow\|spin-slow\|marquee\)" app components lib`.
  - Esperado: nada.
- [ ] **Step 7: Rodar e ver passar.**
  - Comando: `VAGAS=5511912345678 node ferramentas/conferir-entrada.cjs`.
  - Esperado: saída 0.
  - Abra os quatro PNG e olhe: a hierarquia, as margens em 390, o escuro
    legível.
- [ ] **Step 8:** `npm test && npx tsc --noEmit`: tudo passa. Deixe o dev e o
  mock no ar para a Task 5, com os PIDs guardados.
- [ ] **Step 9: Commit e push.** Mensagem: "Entrada: a página da
  nutricionista em /".

### Task 5: O nome em toda parte, o manifesto e a tela de entrar

**Arquivos:**
- Criar: `app/manifest.ts`, `lib/manifesto.test.ts`.
- Apagar: `app/manifest.webmanifest`.
- Modificar: os arquivos do Step 5 e `lib/marca.test.ts`, que ganha a
  guarda do nome.
- Ampliar: `ferramentas/conferir-entrada.cjs`.

**Interfaces:**
- Consome: `NOME`, `TITULO` e `DESCRICAO` (Task 1); `TEMA_APP` de
  `@/lib/temaApp`.
- Produz: `app/manifest.ts`, com
  `export default function manifest(): MetadataRoute.Manifest`.

- [ ] **Step 1: Escrever os testes que falham.**
  - **Em `lib/manifesto.test.ts`,** importando `manifest` de `@/app/manifest`:
    - `name` é `TITULO`, `short_name` é `NOME` e `description` é `DESCRICAO`;
    - `categories` é `["health", "medical"]`;
    - `start_url` é `"/app"`, `scope` é `"/"`, `display` é `"standalone"`,
      `orientation` é `"portrait"` e `lang` é `"pt-BR"`;
    - `background_color` é `TEMA_APP.claro.pagina` e `theme_color` é
      `TEMA_APP.claro.primaria`;
    - os `icons` são os quatro de hoje, com os mesmos `src`, `sizes`, `type` e
      `purpose` (copie do `app/manifest.webmanifest` atual para o teste antes de
      apagá-lo).
  - **Em `lib/marca.test.ts`:**

```ts
import fs from "node:fs";
import path from "node:path";

function arquivos(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? arquivos(p) : [p];
  });
}

it("o nome só está escrito em lib/marca.ts", () => {
  const achados = ["app", "components", "lib"]
    .flatMap(arquivos)
    .filter((f) => /\.(ts|tsx|webmanifest)$/.test(f))
    .filter((f) => !f.endsWith(".test.ts") && f !== path.join("lib", "marca.ts"))
    .filter((f) => fs.readFileSync(f, "utf8").includes(NOME));
  expect(achados).toEqual([]);
});
```

- [ ] **Step 2: Rodar e ver falhar.**
  - Comando: `npx vitest run lib/manifesto.test.ts lib/marca.test.ts`.
  - Esperado: FAIL. O `app/manifest` não existe, e a guarda lista os arquivos
    com "Pace Fit".
- [ ] **Step 3: Criar o `app/manifest.ts`** com os valores do teste e apagar o
  `app/manifest.webmanifest`. Os dois juntos dão conflito de rota no Next. O
  `manifest: "/manifest.webmanifest"` do layout fica.
- [ ] **Step 4: Trocar a tela de entrar** (`app/login/page.tsx`, painel
  lateral).
  - **`HIGHLIGHTS`:**

    ```ts
    [
      "A fila de quem precisa de atenção, para a nutricionista",
      "O plano, as metas e os registros do dia, para o paciente",
      "Cada paciente só aparece para a nutricionista que o acompanha",
    ]
    ```

  - **O `h2`:** "O acompanhamento entre uma consulta e outra.", numa linha só,
    sem o `<span>` colorido.
  - **O parágrafo:** "Para a nutricionista, a fila de quem precisa de atenção.
    Para o paciente, o plano e os registros do dia."
  - **Os selos** ficam.
- [ ] **Step 5: Ler o `NOME` em todo lugar que escreve o nome.**
  - `app/layout.tsx`: `title: TITULO`, `description: DESCRICAO`,
    `applicationName: NOME` e `appleWebApp.title: NOME`.
  - **Títulos de página:**
    - `app/app/agenda/page.tsx:27`: `` `Agenda · ${NOME}` ``;
    - `app/app/pacientes/[id]/page.tsx:42`: `` `${rotulo} · Paciente · ${NOME}` ``;
    - `app/app/pacientes/[id]/consultas/[consulta]/page.tsx:31`: `` `Registro · Paciente · ${NOME}` ``.
  - **Telas:**
    - `app/login/page.tsx`: as três ocorrências;
    - `app/redefinir-senha/page.tsx:94`;
    - `components/AppShell.tsx:207` e `:273`;
    - `components/Onboarding.tsx:140`;
    - `components/PwaSettings.tsx:250`;
    - `app/app/tratamento/page.tsx:312` e `:421`;
    - `app/app/integracoes/page.tsx:88`.
  - **Rotas de API:**
    - os prompts de `app/api/insights/route.ts:12` e `app/api/report/route.ts:13`;
    - o corpo do push de `app/api/push/test/route.ts:38`.
  - **O `alt` dos ícones:** `app/apple-icon.tsx` e as três rotas
    `app/icon-*.png/route.tsx`.
  - **`lib/types.ts:1`:** "// Tipos do banco de dados."
- [ ] **Step 6: Rodar e ver passar.**
  - Comando: `npx vitest run lib/manifesto.test.ts lib/marca.test.ts`.
  - Esperado: PASS. Depois, `npm test && npx tsc --noEmit`.
- [ ] **Step 7: Ampliar o `conferir-entrada.cjs`.**
  - **O `/manifest.webmanifest`:** responde JSON, o `name` contém `NOME`, o
    `short_name` é `NOME` e as `categories` não têm "fitness".
  - **O `/icon-192.png`:** responde 200, com `content-type` começando por
    `image/png`.
  - **O `/login`, em 1280×800 e em 390×844:**
    - nenhum `svg.lucide-dumbbell`;
    - um `svg[data-marca]` visível;
    - em 1280, o `h2` do painel é "O acompanhamento entre uma consulta e
      outra.".
  - **Print:** `login-1280.png`.
- [ ] **Step 8: Rodar o script.**
  - Comando: `VAGAS=5511912345678 node ferramentas/conferir-entrada.cjs`, com o
    dev da Task 4.
  - Esperado: saída 0.
  - Olhe o `login-1280.png`.
- [ ] **Step 9: Commit e push.** Mensagem: "Marca: o nome lido de
  lib/marca.ts em toda parte, manifesto e tela de entrar".

### Task 6: Conferir tudo, documentar e publicar no branch

**Arquivos:**
- Modificar: `CLAUDE.md`, `ferramentas/LEIAME.md`.

- [ ] **Step 1: O app do paciente, com o número.**
  - Comando: `node ferramentas/conferir-inicio.cjs`, com o dev e o mock da Task 4.
  - Esperado: só a falha já conhecida da Gaia no canto do "Registrar", a mesma
    de antes.
- [ ] **Step 2: Trocar para a carteira, sem o número.**
  - Pare o dev e o mock pelo PID.
  - Tire a linha `NEXT_PUBLIC_WHATSAPP_VAGAS` do `.env.local` e rode
    `rm -rf .next`.
  - Suba `CENARIO=carteira node ferramentas/mock-supabase.cjs & MOCK_PID=$!` e
    o dev.
- [ ] **Step 3:** `node ferramentas/conferir-entrada.cjs`, sem `VAGAS`.
  - Esperado: saída 0, com o "abrem em breve" duas vezes e nenhum `wa.me`.
  - Olhe os prints.
- [ ] **Step 4:** `node ferramentas/tirar-prints-nutri.cjs`.
  - Esperado: passa como antes. Os títulos que ele confere ainda dizem "Pace
    Fit", porque o `NOME` não mudou.
  - Olhe os prints do menu lateral: o símbolo novo aparece, e o resto do lado
    clínico fica igual.
- [ ] **Step 5: O build.**
  - Pare o dev e o mock pelo PID e espere-os sair (`wait`, ou o laço com
    `kill -0`).
  - Comando: `npm test && npx tsc --noEmit && npm run build`.
  - Esperado: tudo passa. O `/` aparece como estático (○) na tabela do build.
- [ ] **Step 6: Devolver o `.env.local` guardado** na Task 4 (`cp` de volta do
  `env.local.antes`) e rodar `rm -rf .next`.
- [ ] **Step 7: O `CLAUDE.md`.**
  - **Uma seção nova, "## Marca e página de entrada",** antes de
    "## Comandos", com o seguinte:
    - **O nome:** mora em `lib/marca.ts` (`NOME`, `SLOGAN`, `TITULO`,
      `DESCRICAO`), e a guarda de `lib/marca.test.ts` acusa o nome escrito em
      outro arquivo de `app/`, `components/` ou `lib/`.
    - **O que fica à mão:** o `public/sw.js` (o comentário e o título padrão do
      push) e os títulos que o `tirar-prints-nutri.cjs` confere.
    - **O ícone A:** a geometria é `FORMAS_DA_MARCA` (`lib/appIcon.ts`), com as
      cores do `TEMA_APP`. O `public/icon.svg` é cópia conferida por teste, e o
      `MarcaIcone` é o símbolo das telas. O haltere ficou só em Treinos.
    - **O número do WhatsApp:**
      - está em `NEXT_PUBLIC_WHATSAPP_VAGAS`, configurada na Vercel;
      - aceita 10 ou 11 dígitos com DDD, ou 12 ou 13 começando com 55; qualquer
        outra coisa (o 0 de tronco, por exemplo) dá "As vagas de implantação
        abrem em breve.", sem aviso;
      - entra no build, e trocar o número pede um deploy;
      - fica visível no link: não é segredo.
    - **A página `/`:** é da nutricionista, estática e sem banco. Os textos da
      demonstração saem das funções da fila (`textoDesvios` e companhia), e o
      `/recursos` redireciona com 308.
  - **Em "Lógica testada",** acrescentar:
    - `lib/marca.ts` (`linkDaVaga`, `textoDoConvite`);
    - os textos da fila em `lib/nutri.ts`;
    - `lib/appIcon.ts`.
  - **Em "Visual do app",** dizer que a página de entrada também segue a
    linguagem nova, e trocar a frase do `font-display` e a da landing por "a
    página de entrada foi reescrita na linguagem do app (26/10)".
  - **Em "Convenções",** tirar "na landing (com o `MobileMenu` dela)" da lista
    do `brand-*`.
  - **Em "Em aberto",** tirar o item "A landing fala com consumidor final".
  - **Em "Comandos",** a contagem de testes passa a ser a nova, que sai do
    `npm test`.
- [ ] **Step 8: O `ferramentas/LEIAME.md`.** Um parágrafo sobre o
  `conferir-entrada.cjs`:
  - o que confere;
  - que não precisa de login nem de cenário;
  - as duas rodadas, com `NEXT_PUBLIC_WHATSAPP_VAGAS` no `.env.local` e
    `VAGAS=<dígitos>` no script, e sem os dois;
  - que mudar a variável pede reiniciar o dev com `rm -rf .next`, porque ela
    entra na compilação.
- [ ] **Step 9: Commit e push.** Mensagem: "Docs: marca e página de entrada no
  CLAUDE.md e no LEIAME".
