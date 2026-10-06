"use client";

import { useCallback, useEffect, useState } from "react";
import { BookmarkPlus, Loader2, Trash2, Check, LayoutTemplate } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export type Modelo = {
  id: string;
  kind: string;
  name: string;
  notes: string | null;
  content: any;
  created_at: string;
};

// Barra de modelos do nutricionista: salvar o que está montado como modelo e
// aplicar um modelo salvo. Serve cardápio e treino — a forma do `content`
// muda, mas o fluxo é o mesmo, então o componente é agnóstico e quem usa
// decide como capturar e como aplicar.
export default function TemplateBar({
  kind,
  nutriId,
  capturarAtual,
  aplicar,
  rotulo,
}: {
  kind: "cardapio" | "treino";
  nutriId: string;
  /** Devolve o conteúdo atual para salvar, ou null se não há o que salvar. */
  capturarAtual: () => any[] | null;
  /** Recebe o conteúdo de um modelo e grava para o paciente. */
  aplicar: (content: any[]) => Promise<void>;
  rotulo: string;
}) {
  const supabase = createClient();
  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [aplicando, setAplicando] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [abrindoForm, setAbrindoForm] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const { data } = await supabase
      .from("nutri_templates")
      .select("id, kind, name, notes, content, created_at")
      .eq("kind", kind)
      .order("created_at", { ascending: false });
    setModelos((data ?? []) as Modelo[]);
    setCarregando(false);
  }, [supabase, kind]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function salvarModelo() {
    const conteudo = capturarAtual();
    if (!conteudo || conteudo.length === 0) {
      setErro(`Monte o ${rotulo} antes de salvar como modelo.`);
      return;
    }
    if (!nome.trim()) {
      setErro("Dê um nome ao modelo.");
      return;
    }
    setSalvando(true);
    setErro(null);
    const { error } = await supabase.from("nutri_templates").insert({
      nutritionist_id: nutriId,
      kind,
      name: nome.trim(),
      content: conteudo,
    });
    setSalvando(false);
    if (error) {
      setErro("Não foi possível salvar o modelo.");
      return;
    }
    setNome("");
    setAbrindoForm(false);
    setOk(true);
    setTimeout(() => setOk(false), 2200);
    carregar();
  }

  async function aplicarModelo(m: Modelo) {
    if (
      !confirm(
        `Aplicar "${m.name}" a este paciente? O que já existe é mantido; os itens do modelo são adicionados.`
      )
    )
      return;
    setAplicando(m.id);
    setErro(null);
    try {
      await aplicar(Array.isArray(m.content) ? m.content : []);
    } catch {
      setErro("Não foi possível aplicar o modelo.");
    }
    setAplicando(null);
  }

  async function excluir(id: string) {
    if (!confirm("Excluir este modelo? Os pacientes que já o receberam não são afetados."))
      return;
    await supabase.from("nutri_templates").delete().eq("id", id);
    carregar();
  }

  return (
    <div className="card mb-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="section-title text-sm">
          <span className="icon-badge">
            <LayoutTemplate className="h-4 w-4" />
          </span>
          Meus modelos
        </h3>
        {!abrindoForm && (
          <button
            onClick={() => {
              setErro(null);
              setAbrindoForm(true);
            }}
            className="tappable rounded-lg px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10"
          >
            {ok ? (
              <>
                <Check className="mr-1 inline h-3.5 w-3.5" /> salvo
              </>
            ) : (
              <>
                <BookmarkPlus className="mr-1 inline h-3.5 w-3.5" /> Salvar
                atual
              </>
            )}
          </button>
        )}
      </div>

      {abrindoForm && (
        <div className="mb-3 flex gap-2">
          <input
            className="input"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder={`Nome do modelo (ex.: ${
              kind === "cardapio" ? "Low carb 1600 kcal" : "Hipertrofia ABC"
            })`}
          />
          <button
            onClick={salvarModelo}
            disabled={salvando}
            className="btn-primary shrink-0 px-3 py-2 text-sm"
          >
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Salvar
          </button>
          <button
            onClick={() => setAbrindoForm(false)}
            className="btn-ghost shrink-0 px-3 py-2 text-sm"
          >
            Cancelar
          </button>
        </div>
      )}

      {erro && (
        <p className="mb-2 text-xs text-rose-600 dark:text-rose-400">{erro}</p>
      )}

      {carregando ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">Carregando…</p>
      ) : modelos.length === 0 ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Nenhum modelo ainda. Monte o {rotulo} de um paciente e toque em
          “Salvar atual” — depois você aplica em qualquer outro com um clique.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {modelos.map((m) => (
            <div
              key={m.id}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white pl-3 pr-1 dark:border-slate-700 dark:bg-slate-900"
            >
              <button
                onClick={() => aplicarModelo(m)}
                disabled={aplicando === m.id}
                className="tappable py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-60 dark:text-slate-200"
              >
                {aplicando === m.id ? (
                  <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
                ) : null}
                {m.name}
              </button>
              <button
                onClick={() => excluir(m.id)}
                className="tappable rounded-full p-1 text-slate-400 hover:text-rose-600"
                aria-label={`Excluir modelo ${m.name}`}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
