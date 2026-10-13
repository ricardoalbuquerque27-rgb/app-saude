import type { Res } from "@/lib/consultasDb";
import {
  COLUNAS_ADENDO,
  COLUNAS_REGISTRO,
  ultimoObservarPorPaciente,
  type Adendo,
  type CampoMedida,
  type ObservarDoPaciente,
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
 * concluído, com o início da consulta dele em `data`. "Último" é o da consulta
 * que começou por último, e não o concluído por último: o nutri que preenche
 * hoje o registro de uma consulta antiga não muda qual é a mais recente, e a
 * instrução velha não pode passar por atual. É a ordem da página do registro
 * (consultas "anteriores a esta", por `starts_at`). Só concluído: o rascunho
 * ainda é do nutri e pode mudar ou sumir. Se o último não tem `observar`, o
 * paciente fica sem entrada, sem cair num mais velho (ultimoObservarPorPaciente).
 *
 * Duas leituras: os registros concluídos e, deles, o início de cada consulta.
 * Não vai num select embutido porque o Supabase falso das ferramentas não
 * entende `appointments(starts_at)`. As consultas vão em blocos de 100 ids: um
 * `in (...)` com todas as de um paciente de anos, vezes os pacientes da agenda
 * do mês, passaria do tamanho que o endereço aceita. A falha de qualquer uma, ou
 * um registro cuja consulta não se leu (sem ela não há ordem), é `falhou`.
 *
 * Os registros vêm do concluído mais recente para o mais antigo: o Supabase
 * corta em 1.000 linhas sem erro, e o corte, se houver, cai nos mais antigos.
 */
export async function getObservarDosPacientes(
  supabase: any,
  pacienteIds: string[],
): Promise<Res<Record<string, ObservarDoPaciente>>> {
  if (pacienteIds.length === 0) return { data: {}, falhou: false };
  const { data, error } = await supabase
    .from("consultation_records")
    .select("patient_id, appointment_id, observar")
    .eq("status", "concluido")
    .in("patient_id", pacienteIds)
    .order("concluded_at", { ascending: false });
  if (error) return { data: {}, falhou: true };
  const registros = (data ?? []) as {
    patient_id: string;
    appointment_id: string;
    observar: string | null;
  }[];

  const consultaIds = Array.from(new Set(registros.map((r) => r.appointment_id)));
  const blocos: string[][] = [];
  for (let i = 0; i < consultaIds.length; i += 100) blocos.push(consultaIds.slice(i, i + 100));
  const inicios: Record<string, string> = {};
  let falhou = false;
  await Promise.all(
    blocos.map(async (bloco) => {
      const r = await supabase.from("appointments").select("id, starts_at").in("id", bloco);
      if (r.error) falhou = true;
      for (const a of (r.data ?? []) as { id: string; starts_at: string }[]) inicios[a.id] = a.starts_at;
    }),
  );
  if (registros.some((r) => !inicios[r.appointment_id])) falhou = true;
  return { data: ultimoObservarPorPaciente(registros, inicios), falhou };
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
 * consulta (`appointment_id`) e as que ele anotou em casa, para a coluna de
 * contexto ("última medida em casa"). As 200 mais recentes: de sobra para
 * isso, e a lista não cresce sem teto. O "antes" do editor NÃO sai daqui
 * (getMedidasDasConsultas).
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

/**
 * Só as medidas tiradas em consulta, da mais nova para a mais antiga: de onde
 * saem o "antes" do editor e a diferença do concluído (`anteriores`). Saíam da
 * série de cima, e quem se pesa todo dia em casa passa das 200 em sete meses:
 * a medida da consulta ficava atrás do teto e o "antes" sumia calado. Sem teto
 * próprio: é uma por consulta. O Supabase corta em 1.000 linhas sem erro, e a
 * ordem decrescente faz o corte, se um dia houver, cair nas mais antigas.
 */
export async function getMedidasDasConsultas(
  supabase: any,
  pacienteId: string,
): Promise<Res<LinhaDeMedida[]>> {
  const { data, error } = await supabase
    .from("body_measurements")
    .select(COLUNAS_MEDIDA)
    .eq("user_id", pacienteId)
    .not("appointment_id", "is", null)
    .order("date", { ascending: false });
  return { data: (data ?? []) as LinhaDeMedida[], falhou: !!error };
}
