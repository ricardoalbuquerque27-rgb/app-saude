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

/**
 * "+1,2", "−4,3" (o sinal de menos de verdade, U+2212, como nos gráficos) ou
 * "0". O zero é o que a tela MOSTRA, não o número: uma variação de 0,04 kg
 * saía "+0", e o sinal dizia que o peso subiu enquanto o número dizia que não.
 */
export function comSinal(n: number, casas = 1): string {
  const absoluto = numeroBR(Math.abs(n), casas);
  if (absoluto === "0") return "0";
  return `${n < 0 ? "−" : "+"}${absoluto}`;
}

/**
 * "30,4%" (o % colado no número, como no título do gráfico) ou "85 cm". Com
 * `fixas`, sempre `casas` casas, com o zero ("66,0 kg"): é a lista da página
 * Medidas, que tinha uma cópia desta função só para isso.
 */
export function comUnidade(n: number, unidade: string, casas = 1, fixas = false): string {
  const numero = fixas ? numeroFixo(n, casas) : numeroBR(n, casas);
  return unidade === "%" ? `${numero}%` : `${numero} ${unidade}`;
}
