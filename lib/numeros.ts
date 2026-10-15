/**
 * Os números da página do paciente do nutricionista, em pt-BR. Eram quatro
 * cópias (GraficoPeso, AnelDaMeta, Corpo e Clínico), e uma delas escrevia
 * "30,4 %" onde o título do mesmo gráfico dizia "30,4%". Sem "use client":
 * serve ao servidor e ao navegador.
 */

/**
 * "70,3", "66", "0,4": vírgula decimal, no máximo `casas` casas, sem zero
 * sobrando e sem separador de milhar (o resultado de exame "6500" não vira
 * "6.500", que leria como seis e meio).
 */
export function numeroBR(n: number, casas = 1): string {
  return n.toLocaleString("pt-BR", { maximumFractionDigits: casas, useGrouping: false });
}

/**
 * "65,8", "66,0": sempre `casas` casas, com o zero. É o peso do Progresso da
 * Início e da linha dele: o numeroBR tiraria o zero ("66"), e o peso parecia
 * menos preciso que a variação ao lado ("−2,6 kg"). Sem separador de milhar,
 * como o numeroBR.
 */
export function numeroFixo(n: number, casas = 1): string {
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
    useGrouping: false,
  });
}

/** "+1,2", "−4,3" (o sinal de menos de verdade, U+2212, como nos gráficos) ou "0". */
export function comSinal(n: number, casas = 1): string {
  if (n === 0) return "0";
  return `${n < 0 ? "−" : "+"}${numeroBR(Math.abs(n), casas)}`;
}

/** "30,4%" (o % colado no número, como no título do gráfico) ou "85 cm". */
export function comUnidade(n: number, unidade: string, casas = 1): string {
  return unidade === "%" ? `${numeroBR(n, casas)}%` : `${numeroBR(n, casas)} ${unidade}`;
}
