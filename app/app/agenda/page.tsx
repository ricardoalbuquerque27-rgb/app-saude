import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { meuPerfil } from "@/lib/perfil";
import { todayISO } from "@/lib/date";
import {
  COLUNAS_CONSULTA,
  dataDaUrl,
  diaDaConsulta,
  periodoDaVista,
  vistaDaUrl,
  type Consulta,
} from "@/lib/consultas";
import {
  getConsultasDoPeriodo,
  getDesdeUltimaConsulta,
  getNomesDosPacientes,
  getPacientesAtivos,
  getPendencias,
} from "@/lib/consultasDb";
import { textoDesdeUltima, tituloDesde } from "@/lib/desdeConsulta";
import { Agenda } from "@/components/consultas/agenda/Agenda";

export const dynamic = "force-dynamic";
export const metadata = { title: "Agenda · Pace Fit" };

// A agenda do nutricionista (spec: docs/superpowers/specs/2026-10-13-consultas-e-agenda-design.md).
// O servidor busca só o período que a vista mostra, as pendências de
// qualquer data (para a linha de aviso) e, na vista Dia, o "desde a última
// consulta" de quem tem retorno no dia.
export default async function AgendaPage({
  searchParams,
}: {
  searchParams: { [chave: string]: string | string[] | undefined };
}) {
  const supabase = await createClient();
  const perfil = await meuPerfil<{ id: string; role: string }>(supabase, "id, role");
  if (!perfil) redirect("/login");
  if (perfil.role !== "nutritionist") redirect("/app");

  const hoje = todayISO();
  const agora = new Date().toISOString();
  const vista = vistaDaUrl(searchParams?.vista, cookies().get("agenda_vista")?.value);
  const data = dataDaUrl(searchParams?.data, hoje);
  const { desde, ate } = periodoDaVista(vista, data);

  const [periodo, pendencias, pacientes] = await Promise.all([
    getConsultasDoPeriodo(supabase, perfil.id, desde, ate),
    getPendencias(supabase, perfil.id, agora),
    getPacientesAtivos(supabase, perfil.id),
  ]);

  // Nomes de quem aparece na tela: os ativos já vêm com nome; uma consulta
  // antiga de alguém fora da lista (sem perfil legível) cai no rótulo.
  const nomes: Record<string, string> = {};
  for (const p of pacientes.data) nomes[p.id] = p.nome;
  const semNome = Array.from(
    new Set([...periodo.data, ...pendencias.data].map((c) => c.patient_id))
  ).filter((id) => !nomes[id]);
  const outros = await getNomesDosPacientes(supabase, semNome);
  Object.assign(nomes, outros.data);

  // "Desde a última consulta" só na vista Dia, para os retornos do dia.
  const desdeTexto: Record<string, { titulo: string; texto: string }> = {};
  if (vista === "dia") {
    const ids = Array.from(
      new Set(
        periodo.data
          .filter((c) => diaDaConsulta(c) === data && c.kind === "retorno" && c.status !== "cancelada")
          .map((c) => c.patient_id)
      )
    );
    if (ids.length) {
      const { data: realizadas, error } = await supabase
        .from("appointments")
        .select(COLUNAS_CONSULTA)
        .in("patient_id", ids)
        .eq("status", "realizada")
        .lt("starts_at", agora)
        .order("starts_at", { ascending: false });
      const porPaciente: Record<string, Consulta[]> = {};
      for (const id of ids) porPaciente[id] = [];
      for (const c of (realizadas ?? []) as Consulta[]) porPaciente[c.patient_id]?.push(c);
      const r = await getDesdeUltimaConsulta(supabase, porPaciente, agora, hoje);
      // Com leitura falha a linha diz isso: sumir pareceria "nada a dizer", e
      // "nenhum registro" seria falso (CLAUDE.md, leitura que falha).
      if (error || r.falhou) {
        for (const id of ids)
          desdeTexto[id] = { titulo: "Desde a última consulta", texto: "não foi possível carregar" };
      } else {
        for (const [id, resumo] of Object.entries(r.data)) {
          if (resumo) desdeTexto[id] = { titulo: tituloDesde(resumo), texto: textoDesdeUltima(resumo) };
        }
      }
    }
  }

  return (
    <Agenda
      vista={vista}
      data={data}
      hoje={hoje}
      agora={agora}
      nutriId={perfil.id}
      consultas={periodo.data}
      pendencias={pendencias.data}
      nomes={nomes}
      pacientes={pacientes.data}
      desde={desdeTexto}
      falhou={{
        periodo: periodo.falhou,
        pendencias: pendencias.falhou,
        pacientes: pacientes.falhou || outros.falhou,
      }}
    />
  );
}
