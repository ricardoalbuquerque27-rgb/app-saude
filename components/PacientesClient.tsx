"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Users,
  UserPlus,
  Loader2,
  Copy,
  Check,
  Trash2,
  ChevronRight,
  Clock,
  AlertTriangle,
  Scale,
  Dumbbell,
  CalendarCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PageHeader, Modal, Field, EmptyState } from "@/components/ui";
import type { PatientSummary } from "@/lib/nutri";
import { comSinal, numeroFixo } from "@/lib/numeros";
import { textoDoConvite } from "@/lib/marca";

export type LinkRow = {
  id: string;
  patient_id: string | null;
  patient_label: string | null;
  invite_code: string | null;
  status: string;
  created_at: string;
};

type Filter = "todos" | "atencao" | "hoje";

export default function PacientesClient({
  links,
  summaries,
  today,
}: {
  links: LinkRow[];
  summaries: PatientSummary[];
  today: string;
}) {
  const supabase = createClient();
  const router = useRouter();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [generating, setGenerating] = useState(false);
  const [newCode, setNewCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [filter, setFilter] = useState<Filter>("todos");

  const byId = new Map(summaries.map((s) => [s.id, s]));
  const active = links.filter((l) => l.status === "active" && l.patient_id);
  const pending = links.filter((l) => l.status === "pending");

  const attentionCount = summaries.filter((s) => s.alerts.length > 0).length;
  const todayCount = summaries.filter((s) => s.lastActivity === today).length;

  const shown = active.filter((l) => {
    const s = byId.get(l.patient_id!);
    if (filter === "atencao") return (s?.alerts.length ?? 0) > 0;
    if (filter === "hoje") return s?.lastActivity === today;
    return true;
  });

  async function generate() {
    setGenerating(true);
    setNewCode(null);
    const { data, error } = await supabase.rpc("create_patient_invite", {
      p_label: label.trim() || undefined,
    });
    setGenerating(false);
    if (!error && data) {
      setNewCode(data as string);
      router.refresh();
    }
  }

  function inviteLink(code: string) {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/app/nutricionista?code=${code}`;
  }

  async function copyInvite(code: string) {
    const text = textoDoConvite(code, inviteLink(code));
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  }

  async function cancelInvite(id: string) {
    if (!confirm("Cancelar este convite?")) return;
    await supabase.from("patient_links").delete().eq("id", id);
    router.refresh();
  }

  async function removePatient(id: string) {
    if (
      !confirm(
        "Remover o vínculo com este paciente? Você perderá o acesso aos dados dele."
      )
    )
      return;
    await supabase.from("patient_links").delete().eq("id", id);
    router.refresh();
  }

  function openInvite() {
    setLabel("");
    setNewCode(null);
    setInviteOpen(true);
  }

  const filters: { key: Filter; label: string; count: number }[] = [
    { key: "todos", label: "Todos", count: active.length },
    { key: "atencao", label: "Atenção", count: attentionCount },
    { key: "hoje", label: "Ativos hoje", count: todayCount },
  ];

  return (
    <div>
      <PageHeader
        title="Pacientes"
        subtitle="Acompanhe e prescreva para seus pacientes."
        action={
          <button onClick={openInvite} className="btn-primary">
            <UserPlus className="h-4 w-4" /> Convidar paciente
          </button>
        }
      />

      {links.length === 0 ? (
        <EmptyState
          icon={<Users className="h-10 w-10" />}
          title="Nenhum paciente ainda"
          description="Toque em “Convidar paciente” para gerar um código e enviar ao seu paciente."
        />
      ) : (
        <div className="space-y-6">
          {active.length > 0 && (
            <div>
              <div className="mb-3 flex gap-1.5">
                {filters.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    className={`tappable min-h-[44px] rounded-lg px-3 text-sm font-medium ${
                      filter === f.key
                        ? "bg-app-primaria text-app-sobre-primaria"
                        : "text-app-texto-2 hover:bg-app-primaria-fundo"
                    }`}
                  >
                    {f.label}
                    {/* `opacity` e não `/70` na cor: as cores do app são
                        variáveis e não aceitam alfa no Tailwind. */}
                    <span
                      className={`tabular ml-1.5 text-[13px] ${
                        filter === f.key ? "opacity-80" : "text-app-texto-2"
                      }`}
                    >
                      {f.count}
                    </span>
                  </button>
                ))}
              </div>

              {shown.length === 0 ? (
                <p className="card text-sm text-app-texto-2">
                  Nenhum paciente neste filtro.
                </p>
              ) : (
                <div className="pf-stagger space-y-2">
                  {shown.map((l) => {
                    const s = byId.get(l.patient_id!);
                    const name =
                      s?.name || l.patient_label || "Paciente";
                    const alert = s?.alerts[0];
                    return (
                      <div key={l.id} className="card card-interactive flex items-center gap-3 p-3">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-semibold ${
                            alert
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                              : "bg-app-primaria-fundo text-app-primaria"
                          }`}
                        >
                          {name.slice(0, 1).toUpperCase()}
                        </div>
                        <Link
                          href={`/app/pacientes/${l.patient_id}`}
                          className="min-w-0 flex-1"
                        >
                          <p className="truncate font-semibold text-app-texto">
                            {name}
                          </p>
                          {alert ? (
                            <p className="mt-0.5 flex items-start gap-1 text-[13px] font-medium text-amber-700 dark:text-amber-400">
                              <AlertTriangle className="mt-[3px] h-3.5 w-3.5 shrink-0" />
                              {s!.alerts.join(" · ")}
                            </p>
                          ) : (
                            <p className="tabular mt-0.5 flex flex-wrap gap-x-2.5 text-[13px] text-app-texto-2">
                              <span className="inline-flex items-center gap-1">
                                <CalendarCheck className="h-3 w-3" />
                                {s?.daysLogged7 ?? 0}/7 dias
                              </span>
                              {s?.workouts7 ? (
                                <span className="inline-flex items-center gap-1">
                                  <Dumbbell className="h-3 w-3" />
                                  {s.workouts7} treinos
                                </span>
                              ) : null}
                              {s?.weightLast != null ? (
                                <span className="inline-flex items-center gap-1">
                                  <Scale className="h-3 w-3" />
                                  {numeroFixo(s.weightLast, 1)} kg
                                  {s.weightDelta30 != null
                                    ? ` (${comSinal(s.weightDelta30)})`
                                    : ""}
                                </span>
                              ) : null}
                            </p>
                          )}
                        </Link>
                        {/* Os dois com 44 px de toque, lado a lado e sem o vão
                            do card entre eles: com o vão, o nome perdia largura
                            em 390 px. */}
                        <div className="flex shrink-0 items-center">
                          <button
                            onClick={() => removePatient(l.id)}
                            className="tappable flex h-11 w-11 items-center justify-center rounded-lg text-app-texto-2 hover:text-app-perigo"
                            aria-label="Remover paciente"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          <Link
                            href={`/app/pacientes/${l.patient_id}`}
                            className="tappable flex h-11 w-11 items-center justify-center rounded-lg text-app-texto-2 hover:bg-app-primaria-fundo"
                            aria-label={`Abrir ${name}`}
                          >
                            <ChevronRight className="h-5 w-5" />
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {pending.length > 0 && (
            <div>
              <p className="eyebrow mb-2">
                Convites pendentes ({pending.length})
              </p>
              <div className="pf-stagger space-y-2">
                {pending.map((l) => (
                  <div key={l.id} className="card card-interactive flex items-center gap-3 p-3">
                    {/* Convite esperando não é alerta: neutro, e o âmbar fica para
                        o paciente que precisa do nutricionista. */}
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-app-pagina text-app-texto-2">
                      <Clock className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-app-texto">
                        {l.patient_label || "Convite"}
                      </p>
                      <p className="text-[13px] text-app-texto-2">
                        Código:{" "}
                        <span className="font-mono font-semibold text-app-texto">
                          {l.invite_code}
                        </span>{" "}
                        · aguardando aceite
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center">
                      <button
                        onClick={() => l.invite_code && copyInvite(l.invite_code)}
                        className="tappable flex h-11 w-11 items-center justify-center rounded-lg text-app-texto-2 hover:text-app-primaria"
                        aria-label="Copiar convite"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => cancelInvite(l.id)}
                        className="tappable flex h-11 w-11 items-center justify-center rounded-lg text-app-texto-2 hover:text-app-perigo"
                        aria-label="Cancelar convite"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Convidar paciente"
      >
        {newCode ? (
          <div className="space-y-4">
            <p className="text-sm text-app-texto-2">
              Convite criado! Envie o código (ou o link) para o paciente. Ele cria
              a conta, insere o código e aceita — aí você passa a acompanhar os
              dados.
            </p>
            <div className="rounded-xl bg-app-primaria-fundo p-4 text-center">
              <p className="text-[13px] text-app-texto-2">Código do convite</p>
              {/* Sem o espaçamento largo entre as letras de antes: a fonte
                  monoespaçada já dá a mesma largura a cada caractere. */}
              <p className="font-mono text-3xl font-semibold text-app-primaria">
                {newCode}
              </p>
            </div>
            <button
              onClick={() => copyInvite(newCode)}
              className="btn-primary w-full py-2.5"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copiado!" : "Copiar convite (código + link)"}
            </button>
            <button
              onClick={() => setInviteOpen(false)}
              className="btn-ghost min-h-[44px] w-full py-2.5"
            >
              Concluir
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <Field label="Nome do paciente (opcional)">
              <input
                className="input"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Ex.: Maria Silva"
              />
              <p className="mt-1 text-[13px] text-app-texto-2">
                Só para você identificar o convite enquanto o paciente não aceita.
              </p>
            </Field>
            <button
              onClick={generate}
              disabled={generating}
              className="btn-primary w-full py-2.5"
            >
              {generating && <Loader2 className="h-4 w-4 animate-spin" />}
              Gerar convite
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
