import { createClient } from "@/lib/supabase/server";
import { formatDate, todayISO } from "@/lib/date";
import { Secao } from "@/components/clinico/Secao";
import { ErroSecao } from "./ErroSecao";

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

// Tratamento, próxima dose, exames e efeitos colaterais. Só leitura: são
// registros do paciente, e o nutricionista não os altera.
export async function Clinico({ uid }: { uid: string }) {
  const supabase = await createClient();
  const hoje = todayISO();

  const [examesRes, tratamentoRes, dosesRes, efeitosRes] = await Promise.all([
    supabase
      .from("exams")
      .select("date, title, result_value, unit, reference_range, status, notes")
      .eq("user_id", uid)
      .order("date", { ascending: false })
      .limit(40),
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

  if (examesRes.error || tratamentoRes.error || dosesRes.error || efeitosRes.error) {
    return (
      <Secao id="clinico" titulo="Clínico">
        <ErroSecao secao="os dados clínicos" />
      </Secao>
    );
  }

  const exames = (examesRes.data ?? []) as any[];
  const tratamento = tratamentoRes.data as any;
  const doses = (dosesRes.data ?? []) as any[];
  const efeitos = (efeitosRes.data ?? []) as any[];
  const doseAtrasada =
    !!tratamento?.next_dose_date && tratamento.next_dose_date < hoje;

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
      {exames.length === 0 ? (
        <p className="mt-2 text-[14px] text-clin-texto-2">Nenhum exame registrado.</p>
      ) : (
        <ul className="mt-2 divide-y divide-clin-linha">
          {exames.map((e, i) => {
            const st = STATUS_EXAME[e.status];
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
