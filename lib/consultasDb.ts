import { addDaysISO, todayISO } from "@/lib/date";
import {
  COLUNAS_CONSULTA,
  diaDaConsulta,
  ehPendencia,
  instanteEmSaoPaulo,
  ultimaRealizada,
  type Consulta,
} from "@/lib/consultas";
import { MAX_DIAS_DESDE, resumoDesdeUltima, type ResumoDesde } from "@/lib/desdeConsulta";

// Leituras das consultas. A RLS decide o que cada um vê (o nutri, as dele com
// paciente ainda vinculado; o paciente, as dele), mas toda consulta filtra
// também pelo id: o Supabase falso das ferramentas não tem RLS, e um filtro a
// menos aqui só apareceria lá.
//
// Cada função devolve `falhou` junto: lista vazia por erro de leitura não é
// "sem consulta" (CLAUDE.md, "Leitura que falha não é 'não tem'").

type Res<T> = { data: T; falhou: boolean };

/** Do começo do dia `desde` ao fim do dia `ate`, em São Paulo. */
function bordas(desde: string, ate: string) {
  return {
    de: instanteEmSaoPaulo(desde, "00:00"),
    ate: instanteEmSaoPaulo(addDaysISO(ate, 1), "00:00"),
  };
}

/** As consultas do nutri que começam entre dois dias (inclusive), de qualquer situação. */
export async function getConsultasDoPeriodo(
  supabase: any,
  nutriId: string,
  desde: string,
  ate: string
): Promise<Res<Consulta[]>> {
  const b = bordas(desde, ate);
  const { data, error } = await supabase
    .from("appointments")
    .select(COLUNAS_CONSULTA)
    .eq("nutritionist_id", nutriId)
    .gte("starts_at", b.de)
    .lt("starts_at", b.ate)
    .order("starts_at", { ascending: true });
  return { data: (data ?? []) as Consulta[], falhou: !!error };
}

/**
 * As pendências do nutri, em qualquer data: pedidos, pedidos de remarcação e
 * agendadas cujo fim já passou. O `or` só encolhe o que vem do banco; quem
 * decide é `ehPendencia`, a mesma regra da tela.
 */
export async function getPendencias(
  supabase: any,
  nutriId: string,
  agora = new Date().toISOString()
): Promise<Res<Consulta[]>> {
  const { data, error } = await supabase
    .from("appointments")
    .select(COLUNAS_CONSULTA)
    .eq("nutritionist_id", nutriId)
    .in("status", ["pedido", "agendada"])
    .or(`status.eq.pedido,reschedule_requested_at.not.is.null,starts_at.lt."${agora}"`)
    .order("starts_at", { ascending: true });
  const lista = ((data ?? []) as Consulta[]).filter((c) => ehPendencia(c, agora));
  return { data: lista, falhou: !!error };
}

/** Todas as consultas de um paciente, da mais nova para a mais antiga. */
export async function getConsultasDoPaciente(
  supabase: any,
  pacienteId: string
): Promise<Res<Consulta[]>> {
  const { data, error } = await supabase
    .from("appointments")
    .select(COLUNAS_CONSULTA)
    .eq("patient_id", pacienteId)
    .order("starts_at", { ascending: false })
    .limit(200);
  return { data: (data ?? []) as Consulta[], falhou: !!error };
}

/** Nome de cada paciente: o do perfil, ou o rótulo do convite. */
export async function getNomesDosPacientes(
  supabase: any,
  ids: string[]
): Promise<Res<Record<string, string>>> {
  if (ids.length === 0) return { data: {}, falhou: false };
  const [perfis, vinculos] = await Promise.all([
    supabase.from("profiles").select("id, full_name").in("id", ids),
    supabase.from("patient_links").select("patient_id, patient_label").in("patient_id", ids),
  ]);
  const nomes: Record<string, string> = {};
  for (const v of (vinculos.data ?? []) as any[]) if (v.patient_label) nomes[v.patient_id] = v.patient_label;
  for (const p of (perfis.data ?? []) as any[]) if (p.full_name) nomes[p.id] = p.full_name;
  return { data: nomes, falhou: !!(perfis.error || vinculos.error) };
}

