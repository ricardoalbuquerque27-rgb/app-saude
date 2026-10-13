import type { Res } from "@/lib/consultasDb";
import {
  COLUNAS_ADENDO,
  COLUNAS_REGISTRO,
  type Adendo,
  type CampoMedida,
  type Registro,
} from "@/lib/registro";

// Leituras do registro da consulta. A RLS deixa o nutri ler só o que ele
// mesmo escreveu (consultation_records e consultation_addenda não têm política
// para o paciente), mas toda consulta filtra também pelo id: o Supabase falso
// das ferramentas não tem RLS, e um filtro a menos aqui só apareceria lá.
//
// Cada função devolve `falhou` junto: registro que não carregou por erro de
// leitura não é "sem registro" (CLAUDE.md, "Leitura que falha não é 'não
// tem'"). Foi assim que o paciente aparecia como "Nunca registrou nada".

/** O registro de uma consulta, ou nulo se ainda não existe. */
export async function getRegistroDaConsulta(
  supabase: any,
  consultaId: string,
): Promise<Res<Registro | null>> {
  const { data, error } = await supabase
    .from("consultation_records")
    .select(COLUNAS_REGISTRO)
    .eq("appointment_id", consultaId)
    .maybeSingle();
  return { data: (data ?? null) as Registro | null, falhou: !!error };
}

/** Todos os registros de um paciente (rascunhos e concluídos), do alterado há menos tempo para o mais antigo. */
export async function getRegistrosDoPaciente(
  supabase: any,
  pacienteId: string,
): Promise<Res<Registro[]>> {
  const { data, error } = await supabase
    .from("consultation_records")
    .select(COLUNAS_REGISTRO)
    .eq("patient_id", pacienteId)
    .order("updated_at", { ascending: false });
  return { data: (data ?? []) as Registro[], falhou: !!error };
}

/**
 * A situação (rascunho ou concluído) do registro de cada consulta da lista,
 * por id da consulta: o que a agenda precisa para o selo, sem trazer o texto
 * do prontuário. Consulta sem registro não aparece. Lista vazia não vai ao
 * banco: `in ()` com nada devolve nada, e a chamada seria à toa.
 */
export async function getRegistrosDasConsultas(
  supabase: any,
  consultaIds: string[],
): Promise<Res<Record<string, Registro["status"]>>> {
  if (consultaIds.length === 0) return { data: {}, falhou: false };
  const { data, error } = await supabase
    .from("consultation_records")
    .select("appointment_id, status")
    .in("appointment_id", consultaIds);
  const porConsulta: Record<string, Registro["status"]> = {};
  for (const r of (data ?? []) as { appointment_id: string; status: Registro["status"] }[]) {
    porConsulta[r.appointment_id] = r.status;
  }
  return { data: porConsulta, falhou: !!error };
}

/**
 * O "observar no retorno" de cada paciente: o texto mais recente que não é
 * vazio, entre os registros concluídos, com o dia em que foi concluído. Só
 * concluído: o rascunho ainda é do nutri e pode mudar ou sumir. Percorre do
 * mais novo para o mais antigo e fica com o primeiro não vazio de cada um;
 * "não vazio" ignora espaço e quebra de linha, como `temAlgumaParte`.
 */
export async function getObservarDosPacientes(
  supabase: any,
  pacienteIds: string[],
): Promise<Res<Record<string, { texto: string; data: string }>>> {
  if (pacienteIds.length === 0) return { data: {}, falhou: false };
  const { data, error } = await supabase
    .from("consultation_records")
    .select("patient_id, observar, concluded_at")
    .eq("status", "concluido")
    .in("patient_id", pacienteIds)
    .order("concluded_at", { ascending: false });
  const porPaciente: Record<string, { texto: string; data: string }> = {};
  for (const r of (data ?? []) as {
    patient_id: string;
    observar: string | null;
    concluded_at: string | null;
  }[]) {
    if (porPaciente[r.patient_id]) continue;
    if (r.observar == null || r.observar.trim() === "" || r.concluded_at == null) continue;
    porPaciente[r.patient_id] = { texto: r.observar, data: r.concluded_at };
  }
  return { data: porPaciente, falhou: !!error };
}

/** Os adendos de um registro, do mais antigo para o mais novo (a ordem em que foram escritos). */
export async function getAdendos(supabase: any, registroId: string): Promise<Res<Adendo[]>> {
  const { data, error } = await supabase
    .from("consultation_addenda")
    .select(COLUNAS_ADENDO)
    .eq("record_id", registroId)
    .order("created_at", { ascending: true });
  return { data: (data ?? []) as Adendo[], falhou: !!error };
}

/**
 * Uma linha da série de medidas do paciente. Cada medida é `number | null`:
 * no banco a que não foi tirada é nula (`Medidas` de lib/registro.ts é o que
 * o editor manda, onde a medida vazia simplesmente não existe).
 */
export type LinhaDeMedida = {
  date: string;
  appointment_id: string | null;
  measured_by: string | null;
} & Partial<Record<CampoMedida, number | null>>;

const COLUNAS_MEDIDA =
  "date, appointment_id, measured_by, weight_kg, body_fat_pct, waist_cm, hip_cm, chest_cm, arm_cm, thigh_cm, calf_cm, neck_cm";

/**
 * A série de medidas do paciente, da mais nova para a mais antiga, as de
 * consulta (`appointment_id`) e as que ele anotou em casa. Quem precisa só das
 * de consulta (o "antes" do editor) filtra com `anteriores`. As 200 mais
 * recentes: de sobra para um acompanhamento, e a lista não cresce sem teto.
 */
export async function getMedidasDoPaciente(
  supabase: any,
  pacienteId: string,
): Promise<Res<LinhaDeMedida[]>> {
  const { data, error } = await supabase
    .from("body_measurements")
    .select(COLUNAS_MEDIDA)
    .eq("user_id", pacienteId)
    .order("date", { ascending: false })
    .limit(200);
  return { data: (data ?? []) as LinhaDeMedida[], falhou: !!error };
}
