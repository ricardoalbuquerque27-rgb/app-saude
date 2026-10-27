/**
 * A leitura do laudo pela IA só transcreve: nome, valor, unidade e a faixa
 * como está impressa. O juízo (normal, alterado, o que significa, o que fazer)
 * fica com a nutricionista; a rota antiga devolvia "interpretação" e
 * "recomendações" ao paciente, que é o que aproxima o app de um software de
 * diagnóstico (spec do uso pretendido). O que a IA mandar além disso cai aqui.
 */
export type ItemTranscrito = { nome: string; valor: string | null; unidade: string | null; referencia: string | null };

// A IA devolve número, objeto ou nulo onde se espera texto (`.trim` num
// número derrubava a leitura inteira). Só o valor pode vir como número (180);
// unidade, faixa ou nome em número não querem dizer nada e viram nulo.
function texto(v: unknown, numeroVale = false): string | null {
  if (typeof v === "number") return numeroVale && Number.isFinite(v) ? String(v) : null;
  if (typeof v !== "string") return null;
  return v.trim() || null;
}

export function transcricaoDoLaudo(json: unknown): ItemTranscrito[] {
  if (!json || typeof json !== "object" || Array.isArray(json)) return [];
  const itens = (json as { itens?: unknown }).itens;
  if (!Array.isArray(itens)) return [];
  const lidos: ItemTranscrito[] = [];
  for (const it of itens) {
    if (!it || typeof it !== "object") continue;
    const o = it as Record<string, unknown>;
    const nome = texto(o.nome);
    if (!nome) continue;
    lidos.push({ nome, valor: texto(o.valor, true), unidade: texto(o.unidade), referencia: texto(o.referencia) });
  }
  return lidos;
}
