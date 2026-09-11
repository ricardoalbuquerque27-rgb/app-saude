import Link from "next/link";
import {
  Users,
  UserPlus,
  AlertTriangle,
  Activity,
  ChevronRight,
  CheckCircle2,
  Clock,
  Syringe,
  FileText,
  CalendarOff,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui";
import { getPatientsSummary, idleDays, type PatientSummary } from "@/lib/nutri";

export const dynamic = "force-dynamic";

// Visão macro da carteira do nutricionista: números do dia, quem precisa de
// atenção e quem se movimentou. É a home de quem tem role = nutritionist.

function alertIcon(alert: string) {
  if (alert.includes("Dose")) return <Syringe className="h-3.5 w-3.5" />;
  if (alert.includes("exame")) return <FileText className="h-3.5 w-3.5" />;
  return <CalendarOff className="h-3.5 w-3.5" />;
}

function Kpi({
  label,
  value,
  icon,
  tone = "slate",
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  tone?: "slate" | "brand" | "amber" | "emerald";
}) {
  const tones: Record<string, string> = {
    slate: "text-slate-400",
    brand: "text-brand-500",
    amber: "text-amber-500",
    emerald: "text-emerald-500",
  };
  return (
    <div className="card">
      <div className={tones[tone]}>{icon}</div>
      <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
        {value}
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
}

function PatientRow({ s, today }: { s: PatientSummary; today: string }) {
  const idle = idleDays(s, today);
  return (
    <Link
      href={`/app/pacientes/${s.id}`}
      className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-sm font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
        {s.name.slice(0, 1).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
          {s.name}
        </p>
        <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-1">
          {s.alerts.length > 0 ? (
            s.alerts.slice(0, 2).map((a) => (
              <span
                key={a}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-400"
              >
                {alertIcon(a)}
                {a}
              </span>
            ))
          ) : (
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {idle === 0
                ? "Registrou hoje"
                : idle != null
                  ? `Último registro há ${idle} d`
                  : "Sem registros"}
              {" · "}
              {s.daysLogged7}/7 dias na semana
            </span>
          )}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 dark:text-slate-600" />
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

  const needAttention = summaries
    .filter((s) => s.alerts.length > 0)
    .sort((a, b) => b.alerts.length - a.alerts.length);
  const loggedToday = summaries.filter((s) => s.lastActivity === today);
  const onTrack = summaries.filter((s) => s.alerts.length === 0);

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
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Olá, {firstName}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Visão geral dos seus pacientes.
          </p>
        </div>
        <Link href="/app/pacientes" className="btn-primary shrink-0">
          <UserPlus className="h-4 w-4" /> Convidar
        </Link>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi
          label="Pacientes ativos"
          value={activeIds.length}
          icon={<Users className="h-4 w-4" />}
          tone="brand"
        />
        <Kpi
          label="Registraram hoje"
          value={loggedToday.length}
          icon={<Activity className="h-4 w-4" />}
          tone="emerald"
        />
        <Kpi
          label="Precisam de atenção"
          value={needAttention.length}
          icon={<AlertTriangle className="h-4 w-4" />}
          tone="amber"
        />
        <Kpi
          label="Convites pendentes"
          value={pendingCount}
          icon={<Clock className="h-4 w-4" />}
        />
      </div>

      {needAttention.length > 0 && (
        <div className="card mb-4 p-3">
          <div className="mb-1 flex items-center gap-2 px-2 pt-1">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <h2 className="font-semibold text-slate-900 dark:text-white">
              Precisam de atenção
            </h2>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {needAttention.map((s) => (
              <PatientRow key={s.id} s={s} today={today} />
            ))}
          </div>
        </div>
      )}

      {loggedToday.length > 0 && (
        <div className="card mb-4 p-3">
          <div className="mb-1 flex items-center gap-2 px-2 pt-1">
            <Activity className="h-4 w-4 text-emerald-500" />
            <h2 className="font-semibold text-slate-900 dark:text-white">
              Movimento de hoje
            </h2>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {loggedToday.map((s) => (
              <Link
                key={s.id}
                href={`/app/pacientes/${s.id}`}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-sm font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                  {s.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                    {s.name}
                  </p>
                  <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                    {[
                      s.caloriesToday
                        ? `${Math.round(s.caloriesToday)} kcal`
                        : null,
                      s.waterToday
                        ? `${(s.waterToday / 1000).toFixed(1)} L`
                        : null,
                      s.workouts7 ? `${s.workouts7} treinos/7d` : null,
                      s.weightLast ? `${s.weightLast} kg` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Registrou hoje"}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 dark:text-slate-600" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {onTrack.length > 0 && (
        <div className="card mb-4 p-3">
          <div className="mb-1 flex items-center gap-2 px-2 pt-1">
            <CheckCircle2 className="h-4 w-4 text-brand-500" />
            <h2 className="font-semibold text-slate-900 dark:text-white">
              Em dia ({onTrack.length})
            </h2>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {onTrack.map((s) => (
              <PatientRow key={s.id} s={s} today={today} />
            ))}
          </div>
        </div>
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
