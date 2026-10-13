// As abas da página do paciente (lado do nutricionista).
//
// A página foi uma rolagem só, por assunto; com dados reais, a fila, os
// números, Alimentação, Treino, Corpo e Clínico empilhados ficaram longos
// demais, e cada assunto novo (consultas, evolução) esticaria mais. Cada aba
// vive no endereço (?aba=treino) para o Voltar do navegador e um link mandado
// a alguém abrirem a mesma aba.

export type AbaPaciente =
  | "resumo"
  | "alimentacao"
  | "treino"
  | "corpo"
  | "clinico"
  | "consultas";

export const ABAS: { id: AbaPaciente; rotulo: string }[] = [
  { id: "resumo", rotulo: "Resumo" },
  { id: "alimentacao", rotulo: "Alimentação" },
  { id: "treino", rotulo: "Treino" },
  { id: "corpo", rotulo: "Corpo" },
  { id: "clinico", rotulo: "Clínico" },
  { id: "consultas", rotulo: "Consultas" },
];

/** A aba pedida no endereço; qualquer valor desconhecido cai no Resumo. */
export function abaDaUrl(valor: string | string[] | undefined): AbaPaciente {
  const v = Array.isArray(valor) ? valor[0] : valor;
  return ABAS.some((a) => a.id === v) ? (v as AbaPaciente) : "resumo";
}

/**
 * O endereço de uma aba; o Resumo é o endereço do paciente sem parâmetro.
 *
 * `foco` é o modo de tela cheia do celular (Mensagem, Nota). A aba vai junto
 * para o Voltar cair nela: sem isso voltava ao Resumo, e um rascunho de metas
 * aberto em Alimentação era desmontado.
 */
export function hrefDaAba(
  uid: string,
  aba: AbaPaciente,
  foco?: "conversa" | "notas"
): string {
  const partes: string[] = [];
  if (aba !== "resumo") partes.push(`aba=${aba}`);
  if (foco) partes.push(`${foco}=1`);
  return `/app/pacientes/${uid}` + (partes.length ? `?${partes.join("&")}` : "");
}
