import { createClient } from "@/lib/supabase/server";
import { addDaysISO, formatDate, todayISO } from "@/lib/date";
import { MEAL_TYPES } from "@/lib/cardapio";
import {
  compararComMeta,
  getPatientSeries,
  mediasDaSemana,
  notaDasMedias,
  notaMedia,
  ultimoDesvioPorCampo,
  type ItemMeta,
  type Media,
  type MetasPrescritas,
} from "@/lib/nutri";
import { Secao } from "@/components/clinico/Secao";
import { Editavel } from "@/components/clinico/Editavel";
import { EditorMetas } from "@/components/clinico/EditorMetas";
import { BarraMeta } from "@/components/clinico/BarraMeta";
import { TabelaRealMeta } from "@/components/clinico/TabelaRealMeta";
import { VerHistorico } from "@/components/clinico/VerHistorico";
import type { Desvio } from "@/components/clinico/tipos";
import MealPlanEditor, {
  type ItemCardapio,
  type PlanoAlimentar,
} from "@/components/MealPlanEditor";
import { ErroSecao } from "./ErroSecao";

const ROTULO_CAMPO: Record<string, string> = {
  daily_calorie_goal: "Calorias",
  protein_goal_g: "Proteína",
  daily_water_goal_ml: "Água",
  weight_goal_kg: "Peso alvo",
};
const UNIDADE_CAMPO: Record<string, string> = {
  daily_calorie_goal: "kcal",
  protein_goal_g: "g",
  daily_water_goal_ml: "ml",
  weight_goal_kg: "kg",
};

const kcal = (n: number) => `${Math.round(n).toLocaleString("pt-BR")} kcal`;
const gramas = (n: number) => `${Math.round(n).toLocaleString("pt-BR")} g`;
const litros = (ml: number) =>
  `${(ml / 1000).toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} L`;

const TITULO_BLOCO = "text-[15px] font-semibold leading-snug text-clin-texto";

export type PerfilAlimentacao = MetasPrescritas & { sex: string | null };

