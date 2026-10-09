// Contraste WCAG entre duas cores #rrggbb.
//
// Mora aqui, e não na página /estilo, porque deixou de ser só uma régua
// visual: os testes da paleta clínica (lib/temaClinico.test.ts) usam a
// mesma conta para reprovar uma cor que não passa. Uma conta, dois usos —
// se cada um tivesse a sua, o guia de estilo poderia mostrar "AA" para um
// par que o teste reprova, ou o contrário.

function rgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [
    number,
    number,
    number,
  ];
}

/** Luminância relativa (WCAG 2.x), de 0 (preto) a 1 (branco). */
function luminancia(c: [number, number, number]): number {
  const [r, g, b] = c.map((v) => {
    const x = v / 255;
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Razão de contraste entre duas cores, de 1 (iguais) a 21 (preto e branco).
 * Simétrica: não importa qual é a frente e qual é o fundo.
 */
export function razaoContraste(a: string, b: string): number {
  const [la, lb] = [luminancia(rgb(a)), luminancia(rgb(b))];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
