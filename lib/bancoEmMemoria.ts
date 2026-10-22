// Um Supabase em memória para os testes das leituras paginadas
// (lib/evolucaoDb.test.ts e lib/examesDb.test.ts). Não é usado pelo app: só
// os testes o importam.
//
// Faz o que essas leituras usam, do jeito do PostgREST: o `select` devolve só
// as colunas pedidas (a coluna esquecida chega ausente), `order` em mais de
// uma coluna, `range(de, ate)` (o `offset` e o `limit` que o supabase-js
// manda), `limit` e `maybeSingle`, que falha com duas linhas. E o que os
// outros Supabases falsos dos testes não fazem: uma chamada pode devolver
// `error` (`falhar`), que é o caso da leitura que falha no meio das páginas,
// o `count: "exact"` do `select` (o total das linhas que passam nos filtros,
// antes do `range`, como o Content-Range do PostgREST) e o `max-rows` do
// projeto (`maxRows`): o PostgREST corta a resposta nele SEM erro, e é isso
// que a conferência da contagem em `lerEmPaginas` pega. Cada chamada fica
// anotada em `chamadas`, com os filtros, o intervalo e a contagem pedida.
// Não sabe quais colunas a tabela tem e não aplica a RLS.
//
// Grava também, para os testes das gravações de treino
// (lib/treinoAoVivo.test.ts e lib/planCheckIn.test.ts): `insert` (com
// `select().single()` devolvendo a linha criada, com um `id` quando ela não
// traz), `upsert` pela chave do `onConflict`, `delete` com os filtros e o `in`.
// A gravação que falha (`falhar`, que vê o `op` da chamada) não muda a tabela.

type Linha = Record<string, any>;

export type Chamada = {
  tabela: string;
  op: "select" | "insert" | "upsert" | "delete";
  filtros: [string, string, unknown][];
  range: [number, number] | null;
  /** O `count` que o `select` pediu, ou nulo. */
  contagem: "exact" | null;
};

export function bancoEmMemoria(
  tabelas: Record<string, Linha[]>,
  opcoes: {
    falhar?: (chamada: Chamada, indice: number) => boolean;
    /** O teto de linhas por resposta do projeto (o padrão da Supabase é 1.000). Sem ele, não há corte. */
    maxRows?: number;
  } = {}
) {
  const chamadas: Chamada[] = [];
  return {
    chamadas,
    from(tabela: string) {
      const chamada: Chamada = { tabela, op: "select", filtros: [], range: null, contagem: null };
      let novas: Linha[] = [];
      let chaveDoUpsert: string[] = [];
      let devolveLinhas = false;
      let exigeUma = false;
      let colunas: string[] | null = null;
      const testes: ((l: Linha) => boolean)[] = [];
      const ordens: { col: string; asc: boolean }[] = [];
      let teto: number | null = null;
      let umaSo = false;
      const filtro = (op: string, c: string, v: unknown, teste: (l: Linha) => boolean) => {
        chamada.filtros.push([op, c, v]);
        testes.push(teste);
        return q;
      };
      const q: any = {
        select: (c: string = "*", o?: { count?: string }) => (
          (colunas = c.trim() === "*" ? null : c.split(",").map((x) => x.trim())),
          (chamada.contagem = o?.count === "exact" ? "exact" : null),
          (devolveLinhas = true),
          q
        ),
        insert: (l: Linha | Linha[]) => ((chamada.op = "insert"), (novas = Array.isArray(l) ? l : [l]), q),
        upsert: (l: Linha, o?: { onConflict?: string }) => (
          (chamada.op = "upsert"),
          (novas = [l]),
          (chaveDoUpsert = (o?.onConflict ?? "id").split(",").map((x) => x.trim())),
          q
        ),
        delete: () => ((chamada.op = "delete"), q),
        in: (c: string, v: unknown[]) => filtro("in", c, v, (l) => v.includes(l[c])),
        eq: (c: string, v: unknown) => filtro("eq", c, v, (l) => l[c] === v),
        gte: (c: string, v: string) => filtro("gte", c, v, (l) => l[c] >= v),
        lte: (c: string, v: string) => filtro("lte", c, v, (l) => l[c] <= v),
        order: (c: string, o?: { ascending?: boolean }) => (ordens.push({ col: c, asc: o?.ascending !== false }), q),
        limit: (n: number) => ((teto = n), q),
        range: (de: number, ate: number) => ((chamada.range = [de, ate]), q),
        maybeSingle: () => ((umaSo = true), q),
        single: () => ((umaSo = true), (exigeUma = true), q),
        then: (resolve: (r: { data: any; error: unknown; count?: number | null }) => void, reject?: (e: unknown) => void) => {
          try {
            const indice = chamadas.length;
            chamadas.push(chamada);
            if (opcoes.falhar?.(chamada, indice)) {
              resolve({ data: null, error: { message: "falha de teste", code: "XX000" } });
              return;
            }
            if (chamada.op !== "select") {
              const tabelaAtual = (tabelas[tabela] ??= []);
              let afetadas: Linha[] = [];
              if (chamada.op === "delete") {
                afetadas = tabelaAtual.filter((l) => testes.every((t) => t(l)));
                tabelas[tabela] = tabelaAtual.filter((l) => !afetadas.includes(l));
              } else {
                for (const n of novas) {
                  const existente =
                    chamada.op === "upsert"
                      ? tabelaAtual.find((l) => chaveDoUpsert.every((k) => l[k] === n[k]))
                      : undefined;
                  if (existente) {
                    Object.assign(existente, n);
                    afetadas.push(existente);
                  } else {
                    const linha = { id: `${tabela}-${tabelaAtual.length + 1}`, ...n };
                    tabelaAtual.push(linha);
                    afetadas.push(linha);
                  }
                }
              }
              const lista = colunas;
              const linhas = lista ? afetadas.map((l) => Object.fromEntries(lista.map((c) => [c, l[c]]))) : afetadas;
              if (!devolveLinhas) resolve({ data: null, error: null });
              else if (umaSo) resolve({ data: linhas[0] ?? null, error: null });
              else resolve({ data: linhas, error: null });
              return;
            }
            let out = (tabelas[tabela] ?? []).filter((l) => testes.every((t) => t(l)));
            out = [...out].sort((a, b) => {
              for (const { col, asc } of ordens) {
                if (a[col] === b[col]) continue;
                return (a[col] < b[col] ? -1 : 1) * (asc ? 1 : -1);
              }
              return 0;
            });
            const total = out.length;
            if (chamada.range) out = out.slice(chamada.range[0], chamada.range[1] + 1);
            if (teto != null) out = out.slice(0, teto);
            if (opcoes.maxRows != null) out = out.slice(0, opcoes.maxRows);
            const lista = colunas;
            const linhas = lista ? out.map((l) => Object.fromEntries(lista.map((c) => [c, l[c]]))) : out;
            if (umaSo) {
              if (linhas.length > 1 || (exigeUma && linhas.length === 0)) {
                resolve({ data: null, error: { message: "JSON object requested, multiple (or no) rows returned", code: "PGRST116" } });
              } else {
                resolve({ data: linhas[0] ?? null, error: null, count: chamada.contagem ? total : null });
              }
              return;
            }
            resolve({ data: linhas, error: null, count: chamada.contagem ? total : null });
          } catch (e) {
            reject?.(e);
          }
        },
      };
      return q;
    },
  };
}
