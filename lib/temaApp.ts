// Paleta do app do paciente ("calmo e confiável"): as variáveis --app-* e as
// classes bg-app-*, text-app-*, border-app-* do Tailwind.
//
// Fica em TypeScript, como a clínica (lib/temaClinico.ts), para o contraste
// ser TESTÁVEL: lib/temaApp.test.ts reprova qualquer par abaixo do mínimo, nos
// dois temas. O CSS que o navegador recebe (cssDoTemaApp) e as classes do
// Tailwind saem desta mesma tabela.
//
// Os papéis comuns aos dois lados (texto, linha, primária, aviso, erro...)
// são IMPORTADOS de TEMA_CLINICO, não copiados. É o que garante, pelo código,
// que a principal do paciente é a mesma do nutricionista: duas listas de hex
// que concordam hoje divergem no primeiro ajuste de cor de um dos lados. Só
// quatro coisas são próprias do app: a página (`pagina`), o nome do cartão
// (`cartao`, que é o `chao` do clínico) e as três cores das barras de macros.
//
// Este arquivo é importado pelo tailwind.config.ts, e o carregador de config
// do Tailwind não resolve o alias "@/". Por isso o import abaixo é RELATIVO e
// o arquivo não importa nada além dele. A conta de contraste só entra no teste.

import { NOMES_COR, TEMA_CLINICO, type NomeCor } from "./temaClinico";

type Tema = "claro" | "escuro";

/** Os nomes do clínico que o app herda; `chao` vira `cartao`. */
type NomeComum = Exclude<NomeCor, "chao">;

type NomeProprio =
  | "pagina"
  | "macro-proteina"
  | "macro-carbo"
  | "macro-gordura";

export type NomeCorApp = NomeProprio | "cartao" | NomeComum;

/**
 * Fonte única da lista de nomes; o Tailwind gera `app.*` a partir dela. Os
 * comuns saem de NOMES_COR do clínico, então um nome novo lá entra aqui sem
 * segunda lista (e o teste da tabela pega o que ficar de fora).
 */
export const NOMES_COR_APP: NomeCorApp[] = [
  "pagina",
  "cartao",
  ...NOMES_COR.filter((n): n is NomeComum => n !== "chao"),
  "macro-proteina",
  "macro-carbo",
  "macro-gordura",
];

// `pagina` é um cinza-esverdeado quase imperceptível: o cartão (branco no
// claro, #0c1210 no escuro) se destaca dele sem precisar de sombra. Texto
// direto nesse fundo usa `texto` e `texto-2`, nunca slate-500, que dá 4,43:1
// sobre a página clara (os pares estão em PARES_TEXTO_APP).
//
// Os macros são a escala da própria primária, do escuro ao claro no tema
// claro e ao contrário no escuro: cor com função (qual macro é qual), sem
// matiz novo para decorar. Os tons claros NÃO passam 3:1 contra o fundo, de
// propósito: a legenda ao lado da barra dá nome e gramas em texto, então a
// barra só precisa distinguir um macro do vizinho (VIZINHOS_MACRO, 2:1).
const PROPRIOS: Record<Tema, Record<NomeProprio, string>> = {
  claro: {
    pagina: "#f6f7f6",
    "macro-proteina": "#0e5d34",
    "macro-carbo": "#5c9a76",
    "macro-gordura": "#b9dbc6",
  },
  escuro: {
    pagina: "#070b09",
    "macro-proteina": "#3fd27b",
    "macro-carbo": "#2a8a55",
    "macro-gordura": "#1d5538",
  },
};

function montar(t: Tema): Record<NomeCorApp, string> {
  const clinico: Record<NomeCor, string> = TEMA_CLINICO[t];
  const comuns = {} as Record<NomeComum, string>;
  for (const nome of NOMES_COR)
    if (nome !== "chao") comuns[nome] = clinico[nome];
  return { ...comuns, cartao: clinico.chao, ...PROPRIOS[t] };
}

export const TEMA_APP: Record<Tema, Record<NomeCorApp, string>> = {
  claro: montar("claro"),
  escuro: montar("escuro"),
};

/**
 * Pares [frente, fundo] em que a cor carrega TEXTO: mínimo 4,5:1 (WCAG AA).
 * `pagina` entra porque há texto direto no chão (a data, o "Bom dia", o
 * título de seção fora do cartão), e não só dentro do cartão.
 */
export const PARES_TEXTO_APP: [NomeCorApp, NomeCorApp][] = [
  ["texto", "cartao"],
  ["texto", "pagina"],
  ["texto-2", "cartao"],
  ["texto-2", "pagina"],
  ["primaria", "cartao"],
  ["primaria", "pagina"],
  ["sobre-primaria", "primaria"],
  ["primaria", "primaria-fundo"],
  ["texto-2", "primaria-fundo"],
  // O texto comum sobre o fundo da principal: hover de botão e de linha, e a
  // linha ativa do histórico de Relatórios (as telas do paciente fora da Início
  // e da Dieta).
  ["texto", "primaria-fundo"],
  ["atencao", "atencao-fundo"],
  ["texto", "atencao-fundo"],
  ["atencao-texto-2", "atencao-fundo"],
  ["atencao", "cartao"],
  ["perigo", "perigo-fundo"],
  ["perigo", "cartao"],
];

/** Pares [frente, fundo] em que a cor é marca de gráfico ou borda: mínimo 3:1 (WCAG 1.4.11). */
export const PARES_GRAFICO_APP: [NomeCorApp, NomeCorApp][] = [
  // O anel da meta sobre o trilho.
  ["primaria", "linha"],
  // A borda de campo (a `linha` do cartão é quase invisível, de propósito:
  // 1,24:1 não serve para mostrar onde digitar), sobre o cartão e sobre a
  // página.
  ["campo", "cartao"],
  ["campo", "pagina"],
];

/**
 * Vizinhos na barra de macros: mínimo 2:1 entre si, para um macro acabar e o
 * outro começar à vista. Não é contraste contra o fundo (ver PROPRIOS).
 */
export const VIZINHOS_MACRO: [NomeCorApp, NomeCorApp][] = [
  ["macro-proteina", "macro-carbo"],
  ["macro-carbo", "macro-gordura"],
];

function bloco(tema: Record<NomeCorApp, string>): string {
  return NOMES_COR_APP.map((nome) => `--app-${nome}:${tema[nome]};`).join("");
}

/**
 * CSS das variáveis `--app-*`: o claro em `:root`, o escuro em `.dark`. O tema
 * escuro do app é por classe (`.dark` no <html>), não por prefers-color-scheme.
 * `:root` e `.dark` valem a mesma especificidade (uma classe), e o `.dark` vem
 * depois, por isso vence no <html class="dark">. Formato sem espaços: o teste
 * fixa o começo de cada bloco.
 *
 * Diferente do clínico, que se escopa em `.tema-clinico`, estas variáveis são
 * globais: o app inteiro do paciente as usa, e a classe `app-*` não precisa de
 * `dark:` porque o par está dentro da variável.
 */
export function cssDoTemaApp(): string {
  return `:root{${bloco(TEMA_APP.claro)}}.dark{${bloco(TEMA_APP.escuro)}}`;
}
