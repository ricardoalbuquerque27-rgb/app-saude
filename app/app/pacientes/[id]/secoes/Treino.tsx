import { createClient } from "@/lib/supabase/server";
import { addDaysISO, dataNoBrasil, formatDate, todayISO } from "@/lib/date";
import {
  computeAdherence,
  estadosDaSemana,
  type Completion,
} from "@/lib/planCheckIn";
import {
  separarDesvios,
  textoDoDesvioDoPlano,
  type Desvio,
} from "@/lib/nutri";
import { Secao } from "@/components/clinico/Secao";
import { Editavel } from "@/components/clinico/Editavel";
import { EditorTreino } from "@/components/clinico/EditorTreino";
import { SemanaTreino } from "@/components/clinico/SemanaTreino";
import { VerHistorico } from "@/components/clinico/VerHistorico";
import type {
  ExercicioRotina,
  PlanoItem,
  Rotina,
} from "@/components/clinico/tipos";
import { ErroSecao } from "./ErroSecao";

const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const TITULO_BLOCO = "text-[15px] font-semibold leading-snug text-clin-texto";

// Mesma regra de descanso da adesão no resumo (lib/nutri.ts): sessão de
// descanso no plano não é treino previsto e não pode virar falta.
const ehDescanso = (sport: string | null) =>
  String(sport ?? "").toLowerCase().includes("descanso");

