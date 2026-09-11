import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/date";
import { getPatientsSummary } from "@/lib/nutri";
import PacientesClient, { type LinkRow } from "@/components/PacientesClient";

export const dynamic = "force-dynamic";

// Lista de pacientes do nutricionista. Os resumos (adesão, peso, alertas) são
// calculados no servidor — 6 consultas no total, independente do número de
// pacientes — e a interação (convite, remover) fica no componente cliente.
export default async function PacientesPage() {
  const supabase = await createClient();
  const today = todayISO();

  const { data } = await supabase
    .from("patient_links")
    .select("id, patient_id, patient_label, invite_code, status, created_at")
    .order("created_at", { ascending: false });
  const links = (data ?? []) as LinkRow[];

  const ids = links
    .filter((l) => l.status === "active" && l.patient_id)
    .map((l) => l.patient_id as string);

  const names: Record<string, string> = {};
  if (ids.length) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", ids);
    for (const p of (profs ?? []) as any[]) {
      names[p.id] = p.full_name || "Paciente";
    }
  }

  const summaries = await getPatientsSummary(supabase, ids, names);

  return (
    <PacientesClient links={links} summaries={summaries} today={today} />
  );
}
