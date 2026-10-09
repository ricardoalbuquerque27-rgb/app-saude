// Regra de uma edição por vez no detalhe do paciente.
//
// As seções editáveis (metas, cardápio, treino) abrem no lugar, na mesma
// página. Se duas pudessem ficar abertas, o nutricionista perderia o que
// digitou ao salvar uma e recarregar a outra. A regra: só uma aberta; uma
// seção "suja" (com alteração não salva) não cede o lugar, uma limpa sim.

export type SecaoEditavel = "metas" | "cardapio" | "treino";

export type EstadoEdicao = { aberta: SecaoEditavel | null; suja: boolean };

export type AcaoEdicao =
  | { tipo: "abrir"; secao: SecaoEditavel }
  | { tipo: "sujar" }
  | { tipo: "fechar" };

/**
 * Uma seção pode abrir se nada está aberto, se é ela mesma que está aberta,
 * ou se a que está aberta não tem alteração a perder.
 */
export function podeAbrir(e: EstadoEdicao, secao: SecaoEditavel): boolean {
  return e.aberta === null || e.aberta === secao || !e.suja;
}

export function reduzirEdicao(e: EstadoEdicao, a: AcaoEdicao): EstadoEdicao {
  switch (a.tipo) {
    case "abrir":
      if (!podeAbrir(e, a.secao)) return e;
      // Reabrir a própria seção não zera a marca de suja.
      if (e.aberta === a.secao) return e;
      return { aberta: a.secao, suja: false };
    case "sujar":
      // Sem seção aberta não há o que sujar.
      return e.aberta === null ? e : { ...e, suja: true };
    case "fechar":
      return { aberta: null, suja: false };
  }
}
