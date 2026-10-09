import Link from "next/link";
import {
  Users,
  UserPlus,
  AlertTriangle,
  ChevronRight,
  CheckCircle2,
  Clock,
  Syringe,
  FileText,
  CalendarOff,
  ClipboardList,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui";
import {
  getPatientsSummary,
  filaDeTriagem,
  type PatientSummary,
} from "@/lib/nutri";

export const dynamic = "force-dynamic";

// Home de quem tem role = nutritionist: uma fila de triagem, não um painel.
// A versão anterior tinha quatro números e, logo abaixo, as listas dos
// mesmos pacientes ("Precisam de atenção", "Movimento de hoje", "Em dia"),
// que somadas davam a carteira inteira, com gente repetida — e a página
// Pacientes já filtra por atenção e por hoje. Aqui cada paciente aparece
// uma vez, e só se precisar do nutricionista.

function alertIcon(alert: string) {
  if (alert.includes("Dose")) return <Syringe className="h-3.5 w-3.5" />;
  if (alert.includes("prescrição")) return <ClipboardList className="h-3.5 w-3.5" />;
  if (alert.includes("exame")) return <FileText className="h-3.5 w-3.5" />;
  return <CalendarOff className="h-3.5 w-3.5" />;
}

function PatientRow({ s }: { s: PatientSummary }) {
  return (
    <Link
      href={`/app/pacientes/${s.id}`}
      className="tappable flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-sm font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
        {s.name.slice(0, 1).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
          {s.name}
        </p>
        <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-1">
          {s.alerts.slice(0, 2).map((a) => (
            <span
              key={a}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-400"
            >
              {alertIcon(a)}
              {a}
            </span>
          ))}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 dark:text-slate-400" />
    </Link>
  );
}

export default async function NutriHome({
  firstName,
  today,
}: {
  firstName: string;
  today: string;
}) {
  const supabase = await createClient();

  const { data: linksData } = await supabase
    .from("patient_links")
    .select("patient_id, patient_label, status")
    .order("created_at", { ascending: false });
  const links = (linksData ?? []) as any[];

  const activeIds = links
    .filter((l) => l.status === "active" && l.patient_id)
    .map((l) => l.patient_id as string);
  const pendingCount = links.filter((l) => l.status === "pending").length;

  const names: Record<string, string> = {};
  if (activeIds.length) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", activeIds);
    for (const p of (profs ?? []) as any[]) {
      names[p.id] = p.full_name || "Paciente";
    }
  }

  const summaries = await getPatientsSummary(supabase, activeIds, names);
  const fila = filaDeTriagem(summaries, today);
  const emDia = summaries.length - fila.length;

  if (activeIds.length === 0 && pendingCount === 0) {
    return (
      <div>
        <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Olá, {firstName}
        </h1>
        <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
          Sua visão geral aparece aqui assim que você tiver pacientes.
        </p>
        <EmptyState
          icon={<Users className="h-10 w-10" />}
          title="Nenhum paciente ainda"
          description="Convide seu primeiro paciente para começar a acompanhar treinos, alimentação, exames e tratamento em um só lugar."
        />
        <Link href="/app/pacientes" className="btn-primary mt-4 w-full py-2.5">
          <UserPlus className="h-4 w-4" /> Convidar paciente
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Olá, {firstName}
        </h1>
        <Link href="/app/pacientes" className="btn-primary shrink-0">
          <UserPlus className="h-4 w-4" /> Convidar
        </Link>
      </div>

      {activeIds.length > 0 &&
        (fila.length > 0 ? (
          <div className="card mb-4 p-3">
            <h2 className="section-title mb-1 px-2 pt-1">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4" />
              </span>
              <span>
                Precisam de você{" "}
                <span className="text-sm font-normal text-slate-500 dark:text-slate-400">
                  ({fila.length} de {summaries.length})
                </span>
              </span>
            </h2>
            <div className="pf-stagger divide-y divide-slate-100 dark:divide-slate-800">
              {fila.map((s) => (
                <PatientRow key={s.id} s={s} />
              ))}
            </div>
          </div>
        ) : (
          <div className="card mb-4 flex items-center gap-3">
            <span className="icon-badge">
              <CheckCircle2 className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                Ninguém precisa de você agora
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {emDia} {emDia === 1 ? "paciente em dia" : "pacientes em dia"}
              </p>
            </div>
          </div>
        ))}

      {pendingCount > 0 && (
        <Link
          href="/app/pacientes"
          className="tappable mb-4 flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/60"
        >
          <Clock className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />
          <span className="flex-1">
            {pendingCount}{" "}
            {pendingCount === 1
              ? "convite aguardando o paciente"
              : "convites aguardando o paciente"}
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 dark:text-slate-400" />
        </Link>
      )}

      <Link
        href="/app/pacientes"
        className="btn-ghost w-full py-2.5 text-sm text-slate-600 dark:text-slate-300"
      >
        Ver todos os pacientes <ChevronRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
