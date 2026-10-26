import { TEMA_APP } from "@/lib/temaApp";

// O ícone do app: uma lista de três linhas, com a do meio marcada (o paciente
// que precisa de atenção). Era um haltere, que dizia academia e reforçava a
// objeção "treino é do personal", vista em todas as rodadas do painel de
// compradores (founder/brand.md). A geometria mora aqui, num lugar só: dela
// saem o SVG dos PNG do manifesto e do apple-touch-icon (via next/og) e o
// símbolo das telas (components/MarcaIcone.tsx). O public/icon.svg é cópia do
// ICON_SVG, conferida por teste.
export const FORMAS_DA_MARCA = {
  cantos: 112,
  barras: [
    { x: 132, y: 142, width: 248, height: 44, opacity: 0.55 },
    { x: 208, y: 234, width: 172, height: 44, opacity: 1 },
    { x: 132, y: 326, width: 248, height: 44, opacity: 0.55 },
  ],
  ponto: { cx: 154, cy: 256, r: 30 },
} as const;

// As pontas redondas: o raio do canto é metade da altura da barra.
const FORMAS = [
  ...FORMAS_DA_MARCA.barras.map(
    (b) =>
      `<rect x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" rx="${b.height / 2}"${
        b.opacity < 1 ? ` opacity="${b.opacity}"` : ""
      }/>`
  ),
  `<circle cx="${FORMAS_DA_MARCA.ponto.cx}" cy="${FORMAS_DA_MARCA.ponto.cy}" r="${FORMAS_DA_MARCA.ponto.r}"/>`,
].join("\n    ");

// O PNG não lê variável de CSS: as cores são as do tema claro, tiradas da
// paleta (o branco sobre a principal passa 4,5:1, em lib/temaApp.test.ts).
const FUNDO = TEMA_APP.claro.primaria;
const FRENTE = TEMA_APP.claro["sobre-primaria"];

export const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="${FORMAS_DA_MARCA.cantos}" fill="${FUNDO}"/>
  <g fill="${FRENTE}">
    ${FORMAS}
  </g>
</svg>`;

export const ICON_DATA_URI = `data:image/svg+xml;utf8,${encodeURIComponent(
  ICON_SVG
)}`;

// Versão "maskable": fundo no quadrado inteiro e o desenho com margem de
// segurança (safe zone), para não ser cortado quando o sistema aplica máscara
// circular.
export const ICON_MASKABLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="${FUNDO}"/>
  <g fill="${FRENTE}" transform="translate(256 256) scale(0.72) translate(-256 -256)">
    ${FORMAS}
  </g>
</svg>`;

export const ICON_MASKABLE_DATA_URI = `data:image/svg+xml;utf8,${encodeURIComponent(
  ICON_MASKABLE_SVG
)}`;
