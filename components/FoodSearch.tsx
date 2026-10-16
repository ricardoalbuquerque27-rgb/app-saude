"use client";

import { useEffect, useRef, useState } from "react";
import { Search, Loader2, Plus, X } from "lucide-react";

export type AlimentoApi = {
  id: number;
  nome: string;
  categoria: string;
  kcal100: number;
  prot100: number;
  carb100: number;
  gord100: number;
};

export type AlimentoEscolhido = {
  nome: string;
  gramas: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

// As cores dependem de onde o componente aparece. O paciente (Dieta) usa a
// paleta do app. O editor de cardápio do nutricionista é o tema clínico, que
// "não muda na tela": como as classes `app-*` são variáveis globais, trocar
// `slate-*` por elas aqui mudaria o tom do clínico (o `texto-2` do app é um
// cinza mais escuro que o slate-500, e a caixa do alimento escolhido perderia o
// verde). Por isso o clínico pede `tema="clinico"` e recebe as classes de antes,
// letra por letra. `.input` e `.btn-primary` ficam iguais nos dois: o
// :where(.tema-clinico) de globals.css já as refaz lá dentro.
type Tema = "app" | "clinico";

const CLASSES: Record<
  Tema,
  {
    icone: string;
    lista: string;
    item: string;
    nome: string;
    categoria: string;
    kcal: string;
    vazio: string;
    escolhido: string;
    escolhidoNome: string;
    trocar: string;
    rotulo: string;
    macros: string;
  }
> = {
  app: {
    icone: "text-app-texto-2",
    lista:
      "absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-app-campo bg-app-cartao",
    item: "flex min-h-[44px] w-full items-start justify-between gap-2 px-3 py-2 text-left transition hover:bg-app-primaria-fundo",
    nome: "block truncate text-sm text-app-texto",
    categoria: "block truncate text-[13px] text-app-texto-2",
    kcal: "tabular shrink-0 text-[13px] font-semibold text-app-texto-2",
    vazio: "mt-1 text-[13px] text-app-texto-2",
    escolhido: "rounded-xl bg-app-primaria-fundo p-3",
    escolhidoNome: "min-w-0 text-sm font-medium text-app-texto",
    // 44 px de toque; as margens negativas devolvem o que o botão acrescenta
    // à caixa, que seguia com a altura de uma linha.
    trocar:
      "tappable -mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-app-texto-2 hover:text-app-perigo",
    rotulo: "mb-1 block text-[13px] font-medium text-app-texto-2",
    macros: "mt-2 text-[13px] text-app-texto-2",
  },
  clinico: {
    icone: "text-slate-500",
    lista:
      "absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900",
    item: "flex w-full items-start justify-between gap-2 px-3 py-2 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800",
    nome: "block truncate text-sm text-slate-800 dark:text-slate-200",
    categoria: "block truncate text-[11px] text-slate-500 dark:text-slate-400",
    kcal: "shrink-0 text-[11px] font-semibold text-slate-500 dark:text-slate-400",
    vazio: "mt-1 text-xs text-slate-500 dark:text-slate-400",
    escolhido:
      "rounded-xl border border-brand-200 bg-brand-50/60 p-3 dark:border-brand-800/50 dark:bg-brand-500/[0.07]",
    escolhidoNome: "min-w-0 text-sm font-medium text-slate-800 dark:text-slate-200",
    trocar: "tappable shrink-0 rounded-lg p-1 text-slate-500 hover:text-rose-600",
    rotulo: "mb-1 block text-[11px] font-medium text-slate-600 dark:text-slate-400",
    macros: "mt-2 text-[11px] text-slate-600 dark:text-slate-300",
  },
};

// Busca na TACO com porção em gramas. Serve tanto o nutricionista montando o
// cardápio quanto o paciente registrando uma refeição — por isso devolve o
// item escolhido por callback em vez de gravar nada.
export default function FoodSearch({
  onEscolher,
  placeholder = "Buscar alimento (ex.: arroz integral)",
  tema = "app",
}: {
  onEscolher: (a: AlimentoEscolhido) => void;
  placeholder?: string;
  /** `clinico` dentro do `.tema-clinico` (editor de cardápio); o resto é `app`. */
  tema?: Tema;
}) {
  const c = CLASSES[tema];
  const [termo, setTermo] = useState("");
  const [itens, setItens] = useState<AlimentoApi[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [sel, setSel] = useState<AlimentoApi | null>(null);
  const [gramas, setGramas] = useState("100");
  const abortRef = useRef<AbortController | null>(null);

  // Debounce: evita uma requisição por tecla.
  useEffect(() => {
    if (sel) return;
    const t = termo.trim();
    if (t.length < 2) {
      setItens([]);
      return;
    }
    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setBuscando(true);
      try {
        const r = await fetch(`/api/alimentos?q=${encodeURIComponent(t)}`, {
          signal: ctrl.signal,
        });
        const j = await r.json();
        setItens(j.itens ?? []);
        setAberto(true);
      } catch {
        /* abortado ou offline — silencioso de propósito */
      } finally {
        setBuscando(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [termo, sel]);

  const g = Number(gramas) || 0;
  const macros = sel
    ? {
        calories: Math.round((sel.kcal100 * g) / 100),
        protein_g: Math.round((sel.prot100 * g) / 10) / 10,
        carbs_g: Math.round((sel.carb100 * g) / 10) / 10,
        fat_g: Math.round((sel.gord100 * g) / 10) / 10,
      }
    : null;

  function limpar() {
    setSel(null);
    setTermo("");
    setItens([]);
    setGramas("100");
  }

  function confirmar() {
    if (!sel || !macros || g <= 0) return;
    onEscolher({ nome: `${sel.nome} (${g} g)`, gramas: g, ...macros });
    limpar();
  }

  return (
    <div className="relative">
      {!sel ? (
        <>
          <div className="relative">
            <Search className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${c.icone}`} />
            <input
              className="input pl-9"
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              onFocus={() => itens.length && setAberto(true)}
              placeholder={placeholder}
            />
            {buscando && (
              <Loader2 className={`absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin ${c.icone}`} />
            )}
          </div>

          {aberto && itens.length > 0 && (
            <ul className={c.lista}>
              {itens.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSel(a);
                      setAberto(false);
                    }}
                    className={c.item}
                  >
                    <span className="min-w-0">
                      <span className={c.nome}>
                        {a.nome}
                      </span>
                      <span className={c.categoria}>
                        {a.categoria}
                      </span>
                    </span>
                    <span className={c.kcal}>
                      {Math.round(a.kcal100)} kcal/100g
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {termo.trim().length >= 2 && !buscando && itens.length === 0 && (
            <p className={c.vazio}>
              Nada encontrado na tabela. Você pode escrever à mão.
            </p>
          )}
        </>
      ) : (
        <div className={c.escolhido}>
          <div className="flex items-start justify-between gap-2">
            <p className={c.escolhidoNome}>
              {sel.nome}
            </p>
            <button
              type="button"
              onClick={limpar}
              className={c.trocar}
              aria-label="Trocar alimento"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-2 flex items-end gap-2">
            <label className="flex-1">
              <span className={c.rotulo}>
                Quantidade (g)
              </span>
              <input
                type="number"
                min={1}
                className="input"
                value={gramas}
                onChange={(e) => setGramas(e.target.value)}
              />
            </label>
            <button
              type="button"
              onClick={confirmar}
              disabled={g <= 0}
              className="btn-primary px-3 py-2.5 text-sm disabled:opacity-60"
            >
              <Plus className="h-4 w-4" /> Usar
            </button>
          </div>

          {macros && g > 0 && (
            <p className={c.macros}>
              {macros.calories} kcal · {macros.protein_g} g proteína ·{" "}
              {macros.carbs_g} g carbo · {macros.fat_g} g gordura
            </p>
          )}
        </div>
      )}
    </div>
  );
}