// Metas contra o real da semana e o cardápio, com edição no lugar.
//
// "Meta" é o que o nutricionista PRESCREVEU (última linha de prescriptions),
// não o que está no perfil agora: quando o paciente mexe na própria meta, o
// perfil passa a ter o valor dele, e comparar o real com isso esconderia
// justamente a mudança. A mudança aparece embaixo, um aviso por meta ("ela
// está usando 2.200 kcal"). Sem prescrição nenhuma, vale a meta do perfil,
// que é a que o app do paciente usa.
//
// O editor abre com as metas do perfil, como a aba Prescrição fazia.
export async function Alimentacao({
  uid,
  nutriId,
  perfil,
  prescricao,
}: {
  uid: string;
  nutriId: string;
  perfil: PerfilAlimentacao;
  prescricao: Promise<{ data: MetasPrescritas | null; error: unknown }>;
}) {
  const supabase = await createClient();
  const hoje = todayISO();
  // 14 dias contando hoje, com teto: a aba antiga usava `>= hoje-14` (15
  // dias) e sem teto, então refeição lançada para amanhã entrava no
  // histórico.
  const desde = addDaysISO(hoje, -13);

  const [serie, presc, desviosRes, cardapioRes, refeicoesRes] = await Promise.all([
    getPatientSeries(supabase, uid, 14),
    prescricao,
    // prescription_deviations não está nos tipos gerados (lib/types.ts).
    (supabase as any)
      .from("prescription_deviations")
      .select("id, kind, field, prescribed, current_value, created_at")
      .eq("patient_id", uid)
      .is("acknowledged_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("meal_plans")
      .select("id, name, notes, created_at")
      .eq("patient_id", uid)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("meals")
      .select("date, meal_type, description, calories, protein_g, carbs_g, fat_g")
      .eq("user_id", uid)
      .gte("date", desde)
      .lte("date", hoje)
      .order("date", { ascending: false })
      .limit(60),
  ]);

  const plano = (cardapioRes.data ?? null) as PlanoAlimentar | null;
  const itensRes = plano
    ? await supabase
        .from("meal_plan_items")
        .select(
          "id, meal_plan_id, meal_type, position, description, calories, protein_g, carbs_g, fat_g"
        )
        .eq("meal_plan_id", plano.id)
        .order("position", { ascending: true })
    : { data: [], error: null };

  if (
    presc.error ||
    desviosRes.error ||
    cardapioRes.error ||
    refeicoesRes.error ||
    itensRes.error
  ) {
    return (
      <Secao id="alimentacao" titulo="Alimentação">
        <ErroSecao secao="a alimentação" />
      </Secao>
    );
  }

  const meta: MetasPrescritas = presc.data ?? perfil;
  const medias = mediasDaSemana(serie, hoje);
  const itens = (itensRes.data ?? []) as ItemCardapio[];
  const desvios = ultimoDesvioPorCampo((desviosRes.data ?? []) as Desvio[]);
  const refeicoes = (refeicoesRes.data ?? []) as any[];
  const temMetas = [
    meta.daily_calorie_goal,
    meta.protein_goal_g,
    meta.daily_water_goal_ml,
    meta.weight_goal_kg,
  ].some((v) => v != null);
  const pronome =
    perfil.sex === "F" ? "ela" : perfil.sex === "M" ? "ele" : "o paciente";

  const linhas = (
    [
      ["Calorias", "calorias", medias.calorias, meta.daily_calorie_goal, kcal],
      ["Proteína", "proteina", medias.proteina, meta.protein_goal_g, gramas],
      ["Água", "agua", medias.agua, meta.daily_water_goal_ml, litros],
    ] as [string, ItemMeta, Media, number | null, (n: number) => string][]
  ).map(([item, chave, media, valorMeta, fmt]) => {
    const m = valorMeta == null ? null : Number(valorMeta);
    return {
      item,
      media,
      real: media.valor == null ? "—" : fmt(media.valor),
      meta: m == null ? null : fmt(m),
      proporcao: media.valor != null && m ? media.valor / m : null,
      comparacao: compararComMeta(chave, media.valor, m),
    };
  });

  // Total do dia somando só a 1ª opção de cada refeição, como o editor:
  // somar as alternativas daria um dia que ninguém vai comer.
  const refeicoesDoCardapio = MEAL_TYPES.map((tipo) =>
    itens
      .filter((i) => i.meal_type === tipo)
      .sort((a, b) => a.position - b.position)
  ).filter((opcoes) => opcoes.length > 0);
  const totalKcal = refeicoesDoCardapio.reduce(
    (s, [primeira]) => s + (Number(primeira.calories) || 0),
    0
  );
  const totalProt = refeicoesDoCardapio.reduce(
    (s, [primeira]) => s + (Number(primeira.protein_g) || 0),
    0
  );

  return (
    <Secao id="alimentacao" titulo="Alimentação">
      <Editavel
        secao="metas"
        titulo={<h3 className={TITULO_BLOCO}>Metas</h3>}
        rotuloBotao={temMetas ? "Editar metas" : "Definir metas"}
        editor={
          <EditorMetas
            pacienteId={uid}
            metas={{
              daily_calorie_goal: perfil.daily_calorie_goal,
              protein_goal_g: perfil.protein_goal_g,
              daily_water_goal_ml: perfil.daily_water_goal_ml,
              weight_goal_kg: perfil.weight_goal_kg,
            }}
          />
        }
      >
        {/* Celular: uma barra por item. Computador: a tabela. As duas
            existem no HTML e o CSS mostra uma; a escondida (display: none)
            não é lida pelo leitor de tela. */}
        <div className="space-y-4 lg:hidden">
          {linhas.map((l) => (
            <BarraMeta
              key={l.item}
              rotulo={l.item}
              realTexto={l.real}
              metaTexto={l.meta}
              proporcao={l.proporcao}
              comparacao={l.comparacao}
              nota={notaMedia(l.media.dias)}
            />
          ))}
        </div>
        <div className="hidden lg:block">
          <TabelaRealMeta
            linhas={linhas.map((l) => ({
              item: l.item,
              real: l.real,
              meta: l.meta ?? "—",
              comparacao: l.comparacao,
            }))}
          />
          <p className="mt-2 text-[13px] leading-snug text-clin-texto-2">
            {notaDasMedias(medias)}
          </p>
        </div>

        {desvios.length > 0 && (
          // `texto` e `atencao` sobre `atencao-fundo`: pares testados.
          <ul className="mt-4 space-y-1 rounded-md bg-clin-atencao-fundo px-3 py-2.5">
            {desvios.map((d) => (
              <li key={d.id} className="text-[14px] leading-snug text-clin-texto">
                <span className="font-semibold text-clin-atencao">
                  {ROTULO_CAMPO[d.field] ?? d.field}:
                </span>{" "}
                {d.current_value == null || d.current_value === ""
                  ? `${pronome} está sem meta`
                  : `${pronome} está usando ${valorDoDesvio(d)}`}
              </li>
            ))}
          </ul>
        )}
      </Editavel>

      <div className="mt-8">
        <Editavel
          secao="cardapio"
          titulo={<h3 className={TITULO_BLOCO}>Cardápio</h3>}
          rotuloBotao={plano ? "Editar cardápio" : "Montar cardápio"}
          editor={
            <MealPlanEditor
              patientId={uid}
              nutriId={nutriId}
              plano={plano}
              itens={itens}
              metaCalorias={meta.daily_calorie_goal}
              metaProteina={meta.protein_goal_g}
            />
          }
        >
          {!plano ? (
            <p className="text-[14px] text-clin-texto-2">
              Nenhum cardápio prescrito.
            </p>
          ) : (
            <div>
              <p className="text-[15px] font-medium text-clin-texto">{plano.name}</p>
              {plano.notes && (
                <p className="mt-1 text-[14px] leading-snug text-clin-texto-2">
                  {plano.notes}
                </p>
              )}
              {refeicoesDoCardapio.length === 0 ? (
                <p className="mt-3 text-[14px] text-clin-texto-2">
                  Nenhuma refeição no cardápio ainda.
                </p>
              ) : (
                <>
                  <dl className="mt-3 divide-y divide-clin-linha">
                    {refeicoesDoCardapio.map(([primeira, ...outras]) => (
                      <div key={primeira.meal_type} className="py-2.5">
                        <dt className="text-[13px] text-clin-texto-2">
                          {primeira.meal_type}
                        </dt>
                        <dd className="mt-0.5 text-[14px] leading-snug text-clin-texto">
                          {primeira.description}
                          {primeira.calories ? (
                            <span className="tabular-nums text-clin-texto-2">
                              {" "}
                              · {kcal(Number(primeira.calories))}
                            </span>
                          ) : null}
                          {outras.length > 0 && (
                            <span className="text-clin-texto-2">
                              {" "}
                              · mais {outras.length}{" "}
                              {outras.length === 1 ? "opção" : "opções"}
                            </span>
                          )}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-2 text-[13px] leading-snug tabular-nums text-clin-texto-2">
                    No dia, com a 1ª opção de cada refeição: {kcal(totalKcal)} ·{" "}
                    {gramas(totalProt)} de proteína
                  </p>
                </>
              )}
            </div>
          )}
        </Editavel>
      </div>

      <VerHistorico>
        <h3 className={TITULO_BLOCO}>Refeições dos últimos 14 dias</h3>
        {refeicoes.length === 0 ? (
          <p className="mt-2 text-[14px] text-clin-texto-2">
            Nenhuma refeição registrada nos últimos 14 dias.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-clin-linha">
            {refeicoes.map((m, i) => (
              <li key={i} className="flex items-start justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-[14px] leading-snug text-clin-texto">
                    {m.description || m.meal_type || "Refeição"}
                  </p>
                  <p className="text-[13px] tabular-nums text-clin-texto-2">
                    {formatDate(m.date)}
                    {m.meal_type ? ` · ${m.meal_type}` : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right text-[13px] tabular-nums">
                  <p className="font-semibold text-clin-texto">
                    {m.calories ? kcal(Number(m.calories)) : "—"}
                  </p>
                  <p className="text-clin-texto-2">
                    {[
                      m.protein_g ? `P ${Math.round(Number(m.protein_g))}` : null,
                      m.carbs_g ? `C ${Math.round(Number(m.carbs_g))}` : null,
                      m.fat_g ? `G ${Math.round(Number(m.fat_g))}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </VerHistorico>
    </Secao>
  );
}

/** "2.200 kcal" a partir do texto que o gatilho gravou ("2200"). */
function valorDoDesvio(d: Desvio): string {
  const n = Number(d.current_value);
  const unidade = UNIDADE_CAMPO[d.field];
  if (!Number.isFinite(n)) return String(d.current_value);
  return `${n.toLocaleString("pt-BR")}${unidade ? ` ${unidade}` : ""}`;
}
