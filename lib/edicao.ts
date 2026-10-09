// Regra de uma edição por vez no detalhe do paciente.
//
// As seções editáveis (metas, cardápio, treino) abrem no lugar, na mesma
// página. Se duas pudessem ficar abertas, o nutricionista perderia o que
// digitou ao salvar uma e recarregar a outra. A regra: só uma aberta; uma
// seção "suja" (com alteração não salva) não cede o lugar, uma limpa sim.

export type SecaoEditavel = "metas" | "cardapio" | "treino";

export type EstadoEdicao = { aberta: SecaoEditavel | null; suja: boolean };

// `secao` em "sujar"/"limpar"/"fechar" diz QUEM está pedindo. Sem ele a ação vale para
// a seção aberta, seja ela qual for; com ele, só vale se for a própria.
// Motivo: uma seção limpa cede o lugar a outra enquanto ainda salva; quando o
// salvar termina e chama fechar(), a seção aberta já é a outra, e fechá-la
// jogaria fora o rascunho dela.
export type AcaoEdicao =
  | { tipo: "abrir"; secao: SecaoEditavel }
  | { tipo: "sujar"; secao?: SecaoEditavel }
  | { tipo: "limpar"; secao?: SecaoEditavel }
  | { tipo: "fechar"; secao?: SecaoEditavel };

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
      // Sem seção aberta não há o que sujar; de outra seção, não é comigo.
      if (e.aberta === null) return e;
      if (a.secao && a.secao !== e.aberta) return e;
      return { ...e, suja: true };
    case "limpar":
      // Tira a marca de alteração sem fechar a seção: o treino grava a cada
      // ação e continua aberto depois de salvar, e a marca de quando havia um
      // rascunho não pode sobreviver a ele e travar as outras seções por nada.
      // Devolve o MESMO objeto quando não há o que mudar (nada aberto, outra
      // seção ou já limpa), para o React não re-renderizar a página inteira.
      if (e.aberta === null || !e.suja) return e;
      if (a.secao && a.secao !== e.aberta) return e;
      return { ...e, suja: false };
    case "fechar":
      if (a.secao && a.secao !== e.aberta) return e;
      return { aberta: null, suja: false };
  }
}
