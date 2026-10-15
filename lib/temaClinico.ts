// Paleta do visual "Clínico sereno", piloto na página do paciente do
// nutricionista (app/app/pacientes/[id]/).
//
// Fica em TypeScript, e não só em CSS, para o contraste ser TESTÁVEL:
// lib/temaClinico.test.ts reprova qualquer par de PARES_TEXTO abaixo de
// 4,5:1 e de PARES_GRAFICO abaixo de 3:1, nos dois temas. O CSS que o
// navegador recebe (cssDoTemaClinico) e as classes do Tailwind
// (bg-clin-*, text-clin-*, border-clin-*) saem desta mesma tabela — não há
// uma segunda lista de cores para ficar fora de sincronia.
//
// Este arquivo é importado pelo tailwind.config.ts, e o carregador de
// config do Tailwind não resolve o alias "@/". Por isso ele não importa
// nada: nem "@/lib/contraste". A conta de contraste só entra no teste.

export type NomeCor =
  | "chao"
  | "texto"
  | "texto-2"
  | "linha"
  | "campo"
  | "primaria"
  | "sobre-primaria"
  | "primaria-fundo"
  | "atencao"
  | "atencao-fundo"
  | "atencao-texto-2"
  | "perigo"
  | "perigo-fundo";

/** Fonte única da lista de nomes; o Tailwind gera `clin.*` a partir dela. */
export const NOMES_COR: NomeCor[] = [
  "chao",
  "texto",
  "texto-2",
  "linha",
  "campo",
  "primaria",
  "sobre-primaria",
  "primaria-fundo",
  "atencao",
  "atencao-fundo",
  "atencao-texto-2",
  "perigo",
  "perigo-fundo",
];

// Cor sempre em par claro/escuro: nenhum tom serve aos dois temas. No
// claro a primária é escura (#0e5d34) para ler sobre branco; no escuro
// ela clareia (#3fd27b) para ler sobre quase-preto. `atencao-texto-2` é o
// texto secundário DENTRO do aviso: no escuro ele tem o tom quente do fundo
// âmbar, em vez do cinza-esverdeado do `texto-2`, que destoaria ali.
//
// `linha` separa (borda de card, divisória) e é de propósito quase
// invisível: 1,24:1 no claro. Isso NÃO serve de borda de campo de
// formulário, que o WCAG 1.4.11 exige com 3:1 sobre o fundo. Para isso
// existe `campo` (3,35:1 no claro, 3,31:1 no escuro): mais suave que o
// `texto-2`, mas que ainda mostra onde digitar.
export const TEMA_CLINICO: Record<"claro" | "escuro", Record<NomeCor, string>> = {
  claro: {
    chao: "#ffffff",
    texto: "#111827",
    "texto-2": "#4b5563",
    linha: "#e5e7eb",
    campo: "#858d99",
    primaria: "#0e5d34",
    "sobre-primaria": "#ffffff",
    "primaria-fundo": "#e7f3ec",
    atencao: "#9a3412",
    "atencao-fundo": "#fff7ed",
    "atencao-texto-2": "#4b5563",
    perigo: "#9f1239",
    "perigo-fundo": "#fdecea",
  },
  escuro: {
    chao: "#0c1210",
    texto: "#e7ece9",
    "texto-2": "#a3b1aa",
    linha: "#24302b",
    campo: "#5a6a62",
    primaria: "#3fd27b",
    "sobre-primaria": "#062e1a",
    "primaria-fundo": "#16291f",
    atencao: "#fdba74",
    "atencao-fundo": "#24180c",
    "atencao-texto-2": "#c9b9a6",
    perigo: "#fda4af",
    "perigo-fundo": "#2d1418",
  },
};

/** Pares [frente, fundo] em que a cor carrega TEXTO: mínimo 4,5:1 (WCAG AA). */
export const PARES_TEXTO: [NomeCor, NomeCor][] = [
  ["texto", "chao"],
  ["texto-2", "chao"],
  ["primaria", "chao"],
  ["sobre-primaria", "primaria"],
  ["primaria", "primaria-fundo"],
  ["texto-2", "primaria-fundo"],
  ["atencao", "atencao-fundo"],
  ["texto", "atencao-fundo"],
  ["atencao-texto-2", "atencao-fundo"],
  ["perigo", "perigo-fundo"],
  // Situação de consulta pendente ("Pedido do paciente") no bloco tracejado
  // da agenda, que é branco (chao), não âmbar.
  ["atencao", "chao"],
];

/** Pares [frente, fundo] em que a cor é marca de gráfico: mínimo 3:1 (WCAG 1.4.11). */
export const PARES_GRAFICO: [NomeCor, NomeCor][] = [
  ["primaria", "linha"],
  ["atencao", "linha"],
  // Também a linha vertical de cada consulta no GraficoPeso (em `linha` ela
  // dava 1,24:1 e quase sumia), a meta tracejada e as bordas da faixa do
  // MiniGrafico.
  ["campo", "chao"],
  // Aba Corpo, a Evolução (components/clinico/graficos/): a linha da média e o
  // arco do anel sobre o fundo da página, o ponto da consulta (e o texto dos
  // eixos, que pede mais: está em PARES_TEXTO) e a linha da média sobre a
  // semana que a dica destaca (GraficoPeso pinta a semana de `primaria-fundo`).
  ["primaria", "chao"],
  ["texto", "chao"],
  ["primaria", "primaria-fundo"],
  // Aba Clínico, o MiniGrafico dos exames: a linha e os pontos (`texto`) sobre
  // a faixa de referência sombreada (`primaria-fundo`). As bordas da faixa são
  // `campo` sobre o fundo da página, par que já está acima: o preenchimento
  // sozinho dá ~1,1:1 contra a página, e o limite da faixa é informação.
  ["texto", "primaria-fundo"],
];

function bloco(tema: Record<NomeCor, string>): string {
  return NOMES_COR.map((nome) => `--clin-${nome}:${tema[nome]};`).join("");
}

/**
 * CSS das variáveis `--clin-*`, escopado em `.tema-clinico`. O tema escuro
 * do app é por classe (`.dark` no <html>), não por prefers-color-scheme —
 * daí o seletor descendente `.dark .tema-clinico`. Formato sem espaços:
 * o teste fixa o começo de cada bloco.
 *
 * O `body:has(...)` pinta a página inteira com o chão do tema. Só a caixa do
 * conteúdo tinha esse fundo; em volta dela ficava o do app (outra cor, com o
 * brilho verde), e a página do paciente parecia uma caixa solta, com uma
 * faixa vazia entre ela e o menu. O `background` (shorthand, e não
 * `background-color`) zera também uma imagem de fundo do body. Hoje é só
 * defensivo: o brilho verde que o `.dark body` de globals.css punha saiu, e o
 * body tem apenas `background-color`; se um dia voltar uma imagem ali, a
 * página clínica continua lisa.
 */
export function cssDoTemaClinico(): string {
  return (
    `.tema-clinico{${bloco(TEMA_CLINICO.claro)}}` +
    `.dark .tema-clinico{${bloco(TEMA_CLINICO.escuro)}}` +
    `body:has(.tema-clinico){background:${TEMA_CLINICO.claro.chao}}` +
    `.dark body:has(.tema-clinico){background:${TEMA_CLINICO.escuro.chao}}`
  );
}
