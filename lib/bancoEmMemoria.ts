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
// e cada chamada fica anotada em `chamadas`, com os filtros e o intervalo.
// Não sabe quais colunas a tabela tem e não aplica a RLS.

type Linha = Record<string, any>;

export type Chamada = {
  tabela: string;
  filtros: [string, string, unknown][];
  range: [number, number] | null;
};

export function bancoEmMemoria(
  tabelas: Record<string, Linha[]>,
  opcoes: { falhar?: (chamada: Chamada, indice: number) => boolean } = {}
) {
  const chamadas: Chamada[] = [];
  return {
    chamadas,
    from(tabela: string) {
      const chamada: Chamada = { tabela, filtros: [], range: null };
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
        select: (c: string) => ((colunas = c.trim() === "*" ? null : c.split(",").map((x) => x.trim())), q),
        eq: (c: string, v: unknown) => filtro("eq", c, v, (l) => l[c] === v),
        gte: (c: string, v: string) => filtro("gte", c, v, (l) => l[c] >= v),
        lte: (c: string, v: string) => filtro("lte", c, v, (l) => l[c] <= v),
        order: (c: string, o?: { ascending?: boolean }) => (ordens.push({ col: c, asc: o?.ascending !== false }), q),
        limit: (n: number) => ((teto = n), q),
        range: (de: number, ate: number) => ((chamada.range = [de, ate]), q),
        maybeSingle: () => ((umaSo = true), q),
        then: (resolve: (r: { data: any; error: unknown }) => void, reject?: (e: unknown) => void) => {
          try {
            const indice = chamadas.length;
            chamadas.push(chamada);
            if (opcoes.falhar?.(chamada, indice)) {
              resolve({ data: null, error: { message: "falha de teste", code: "XX000" } });
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
            if (chamada.range) out = out.slice(chamada.range[0], chamada.range[1] + 1);
            if (teto != null) out = out.slice(0, teto);
            const lista = colunas;
            const linhas = lista ? out.map((l) => Object.fromEntries(lista.map((c) => [c, l[c]]))) : out;
            if (umaSo) {
              if (linhas.length > 1) {
                resolve({ data: null, error: { message: "JSON object requested, multiple rows returned", code: "PGRST116" } });
              } else {
                resolve({ data: linhas[0] ?? null, error: null });
              }
              return;
            }
            resolve({ data: linhas, error: null });
          } catch (e) {
            reject?.(e);
          }
        },
      };
      return q;
    },
  };
}
