"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ErroInline } from "./ErroInline";

// "Reaplicar" as metas que o nutricionista prescreveu, quando o paciente as
// mexeu por conta própria (aviso de desvio na fila).
//
// Chama set_patient_goals com as QUATRO metas da última prescrição, do jeito
// que vieram. Não é um detalhe: a função trata NULL como "limpar esta meta",
// então omitir ou trocar por um valor padrão uma meta que a prescrição não tinha
// apagaria a do perfil. Cada chamada grava uma prescrição nova, e é essa
// inserção que, por gatilho no banco, dá baixa nos desvios abertos do paciente;
// por isso não há um segundo UPDATE aqui. A observação vai nula: reaplicar não
// é uma decisão clínica nova que mereça texto no histórico.
export function ReaplicarMetas({
  pacienteId,
  prescricao,
}: {
  pacienteId: string;
  prescricao: {
    daily_calorie_goal: number | null;
    protein_goal_g: number | null;
    daily_water_goal_ml: number | null;
    weight_goal_kg: number | null;
  };
}) {
  const supabase = createClient();
  const router = useRouter();
  const [aplicando, setAplicando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const kcal = prescricao.daily_calorie_goal;
  const rotulo =
    kcal == null ? "Reaplicar metas" : `Reaplicar ${kcal.toLocaleString("pt-BR")} kcal`;

  async function reaplicar() {
    setAplicando(true);
    setErro(null);
    const { data, error } = await supabase.rpc("set_patient_goals", {
      p_patient: pacienteId,
      p_calories: prescricao.daily_calorie_goal,
      p_protein: prescricao.protein_goal_g,
      p_water: prescricao.daily_water_goal_ml,
      p_weight: prescricao.weight_goal_kg,
      p_notes: null,
    });
    setAplicando(false);
    const res = data as { ok?: boolean; error?: string } | null;
    if (error || res?.ok === false) {
      setErro(res?.error ?? "Não foi possível reaplicar as metas.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={reaplicar}
        disabled={aplicando}
        className="btn-primary min-h-[44px] px-4"
      >
        {aplicando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {rotulo}
      </button>
      <ErroInline mensagem={erro} className="" />
    </div>
  );
}
