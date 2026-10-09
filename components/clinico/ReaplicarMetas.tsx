"use client";

import { useId, useState } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ErroInline } from "./ErroInline";
import { useRecarregar } from "./useRecarregar";

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
//
// A baixa vale para TODOS os avisos abertos, os do plano de treino também.
// `observacao` (de quem chama, que sabe se há aviso de treino aberto) diz
// isso embaixo do botão, antes do clique. Fica sobre `atencao-fundo` da fila,
// em `atencao-texto-2`: par com contraste testado ali (lib/temaClinico.ts).
export function ReaplicarMetas({
  pacienteId,
  prescricao,
  observacao,
}: {
  pacienteId: string;
  prescricao: {
    daily_calorie_goal: number | null;
    protein_goal_g: number | null;
    daily_water_goal_ml: number | null;
    weight_goal_kg: number | null;
  };
  observacao?: string;
}) {
  const supabase = createClient();
  const [aplicando, setAplicando] = useState(false);
  const [recarregando, recarregar] = useRecarregar();
  const [erro, setErro] = useState<string | null>(null);
  const idObservacao = useId();
  // Da RPC até a página nova (em que o aviso já teve baixa e o botão some),
  // desligado: um segundo clique gravaria outra prescrição igual.
  const ocupado = aplicando || recarregando;

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
    const res = data as { ok?: boolean; error?: string } | null;
    if (error || res?.ok === false) {
      setAplicando(false);
      setErro(res?.error ?? "Não foi possível reaplicar as metas.");
      return;
    }
    // A transição começa antes de soltar o `aplicando`: o botão passa de um
    // para o outro sem acender no meio.
    recarregar();
    setAplicando(false);
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={reaplicar}
          disabled={ocupado}
          aria-describedby={observacao ? idObservacao : undefined}
          className="btn-primary min-h-[44px] px-4"
        >
          {ocupado ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : null}
          {ocupado ? "Reaplicando…" : rotulo}
        </button>
        <ErroInline mensagem={erro} className="" />
      </div>
      {observacao && (
        <p id={idObservacao} className="text-[13px] leading-snug text-clin-atencao-texto-2">
          {observacao}
        </p>
      )}
    </div>
  );
}
