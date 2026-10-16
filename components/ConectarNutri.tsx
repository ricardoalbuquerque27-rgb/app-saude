"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Field } from "@/components/ui";

// Entrada do vínculo: o paciente cola o código do convite. Fica numa ilha
// cliente porque a página virou servidor — o resto do acompanhamento é só
// leitura e não precisa de JavaScript para aparecer.
export default function ConectarNutri({ codeInicial = "" }: { codeInicial?: string }) {
  const supabase = createClient();
  const router = useRouter();
  const [code, setCode] = useState(codeInicial.toUpperCase());
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // O convite chega como /app/nutricionista?code=XXXX.
  useEffect(() => {
    if (codeInicial) setCode(codeInicial.toUpperCase());
  }, [codeInicial]);

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
      router.refresh();
    } else {
      setMsg({ type: "err", text: res?.error ?? "Convite inválido." });
    }
  }

  return (
    <div className="card">
      <h2 className="section-title mb-3">Conectar com um código</h2>
      <Field label="Código do convite">
        <input
          // O código já é guardado em maiúsculas (onChange); em fonte
          // monoespaçada cada caractere tem a mesma largura, o que basta
          // para ler "7F3A9C2B" sem a caixa alta e o espaçamento do CSS.
          className="input font-mono"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Ex.: 7F3A9C2B"
          maxLength={8}
        />
      </Field>
      <p className="mb-3 flex items-start gap-1.5 text-[13px] text-app-texto-2">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-app-primaria" />
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
              ? "bg-app-primaria-fundo text-app-primaria"
              : "bg-app-perigo-fundo text-app-perigo"
          }`}
        >
          {msg.text}
        </p>
      )}
    </div>
  );
}
