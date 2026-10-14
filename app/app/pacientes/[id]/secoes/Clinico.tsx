import { ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatDate, idadeEm, todayISO } from "@/lib/date";
import type { ExamContext } from "@/lib/examRanges";
import {
  avisosDaLinha,
  compararExames,
  dataDoComparativo,
  descricaoDaSerie,
  fraseSemComparacao,
  resumoDoComparativo,
  type LinhaDoComparativo,
} from "@/lib/exames";
import { getExamesDoPaciente, type ExameDoPaciente } from "@/lib/examesDb";
import { MiniGrafico } from "@/components/clinico/graficos/MiniGrafico";
import { Secao } from "@/components/clinico/Secao";
import { ErroSecao } from "@/components/clinico/ErroSecao";
import { FOCO } from "@/components/clinico/estilos";
import { CLASSE_SELO } from "@/components/consultas/aparencia";

const TITULO_BLOCO = "text-[15px] font-semibold leading-snug text-clin-texto";

// Cada status de exame com texto além da cor: quem não distingue as cores lê
// o mesmo que os outros. Os três são pares com contraste testado
// (lib/temaClinico.ts). O app grava "atencao" e "atenção"; os dois valem.
const STATUS_EXAME: Record<string, { rotulo: string; caixa: string }> = {
  alterado: { rotulo: "alterado", caixa: "bg-clin-perigo-fundo text-clin-perigo" },
  atencao: { rotulo: "atenção", caixa: "bg-clin-atencao-fundo text-clin-atencao" },
  atenção: { rotulo: "atenção", caixa: "bg-clin-atencao-fundo text-clin-atencao" },
  normal: { rotulo: "normal", caixa: "bg-clin-primaria-fundo text-clin-primaria" },
};

const situacaoDoExame = (status: string | null) => (status ? STATUS_EXAME[status] : undefined);
const comMaiuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);

/** "5,9": vírgula decimal e sem separador de milhar, como o resultado é gravado. */
const numero = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 3, useGrouping: false });
/** "+27", "−13" (sinal de menos de verdade, como nos gráficos) ou "0". */
const comSinal = (n: number) => (n === 0 ? "0" : `${n < 0 ? "−" : "+"}${numero(Math.abs(n))}`);

type Exame = ExameDoPaciente;

