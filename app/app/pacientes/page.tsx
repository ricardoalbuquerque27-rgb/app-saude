"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  UserPlus,
  Loader2,
  Copy,
  Check,
  Trash2,
  ChevronRight,
  Clock,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PageHeader, Modal, Field, EmptyState } from "@/components/ui";

type Link_ = {
  id: string;
  patient_id: string | null;
  patient_label: string | null;
  invite_code: string | null;
  status: string;
  created_at: string;
};

export default function PacientesPage() {
  const supabase = createClient();
  const [links, setLinks] = useState<Link_[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [generating, setGenerating] = useState(false);
  const [newCode, setNewCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("patient_links")
      .select("id, patient_id, patient_label, invite_code, status, created_at")
      .order("created_at", { ascending: false });
    const list = (data ?? []) as Link_[];
    setLinks(list);
    const ids = list.map((l) => l.patient_id).filter(Boolean) as string[];
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", ids);
      const m: Record<string, string> = {};
      (profs ?? []).forEach((p: any) => (m[p.id] = p.full_name || "Paciente"));
      setNames(m);
    } else {
      setNames({});
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function generate() {
    setGenerating(true);
    setNewCode(null);
    const { data, error } = await supabase.rpc("create_patient_invite", {
      p_label: label.trim() || undefined,
    });
    setGenerating(false);
    if (!error && data) {
      setNewCode(data as string);
      await load();
    }
  }

  function inviteLink(code: string) {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/app/nutricionista?code=${code}`;
  }

  async function copyInvite(code: string) {
    const text = `Você foi convidado(a) para acompanhar sua saúde comigo. Crie sua conta e use o código ${code} — ou abra: ${inviteLink(code)}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  }

  async function cancelInvite(id: string) {
    if (!confirm("Cancelar este convite?")) return;
    await supabase.from("patient_links").delete().eq("id", id);
    setLinks((prev) => prev.filter((l) => l.id !== id));
  }

  async function removePatient(id: string) {
    if (!confirm("Remover o vínculo com este paciente? Você perderá o acesso aos dados dele."))
      return;
    await supabase.from("patient_links").delete().eq("id", id);
    setLinks((prev) => prev.filter((l) => l.id !== id));
  }

  const active = links.filter((l) => l.status === "active");
  const pending = links.filter((l) => l.status === "pending");

  function openInvite() {
    setLabel("");
    setNewCode(null);
    setInviteOpen(true);
  }

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

      {loading ? (
        <div className="flex justify-center py-16 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : links.length === 0 ? (
        <EmptyState
          icon={<Users className="h-10 w-10" />}
          title="Nenhum paciente ainda"
          description="Toque em “Convidar paciente” para gerar um código e enviar ao seu paciente."
        />
      ) : (
        <div className="space-y-6">
          {active.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Ativos ({active.length})
              </p>
              <div className="space-y-2">
                {active.map((l) => (
                  <div key={l.id} className="card flex items-center gap-3 p-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                      {(names[l.patient_id!] || l.patient_label || "P")
                        .slice(0, 1)
                        .toUpperCase()}
                    </div>
                    <Link href={`/app/pacientes/${l.patient_id}`} className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-slate-900 dark:text-white">
                        {names[l.patient_id!] || l.patient_label || "Paciente"}
                      </p>
                      <p className="text-xs text-brand-600 dark:text-brand-400">Ver painel</p>
                    </Link>
                    <button
                      onClick={() => removePatient(l.id)}
                      className="rounded-lg p-1.5 text-slate-400 hover:text-rose-600"
                      aria-label="Remover paciente"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <Link
                      href={`/app/pacientes/${l.patient_id}`}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pending.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Convites pendentes ({pending.length})
              </p>
              <div className="space-y-2">
                {pending.map((l) => (
                  <div key={l.id} className="card flex items-center gap-3 p-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                      <Clock className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-slate-900 dark:text-white">
                        {l.patient_label || "Convite"}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Código: <span className="font-mono font-semibold">{l.invite_code}</span> · aguardando aceite
                      </p>
                    </div>
                    <button
                      onClick={() => l.invite_code && copyInvite(l.invite_code)}
                      className="rounded-lg p-1.5 text-slate-400 hover:text-brand-600"
                      aria-label="Copiar convite"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => cancelInvite(l.id)}
                      className="rounded-lg p-1.5 text-slate-400 hover:text-rose-600"
                      aria-label="Cancelar convite"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="Convidar paciente">
        {newCode ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Convite criado! Envie o código (ou o link) para o paciente. Ele cria a
              conta, insere o código e aceita — aí você passa a acompanhar os dados.
            </p>
            <div className="rounded-xl border border-brand-200 bg-brand-50/50 p-4 text-center dark:border-brand-900/40 dark:bg-brand-950/20">
              <p className="text-xs text-slate-500 dark:text-slate-400">Código do convite</p>
              <p className="font-mono text-3xl font-bold tracking-widest text-brand-700 dark:text-brand-300">
                {newCode}
              </p>
            </div>
            <button onClick={() => copyInvite(newCode)} className="btn-primary w-full py-2.5">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copiado!" : "Copiar convite (código + link)"}
            </button>
            <button onClick={() => setInviteOpen(false)} className="btn-ghost w-full py-2.5">
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
              <p className="mt-1 text-xs text-slate-400">
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
