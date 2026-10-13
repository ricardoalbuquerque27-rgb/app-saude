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
 * O "observar no retorno" de cada paciente: o texto do ÚLTIMO registro
 * concluído, com o dia em que foi concluído. Só concluído: o rascunho ainda é
 * do nutri e pode mudar ou sumir. Se o último concluído não tem `observar`
 * (nulo, ou só espaço e quebra de linha, como em `temAlgumaParte`), o paciente
 * fica sem entrada: nunca se cai para um registro mais antigo, porque a
 * instrução de uma consulta anterior apareceria como se fosse a de agora,
 * depois de o nutri ter registrado a consulta seguinte sem nada a observar.
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
  // Quem já teve o seu último concluído examinado, com texto ou sem.
  const jaVistos = new Set<string>();
  for (const r of (data ?? []) as {
    patient_id: string;
    observar: string | null;
    concluded_at: string | null;
  }[]) {
    // Concluído sempre tem data (check no banco); a guarda é só para o tipo.
    if (r.concluded_at == null || jaVistos.has(r.patient_id)) continue;
    jaVistos.add(r.patient_id);
    if (r.observar == null || r.observar.trim() === "") continue;
    porPaciente[r.patient_id] = { texto: r.observar, data: r.concluded_at };
  }
  return { data: porPaciente, falhou: !!error };
}