// Tratamento, próxima dose, exames e efeitos colaterais. Só leitura: são
// registros do paciente, e o nutricionista não os altera.
//
// Os exames viram o comparativo (último resultado de cada exame contra o
// anterior, em palavras, lib/exames.ts), com a lista de todos os resultados
// atrás de um botão. Sexo e nascimento entram só para a faixa da tabela do app
// quando o laudo não traz a dele.
export async function Clinico({
  uid,
  sexo,
  nascimento,
}: {
  uid: string;
  sexo: string | null;
  nascimento: string | null;
}) {
  const supabase = await createClient();
  const hoje = todayISO();

  const [examesRes, tratamentoRes, dosesRes, efeitosRes] = await Promise.all([
    // Todos, em páginas, do mais velho ao mais novo (lib/examesDb.ts). A lista
    // "Ver todos" inverte, para ficar como sempre foi, do mais novo ao mais velho.
    getExamesDoPaciente(supabase, uid),
    // Nada impede dois tratamentos ativos ao mesmo tempo, e `.maybeSingle()`
    // sozinho FALHA com duas linhas: a aba antiga dizia "Nenhum tratamento
    // ativo" justamente para quem tinha dois. Vale o mais recente.
    supabase
      .from("treatments")
      .select("medication, dose, frequency_days, start_date, next_dose_date, notes")
      .eq("user_id", uid)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("dose_logs")
      .select("date, dose")
      .eq("user_id", uid)
      .order("date", { ascending: false })
      .limit(12),
    supabase
      .from("side_effects")
      .select("date, nausea, appetite, fatigue, other, notes")
      .eq("user_id", uid)
      .order("date", { ascending: false })
      .limit(12),
  ]);

  // A leitura dos exames que falha derruba só o bloco Exames, mais abaixo: o
  // tratamento e os efeitos não dependem dela. Com 200 exames a aba inteira
  // dizia "Não foi possível carregar os dados clínicos", o tratamento junto.
  if (tratamentoRes.error || dosesRes.error || efeitosRes.error) {
    return (
      <Secao id="clinico" titulo="Clínico">
        <ErroSecao secao="os dados clínicos" />
      </Secao>
    );
  }

  const exames: Exame[] = examesRes.data;
  const tratamento = tratamentoRes.data as any;
  const doses = (dosesRes.data ?? []) as any[];
  const efeitos = (efeitosRes.data ?? []) as any[];
  const doseAtrasada =
    !!tratamento?.next_dose_date && tratamento.next_dose_date < hoje;

  const contexto: ExamContext = {
    sex: sexo === "M" || sexo === "F" ? sexo : null,
    age: idadeEm(nascimento, hoje),
  };
  const comparativo = compararExames(exames, contexto);
  // Nenhum exame com o que comparar: a tela diz por quê (fraseSemComparacao) e
  // mostra a lista de sempre, em vez de uma tabela de "primeiro resultado".
  const semComparacao = fraseSemComparacao(exames, comparativo);

  return (
    <Secao id="clinico" titulo="Clínico">
      <h3 className={TITULO_BLOCO}>Tratamento</h3>
      {!tratamento ? (
        <p className="mt-2 text-[14px] text-clin-texto-2">Sem tratamento ativo</p>
      ) : (
        <div className="mt-2">
          <p className="text-[15px] font-medium text-clin-texto">
            {tratamento.medication}
            {tratamento.dose ? ` · ${tratamento.dose}` : ""}
          </p>
          <p className="mt-0.5 text-[14px] tabular-nums text-clin-texto-2">
            {[
              tratamento.frequency_days
                ? `a cada ${tratamento.frequency_days} dias`
                : null,
              tratamento.start_date
                ? `início ${formatDate(tratamento.start_date)}`
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {tratamento.next_dose_date && (
            <p className="mt-1 text-[14px] tabular-nums text-clin-texto">
              Próxima dose: {formatDate(tratamento.next_dose_date)}
              {doseAtrasada && (
                <span className="ml-2 inline-block rounded bg-clin-atencao-fundo px-1.5 text-[13px] font-semibold text-clin-atencao">
                  atrasada
                </span>
              )}
            </p>
          )}
          {tratamento.notes && (
            <p className="mt-1 text-[14px] leading-snug text-clin-texto-2">
              {tratamento.notes}
            </p>
          )}
          {doses.length > 0 && (
            <>
              <p className="mt-3 text-[13px] text-clin-texto-2">Últimas aplicações</p>
              <ul className="mt-1 flex flex-wrap gap-1.5">
                {doses.map((d, i) => (
                  <li
                    key={i}
                    className="rounded-md border border-clin-linha px-2 py-0.5 text-[13px] tabular-nums text-clin-texto"
                  >
                    {formatDate(d.date)}
                    {d.dose ? ` · ${d.dose}` : ""}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      <h3 className={`mt-6 ${TITULO_BLOCO}`}>Exames</h3>
      {examesRes.falhou ? (
        <div className="mt-2">
          <ErroSecao secao="os exames" />
        </div>
      ) : exames.length === 0 ? (
        <p className="mt-2 text-[14px] text-clin-texto-2">Nenhum exame registrado.</p>
      ) : semComparacao ? (
        <>
          <p className="mt-2 text-[14px] text-clin-texto-2">{semComparacao}</p>
          <div className="mt-2">
            <ListaDeExames exames={exames} />
          </div>
        </>
      ) : (
        <ComparativoDosExames comparativo={comparativo} exames={exames} hoje={hoje} />
      )}

      {efeitos.length > 0 && (
        <>
          <h3 className={`mt-6 ${TITULO_BLOCO}`}>Efeitos colaterais relatados</h3>
          <ul className="mt-2 divide-y divide-clin-linha">
            {efeitos.map((e, i) => (
              <li key={i} className="py-2.5">
                <p className="text-[13px] tabular-nums text-clin-texto-2">
                  {formatDate(e.date)}
                </p>
                <p className="text-[14px] leading-snug text-clin-texto">
                  {[
                    e.nausea ? `náusea ${e.nausea}/5` : null,
                    e.appetite ? `apetite ${e.appetite}/5` : null,
                    e.fatigue ? `cansaço ${e.fatigue}/5` : null,
                    e.other || null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Sem detalhes"}
                </p>
                {e.notes && (
                  <p className="text-[13px] leading-snug text-clin-texto-2">
                    {e.notes}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </Secao>
  );
}

/**
 * A lista de todos os resultados, do mais novo ao mais velho, um por linha: a
 * lista de antes do comparativo, sem mudança. `exames` vem do mais velho ao
 * mais novo (a ordem que o comparativo pede), e aqui se inverte.
 */
function ListaDeExames({ exames }: { exames: Exame[] }) {
  return (
    <ul aria-label="Resultados dos exames" className="divide-y divide-clin-linha">
      {[...exames].reverse().map((e, i) => {
        const st = situacaoDoExame(e.status);
        const resultado = [e.result_value, e.unit].filter(Boolean).join(" ");
        return (
          <li key={i} className="py-2.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[14px] font-medium leading-snug text-clin-texto">
                  {e.title}
                </p>
                <p className="text-[13px] tabular-nums text-clin-texto-2">
                  {formatDate(e.date)}
                  {e.reference_range ? ` · ref. ${e.reference_range}` : ""}
                </p>
              </div>
              <span
                className={`shrink-0 rounded px-2 py-0.5 text-right text-[13px] font-semibold tabular-nums ${
                  st?.caixa ?? "text-clin-texto"
                }`}
              >
                {resultado || "—"}
                {st && <span className="font-normal"> · {st.rotulo}</span>}
              </span>
            </div>
            {e.notes && (
              <p className="mt-1 text-[13px] leading-snug text-clin-texto-2">
                {e.notes}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * A linha de resumo, a tabela (um exame por linha: o último resultado, o
 * anterior, o que mudou e a tendência), a nota da ordem e o botão que abre a
 * lista de todos os resultados.
 *
 * A tabela tem cinco colunas e não cabe em 390 px: rola dentro da própria
 * caixa, e a página não ganha rolagem lateral. Caixa que rola precisa receber
 * foco, senão quem usa teclado não alcança as colunas da direita (como a de
 * "Medidas registradas" da aba Corpo).
 */
function ComparativoDosExames({
  comparativo,
  exames,
  hoje,
}: {
  comparativo: LinhaDoComparativo[];
  exames: Exame[];
  /** Para a data com ano quando o ano não é o de hoje (dataDoComparativo). */
  hoje: string;
}) {
  const { melhores, piores, umResultado } = resumoDoComparativo(comparativo);
  const data = (iso: string) => dataDoComparativo(iso, hoje);

  return (
    <div className="mt-2">
      <p className="text-[13px] text-clin-texto-2">
        último resultado de cada exame contra o anterior
      </p>

      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-clin-texto-2">
        <span><strong className="font-semibold text-clin-texto">{melhores}</strong> {melhores === 1 ? "melhor ou dentro da faixa" : "melhores ou dentro da faixa"}</span>
        <span><strong className="font-semibold text-clin-texto">{piores}</strong> {piores === 1 ? "pior que antes" : "piores que antes"}</span>
        <span><strong className="font-semibold text-clin-texto">{umResultado}</strong> só com um resultado</span>
      </p>

      <div
        tabIndex={0}
        role="region"
        aria-label="Comparativo dos exames"
        className={`mt-3 overflow-x-auto rounded-md border border-clin-linha ${FOCO}`}
      >
        <table className="w-full min-w-[640px] border-collapse text-[14px] tabular-nums">
          <thead>
            <tr className="border-b border-clin-linha text-left text-[13px] text-clin-texto-2">
              <th scope="col" className="py-2.5 pl-3.5 pr-2 font-medium">Exame</th>
              <th scope="col" className="px-2 py-2.5 font-medium">Último</th>
              <th scope="col" className="px-2 py-2.5 font-medium">Anterior</th>
              <th scope="col" className="px-2 py-2.5 font-medium">O que mudou</th>
              <th scope="col" className="py-2.5 pl-2 pr-3.5 font-medium">Tendência</th>
            </tr>
          </thead>
          <tbody>
            {comparativo.map((l) => {
              // O selo sai da faixa da linha (lib/exames.ts, `situacao`), não
              // do status gravado: assim nunca contradiz a referência ao lado.
              const st = situacaoDoExame(l.situacao);
              const avisos = avisosDaLinha(l, hoje);
              return (
                <tr key={l.chave} className="border-b border-clin-linha text-clin-texto last:border-b-0">
                  <th scope="row" className="min-w-[150px] py-3 pl-3.5 pr-2 text-left align-top font-medium">
                    <span className="block">{l.nome}</span>
                    <span className="block text-[13px] font-normal text-clin-texto-2">
                      {l.faixaTexto ? `ref. ${l.faixaTexto}` : "sem faixa de referência"}
                    </span>
                  </th>
                  <td className="px-2 py-3 align-top">
                    <span className="block whitespace-nowrap font-semibold">{l.ultimo.texto}</span>
                    {st && (
                      <span className={`${CLASSE_SELO} mt-0.5 ${st.caixa}`}>{comMaiuscula(st.rotulo)}</span>
                    )}
                    <time dateTime={l.ultimo.data} className="block text-[13px] text-clin-texto-2">
                      {data(l.ultimo.data)}
                    </time>
                    {/* O que a conta deixou de lado, dito na linha: o
                        resultado sem número que veio depois e o dia com mais
                        de um resultado (vale o último lançado). */}
                    {avisos.map((a) => (
                      <span
                        key={a}
                        className="aviso-do-exame mt-0.5 block min-w-[10rem] text-[13px] leading-snug text-clin-atencao dark:text-clin-atencao"
                      >
                        {a}
                      </span>
                    ))}
                  </td>
                  {/* Sem quebra de linha: "141 ·" numa linha e "18/12" na outra
                      não se lê, e o resultado com a unidade ("235 pmol/L")
                      partido também não. A caixa rola, então a largura sobra.
                      O anterior não traz unidade: "310" ao lado de "235
                      pmol/L" leria como 310 pmol/L. Com a unidade trocada só
                      a data aparece, e a coluna ao lado explica. */}
                  <td className="whitespace-nowrap px-2 py-3 align-top text-clin-texto-2">
                    {!l.anterior
                      ? "—"
                      : l.mudanca === "unidade diferente do anterior"
                        ? data(l.anterior.data)
                        : `${numero(l.anterior.valor)} · ${data(l.anterior.data)}`}
                  </td>
                  <td className="px-2 py-3 align-top">
                    {l.diferenca != null && (
                      <span className="block font-semibold">{comSinal(l.diferenca)}</span>
                    )}
                    {/* Piorou (saiu ou ficou mais longe da faixa): o par
                        perigo/perigo-fundo, com a palavra, não só a cor. */}
                    {l.grupo === 1 ? (
                      <span className={`${CLASSE_SELO} mt-0.5 bg-clin-perigo-fundo text-clin-perigo`}>
                        {l.mudanca}
                      </span>
                    ) : (
                      <span className="block text-[13px] text-clin-texto-2">{l.mudanca}</span>
                    )}
                  </td>
                  <td className="py-3 pl-2 pr-3.5 align-top">
                    {l.serie ? (
                      <MiniGrafico serie={l.serie} faixa={l.faixa} descricao={descricaoDaSerie(l, hoje)} />
                    ) : (
                      <span className="text-[13px] text-clin-texto-2">
                        {l.resultados} {l.resultados === 1 ? "resultado" : "resultados"}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[13px] leading-snug text-clin-texto-2">
        Ordem: primeiro o que piorou, depois o que segue fora da faixa ou sem comparação, depois o que está
        dentro da faixa e, por último, os de um resultado só. A faixa é a do laudo; sem ela, a da tabela do
        app, e o selo do último resultado sai dessa mesma faixa. O minigráfico aparece com 3 resultados ou
        mais na mesma unidade, e a faixa sombreada nele é a de referência.
      </p>

      {/* <details> nativo, como o "Ver histórico": abre com teclado e leitor de
          tela sem JavaScript, e a lista já vem renderizada no servidor. A
          borda é a de campo (3:1), a de um controle. */}
      <details className="group mt-4">
        <summary
          className={`inline-flex min-h-[44px] cursor-pointer list-none items-center gap-2 rounded-md border border-clin-campo bg-clin-chao px-4 text-[14px] font-medium text-clin-texto hover:bg-clin-primaria-fundo ${FOCO} [&::-webkit-details-marker]:hidden`}
        >
          <span className="group-open:hidden">Ver todos os resultados ({exames.length})</span>
          <span className="hidden group-open:inline">Esconder resultados</span>
          <ChevronDown
            aria-hidden="true"
            className="h-4 w-4 transition-transform group-open:rotate-180"
          />
        </summary>
        <div className="mt-3">
          <ListaDeExames exames={exames} />
        </div>
      </details>
    </div>
  );
}
