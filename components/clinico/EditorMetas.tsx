"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { CampoMeta } from "@/lib/nutri";
import { Field } from "@/components/ui";
import { useEdicao } from "./Edicao";
import { useGravacaoNaSecao } from "./Editavel";
import { ErroInline } from "./ErroInline";
import { useRecarregar } from "./useRecarregar";

// Formulário de metas, movido da antiga aba Prescrição com a mesma chamada ao
// banco: set_patient_goals grava a prescrição e as quatro metas do
// perfil numa transação só. Muda o que cerca a chamada: o erro fica num estado
// local, embaixo do formulário, e salvar fecha a edição DEPOIS que a leitura
// volta com os valores novos (router.refresh()). Fechando antes, a tabela, o
// "ela está usando 2.200 kcal" e o alerta da fila continuavam velhos por uns
// segundos, sem nada dizer que estava salvando, e o nutricionista aplicava de
// novo achando que tinha falhado.
//
// `metas` é o que o formulário mostra ao abrir, e quem chama manda a ÚLTIMA
// PRESCRIÇÃO, a mesma "Meta" da tabela. Abrir com o perfil fazia a tabela
// dizer 1.800 e o formulário 2.200 quando o paciente tinha mudado a meta, e
// salvar só a água adotava calado as calorias dele (a função grava as quatro
// juntas e dá baixa no aviso). `usando` traz, por campo com aviso aberto, a
// frase do que o paciente está usando, para a escolha ser à vista.
export function EditorMetas({
  pacienteId,
  metas,
  usando = {},
}: {
  pacienteId: string;
  metas: {
    daily_calorie_goal: number | null;
    protein_goal_g: number | null;
    daily_water_goal_ml: number | null;
    weight_goal_kg: number | null;
  };
  usando?: Partial<Record<CampoMeta, string>>;
}) {
  const supabase = createClient();
  const { fechar, marcarSuja } = useEdicao("metas");
  const gravacao = useGravacaoNaSecao();
  const [recarregando, recarregar] = useRecarregar();
  const [aplicou, setAplicou] = useState(false);
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

  // Fecha quando a página nova chega. `aplicou` só fica verdadeiro no
  // handler, depois de a RPC dar certo, então este efeito não fecha nada na
  // montagem nem na dupla montagem do StrictMode. O handler chama recarregar()
  // ANTES de setAplicou(true): o `recarregando` da transição entra com
  // prioridade maior e chega à tela antes (ou junto) do `aplicou`, e o efeito
  // só vê `!recarregando` quando a página nova já está lá. Não mexe na marca
  // de alteração (marcarSuja e marcarLimpa ficam só em handlers): fechar()
  // zera a seção inteira.
  useEffect(() => {
    if (aplicou && !recarregando) fechar();
  }, [aplicou, recarregando, fechar]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    const { data, error } = await gravacao(() =>
      supabase.rpc("set_patient_goals", {
        p_patient: pacienteId,
        p_calories: kcal ? Number(kcal) : null,
        p_protein: prot ? Number(prot) : null,
        p_water: agua ? Number(agua) : null,
        p_weight: peso ? Number(peso) : null,
        p_notes: obs.trim() || null,
      })
    );
    setSalvando(false);
    const res = data as { ok?: boolean; error?: string } | null;
    if (error || res?.ok === false) {
      setErro(res?.error ?? "Não foi possível salvar as metas.");
      return;
    }
    recarregar();
    setAplicou(true);
  }

  // Da RPC até a página nova: botões desligados e "Aplicando…". Um segundo
  // clique aqui gravaria outra prescrição. `aplicou` cobre o `recarregando`
  // e mais o instante entre ele acabar e o formulário fechar, em que os
  // botões voltariam a acender por um quadro.
  const ocupado = salvando || recarregando || aplicou;

  return (
    <form onSubmit={salvar} className="card">
      <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
        O que você definir aqui passa a valer no app do paciente — anéis do dia,
        Score de Saúde e contexto da Gaia.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Calorias/dia">
          <input type="number" aria-label="Calorias/dia" className="input" value={kcal} onChange={(e) => { setKcal(e.target.value); alterou(); }} placeholder="1800" />
          <Usando texto={usando.daily_calorie_goal} />
        </Field>
        <Field label="Proteína/dia (g)">
          <input type="number" aria-label="Proteína/dia (g)" className="input" value={prot} onChange={(e) => { setProt(e.target.value); alterou(); }} placeholder="110" />
          <Usando texto={usando.protein_goal_g} />
        </Field>
        <Field label="Água/dia (ml)">
          <input type="number" aria-label="Água/dia (ml)" className="input" value={agua} onChange={(e) => { setAgua(e.target.value); alterou(); }} placeholder="2500" />
          <Usando texto={usando.daily_water_goal_ml} />
        </Field>
        <Field label="Peso alvo (kg)">
          <input type="number" step="0.1" aria-label="Peso alvo (kg)" className="input" value={peso} onChange={(e) => { setPeso(e.target.value); alterou(); }} placeholder="62" />
          <Usando texto={usando.weight_goal_kg} />
        </Field>
      </div>
      <Field label="Observação da prescrição (opcional)">
        <input aria-label="Observação da prescrição (opcional)" className="input" value={obs} onChange={(e) => { setObs(e.target.value); alterou(); }} placeholder="Ex.: ajuste após retorno de 30 dias" />
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Fica no histórico da prescrição. O paciente não vê.
        </p>
      </Field>
      <div className="mt-2 flex gap-2">
        <button type="submit" disabled={ocupado} className="btn-primary min-h-[44px] flex-1 py-2.5">
          {ocupado ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : null}
          {ocupado ? "Aplicando…" : "Aplicar metas"}
        </button>
        <button type="button" onClick={fechar} disabled={ocupado} className="btn-ghost min-h-[44px] px-4 py-2.5">
          Cancelar
        </button>
      </div>
      <ErroInline mensagem={erro} />
    </form>
  );
}

// O que o paciente está usando no lugar da meta, embaixo do campo. `texto`
// sobre `atencao-fundo` é um par com contraste testado (lib/temaClinico.ts).
function Usando({ texto }: { texto?: string }) {
  if (!texto) return null;
  return (
    <p className="mt-1 inline-block rounded bg-clin-atencao-fundo px-1.5 text-[13px] leading-snug text-clin-texto">
      {texto}
    </p>
  );
}