/** Os pacientes ativos do nutri, para escolher no "Marcar consulta". */
export async function getPacientesAtivos(
  supabase: any,
  nutriId: string
): Promise<Res<{ id: string; nome: string }[]>> {
  const { data, error } = await supabase
    .from("patient_links")
    .select("patient_id, patient_label")
    .eq("nutritionist_id", nutriId)
    .eq("status", "active");
  const ids = ((data ?? []) as any[]).map((l) => l.patient_id).filter(Boolean) as string[];
  const nomes = await getNomesDosPacientes(supabase, ids);
  const lista = ids
    .map((id) => ({ id, nome: nomes.data[id] ?? "Paciente" }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return { data: lista, falhou: !!error || nomes.falhou };
}

/**
 * "Desde a última consulta" de vários pacientes de uma vez. `consultas` são
 * as consultas de cada um (para achar a última realizada); quem não tem
 * nenhuma realizada fica de fora (null).
 *
 * Sete consultas no total, qualquer que seja o número de pacientes.
 */
export async function getDesdeUltimaConsulta(
  supabase: any,
  consultasPorPaciente: Record<string, Consulta[]>,
  agora = new Date().toISOString(),
  hoje = todayISO()
): Promise<Res<Record<string, ResumoDesde | null>>> {
  const desde: Record<string, string> = {};
  for (const [id, lista] of Object.entries(consultasPorPaciente)) {
    const u = ultimaRealizada(lista, agora);
    if (u) desde[id] = diaDaConsulta(u);
  }
  const ids = Object.keys(desde);
  const out: Record<string, ResumoDesde | null> = {};
  for (const id of Object.keys(consultasPorPaciente)) out[id] = null;
  if (ids.length === 0) return { data: out, falhou: false };

  // A janela mais longa entre os pacientes, até 90 dias; o peso da base pode
  // ser mais antigo, então as medidas vêm de um ano antes.
  const maisAntigo = ids.map((id) => desde[id]).sort()[0];
  const inicio = [addDaysISO(hoje, -(MAX_DIAS_DESDE - 1)), addDaysISO(maisAntigo, 1)].sort().pop()!;
  const inicioPeso = addDaysISO(inicio, -365);

  const datas = (tabela: string) =>
    supabase.from(tabela).select("user_id, date").in("user_id", ids).gte("date", inicio).lte("date", hoje);
  const [refeicoes, treinos, diarios, medidas, plano, checks, desvios] = await Promise.all([
    datas("meals"),
    datas("workouts"),
    datas("daily_logs"),
    supabase
      .from("body_measurements")
      .select("user_id, date, weight_kg")
      .in("user_id", ids)
      .not("weight_kg", "is", null)
      .gte("date", inicioPeso)
      .lte("date", hoje),
    supabase.from("workout_plan").select("id, user_id, day_of_week, sport").in("user_id", ids),
    supabase
      .from("plan_completions")
      .select("id, user_id, plan_id, date, status, workout_id")
      .in("user_id", ids)
      .gte("date", inicio)
      .lte("date", hoje),
    supabase
      .from("prescription_deviations")
      .select("patient_id, created_at")
      .in("patient_id", ids)
      .gte("created_at", instanteEmSaoPaulo(inicio, "00:00")),
  ]);
  const falhou = [refeicoes, treinos, diarios, medidas, plano, checks, desvios].some((r) => r.error);
  const de = (r: any, campo = "user_id") => (id: string) =>
    ((r.data ?? []) as any[]).filter((x) => x[campo] === id);

  for (const id of ids) {
    out[id] = resumoDesdeUltima({
      desde: desde[id],
      hoje,
      diasComRegistro: [
        ...de(refeicoes)(id),
        ...de(treinos)(id),
        ...de(diarios)(id),
        ...de(medidas)(id),
      ].map((x) => x.date),
      pesos: de(medidas)(id),
      plano: de(plano)(id),
      checks: de(checks)(id),
      desvios: de(desvios, "patient_id")(id),
    });
  }
  return { data: out, falhou };
}

/** "Desde a última consulta" de um paciente (Resumo da página do paciente). */
export async function getDesdeDoPaciente(
  supabase: any,
  pacienteId: string
): Promise<Res<ResumoDesde | null>> {
  const agora = new Date().toISOString();
  const c = await getConsultasDoPaciente(supabase, pacienteId);
  if (c.falhou) return { data: null, falhou: true };
  const r = await getDesdeUltimaConsulta(supabase, { [pacienteId]: c.data }, agora);
  return { data: r.data[pacienteId] ?? null, falhou: r.falhou };
}
