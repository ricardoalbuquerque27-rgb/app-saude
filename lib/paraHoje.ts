// O cartão "Para hoje" da Início: quais linhas entram, em que ordem e quantas
// coisas estão pendentes. Mora num módulo puro porque a página só desenha
// (spec "Início (paciente)", item 3): ordem, contagem e deduplicação são
// regra, e regra se testa.

export type EntradaParaHoje = {
  recados: { id: string }[];
  treinos: { id: string; prescribed_by: string | null }[]; // sessões de hoje
  confirmados: string[]; // plan_id com check-in hoje
  temNutri: boolean;
  aplicacao: { atrasada: boolean } | null; // só quando é hoje ou atrasada
  refeicoesFaltando: number; // tipos do cardápio sem registro e sem resposta hoje (refeicoesQueFaltam)
  pendencias: { key: string; urgent?: boolean }[]; // de getPending
  falhou: boolean; // alguma leitura acima falhou
};

export type LinhaParaHoje =
  | { tipo: "recados"; quantidade: number }
  | { tipo: "treino"; id: string; doNutri: boolean; confirmado: boolean }
  | { tipo: "aplicacao"; atrasada: boolean }
  | { tipo: "cardapio"; faltam: number }
  | { tipo: "pendencia"; key: string; urgente: boolean };

export type ParaHoje = {
  linhas: LinhaParaHoje[];
  pendentes: number;
  estado: "pendente" | "em-dia" | "incompleto";
};

/**
 * Monta as linhas do "Para hoje", na ordem da spec: recados, treinos do
 * nutricionista, treinos próprios, aplicação, cardápio e as demais pendências.
 *
 * - **Contagem.** Cada recado conta 1 (a linha agrupa, mas há N a ler), cada
 *   treino ainda não confirmado conta 1, e aplicação, cardápio e cada
 *   pendência contam 1. O treino já confirmado aparece, mas não conta: a
 *   spec diz que "a contagem não inclui o treino já confirmado".
 * - **Deduplicação da dose.** `getPending` também devolve a pendência `dose`
 *   quando a aplicação é de hoje ou está atrasada, a mesma coisa da linha da
 *   aplicação; com `aplicacao`, a pendência sai, senão o cartão diria a dose
 *   duas vezes e contaria 2.
 * - **Treino "do nutri".** Só vale com vínculo ativo: depois que o paciente
 *   revoga, a sessão segue no plano dele com `prescribed_by` preenchido, mas
 *   "do seu nutricionista" passaria a ser mentira.
 * - **"Em dia" só com certeza.** O supabase-js devolve `{ data: null, error }`
 *   sem lançar, e a Início fazia `data ?? []` e diria "em dia" com uma leitura
 *   quebrada (CLAUDE.md, "Leitura que falha não é 'não tem'"). Com `falhou`, o
 *   estado é "incompleto" mesmo sem linha nenhuma, e `pendentes` conta só o que
 *   chegou.
 */
export function montarParaHoje(e: EntradaParaHoje): ParaHoje {
  const linhas: LinhaParaHoje[] = [];
  let pendentes = 0;

  if (e.recados.length > 0) {
    linhas.push({ tipo: "recados", quantidade: e.recados.length });
    pendentes += e.recados.length;
  }

  const treinos = e.treinos.map((t) => ({
    id: t.id,
    doNutri: e.temNutri && t.prescribed_by != null,
    confirmado: e.confirmados.includes(t.id),
  }));
  // Dois grupos, cada um na ordem em que a leitura trouxe.
  for (const t of [...treinos.filter((t) => t.doNutri), ...treinos.filter((t) => !t.doNutri)]) {
    linhas.push({ tipo: "treino", ...t });
    if (!t.confirmado) pendentes += 1;
  }

  if (e.aplicacao) {
    linhas.push({ tipo: "aplicacao", atrasada: e.aplicacao.atrasada });
    pendentes += 1;
  }

  if (e.refeicoesFaltando > 0) {
    linhas.push({ tipo: "cardapio", faltam: e.refeicoesFaltando });
    pendentes += 1;
  }

  for (const p of e.pendencias) {
    if (p.key === "dose" && e.aplicacao) continue;
    linhas.push({ tipo: "pendencia", key: p.key, urgente: p.urgent === true });
    pendentes += 1;
  }

  const estado = e.falhou ? "incompleto" : pendentes === 0 ? "em-dia" : "pendente";
  return { linhas, pendentes, estado };
}

/**
 * Quantas refeições do cardápio ainda faltam hoje: as que não têm registro
 * NEM resposta ("comi" ou "não comi", da notificação ou do plano). "Não comi"
 * também é resposta: a linha "N refeições ainda faltam" não pode cobrar de
 * quem já disse que não comeu.
 */
export function refeicoesQueFaltam(tiposDoPlano: string[], registradas: string[], respondidas: string[]): number {
  const feitas = new Set([...registradas, ...respondidas]);
  return new Set(tiposDoPlano.filter((t) => !feitas.has(t))).size;
}
