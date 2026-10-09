import { createClient } from "@/lib/supabase/server";
import { formatDate, todayISO } from "@/lib/date";
import {
  textoVariacaoPeso,
  type MetasPrescritas,
  type PatientSummary,
} from "@/lib/nutri";
import { Secao } from "@/components/clinico/Secao";
import { VerHistorico } from "@/components/clinico/VerHistorico";
import { ErroSecao } from "./ErroSecao";
import { FOCO, LINK } from "./estilos";

const TITULO_BLOCO = "text-[15px] font-semibold leading-snug text-clin-texto";

/** "68,4" — medida com no máximo uma casa, vírgula decimal. */
function medida(v: unknown): string {
  if (v == null || v === "") return "—";
  const n = Number(v);
  return Number.isFinite(n)
    ? n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })
    : "—";
}

// Peso atual, variação, meta de peso e as medidas. Só leitura: o peso alvo é
// gravado junto com as outras três metas por set_patient_goals, e mandar um
// campo vazio apaga a meta (spec, Seção 2). Por isso ele se edita nas metas,
// em Alimentação, e aqui há só o link.
//
// A variação é a mesma dos três números do topo (resumirPacientes), para a
// página não mostrar dois "peso em 30 dias" diferentes. A meta segue a mesma
// regra da Alimentação: a prescrita, ou a do perfil se nunca houve prescrição.
export async function Corpo({
  uid,
  perfil,
  resumo,
  prescricao,
}: {
  uid: string;
  perfil: MetasPrescritas;
  resumo: Promise<{ resumos: PatientSummary[]; falhou: boolean }>;
  prescricao: Promise<{ data: MetasPrescritas | null; error: unknown }>;
}) {
  const supabase = await createClient();
  const hoje = todayISO();

  const [medidasRes, r, presc] = await Promise.all([
    // Com teto em hoje: medida lançada com data futura não é o "peso atual".
    supabase
      .from("body_measurements")
      .select("date, weight_kg, body_fat_pct, waist_cm, hip_cm, chest_cm, arm_cm")
      .eq("user_id", uid)
      .lte("date", hoje)
      .order("date", { ascending: false })
      .limit(60),
    resumo,
    prescricao,
  ]);

  // O resumo entra na conta porque a variação vem dele: com uma consulta dele
  // falhando, "—" diria "sem variação" em vez de "não carregou".
  if (medidasRes.error || presc.error || r.falhou) {
    return (
      <Secao id="corpo" titulo="Corpo">
        <ErroSecao secao="as medidas" />
      </Secao>
    );
  }

  const [s] = r.resumos;
  const linhas = (medidasRes.data ?? []) as any[];
  const ultimaComPeso = linhas.find((r) => r.weight_kg != null);
  const peso = ultimaComPeso ? Number(ultimaComPeso.weight_kg) : null;
  const alvoBruto = (presc.data ?? perfil).weight_goal_kg;
  const alvo = alvoBruto == null ? null : Number(alvoBruto);
  const distancia =
    peso != null && alvo != null ? Math.abs(peso - alvo) : null;

  return (
    <Secao id="corpo" titulo="Corpo">
      <dl className="grid gap-4 sm:grid-cols-3">
        <div>
          <dt className="text-[13px] text-clin-texto-2">Peso atual</dt>
          <dd className="mt-0.5 text-[15px] font-semibold tabular-nums text-clin-texto">
            {peso != null ? `${medida(peso)} kg` : "—"}
          </dd>
          {ultimaComPeso && (
            <dd className="text-[13px] tabular-nums text-clin-texto-2">
              em {formatDate(ultimaComPeso.date)}
            </dd>
          )}
        </div>
        <div>
          <dt className="text-[13px] text-clin-texto-2">Variação em 30 dias</dt>
          <dd className="mt-0.5 text-[15px] font-semibold tabular-nums text-clin-texto">
            {textoVariacaoPeso(s.weightDelta30)}
          </dd>
        </div>
        <div>
          <dt className="text-[13px] text-clin-texto-2">Meta de peso</dt>
          <dd className="mt-0.5 text-[15px] font-semibold tabular-nums text-clin-texto">
            {alvo != null ? `${medida(alvo)} kg` : "—"}
          </dd>
          {distancia != null && (
            <dd className="text-[13px] tabular-nums text-clin-texto-2">
              {distancia < 0.05 ? "na meta" : `faltam ${medida(distancia)} kg`}
            </dd>
          )}
          <dd>
            <a href="#alimentacao" className={`inline-flex ${LINK}`}>
              editar nas metas
            </a>
          </dd>
        </div>
      </dl>

      <VerHistorico>
        <h3 className={TITULO_BLOCO}>Medidas registradas</h3>
        {linhas.length === 0 ? (
          <p className="mt-2 text-[14px] text-clin-texto-2">
            Nenhuma medida registrada.
          </p>
        ) : (
          // A tabela tem sete colunas e não cabe em 390 px: rola dentro da
          // própria caixa, e a página não ganha rolagem lateral. Caixa que
          // rola precisa receber foco, senão quem usa teclado não alcança as
          // colunas da direita.
          <div
            tabIndex={0}
            role="region"
            aria-label="Medidas registradas"
            className={`mt-2 overflow-x-auto rounded-md ${FOCO}`}
          >
            <table className="w-full min-w-[480px] border-collapse text-[14px] tabular-nums">
              <thead>
                <tr className="border-b border-clin-linha text-left text-[13px] text-clin-texto-2">
                  <th scope="col" className="py-2 pr-3 font-medium">Data</th>
                  <th scope="col" className="px-2 py-2 font-medium">Peso</th>
                  <th scope="col" className="px-2 py-2 font-medium">%GC</th>
                  <th scope="col" className="px-2 py-2 font-medium">Cintura</th>
                  <th scope="col" className="px-2 py-2 font-medium">Quadril</th>
                  <th scope="col" className="px-2 py-2 font-medium">Peito</th>
                  <th scope="col" className="py-2 pl-2 font-medium">Braço</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((r, i) => (
                  <tr
                    key={i}
                    className="border-b border-clin-linha text-clin-texto last:border-b-0"
                  >
                    <th
                      scope="row"
                      className="whitespace-nowrap py-2 pr-3 text-left text-[13px] font-normal text-clin-texto-2"
                    >
                      {formatDate(r.date)}
                    </th>
                    <td className="px-2 py-2">{medida(r.weight_kg)}</td>
                    <td className="px-2 py-2">{medida(r.body_fat_pct)}</td>
                    <td className="px-2 py-2">{medida(r.waist_cm)}</td>
                    <td className="px-2 py-2">{medida(r.hip_cm)}</td>
                    <td className="px-2 py-2">{medida(r.chest_cm)}</td>
                    <td className="py-2 pl-2">{medida(r.arm_cm)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </VerHistorico>
    </Secao>
  );
}