// A semana com os check-ins, a adesão de 4 semanas, o plano e as rotinas. O
// editor grava nas mesmas tabelas de antes (routines, routine_exercises,
// workout_plan). Os treinos registrados nos últimos 30 dias ficam no
// histórico.
//
// Os avisos de mudança no plano de treino (o gatilho de workout_plan grava em
// prescription_deviations, com `field` fora dos CAMPOS_META) aparecem aqui,
// por extenso. Antes só existiam como número na fila ("2 mudanças"), e
// qualquer set_patient_goals dava baixa neles sem o nutricionista ter visto
// o que mudou. `desvios` é a mesma consulta da fila e da Alimentação.
export async function Treino({
  uid,
  nutriId,
  sexo,
  desvios: desviosAbertos,
}: {
  uid: string;
  nutriId: string;
  sexo: string | null;
  desvios: Promise<{ data: Desvio[]; error: unknown }>;
}) {
  const supabase = await createClient();
  const hoje = todayISO();
  // 28 dias contando hoje para a adesão, e 30 para o histórico. A aba antiga
  // buscava o histórico com `>= hoje-30` (31 dias) e sem teto.
  const desde28 = addDaysISO(hoje, -27);
  const desde30 = addDaysISO(hoje, -29);

  const [planoRes, rotinasRes, exsRes, checksRes, treinosRes, desviosRes] = await Promise.all([
    supabase
      .from("workout_plan")
      .select("id, day_of_week, sport, title, routine_id, prescribed_by")
      .eq("user_id", uid)
      .order("day_of_week", { ascending: true })
      .order("position", { ascending: true }),
    supabase
      .from("routines")
      .select("id, name, notes, prescribed_by")
      .eq("user_id", uid)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("routine_exercises")
      .select(
        "id, routine_id, name, target_sets, target_reps, target_weight_kg, rest_seconds, position"
      )
      .eq("user_id", uid)
      .order("position", { ascending: true }),
    supabase
      .from("plan_completions")
      .select("id, plan_id, date, status, workout_id")
      .eq("user_id", uid)
      .gte("date", desde28),
    supabase
      .from("workouts")
      .select("id, date, name, category, duration_min")
      .eq("user_id", uid)
      .gte("date", desde30)
      .lte("date", hoje)
      .order("date", { ascending: false })
      .limit(30),
    desviosAbertos,
  ]);

  const treinos = (treinosRes.data ?? []) as any[];
  // Exercícios dos treinos do histórico, numa consulta só.
  const exsTreinosRes = treinos.length
    ? await supabase
        .from("exercises")
        .select("workout_id, name, sets, reps, weight_kg")
        .in(
          "workout_id",
          treinos.map((w) => w.id)
        )
        .order("position", { ascending: true })
    : { data: [], error: null };

  if (
    planoRes.error ||
    rotinasRes.error ||
    exsRes.error ||
    checksRes.error ||
    treinosRes.error ||
    exsTreinosRes.error ||
    desviosRes.error
  ) {
    return (
      <Secao id="treino" titulo="Treino">
        <ErroSecao secao="o treino" />
      </Secao>
    );
  }

  const plano = (planoRes.data ?? []) as PlanoItem[];
  const rotinas = (rotinasRes.data ?? []) as Rotina[];
  const exercicios = (exsRes.data ?? []) as ExercicioRotina[];
  const checks = (checksRes.data ?? []) as Completion[];

  const exPorTreino: Record<string, any[]> = {};
  for (const e of (exsTreinosRes.data ?? []) as any[]) {
    (exPorTreino[e.workout_id] ||= []).push(e);
  }

  const dias28: string[] = [];
  for (let i = 27; i >= 0; i--) dias28.push(addDaysISO(hoje, -i));
  const adesao = computeAdherence(
    plano.filter((p) => !ehDescanso(p.sport)),
    checks,
    dias28,
    hoje
  );
  const semana = estadosDaSemana(plano, checks, hoje);
  const mudancas = separarDesvios(desviosRes.data).plano;

  return (
    <Secao id="treino" titulo="Treino">
      <Editavel
        secao="treino"
        titulo={<h3 className={TITULO_BLOCO}>Semana</h3>}
        rotuloBotao={plano.length ? "Editar plano" : "Prescrever plano"}
        editor={
          <EditorTreino
            pacienteId={uid}
            nutriId={nutriId}
            rotinas={rotinas}
            exercicios={exercicios}
            plano={plano}
          />
        }
      >
        {plano.length === 0 ? (
          <p className="text-[14px] text-clin-texto-2">
            Nenhum plano de treino prescrito.
          </p>
        ) : (
          <>
            <SemanaTreino dias={semana} />
            <p className="mt-3 text-[14px] leading-snug tabular-nums text-clin-texto">
              <span className="text-clin-texto-2">Adesão em 4 semanas: </span>
              {adesao.percentual == null ? (
                "—"
              ) : (
                <>
                  <span className="font-semibold">{adesao.percentual}%</span>
                  <span className="text-clin-texto-2">
                    {" "}
                    · {adesao.confirmadas} de {adesao.previstas} confirmados
                    {adesao.faltas
                      ? ` · ${adesao.faltas} ${adesao.faltas === 1 ? "falta" : "faltas"}`
                      : ""}
                    {adesao.semResposta
                      ? ` · ${adesao.semResposta} sem resposta`
                      : ""}
                  </span>
                </>
              )}
            </p>

            <h3 className={`mt-6 ${TITULO_BLOCO}`}>Plano da semana</h3>
            <dl className="mt-2 divide-y divide-clin-linha">
              {DIAS.map((rotulo, dow) => {
                const sessoes = plano.filter((p) => p.day_of_week === dow);
                if (sessoes.length === 0) return null;
                return (
                  <div key={rotulo} className="flex gap-3 py-2">
                    <dt className="w-10 shrink-0 text-[13px] leading-6 text-clin-texto-2">
                      {rotulo}
                    </dt>
                    <dd className="min-w-0 text-[14px] leading-6 text-clin-texto">
                      {sessoes
                        .map((p) =>
                          p.title && p.title !== p.sport
                            ? `${p.title} (${p.sport})`
                            : p.title || p.sport
                        )
                        .join(" · ")}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </>
        )}

        {mudancas.length > 0 && (
          // Fora do `plano.length`: o paciente pode ter tirado a única sessão,
          // e o aviso é justamente o que explica o plano vazio. `texto`,
          // `atencao` e `atencao-texto-2` sobre `atencao-fundo`: pares
          // testados (lib/temaClinico.ts).
          <ul className="mt-4 space-y-1 rounded-md bg-clin-atencao-fundo px-3 py-2.5">
            {mudancas.map((d) => (
              <li key={d.id} className="text-[14px] leading-snug text-clin-texto">
                <span className="font-semibold text-clin-atencao">
                  Plano de treino:
                </span>{" "}
                {textoDoDesvioDoPlano(d, sexo)}
                <span className="tabular-nums text-clin-atencao-texto-2">
                  {" "}
                  · {formatDate(dataNoBrasil(d.created_at))}
                </span>
              </li>
            ))}
          </ul>
        )}

        {rotinas.length > 0 && (
          <>
            <h3 className={`mt-6 ${TITULO_BLOCO}`}>Rotinas</h3>
            <ul className="mt-2 divide-y divide-clin-linha">
              {rotinas.map((r) => {
                const n = exercicios.filter((e) => e.routine_id === r.id).length;
                return (
                  <li key={r.id} className="py-2">
                    <p className="text-[14px] font-medium leading-snug text-clin-texto">
                      {r.name}
                      <span className="font-normal tabular-nums text-clin-texto-2">
                        {" "}
                        · {n} {n === 1 ? "exercício" : "exercícios"}
                      </span>
                    </p>
                    {r.notes && (
                      <p className="text-[13px] leading-snug text-clin-texto-2">
                        {r.notes}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Editavel>

      <VerHistorico>
        <h3 className={TITULO_BLOCO}>Treinos dos últimos 30 dias</h3>
        {treinos.length === 0 ? (
          <p className="mt-2 text-[14px] text-clin-texto-2">
            Nenhum treino registrado nos últimos 30 dias.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-clin-linha">
            {treinos.map((w) => (
              <li key={w.id} className="py-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-[14px] font-medium text-clin-texto">
                    {w.name || "Treino"}
                  </p>
                  <p className="shrink-0 text-[13px] tabular-nums text-clin-texto-2">
                    {formatDate(w.date)}
                  </p>
                </div>
                {(w.category || w.duration_min) && (
                  <p className="text-[13px] text-clin-texto-2">
                    {[w.category, w.duration_min ? `${w.duration_min} min` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
                {(exPorTreino[w.id] ?? []).length > 0 && (
                  <ul className="mt-1.5 space-y-0.5">
                    {exPorTreino[w.id].map((e, i) => (
                      <li
                        key={i}
                        className="flex justify-between gap-2 text-[13px] text-clin-texto-2"
                      >
                        <span className="truncate">{e.name}</span>
                        <span className="shrink-0 tabular-nums">
                          {[
                            e.sets && e.reps ? `${e.sets}×${e.reps}` : null,
                            e.weight_kg ? `${e.weight_kg} kg` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </VerHistorico>
    </Secao>
  );
}
