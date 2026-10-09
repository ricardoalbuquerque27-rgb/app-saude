"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Field } from "@/components/ui";
import { useEdicao } from "./Edicao";
import { ErroInline } from "./ErroInline";

// Formulário de metas, movido da antiga aba Prescrição com a mesma chamada ao
// banco: set_patient_goals grava a prescrição e as quatro metas do
// perfil numa transação só. Muda o que cerca a chamada: o erro fica num estado
// local, embaixo do formulário, e salvar fecha a edição (a leitura volta com
// os valores novos pelo router.refresh()).
export function EditorMetas({
  pacienteId,
  metas,
}: {
  pacienteId: string;
  metas: {
    daily_calorie_goal: number | null;
    protein_goal_g: number | null;
    daily_water_goal_ml: number | null;
    weight_goal_kg: number | null;
  };
}) {
  const supabase = createClient();
  const router = useRouter();
  const { fechar, marcarSuja } = useEdicao("metas");
  const [kcal, setKcal] = useState(metas.daily_calorie_goal?.toString() ?? "");
  const [prot, setProt] = useState(metas.protein_goal_g?.toString() ?? "");
  const [agua, setAgua] = useState(metas.daily_water_goal_ml?.toString() ?? "");
  const [peso, setPeso] = useState(metas.weight_goal_kg?.toString() ?? "");
  const [obs, setObs] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Só a primeira alteração avisa que há algo a perder. Vem do onChange, e não
  // de um useEffect: o efeito rodaria também na montagem (e duas vezes no
  // StrictMode), sujando um formulário que ninguém tocou. A ref evita mandar a
  // mesma ação a cada tecla, que re-renderizaria a página inteira.
  const sujou = useRef(false);
  function alterou() {
    if (sujou.current) return;
    sujou.current = true;
    marcarSuja();
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    const { data, error } = await supabase.rpc("set_patient_goals", {
      p_patient: pacienteId,
      p_calories: kcal ? Number(kcal) : null,
      p_protein: prot ? Number(prot) : null,
      p_water: agua ? Number(agua) : null,
      p_weight: peso ? Number(peso) : null,
      p_notes: obs.trim() || null,
    });
    setSalvando(false);
    const res = data as { ok?: boolean; error?: string } | null;
    if (error || res?.ok === false) {
      setErro(res?.error ?? "Não foi possível salvar as metas.");
      return;
    }
    fechar();
    router.refresh();
  }

  return (
    <form onSubmit={salvar} className="card">
      <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
        O que você definir aqui passa a valer no app do paciente — anéis do dia,
        Score de Saúde e contexto da Gaia.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Calorias/dia">
          <input type="number" className="input" value={kcal} onChange={(e) => { setKcal(e.target.value); alterou(); }} placeholder="1800" />
        </Field>
        <Field label="Proteína/dia (g)">
          <input type="number" className="input" value={prot} onChange={(e) => { setProt(e.target.value); alterou(); }} placeholder="110" />
        </Field>
        <Field label="Água/dia (ml)">
          <input type="number" className="input" value={agua} onChange={(e) => { setAgua(e.target.value); alterou(); }} placeholder="2500" />
        </Field>
        <Field label="Peso alvo (kg)">
          <input type="number" step="0.1" className="input" value={peso} onChange={(e) => { setPeso(e.target.value); alterou(); }} placeholder="62" />
        </Field>
      </div>
      <Field label="Observação da prescrição (opcional)">
        <input className="input" value={obs} onChange={(e) => { setObs(e.target.value); alterou(); }} placeholder="Ex.: ajuste após retorno de 30 dias" />
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Fica no histórico da prescrição. O paciente não vê.
        </p>
      </Field>
      <div className="mt-2 flex gap-2">
        <button type="submit" disabled={salvando} className="btn-primary min-h-[44px] flex-1 py-2.5">
          {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Aplicar metas
        </button>
        <button type="button" onClick={fechar} disabled={salvando} className="btn-ghost min-h-[44px] px-4 py-2.5">
          Cancelar
        </button>
      </div>
      <ErroInline mensagem={erro} />
    </form>
  );
}
