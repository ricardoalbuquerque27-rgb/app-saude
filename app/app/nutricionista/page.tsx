"use client";

import { useCallback, useEffect, useState } from "react";
import { Stethoscope, Loader2, Check, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PageHeader, Field } from "@/components/ui";

type Link_ = { id: string; nutritionist_id: string; status: string };

export default function MeuNutricionistaPage() {
  const supabase = createClient();
  const [links, setLinks] = useState<Link_[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("patient_links")
      .select("id, nutritionist_id, status")
      .eq("status", "active");
    const list = (data ?? []) as Link_[];
    setLinks(list);
    const ids = list.map((l) => l.nutritionist_id);
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", ids);
      const m: Record<string, string> = {};
      (profs ?? []).forEach((p: any) => (m[p.id] = p.full_name || "Nutricionista"));
      setNames(m);
    } else {
      setNames({});
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
    // Pré-preenche o código vindo do link do convite (?code=...).
    try {
      const c = new URLSearchParams(window.location.search).get("code");
      if (c) setCode(c.toUpperCase());
    } catch {}
  }, [load]);

  async function accept() {
    const c = code.trim().toUpperCase();
    if (!c) return;
    setSaving(true);
    setMsg(null);
    const { data, error } = await supabase.rpc("accept_patient_invite", { p_code: c });
    setSaving(false);
    if (error) {
      setMsg({ type: "err", text: "Não foi possível conectar. Tente novamente." });
      return;
    }
    const res = data as { ok: boolean; error?: string; already?: boolean };
    if (res?.ok) {
      setMsg({
        type: "ok",
        text: res.already ? "Você já estava vinculado." : "Pronto! Vínculo criado.",
      });
      setCode("");
      await load();
    } else {
      setMsg({ type: "err", text: res?.error ?? "Convite inválido." });
    }
  }

  async function revoke(id: string) {
    if (
      !confirm(
        "Revogar o acesso deste nutricionista aos seus dados? Ele deixará de ver seus registros."
      )
    )
      return;
    await supabase.from("patient_links").update({ status: "revoked" }).eq("id", id);
    setLinks((prev) => prev.filter((l) => l.id !== id));
  }

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Meu nutricionista"
        subtitle="Conecte-se ao seu nutricionista para ele acompanhar sua evolução."
      />

      {/* Conectar por código */}
      <div className="card mb-6">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
            <Stethoscope className="h-4 w-4" />
          </span>
          <h2 className="font-semibold text-slate-900 dark:text-white">
            Conectar com um código
          </h2>
        </div>
        <Field label="Código do convite">
          <input
            className="input font-mono uppercase tracking-widest"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Ex.: 7F3A9C2B"
            maxLength={8}
          />
        </Field>
        <p className="mb-3 flex items-start gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" />
          Ao conectar, você autoriza este nutricionista a ver seus registros de
          saúde (dieta, peso, exames, hábitos). Você pode revogar quando quiser.
        </p>
        <button
          onClick={accept}
          disabled={saving || !code.trim()}
          className="btn-primary w-full py-2.5"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Conectar
        </button>
        {msg && (
          <p
            className={`mt-3 rounded-lg px-3 py-2 text-sm ${
              msg.type === "ok"
                ? "bg-brand-50 text-brand-700 dark:bg-brand-950/30 dark:text-brand-300"
                : "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300"
            }`}
          >
            {msg.text}
          </p>
        )}
      </div>

      {/* Nutricionistas vinculados */}
      {loading ? (
        <div className="flex justify-center py-8 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : links.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Conectado com
          </p>
          <div className="space-y-2">
            {links.map((l) => (
              <div key={l.id} className="card flex items-center gap-3 p-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                  <Stethoscope className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-900 dark:text-white">
                    {names[l.nutritionist_id] || "Seu nutricionista"}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Acompanhando seus dados
                  </p>
                </div>
                <button
                  onClick={() => revoke(l.id)}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                >
                  Revogar
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Você ainda não está conectado a nenhum nutricionista.
        </p>
      )}
    </div>
  );
}
