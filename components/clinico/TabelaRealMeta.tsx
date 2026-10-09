import type { Comparacao } from "@/lib/nutri";

/**
 * Δ como a tela mostra: "+14%", "−8%" (sinal de menos de verdade, que tem a
 * largura do "+" e não se confunde com hífen) ou "0%". Sem meta ou sem dado
 * não há comparação a fazer, então devolve null e quem chama põe o "—".
 *
 * O número já vem arredondado de `compararComMeta`; aqui só se formata, para
 * o que aparece ser exatamente o que decidiu o status.
 */
export function textoDelta(c: Comparacao): string | null {
  if (c.status === "sem-meta" || c.status === "sem-dado") return null;
  if (c.delta == null) return null;
  if (c.delta > 0) return `+${c.delta}%`;
  if (c.delta < 0) return `−${Math.abs(c.delta)}%`;
  return "0%";
}

// Real contra meta no computador: Item | Real | Meta | Δ. No celular a mesma
// informação aparece em BarraMeta. Fora da meta o Δ ganha fundo `atencao`
// E um texto só para leitor de tela: sem isso a única diferença entre "+4%" e
// "+14%" seria a cor.
export function TabelaRealMeta({
  linhas,
}: {
  linhas: { item: string; real: string; meta: string; comparacao: Comparacao }[];
}) {
  return (
    <table className="w-full border-collapse text-[14px] tabular-nums">
      <caption className="sr-only">Real contra meta</caption>
      <thead>
        <tr className="border-b border-clin-linha text-[13px] text-clin-texto-2">
          <th scope="col" className="py-2 pr-3 text-left font-medium">
            Item
          </th>
          <th scope="col" className="px-3 py-2 text-right font-medium">
            Real
          </th>
          <th scope="col" className="px-3 py-2 text-right font-medium">
            Meta
          </th>
          <th scope="col" className="py-2 pl-3 text-right font-medium">
            Δ
          </th>
        </tr>
      </thead>
      <tbody>
        {linhas.map((l, i) => {
          const delta = textoDelta(l.comparacao);
          return (
            <tr
              key={`${l.item}-${i}`}
              className="border-b border-clin-linha last:border-b-0"
            >
              <th
                scope="row"
                className="py-3 pr-3 text-left font-medium text-clin-texto"
              >
                {l.item}
              </th>
              <td className="px-3 py-3 text-right text-clin-texto">{l.real}</td>
              <td className="px-3 py-3 text-right text-clin-texto-2">
                {l.meta}
              </td>
              <td className="py-3 pl-3 text-right">
                {delta == null ? (
                  <>
                    <span aria-hidden="true" className="text-clin-texto-2">
                      —
                    </span>
                    <span className="sr-only">sem comparação</span>
                  </>
                ) : l.comparacao.status === "atencao" ? (
                  <span className="inline-block rounded bg-clin-atencao-fundo px-2 py-0.5 font-semibold text-clin-atencao">
                    {delta}
                    <span className="sr-only"> (fora da meta)</span>
                  </span>
                ) : (
                  <span className="text-clin-texto-2">{delta}</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
