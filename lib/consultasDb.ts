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
 * "Desde a última consulta" de vários pacientes. `consultas` são as consultas
 * de cada um (para achar a última realizada); quem não tem nenhuma realizada
 * fica de fora (null).
 *
 * Uma leva de consultas POR PACIENTE, cada uma só na janela dele. Juntando
 * todos num `.in(ids)`, três retornos no dia com um paciente de 90 dias atrás
 * já davam mais de 1.000 refeições, e o Supabase corta em 1.000 linhas sem
 * erro: o "dias com registro" saía baixo, ou "Nenhum registro", para quem
 * registra todo dia. Por paciente, 90 dias de refeições ficam bem abaixo
 * disso, e a ordem decrescente faz um corte, se houver, cair nos dias mais
 * antigos.
 */
export async function getDesdeUltimaConsulta(
  supabase: any,
  consultasPorPaciente: Record<string, Consulta[]>,
  agora = new Date().toISOString(),
  hoje = todayISO()
): Promise<Res<Record<string, ResumoDesde | null>>> {
  const out: Record<string, ResumoDesde | null> = {};
  let falhou = false;
  await Promise.all(
    Object.entries(consultasPorPaciente).map(async ([id, lista]) => {
      out[id] = null;
      const u = ultimaRealizada(lista, agora);
      if (!u) return;
      const desde = diaDaConsulta(u);
      // Do dia seguinte à consulta, no máximo 90 dias; o peso da base pode
      // ser mais antigo, então as medidas vêm de um ano antes.
      const inicio = [addDaysISO(hoje, -(MAX_DIAS_DESDE - 1)), addDaysISO(desde, 1)].sort().pop()!;
      const datas = (tabela: string) =>
        supabase
          .from(tabela)
          .select("date")
          .eq("user_id", id)
          .gte("date", inicio)
          .lte("date", hoje)
          .order("date", { ascending: false });
      const respostas = await Promise.all([
        datas("meals"),
        datas("workouts"),
        datas("daily_logs"),
        supabase
          .from("body_measurements")
          .select("date, weight_kg")
          .eq("user_id", id)
          .not("weight_kg", "is", null)
          .gte("date", addDaysISO(inicio, -365))
          .lte("date", hoje)
          .order("date", { ascending: false }),
        supabase.from("workout_plan").select("id, day_of_week, sport").eq("user_id", id),
        supabase
          .from("plan_completions")
          .select("id, plan_id, date, status, workout_id")
          .eq("user_id", id)
          .gte("date", inicio)
          .lte("date", hoje),
        supabase
          .from("prescription_deviations")
          .select("created_at")
          .eq("patient_id", id)
          .gte("created_at", instanteEmSaoPaulo(inicio, "00:00")),
      ]);
      if (respostas.some((r: any) => r.error)) falhou = true;
      const [refeicoes, treinos, diarios, medidas, plano, checks, desvios] = respostas.map(
        (r: any) => (r.data ?? []) as any[]
      );
      out[id] = resumoDesdeUltima({
        desde,
        hoje,
        diasComRegistro: [...refeicoes, ...treinos, ...diarios, ...medidas].map((x) => x.date),
        pesos: medidas,
        plano,
        checks,
        desvios,
      });
    })
  );
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

/**
 * As consultas do cartão do paciente: pedidos abertos (de qualquer data: um
 * pedido vencido sem resposta ainda prende o próximo pelo índice de um pedido
 * por vez, e o paciente precisa vê-lo para cancelar), as futuras e as da
 * última semana (para o aviso "cancelou a consulta"), da mais cedo para a
 * mais tarde. Antes eram as 10 mais NOVAS, e com mais de 10 futuras a mais
 * próxima ficava de fora.
 */
export async function getConsultasDoCartao(
  supabase: any,
  pacienteId: string,
  agora = new Date().toISOString()
): Promise<Res<Consulta[]>> {
  const semanaPassada = new Date(Date.parse(agora) - 7 * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from("appointments")
    .select(COLUNAS_CONSULTA)
    .eq("patient_id", pacienteId)
    .or(`status.eq.pedido,starts_at.gte."${semanaPassada}"`)
    .order("starts_at", { ascending: true })
    .limit(50);
  return { data: (data ?? []) as Consulta[], falhou: !!error };
}
