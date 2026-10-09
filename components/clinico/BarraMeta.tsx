import type { Comparacao } from "@/lib/nutri";
import { textoDelta } from "./TabelaRealMeta";

// Real contra meta no celular: uma linha de texto e uma barra de 4 px. A
// barra é só desenho (aria-hidden); tudo o que ela diz está no texto, que é
// o que o leitor de tela lê. Sem meta ou sem dado a barra fica só no trilho:
// uma barra cheia ou vazia afirmaria um resultado que ninguém mediu.
//
// `proporcao` é real/meta, e quem chama decide o que fazer com ela; aqui só
// se limita a 0–100% para o preenchimento não vazar do trilho quando o real
// passa da meta (o Δ já conta isso em número).
export function BarraMeta({
  rotulo,
  realTexto,
  metaTexto,
  proporcao,
  comparacao,
  nota,
}: {
  rotulo: string;
  realTexto: string;
  metaTexto: string | null;
  proporcao: number | null;
  comparacao: Comparacao;
  nota?: string;
}) {
  const delta = textoDelta(comparacao);
  const atencao = comparacao.status === "atencao";
  const temBarra =
    proporcao != null &&
    Number.isFinite(proporcao) &&
    (comparacao.status === "ok" || atencao);
  const largura = temBarra ? Math.min(Math.max(proporcao, 0), 1) * 100 : 0;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[14px] font-medium text-clin-texto">{rotulo}</span>
        <span className="text-right text-[14px] tabular-nums text-clin-texto">
          <span className="font-semibold">{realTexto}</span>
          {metaTexto != null && (
            <span className="text-clin-texto-2"> de {metaTexto}</span>
          )}
          {delta != null &&
            (atencao ? (
              <span className="ml-2 inline-block rounded bg-clin-atencao-fundo px-1.5 font-semibold text-clin-atencao">
                {delta}
                <span className="sr-only"> (fora da meta)</span>
              </span>
            ) : (
              <span className="ml-2 text-clin-texto-2">{delta}</span>
            ))}
        </span>
      </div>
      <div
        aria-hidden="true"
        className="mt-2 h-1 w-full overflow-hidden rounded-full bg-clin-linha"
      >
        {temBarra && (
          <div
            className={`h-full rounded-full ${
              atencao ? "bg-clin-atencao" : "bg-clin-primaria"
            }`}
            style={{ width: `${largura}%` }}
          />
        )}
      </div>
      {nota && (
        <p className="mt-1.5 text-[13px] leading-snug text-clin-texto-2">
          {nota}
        </p>
      )}
    </div>
  );
}
