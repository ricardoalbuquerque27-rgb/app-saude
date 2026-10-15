"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Trash2,
  Loader2,
  Camera,
  Sparkles,
  Upload,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Meal } from "@/lib/types";
import { Modal, Field } from "@/components/ui";
import { ProgressRing } from "@/components/ProgressRing";
import { todayISO, avancarDia } from "@/lib/date";
import { useLiveRefresh } from "@/lib/useLiveRefresh";
import FoodSearch from "@/components/FoodSearch";
import MealPlanView, {
  type ItemCardapioPaciente,
} from "@/components/MealPlanView";
import { MEAL_TYPES, sugestaoDeProteina, textoDaSugestao } from "@/lib/cardapio";
import { rotuloDoDia } from "@/lib/consultas";
import { papelDasCalorias, pesoMaisRecente } from "@/lib/nutri";

// A Dieta do paciente (spec do visual do app do paciente, "Dieta (paciente)"):
// o cabeçalho com a navegação de dia, o resumo (anéis, macros e a sugestão de
// proteína), o plano alimentar num cartão só e as refeições registradas.
//
// Toda leitura guarda o `error`. O supabase-js devolve `{ data: null, error }`
// sem lançar, e `data ?? []` faria da falha um dia sem refeição: os anéis
// diriam "0" de quem comeu, e o papel das calorias ou a sugestão de proteína
// sairiam de dados que não chegaram. Sem o dado, a tela diz que não carregou.

type Plano = { nome: string; obs: string | null; itens: ItemCardapioPaciente[] };

/** As refeições de UM dia. `date` diz de qual: a resposta de um dia que já não é o da tela não vale. */
type DiaLido = { date: string; meals: Meal[]; falhou: boolean };

/** `cardapio` nulo sem `falhou` é "sem plano"; com `falhou`, é "não carregou". */
type PlanoLido = { cardapio: Plano | null; falhou: boolean };

/** O que não muda de um dia para o outro: metas, peso, vínculo e nome do nutri. */
type Contexto = {
  calorieGoal: number | null;
  proteinGoal: number | null;
  metaDePeso: number | null;
  /** Sem o perfil não se sabe se há meta: o resumo diz que não carregou. */
  perfilFalhou: boolean;
  /** Nulo também quando a leitura do peso falhou: sem peso, sem papel. */
  pesoAtual: number | null;
  vinculoAtivo: boolean;
  /** Sem saber do vínculo, a sugestão (que só vale com nutricionista) não aparece. */
  vinculoFalhou: boolean;
  /** Primeiro nome; vazio quando não há nutricionista ou a leitura falhou. */
  nutriNome: string;
};

const kcal = (n: number) => Math.round(n).toLocaleString("pt-BR");

