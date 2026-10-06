"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Utensils,
  Plus,
  Trash2,
  Loader2,
  Check,
  Flame,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import FoodSearch from "@/components/FoodSearch";
import TemplateBar from "@/components/TemplateBar";

export const MEAL_TYPES = [
  "Café da manhã",
  "Lanche da manhã",
  "Almoço",
  "Lanche da tarde",
  "Jantar",
  "Ceia",
];

export type PlanoAlimentar = {
  id: string;
  name: string;
  notes: string | null;
  created_at: string;
};

export type ItemCardapio = {
  id: string;
  meal_plan_id: string;
  meal_type: string;
  position: number;
  description: string;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
};

// Editor do cardápio, para o nutricionista. Modelo "um dia padrão": cada
// refeição pode ter várias OPÇÕES, que é como o cardápio costuma ser
// entregue aqui ("Café — Opção 1 / Opção 2"), em vez de uma grade semanal.
export default function MealPlanEditor({
  patientId,
  nutriId,
  plano,
  itens,
  metaCalorias,
  metaProteina,
}: {
  patientId: string;
  nutriId: string;
  plano: PlanoAlimentar | null;
  itens: ItemCardapio[];
  metaCalorias: number | null;
  metaProteina: number | null;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [nome, setNome] = useState(plano?.name ?? "Plano alimentar");
  const [obs, setObs] = useState(plano?.notes ?? "");

  // Formulário de nova opção, por refeição
  const [abertoEm, setAbertoEm] = useState<string | null>(null);
  const [desc, setDesc] = useState("");
  const [kcal, setKcal] = useState("");
  const [prot, setProt] = useState("");

  // Soma do cardápio considerando só a PRIMEIRA opção de cada refeição —
  // somar todas as alternativas daria um total que ninguém vai comer.
  const principais = MEAL_TYPES.map((t) =>
    itens
      .filter((i) => i.meal_type === t)
      .sort((a, b) => a.position - b.position)[0]
  ).filter(Boolean) as ItemCardapio[];
  const totalKcal = principais.reduce((s, i) => s + (Number(i.calories) || 0), 0);
  const totalProt = principais.reduce((s, i) => s + (Number(i.protein_g) || 0), 0);

  async function garantirPlano(): Promise<string | null> {
    if (plano) return plano.id;
    const { data, error } = await supabase
      .from("meal_plans")
      .insert({
        patient_id: patientId,
        nutritionist_id: nutriId,
        name: nome.trim() || "Plano alimentar",
        notes: obs.trim() || null,
      })
      .select("id")
      .single();
    if (error || !data) {
      setErro("Não foi possível criar o plano.");
      return null;
    }
    return (data as any).id;
  }

  async function salvarCabecalho() {
    setBusy("cabecalho");
    setErro(null);
    if (!plano) {
      await garantirPlano();
    } else {
      const { error } = await supabase
        .from("meal_plans")
        .update({
          name: nome.trim() || "Plano alimentar",
          notes: obs.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", plano.id);
      if (error) setErro("Não foi possível salvar.");
    }
    setBusy(null);
    router.refresh();
  }

  async function addOpcao(tipo: string) {
    const texto = desc.trim();
    if (!texto) return;
    setBusy(tipo);
    setErro(null);

    const planId = await garantirPlano();
    if (!planId) {
      setBusy(null);
      return;
    }

    const proxima =
      Math.max(
        0,
        ...itens.filter((i) => i.meal_type === tipo).map((i) => i.position)
      ) + 1;

    const { error } = await supabase.from("meal_plan_items").insert({
      meal_plan_id: planId,
      user_id: patientId,
      meal_type: tipo,
      position: proxima,
      description: texto,
      calories: kcal ? Number(kcal) : null,
      protein_g: prot ? Number(prot) : null,
    });

    setBusy(null);
    if (error) {
      setErro("Não foi possível adicionar a opção.");
      return;
    }
    setDesc("");
    setKcal("");
    setProt("");
    setAbertoEm(null);
    router.refresh();
  }

  async function removerItem(id: string) {
    setBusy(id);
    const { error } = await supabase.from("meal_plan_items").delete().eq("id", id);
    setBusy(null);
    if (error) setErro("Não foi possível remover.");
    else router.refresh();
  }

  // Modelo = a lista de itens do cardápio, sem ids nem vínculo a paciente.
  function capturarModelo() {
    if (itens.length === 0) return null;
    return itens
      .sort((a, b) => a.position - b.position)
      .map((i) => ({
        meal_type: i.meal_type,
        position: i.position,
        description: i.description,
        calories: i.calories,
        protein_g: i.protein_g,
        carbs_g: i.carbs_g,
        fat_g: i.fat_g,
      }));
  }

  async function aplicarModelo(conteudo: any[]) {
    const planId = await garantirPlano();
    if (!planId) throw new Error("sem plano");

    // Continua depois do que já existe, por refeição, para aplicar um modelo
    // não apagar o que o profissional já tinha escrito.
    const base: Record<string, number> = {};
    for (const i of itens) {
      base[i.meal_type] = Math.max(base[i.meal_type] ?? 0, i.position);
    }
    const contador: Record<string, number> = { ...base };

    const linhas = conteudo
      .filter((c) => c?.meal_type && c?.description)
      .map((c) => {
        contador[c.meal_type] = (contador[c.meal_type] ?? 0) + 1;
        return {
          meal_plan_id: planId,
          user_id: patientId,
          meal_type: c.meal_type,
          position: contador[c.meal_type],
          description: String(c.description),
          calories: c.calories ?? null,
          protein_g: c.protein_g ?? null,
          carbs_g: c.carbs_g ?? null,
          fat_g: c.fat_g ?? null,
        };
      });

    if (linhas.length === 0) return;
    const { error } = await supabase.from("meal_plan_items").insert(linhas);
    if (error) throw error;
    router.refresh();
  }

  function abrir(tipo: string) {
    setDesc("");
    setKcal("");
    setProt("");
    setAbertoEm(tipo);
  }

  return (
    <>
      {erro && (
        <p className="card mb-4 border-rose-200 bg-rose-50 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
          {erro}
        </p>
      )}

      <TemplateBar
        kind="cardapio"
        nutriId={nutriId}
        capturarAtual={capturarModelo}
        aplicar={aplicarModelo}
        rotulo="cardápio"
      />

      <div className="card mb-4">
        <h2 className="section-title mb-3">
          <span className="icon-badge">
            <Utensils className="h-4 w-4" />
          </span>
          Cardápio prescrito
        </h2>

        <div className="grid gap-2 sm:grid-cols-2">
          <input
            className="input"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome do plano (ex.: Plano de outubro)"
          />
          <input
            className="input"
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            placeholder="Orientação geral (opcional)"
          />
        </div>
        <button
          onClick={salvarCabecalho}
          disabled={busy === "cabecalho"}
          className="btn-ghost mt-2 w-full py-2 text-sm"
        >
          {busy === "cabecalho" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          {plano ? "Salvar nome e orientação" : "Criar plano"}
        </button>

        {principais.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
              <Flame className="h-3 w-3" />
              {Math.round(totalKcal)} kcal no cardápio
              {metaCalorias ? ` · meta ${metaCalorias}` : ""}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-800 dark:bg-rose-500/15 dark:text-rose-300">
              {Math.round(totalProt)} g de proteína
              {metaProteina ? ` · meta ${metaProteina}` : ""}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Soma considera a 1ª opção de cada refeição.
            </span>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {MEAL_TYPES.map((tipo) => {
          const opcoes = itens
            .filter((i) => i.meal_type === tipo)
            .sort((a, b) => a.position - b.position);

          return (
            <div key={tipo} className="card">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="font-semibold text-slate-900 dark:text-white">
                  {tipo}
                </h3>
                {abertoEm !== tipo && (
                  <button
                    onClick={() => abrir(tipo)}
                    className="tappable rounded-lg px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10"
                  >
                    <Plus className="mr-1 inline h-3.5 w-3.5" />
                    {opcoes.length === 0 ? "Adicionar" : "Outra opção"}
                  </button>
                )}
              </div>

              {opcoes.length === 0 && abertoEm !== tipo && (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Nada prescrito para esta refeição.
                </p>
              )}

              {opcoes.length > 0 && (
                <ul className="space-y-2">
                  {opcoes.map((o, i) => (
                    <li
                      key={o.id}
                      className="rounded-xl border border-slate-200/80 bg-white p-2.5 dark:border-white/[0.07] dark:bg-slate-900/60"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          {opcoes.length > 1 && (
                            <p className="eyebrow mb-0.5">Opção {i + 1}</p>
                          )}
                          <p className="whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-200">
                            {o.description}
                          </p>
                          {(o.calories || o.protein_g) && (
                            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                              {[
                                o.calories ? `${Math.round(Number(o.calories))} kcal` : null,
                                o.protein_g ? `${Math.round(Number(o.protein_g))} g proteína` : null,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => removerItem(o.id)}
                          disabled={busy === o.id}
                          className="tappable shrink-0 rounded-lg p-1.5 text-slate-400 hover:text-rose-600"
                          aria-label="Remover opção"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {abertoEm === tipo && (
                <div className="mt-2 rounded-xl border border-brand-200 bg-brand-50/50 p-3 dark:border-brand-800/50 dark:bg-brand-500/[0.07]">
                  <p className="eyebrow mb-1.5">Buscar na tabela TACO</p>
                  <FoodSearch
                    onEscolher={(a) => {
                      // Acumula no texto e soma os macros: uma refeição é
                      // feita de vários alimentos.
                      setDesc((d) => (d ? d + "\n+ " + a.nome : a.nome));
                      setKcal((k) => String((Number(k) || 0) + a.calories));
                      setProt((p) =>
                        String(
                          Math.round(((Number(p) || 0) + a.protein_g) * 10) / 10
                        )
                      );
                    }}
                  />
                  <p className="mb-1.5 mt-3 text-[11px] text-slate-500 dark:text-slate-400">
                    Ou escreva à mão:
                  </p>
                  <textarea
                    className="input min-h-[70px] resize-y"
                    value={desc}
                    onChange={(e) => setDesc(e.target.value)}
                    placeholder="Ex.: 2 ovos mexidos + 1 fatia de pão integral + café sem açúcar"
                    maxLength={2000}
                  />
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      className="input"
                      value={kcal}
                      onChange={(e) => setKcal(e.target.value)}
                      placeholder="kcal (opcional)"
                    />
                    <input
                      type="number"
                      className="input"
                      value={prot}
                      onChange={(e) => setProt(e.target.value)}
                      placeholder="proteína g (opcional)"
                    />
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => addOpcao(tipo)}
                      disabled={busy === tipo || !desc.trim()}
                      className="btn-primary flex-1 py-2 text-sm"
                    >
                      {busy === tipo ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                      Adicionar
                    </button>
                    <button
                      onClick={() => setAbertoEm(null)}
                      className="btn-ghost px-3 py-2 text-sm"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