export default function DietaPage() {
  const supabase = createClient();
  const [date, setDate] = useState(todayISO());
  const [dia, setDia] = useState<DiaLido | null>(null);
  const [plano, setPlano] = useState<PlanoLido | null>(null);
  const [contexto, setContexto] = useState<Contexto | null>(null);
  const [open, setOpen] = useState(false);
  const params = useSearchParams();
  const [saving, setSaving] = useState(false);

  const [mealType, setMealType] = useState(MEAL_TYPES[0]);
  const [description, setDescription] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const dataRef = useRef<HTMLInputElement>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [analyzeNote, setAnalyzeNote] = useState<string | null>(null);

  // Quem pediu por último vale: ir de hoje a ontem e voltar depressa deixava a
  // resposta lenta de ontem sobrescrever a de hoje.
  const pedido = useRef(0);

  const load = useCallback(async () => {
    const meu = ++pedido.current;
    const dataPedida = date;
    const [mealsRes, planoRes] = await Promise.all([
      supabase
        .from("meals")
        .select("*")
        .eq("date", dataPedida)
        .order("created_at", { ascending: true }),
      // Cardápio prescrito pelo nutricionista (se houver). A RLS já garante
      // que só vem o do próprio paciente.
      supabase
        .from("meal_plans")
        .select("id, name, notes")
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    let lido: PlanoLido;
    if (planoRes.error) {
      lido = { cardapio: null, falhou: true };
    } else if (!planoRes.data) {
      lido = { cardapio: null, falhou: false };
    } else {
      const { data: itens, error } = await supabase
        .from("meal_plan_items")
        .select("id, meal_type, position, description, calories, protein_g, carbs_g, fat_g")
        .eq("meal_plan_id", (planoRes.data as any).id)
        .order("position", { ascending: true });
      lido = error
        ? { cardapio: null, falhou: true }
        : {
            cardapio: {
              nome: (planoRes.data as any).name,
              obs: (planoRes.data as any).notes,
              itens: (itens ?? []) as ItemCardapioPaciente[],
            },
            falhou: false,
          };
    }

    if (meu !== pedido.current) return;
    setDia({ date: dataPedida, meals: (mealsRes.data ?? []) as Meal[], falhou: !!mealsRes.error });
    setPlano(lido);
  }, [supabase, date]);

  useEffect(() => {
    load();
  }, [load]);

  // O que a tela lê uma vez, e não a cada dia: as metas, o peso mais recente
  // (que decide se a meta de calorias é teto ou piso) e o vínculo. Cada leitura
  // com o filtro que a RLS não dá: `profiles` sem `.eq("id")` devolve duas
  // linhas para quem tem nutricionista (o dele também é visível) e o
  // `maybeSingle` falha, justo para o caso de uso principal (ver lib/perfil.ts).
  const carregarContexto = useCallback(async () => {
    const hoje = todayISO();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setContexto({
        calorieGoal: null,
        proteinGoal: null,
        metaDePeso: null,
        perfilFalhou: true,
        pesoAtual: null,
        vinculoAtivo: false,
        vinculoFalhou: true,
        nutriNome: "",
      });
      return;
    }
    const [perfilRes, pesoRes, vinculoRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("daily_calorie_goal, protein_goal_g, weight_goal_kg")
        .eq("id", user.id)
        .maybeSingle(),
      // O mais recente até hoje, sem janela. 10 linhas bastam para o dia
      // inteiro (a pesagem de casa e a da consulta); o teto em hoje é do
      // `pesoMaisRecente`, que também o filtra na leitura.
      supabase
        .from("body_measurements")
        .select("date, weight_kg, measured_by, created_at")
        .eq("user_id", user.id)
        .not("weight_kg", "is", null)
        .lte("date", hoje)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("patient_links")
        .select("nutritionist_id")
        .eq("patient_id", user.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle(),
    ]);

    const perfil = perfilRes.data as any;
    const nutriId = (vinculoRes.data as any)?.nutritionist_id as string | undefined;
    const nutriRes = nutriId
      ? await supabase.from("profiles").select("full_name").eq("id", nutriId).maybeSingle()
      : null;
    const nomeCompleto = String((nutriRes?.data as any)?.full_name ?? "").trim();

    setContexto({
      calorieGoal: perfil?.daily_calorie_goal ?? null,
      proteinGoal: perfil?.protein_goal_g ?? null,
      metaDePeso: perfil?.weight_goal_kg != null ? Number(perfil.weight_goal_kg) : null,
      perfilFalhou: !!perfilRes.error,
      pesoAtual: pesoRes.error ? null : pesoMaisRecente((pesoRes.data ?? []) as any, hoje),
      vinculoAtivo: !vinculoRes.error && !!nutriId,
      vinculoFalhou: !!vinculoRes.error,
      nutriNome: nomeCompleto.split(/\s+/)[0] ?? "",
    });
  }, [supabase]);

  useEffect(() => {
    carregarContexto();
  }, [carregarContexto]);

  // Recarrega quando a IA registra uma refeição (ou muda uma meta ou o peso).
  useLiveRefresh("dieta", load);
  useLiveRefresh("dieta", carregarContexto);

  // Os atalhos da Início ("Refeição" e "Foto do prato") apontavam os dois
  // para /app/dieta sem parâmetro: caíam na página com o formulário
  // FECHADO, e o da foto nem abria a câmera. O chip prometia uma coisa e
  // entregava outra. Agora cada um diz para onde vai.
  const atalhoJaAberto = useRef(false);
  useEffect(() => {
    if (atalhoJaAberto.current) return;
    const quer = params.get("novo") === "1";
    const querFoto = params.get("foto") === "1";
    if (!quer && !querFoto) return;
    atalhoJaAberto.current = true;
    setOpen(true);
    // A câmera só pode ser aberta depois que o modal montou o input.
    if (querFoto) setTimeout(() => cameraInputRef.current?.click(), 250);
  }, [params]);

  const todayStr = todayISO();
  const isToday = date === todayStr;

  // Só as refeições do dia da tela: durante a troca de dia `dia` ainda é o
  // anterior, e a conta (anéis, sugestão) partiria dele.
  const carregando = !dia || dia.date !== date || !contexto;
  const meals = dia && dia.date === date ? dia.meals : [];

  // O plano chega depois do primeiro desenho. O link da Início aponta para
  // #plano, e o navegador só rola até um id que já existe; sem isto o link
  // chegava no topo da página. Uma vez só: depois de "Comi isso" a página
  // recarrega e não pode puxar a pessoa de volta.
  const planoNaTela = !carregando && !!plano?.cardapio && plano.cardapio.itens.length > 0;
  const jaRolouAoPlano = useRef(false);
  useEffect(() => {
    if (jaRolouAoPlano.current || !planoNaTela) return;
    if (window.location.hash !== "#plano") return;
    jaRolouAoPlano.current = true;
    document.getElementById("plano")?.scrollIntoView();
  }, [planoNaTela]);

  function shiftDate(days: number) {
    // Era new Date(...).toISOString().slice(0,10): toISOString converte
    // para UTC, e a leste de Greenwich a meia-noite local cai no dia
    // ANTERIOR — a seta andava errado. avancarDia tem teste e também
    // segura o limite de hoje, caso o botão desabilitado escape.
    setDate(avancarDia(date, days, todayStr));
  }

  // O rótulo abre o seletor nativo do input de data, que fica no DOM sem a
  // cara de campo. showPicker lança sem gesto do usuário e não existe em
  // navegador antigo; nos dois casos o foco e o clique no input fazem o mesmo.
  function abrirSeletor() {
    const campo = dataRef.current;
    if (!campo) return;
    try {
      campo.showPicker();
    } catch {
      campo.focus();
      campo.click();
    }
  }

  const totals = meals.reduce(
    (acc, m) => ({
      calories: acc.calories + (Number(m.calories) || 0),
      protein: acc.protein + (Number(m.protein_g) || 0),
      carbs: acc.carbs + (Number(m.carbs_g) || 0),
      fat: acc.fat + (Number(m.fat_g) || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  // Distribuição de macros (por calorias: P/C 4, G 9)
  const pCal = totals.protein * 4;
  const cCal = totals.carbs * 4;
  const fCal = totals.fat * 9;
  const semMacros = pCal + cCal + fCal === 0;

  // Sem as refeições do dia ou sem o perfil (as metas), os anéis mostrariam
  // zeros e o "Definir metas" para quem já definiu: o resumo diz que não carregou.
  const resumoFalhou = !!dia?.falhou || !!contexto?.perfilFalhou;
  const calorieGoal = contexto?.calorieGoal ?? null;
  const proteinGoal = contexto?.proteinGoal ?? null;
  // A meta de calorias é teto para quem está acima do peso-alvo e piso para
  // quem está abaixo. Sem o peso (ou com a leitura dele falhando), sem papel.
  const papel = contexto ? papelDasCalorias(contexto.pesoAtual, contexto.metaDePeso) : null;

  // A sugestão vale só em hoje, e só com tudo o que a conta lê: as refeições, o
  // perfil (a meta), o plano e o vínculo. Faltando qualquer um, o zero que é
  // falha viraria "Faltam 110 g" a quem já comeu, ou uma sugestão sem
  // nutricionista.
  const sugestao =
    isToday && !carregando && !resumoFalhou && contexto && !contexto.vinculoFalhou && plano?.cardapio && !plano.falhou
      ? sugestaoDeProteina({
          meta: proteinGoal == null ? null : Number(proteinGoal),
          consumido: totals.protein,
          itens: plano.cardapio.itens.map((i) => ({
            meal_type: i.meal_type,
            position: Number(i.position) || 0,
            description: i.description,
            protein_g: i.protein_g == null ? null : Number(i.protein_g),
          })),
          tiposRegistrados: meals.map((m) => m.meal_type),
          vinculoAtivo: contexto.vinculoAtivo,
        })
      : null;

  function resetForm() {
    setMealType(MEAL_TYPES[0]);
    setDescription("");
    setCalories("");
    setProtein("");
    setCarbs("");
    setFat("");
    setAnalyzeError(null);
    setAnalyzeNote(null);
  }

  // Redimensiona a foto no navegador antes de enviar (mais rápido e barato).
  function resizeImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const maxSide = 1024;
          let { width, height } = img;
          if (width > maxSide || height > maxSide) {
            const scale = maxSide / Math.max(width, height);
            width = Math.round(width * scale);
            height = Math.round(height * scale);
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) return reject(new Error("canvas"));
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.8));
        };
        img.onerror = () => reject(new Error("img"));
        img.src = reader.result as string;
      };
      reader.onerror = () => reject(new Error("read"));
      reader.readAsDataURL(file);
    });
  }

  async function analyzePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite reenviar a mesma foto
    if (!file) return;
    setAnalyzing(true);
    setAnalyzeError(null);
    setAnalyzeNote(null);
    try {
      const image = await resizeImage(file);
      const res = await fetch("/api/analyze-meal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAnalyzeError(data?.error ?? "Falha ao analisar a foto.");
        return;
      }
      if (data.description) setDescription(data.description);
      if (data.calories != null) setCalories(String(data.calories));
      if (data.protein_g != null) setProtein(String(data.protein_g));
      if (data.carbs_g != null) setCarbs(String(data.carbs_g));
      if (data.fat_g != null) setFat(String(data.fat_g));
      const conf =
        data.confidence === "baixa"
          ? " (confiança baixa — confira os valores)"
          : "";
      setAnalyzeNote("Preenchido pela IA — revise antes de salvar." + conf);
    } catch {
      setAnalyzeError("Não foi possível processar a imagem. Tente outra foto.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) return;
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("meals").insert({
      user_id: user.id,
      date,
      meal_type: mealType,
      description: description.trim(),
      calories: calories ? Number(calories) : null,
      protein_g: protein ? Number(protein) : null,
      carbs_g: carbs ? Number(carbs) : null,
      fat_g: fat ? Number(fat) : null,
    });
    setSaving(false);
    setOpen(false);
    resetForm();
    await load();
  }

  async function remove(id: string) {
    await supabase.from("meals").delete().eq("id", id);
    await load();
  }

  return (
    <div>
      <header className="mb-6 flex flex-col gap-3">
        <h1 className="text-2xl font-semibold text-app-texto">Dieta</h1>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Navegação de dia. As setas e o rótulo têm 44 px de toque. */}
          <div className="flex items-center gap-2 sm:w-[22rem]">
            <button
              onClick={() => shiftDate(-1)}
              className="btn-ghost h-11 w-11 shrink-0 px-0"
              aria-label="Dia anterior"
            >
              <ChevronLeft aria-hidden="true" className="h-5 w-5" />
            </button>
            <div className="relative min-w-0 flex-1">
              <button
                type="button"
                onClick={abrirSeletor}
                title="Escolher outra data"
                className="tappable flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[10px] px-2 text-[15px] font-semibold text-app-texto hover:bg-app-primaria-fundo"
              >
                <CalendarDays aria-hidden="true" className="h-4 w-4 shrink-0 text-app-texto-2" />
                {rotuloDoDia(date, todayStr)}
              </button>
              {/* O campo de data segue no DOM, escondido da vista mas
                  focável: é ele que o showPicker() abre. `max` em hoje, e uma
                  data futura digitada ou o campo limpo não mudam o dia. */}
              <input
                ref={dataRef}
                type="date"
                aria-label="Escolher a data"
                className="sr-only"
                value={date}
                max={todayStr}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) return;
                  setDate(v > todayStr ? todayStr : v);
                }}
              />
            </div>
            <button
              onClick={() => shiftDate(1)}
              disabled={isToday}
              className="btn-ghost h-11 w-11 shrink-0 px-0"
              aria-label="Próximo dia"
            >
              <ChevronRight aria-hidden="true" className="h-5 w-5" />
            </button>
            {!isToday && (
              <button
                onClick={() => setDate(todayStr)}
                className="chip min-h-[44px] shrink-0 px-4 text-[13px]"
              >
                Hoje
              </button>
            )}
          </div>
          <button
            onClick={() => setOpen(true)}
            className="btn-primary min-h-[48px] w-full text-[15px] sm:w-auto sm:px-5"
          >
            Registrar refeição
          </button>
        </div>
      </header>

      {carregando ? (
        <div role="status" className="flex justify-center py-16 text-app-texto-2">
          <Loader2 aria-hidden="true" className="h-6 w-6 animate-spin" />
          <span className="sr-only">Carregando…</span>
        </div>
      ) : (
        <>
          {/* Resumo do dia — antes do cardápio: com cardápio prescrito, o
              resumo ficava abaixo de todas as refeições do plano, e o "como
              está o meu dia" era a última coisa que o paciente via. */}
          <section aria-labelledby="resumo-do-dia" className="mb-6">
            <h2 id="resumo-do-dia" className="section-title">
              Resumo do dia
            </h2>
            {resumoFalhou ? (
              <p className="card mt-2.5 px-4 py-3.5 text-[15px] text-app-atencao">
                Não deu para carregar os números deste dia.
              </p>
            ) : (
              <div className="card mt-2.5 overflow-hidden p-0">
                <div className="grid grid-cols-2 gap-1.5 px-2.5 py-4">
                  <ProgressRing
                    pct={calorieGoal ? totals.calories / calorieGoal : 0}
                    centerMain={kcal(totals.calories)}
                    centerSub={calorieGoal ? `/ ${kcal(calorieGoal)}` : "kcal"}
                    label="Calorias"
                    papel={papel}
                    avisoAcima={papel === "limite"}
                  />
                  <ProgressRing
                    pct={proteinGoal ? totals.protein / proteinGoal : 0}
                    centerMain={`${Math.round(totals.protein)}`}
                    centerSub={proteinGoal ? `/ ${proteinGoal} g` : "g"}
                    label="Proteína"
                  />
                </div>

                {/* Distribuição de macros: três segmentos com 2 px entre eles,
                    nos tons da principal. A barra é redundante (a legenda dá
                    nome e gramas), então fica fora do leitor de tela. */}
                <div className="px-4 pb-4">
                  <div
                    aria-hidden="true"
                    className={`flex h-2.5 gap-0.5 overflow-hidden rounded-full ${semMacros ? "bg-app-linha" : ""}`}
                  >
                    <div className="bg-app-macro-proteina" style={{ flexGrow: pCal, flexBasis: 0 }} />
                    <div className="bg-app-macro-carbo" style={{ flexGrow: cCal, flexBasis: 0 }} />
                    <div className="bg-app-macro-gordura" style={{ flexGrow: fCal, flexBasis: 0 }} />
                  </div>
                  <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-app-texto-2">
                    <li>
                      Proteína{" "}
                      <span className="tabular font-semibold text-app-texto">{Math.round(totals.protein)} g</span>
                    </li>
                    <li>
                      Carbo{" "}
                      <span className="tabular font-semibold text-app-texto">{Math.round(totals.carbs)} g</span>
                    </li>
                    <li>
                      Gordura{" "}
                      <span className="tabular font-semibold text-app-texto">{Math.round(totals.fat)} g</span>
                    </li>
                  </ul>
                </div>

                {/* Sem link: o plano está logo abaixo. */}
                {sugestao && (
                  <p className="border-t border-app-linha px-4 py-3.5 text-[15px] text-app-texto">
                    {textoDaSugestao(sugestao)}
                  </p>
                )}
                {(!calorieGoal || !proteinGoal) && (
                  <div className="border-t border-app-linha px-4 py-1.5">
                    {/* 44 px de alvo; a linha continua do tamanho do texto. */}
                    <Link
                      href="/app/perfil"
                      className="inline-flex min-h-[44px] items-center text-[15px] font-semibold text-app-primaria hover:underline"
                    >
                      Definir metas
                    </Link>
                  </div>
                )}
              </div>
            )}
          </section>

          {plano?.falhou ? (
            <p className="card mb-6 px-4 py-3.5 text-[15px] text-app-atencao">
              Não deu para carregar o plano alimentar.
            </p>
          ) : (
            plano?.cardapio && (
              <MealPlanView
                nome={plano.cardapio.nome}
                observacao={plano.cardapio.obs}
                itens={plano.cardapio.itens}
                date={date}
                jaRegistrados={meals.map((m) => m.meal_type)}
                registradas={meals.map((m) => ({ meal_type: m.meal_type, description: m.description }))}
                onRegistrado={load}
                nutriNome={contexto?.nutriNome || undefined}
                linkPlano
              />
            )
          )}

          <section aria-labelledby="refeicoes-registradas" className="mb-6">
            <h2 id="refeicoes-registradas" className="section-title">
              Refeições registradas
            </h2>
            {dia?.falhou ? (
              <p className="card mt-2.5 px-4 py-3.5 text-[15px] text-app-atencao">
                Não deu para carregar as refeições.
              </p>
            ) : meals.length === 0 ? (
              <div className="mt-1 flex flex-wrap items-center gap-x-3">
                <p className="text-[15px] text-app-texto-2">Nenhuma refeição neste dia.</p>
                <button
                  type="button"
                  onClick={() => setOpen(true)}
                  className="tappable inline-flex min-h-[44px] items-center text-[15px] font-semibold text-app-primaria hover:underline"
                >
                  Registrar refeição
                </button>
              </div>
            ) : (
              <ul className="card mt-2.5 divide-y divide-app-linha overflow-hidden p-0">
                {meals.map((m) => (
                  <li key={m.id} className="flex items-start gap-2 py-2 pl-4 pr-1">
                    <div className="min-w-0 flex-1 py-1">
                      <p className="text-[15px] font-semibold text-app-texto">{m.meal_type}</p>
                      <p className="mt-0.5 text-[15px] text-app-texto">{m.description}</p>
                      <p className="tabular mt-1 flex flex-wrap gap-x-3 text-[13px] text-app-texto-2">
                        {m.calories != null && <span>{kcal(Number(m.calories))} kcal</span>}
                        {m.protein_g != null && <span>{Math.round(Number(m.protein_g))} g prot</span>}
                        {m.carbs_g != null && <span>{Math.round(Number(m.carbs_g))} g carbo</span>}
                        {m.fat_g != null && <span>{Math.round(Number(m.fat_g))} g gord</span>}
                      </p>
                    </div>
                    <button
                      onClick={() => remove(m.id)}
                      aria-label={`Excluir ${m.meal_type}`}
                      className="tappable flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-app-texto-2 hover:text-app-perigo"
                    >
                      <Trash2 aria-hidden="true" className="h-5 w-5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          resetForm();
        }}
        title="Nova refeição"
      >
        <form onSubmit={save} className="space-y-4">
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={analyzePhoto}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={analyzePhoto}
          />
          <div className="rounded-xl border border-dashed border-app-campo p-3">
            <p className="mb-2 flex items-center gap-1.5 text-[13px] font-medium text-app-texto-2">
              <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
              Analisar foto do prato com IA
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                disabled={analyzing}
                className="btn-primary py-2.5"
              >
                {analyzing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
                Tirar foto
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={analyzing}
                className="btn-ghost py-2.5"
              >
                <Upload className="h-4 w-4" />
                Enviar arquivo
              </button>
            </div>
            <p className="mt-2 text-[13px] text-app-texto-2">
              {analyzing
                ? "Analisando foto…"
                : "Tire uma foto ou escolha uma imagem da galeria — a IA estima calorias e macros."}
            </p>
            {analyzeNote && (
              <p className="mt-2 rounded-lg bg-app-primaria-fundo px-3 py-2 text-[13px] text-app-primaria">
                {analyzeNote}
              </p>
            )}
            {analyzeError && (
              <p className="mt-2 rounded-lg bg-app-perigo-fundo px-3 py-2 text-[13px] text-app-perigo">
                {analyzeError}
              </p>
            )}
          </div>

          <Field label="Tipo de refeição">
            <select
              className="input"
              value={mealType}
              onChange={(e) => setMealType(e.target.value)}
            >
              {MEAL_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Buscar alimento">
            <FoodSearch
              onEscolher={(a) => {
                // Soma ao que já está no formulário: uma refeição é feita de
                // vários alimentos.
                setDescription((d) => (d ? d + ", " + a.nome : a.nome));
                setCalories((c) => String((Number(c) || 0) + a.calories));
                setProtein((v) =>
                  String(Math.round(((Number(v) || 0) + a.protein_g) * 10) / 10)
                );
                setCarbs((v) =>
                  String(Math.round(((Number(v) || 0) + a.carbs_g) * 10) / 10)
                );
                setFat((v) =>
                  String(Math.round(((Number(v) || 0) + a.fat_g) * 10) / 10)
                );
              }}
            />
            <p className="mt-1 text-[13px] text-app-texto-2">
              Tabela TACO (Unicamp). Os macros abaixo preenchem sozinhos.
            </p>
          </Field>

          <Field label="Descrição">
            <textarea
              className="input min-h-[70px]"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex.: 2 ovos, 50g de aveia, 1 banana"
              required
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Calorias (kcal)">
              <input
                type="number"
                className="input"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
                placeholder="350"
              />
            </Field>
            <Field label="Proteína (g)">
              <input
                type="number"
                step="0.1"
                className="input"
                value={protein}
                onChange={(e) => setProtein(e.target.value)}
                placeholder="25"
              />
            </Field>
            <Field label="Carboidrato (g)">
              <input
                type="number"
                step="0.1"
                className="input"
                value={carbs}
                onChange={(e) => setCarbs(e.target.value)}
                placeholder="40"
              />
            </Field>
            <Field label="Gordura (g)">
              <input
                type="number"
                step="0.1"
                className="input"
                value={fat}
                onChange={(e) => setFat(e.target.value)}
                placeholder="10"
              />
            </Field>
          </div>
          <button type="submit" disabled={saving} className="btn-primary w-full py-2.5">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar refeição
          </button>
        </form>
      </Modal>
    </div>
  );
}
