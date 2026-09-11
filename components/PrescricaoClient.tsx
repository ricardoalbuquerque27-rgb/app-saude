"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Target,
  Loader2,
  Check,
  Plus,
  Trash2,
  MessageSquare,
  Dumbbell,
  Send,
  Lock,
  Eye,
  X,
  CalendarPlus,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Field } from "@/components/ui";
import { formatDate } from "@/lib/date";

const DIAS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
const ESPORTES = [
  "Musculação",
  "Corrida",
  "Ciclismo",
  "Natação",
  "Crossfit",
  "Funcional",
  "HIIT",
  "Yoga",
  "Pilates",
  "Caminhada",
];

export type ExercicioRotina = {
  id: string;
  routine_id: string;
  name: string;
  target_sets: number | null;
  target_reps: number | null;
  target_weight_kg: number | null;
  rest_seconds: number | null;
  position: number | null;
};

export type Rotina = {
  id: string;
  name: string;
  notes: string | null;
  prescribed_by: string | null;
};

export type PlanoItem = {
  id: string;
  day_of_week: number;
  sport: string;
  title: string | null;
  routine_id: string | null;
  prescribed_by: string | null;
};

export type Mensagem = {
  id: string;
  body: string;
  created_at: string;
  read_at: string | null;
  author_id: string;
  visibility: string;
};

type Aba = "metas" | "treino" | "conversa" | "notas";

type LinhaExercicio = {
  nome: string;
  series: string;
  reps: string;
  carga: string;
  descanso: string;
};

const LINHA_VAZIA: LinhaExercicio = {
  nome: "",
  series: "3",
  reps: "12",
  carga: "",
  descanso: "60",
};

export default function PrescricaoClient({
  patientId,
  nutriId,
  metas,
  rotinas,
  exercicios,
  plano,
  mensagens,
  notasPrivadas,
}: {
  patientId: string;
  nutriId: string;
  metas: {
    daily_calorie_goal: number | null;
    protein_goal_g: number | null;
    daily_water_goal_ml: number | null;
    weight_goal_kg: number | null;
  };
  rotinas: Rotina[];
  exercicios: ExercicioRotina[];
  plano: PlanoItem[];
  mensagens: Mensagem[];
  notasPrivadas: Mensagem[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const [aba, setAba] = useState<Aba>("metas");
  const [erro, setErro] = useState<string | null>(null);

  const naoLidas = mensagens.filter(
    (m) => m.author_id !== nutriId && !m.read_at
  ).length;

  const abas: { key: Aba; label: string; badge?: number }[] = [
    { key: "metas", label: "Metas" },
    { key: "treino", label: "Treino" },
    { key: "conversa", label: "Conversa", badge: naoLidas },
    { key: "notas", label: "Notas privadas" },
  ];

  return (
    <>
      {erro && (
        <p className="card mb-4 border-rose-200 bg-rose-50 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
          {erro}
        </p>
      )}

      <div className="mb-4 flex gap-1 overflow-x-auto pb-1">
        {abas.map((a) => (
          <button
            key={a.key}
            onClick={() => setAba(a.key)}
            className={`tappable shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium ${
              aba === a.key
                ? "bg-brand-600 text-white"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
          >
            {a.label}
            {a.badge ? (
              <span className="ml-1.5 rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">
                {a.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {aba === "metas" && (
        <AbaMetas
          patientId={patientId}
          metas={metas}
          setErro={setErro}
          supabase={supabase}
          router={router}
        />
      )}
      {aba === "treino" && (
        <AbaTreino
          patientId={patientId}
          nutriId={nutriId}
          rotinas={rotinas}
          exercicios={exercicios}
          plano={plano}
          setErro={setErro}
          supabase={supabase}
          router={router}
        />
      )}
      {aba === "conversa" && (
        <AbaConversa
          patientId={patientId}
          nutriId={nutriId}
          mensagens={mensagens}
          setErro={setErro}
          supabase={supabase}
          router={router}
        />
      )}
      {aba === "notas" && (
        <AbaNotas
          patientId={patientId}
          nutriId={nutriId}
          notas={notasPrivadas}
          setErro={setErro}
          supabase={supabase}
          router={router}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Metas
// ---------------------------------------------------------------------------

function AbaMetas({ patientId, metas, setErro, supabase, router }: any) {
  const [kcal, setKcal] = useState(metas.daily_calorie_goal?.toString() ?? "");
  const [prot, setProt] = useState(metas.protein_goal_g?.toString() ?? "");
  const [agua, setAgua] = useState(metas.daily_water_goal_ml?.toString() ?? "");
  const [peso, setPeso] = useState(metas.weight_goal_kg?.toString() ?? "");
  const [obs, setObs] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [ok, setOk] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    setOk(false);
    const { data, error } = await supabase.rpc("set_patient_goals", {
      p_patient: patientId,
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
    setObs("");
    setOk(true);
    setTimeout(() => setOk(false), 2500);
    router.refresh();
  }

  return (
    <form onSubmit={salvar} className="card">
      <h2 className="section-title mb-3">
        <span className="icon-badge">
          <Target className="h-4 w-4" />
        </span>
        Metas do paciente
      </h2>
      <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
        O que você definir aqui passa a valer no app do paciente — anéis do dia,
        Score de Saúde e contexto da Gaia.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Calorias/dia">
          <input type="number" className="input" value={kcal} onChange={(e) => setKcal(e.target.value)} placeholder="1800" />
        </Field>
        <Field label="Proteína/dia (g)">
          <input type="number" className="input" value={prot} onChange={(e) => setProt(e.target.value)} placeholder="110" />
        </Field>
        <Field label="Água/dia (ml)">
          <input type="number" className="input" value={agua} onChange={(e) => setAgua(e.target.value)} placeholder="2500" />
        </Field>
        <Field label="Peso alvo (kg)">
          <input type="number" step="0.1" className="input" value={peso} onChange={(e) => setPeso(e.target.value)} placeholder="62" />
        </Field>
      </div>
      <Field label="Observação da prescrição (opcional)">
        <input className="input" value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: ajuste após retorno de 30 dias" />
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Fica no histórico da prescrição. O paciente não vê.
        </p>
      </Field>
      <button type="submit" disabled={salvando} className="btn-primary mt-2 w-full py-2.5">
        {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : ok ? <Check className="h-4 w-4" /> : null}
        {ok ? "Metas aplicadas!" : "Aplicar metas"}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Treino — rotinas com exercícios + encaixe nos dias
// ---------------------------------------------------------------------------

function AbaTreino({
  patientId,
  nutriId,
  rotinas,
  exercicios,
  plano,
  setErro,
  supabase,
  router,
}: any) {
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState("");
  const [obsRotina, setObsRotina] = useState("");
  const [linhas, setLinhas] = useState<LinhaExercicio[]>([{ ...LINHA_VAZIA }]);
  const [salvando, setSalvando] = useState(false);

  const [dia, setDia] = useState(0);
  const [rotinaId, setRotinaId] = useState("");
  const [esporte, setEsporte] = useState(ESPORTES[0]);
  const [encaixando, setEncaixando] = useState(false);

  function setLinha(i: number, campo: keyof LinhaExercicio, valor: string) {
    setLinhas((prev) =>
      prev.map((l, k) => (k === i ? { ...l, [campo]: valor } : l))
    );
  }

  async function salvarRotina() {
    const validos = linhas.filter((l) => l.nome.trim());
    if (!nome.trim() || validos.length === 0) {
      setErro("Dê um nome à rotina e adicione ao menos um exercício.");
      return;
    }
    setSalvando(true);
    setErro(null);

    const { data: r, error: e1 } = await supabase
      .from("routines")
      .insert({
        user_id: patientId,
        name: nome.trim(),
        notes: obsRotina.trim() || null,
        prescribed_by: nutriId,
      })
      .select("id")
      .single();

    if (e1 || !r) {
      setSalvando(false);
      setErro("Não foi possível criar a rotina.");
      return;
    }

    const { error: e2 } = await supabase.from("routine_exercises").insert(
      validos.map((l, i) => ({
        routine_id: (r as any).id,
        user_id: patientId,
        name: l.nome.trim(),
        target_sets: l.series ? Number(l.series) : null,
        target_reps: l.reps ? Number(l.reps) : null,
        target_weight_kg: l.carga ? Number(l.carga) : null,
        rest_seconds: l.descanso ? Number(l.descanso) : null,
        position: i + 1,
      }))
    );

    setSalvando(false);
    if (e2) {
      setErro("A rotina foi criada, mas os exercícios falharam. Tente editar.");
      return;
    }
    setNome("");
    setObsRotina("");
    setLinhas([{ ...LINHA_VAZIA }]);
    setCriando(false);
    router.refresh();
  }

  async function excluirRotina(id: string) {
    if (!confirm("Excluir esta rotina do paciente? Os exercícios vão junto."))
      return;
    const { error } = await supabase.from("routines").delete().eq("id", id);
    if (error) setErro("Não foi possível excluir a rotina.");
    else router.refresh();
  }

  async function encaixarNoDia() {
    setEncaixando(true);
    setErro(null);
    const rot = rotinas.find((r: Rotina) => r.id === rotinaId);
    const { error } = await supabase.from("workout_plan").insert({
      user_id: patientId,
      day_of_week: dia,
      sport: esporte,
      title: rot?.name ?? null,
      routine_id: rotinaId || null,
      prescribed_by: nutriId,
    });
    setEncaixando(false);
    if (error) setErro("Não foi possível encaixar no plano.");
    else router.refresh();
  }

  async function removerDoDia(id: string) {
    const { error } = await supabase.from("workout_plan").delete().eq("id", id);
    if (error) setErro("Não foi possível remover do plano.");
    else router.refresh();
  }

  return (
    <>
      {/* ---- Rotinas com exercícios ---- */}
      <div className="card mb-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="section-title">
            <span className="icon-badge">
              <Dumbbell className="h-4 w-4" />
            </span>
            Rotinas
          </h2>
          {!criando && (
            <button onClick={() => setCriando(true)} className="btn-ghost px-3 py-1.5 text-xs">
              <Plus className="h-3.5 w-3.5" /> Nova rotina
            </button>
          )}
        </div>

        {criando && (
          <div className="mb-4 rounded-xl border border-brand-200 bg-brand-50/50 p-3 dark:border-brand-800/50 dark:bg-brand-500/[0.07]">
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                className="input"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Nome da rotina (ex.: Treino A — Superiores)"
              />
              <input
                className="input"
                value={obsRotina}
                onChange={(e) => setObsRotina(e.target.value)}
                placeholder="Observação (opcional)"
              />
            </div>

            <p className="eyebrow mb-2 mt-3">Exercícios</p>
            <div className="space-y-2">
              {linhas.map((l, i) => (
                <div key={i} className="rounded-lg border border-slate-200 bg-white p-2 dark:border-white/[0.07] dark:bg-slate-900/70">
                  <div className="flex gap-2">
                    <input
                      className="input flex-1"
                      value={l.nome}
                      onChange={(e) => setLinha(i, "nome", e.target.value)}
                      placeholder="Exercício"
                    />
                    {linhas.length > 1 && (
                      <button
                        onClick={() => setLinhas((p) => p.filter((_, k) => k !== i))}
                        className="tappable rounded-lg px-2 text-slate-400 hover:text-rose-600"
                        aria-label="Remover exercício"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <div className="mt-2 grid grid-cols-4 gap-1.5">
                    {([
                      ["series", "Séries"],
                      ["reps", "Reps"],
                      ["carga", "Carga kg"],
                      ["descanso", "Desc. s"],
                    ] as [keyof LinhaExercicio, string][]).map(([campo, rotulo]) => (
                      <div key={campo}>
                        <label className="mb-0.5 block text-[10px] font-medium text-slate-500 dark:text-slate-400">
                          {rotulo}
                        </label>
                        <input
                          type="number"
                          className="input px-2 py-1.5 text-sm"
                          value={l[campo]}
                          onChange={(e) => setLinha(i, campo, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setLinhas((p) => [...p, { ...LINHA_VAZIA }])}
              className="btn-ghost mt-2 w-full py-1.5 text-xs"
            >
              <Plus className="h-3.5 w-3.5" /> Adicionar exercício
            </button>

            <div className="mt-3 flex gap-2">
              <button onClick={salvarRotina} disabled={salvando} className="btn-primary flex-1 py-2 text-sm">
                {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
                Salvar rotina
              </button>
              <button onClick={() => setCriando(false)} className="btn-ghost px-4 py-2 text-sm">
                Cancelar
              </button>
            </div>
          </div>
        )}

        {rotinas.length === 0 && !criando ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Nenhuma rotina ainda. Crie uma com os exercícios, séries e cargas.
          </p>
        ) : (
          <ul className="space-y-2">
            {rotinas.map((r: Rotina) => {
              const exs = exercicios
                .filter((e: ExercicioRotina) => e.routine_id === r.id)
                .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0));
              return (
                <li key={r.id} className="rounded-xl border border-slate-200/80 p-3 dark:border-white/[0.07]">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 dark:text-white">{r.name}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {r.prescribed_by ? "prescrita por você" : "criada pelo paciente"}
                        {r.notes ? ` · ${r.notes}` : ""}
                      </p>
                    </div>
                    <button
                      onClick={() => excluirRotina(r.id)}
                      className="tappable rounded-lg p-1.5 text-slate-400 hover:text-rose-600"
                      aria-label="Excluir rotina"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  {exs.length > 0 && (
                    <ul className="mt-2 space-y-0.5">
                      {exs.map((e: ExercicioRotina) => (
                        <li key={e.id} className="flex justify-between gap-2 text-xs text-slate-600 dark:text-slate-300">
                          <span className="truncate">{e.name}</span>
                          <span className="shrink-0 font-mono text-slate-500 dark:text-slate-400">
                            {[
                              e.target_sets && e.target_reps ? `${e.target_sets}×${e.target_reps}` : null,
                              e.target_weight_kg ? `${e.target_weight_kg}kg` : null,
                              e.rest_seconds ? `${e.rest_seconds}s` : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ---- Encaixe na semana ---- */}
      <div className="card">
        <h2 className="section-title mb-3">
          <span className="icon-badge">
            <CalendarPlus className="h-4 w-4" />
          </span>
          Semana do paciente
        </h2>

        {plano.length === 0 ? (
          <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
            Nenhuma sessão na semana ainda.
          </p>
        ) : (
          <ul className="mb-3 divide-y divide-slate-100 dark:divide-slate-800">
            {plano.map((p: PlanoItem) => (
              <li key={p.id} className="flex items-center gap-3 py-2">
                <span className="w-12 shrink-0 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                  {DIAS[p.day_of_week]?.slice(0, 3)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                    {p.title || p.sport}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {p.sport}
                    {p.routine_id ? " · com exercícios" : " · sem rotina ligada"}
                    {p.prescribed_by ? " · sua" : " · do paciente"}
                  </p>
                </div>
                <button
                  onClick={() => removerDoDia(p.id)}
                  className="tappable rounded-lg p-1.5 text-slate-400 hover:text-rose-600"
                  aria-label="Remover do plano"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="rounded-xl border border-dashed border-slate-300 p-3 dark:border-slate-700">
          <p className="eyebrow mb-2">Encaixar num dia</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <select className="input" value={dia} onChange={(e) => setDia(Number(e.target.value))}>
              {DIAS.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
            <select className="input" value={rotinaId} onChange={(e) => setRotinaId(e.target.value)}>
              <option value="">Sem rotina</option>
              {rotinas.map((r: Rotina) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <select className="input" value={esporte} onChange={(e) => setEsporte(e.target.value)}>
              {ESPORTES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <button onClick={encaixarNoDia} disabled={encaixando} className="btn-ghost mt-2 w-full py-2 text-sm">
            {encaixando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Encaixar no plano
          </button>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Com uma rotina ligada, o paciente vê o botão “Iniciar treino” e faz a
            sessão série por série.
          </p>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Conversa (mão dupla)
// ---------------------------------------------------------------------------

function AbaConversa({ patientId, nutriId, mensagens, setErro, supabase, router }: any) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const body = texto.trim();
    if (!body) return;
    setEnviando(true);
    setErro(null);
    const { error } = await supabase.from("patient_notes").insert({
      nutritionist_id: nutriId,
      patient_id: patientId,
      author_id: nutriId,
      body,
      visibility: "shared",
    });
    setEnviando(false);
    if (error) {
      setErro("Não foi possível enviar a mensagem.");
      return;
    }
    // Marca como lidas as respostas do paciente que estavam pendentes.
    await supabase
      .from("patient_notes")
      .update({ read_at: new Date().toISOString() })
      .eq("patient_id", patientId)
      .eq("visibility", "shared")
      .is("read_at", null)
      .neq("author_id", nutriId);
    setTexto("");
    router.refresh();
  }

  const ordenadas = [...mensagens].sort((a: Mensagem, b: Mensagem) =>
    a.created_at < b.created_at ? -1 : 1
  );

  return (
    <div className="card">
      <h2 className="section-title mb-3">
        <span className="icon-badge">
          <MessageSquare className="h-4 w-4" />
        </span>
        Conversa com o paciente
      </h2>

      {ordenadas.length === 0 ? (
        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
          Nenhuma mensagem ainda. O paciente pode responder aqui pelo app dele.
        </p>
      ) : (
        <ul className="mb-4 space-y-2">
          {ordenadas.map((m: Mensagem) => {
            const meu = m.author_id === nutriId;
            return (
              <li key={m.id} className={`flex ${meu ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                    meu
                      ? "bg-brand-600 text-white"
                      : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100"
                  }`}
                >
                  <p className="whitespace-pre-wrap text-sm">{m.body}</p>
                  <p
                    className={`mt-1 flex items-center gap-1 text-[10px] ${
                      meu ? "text-white/70" : "text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    {formatDate(m.created_at.slice(0, 10))}
                    {meu &&
                      (m.read_at ? (
                        <>
                          <Eye className="h-2.5 w-2.5" /> lido
                        </>
                      ) : (
                        <>· não lido</>
                      ))}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={enviar}>
        <textarea
          className="input min-h-[72px] resize-y"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escreva para o paciente…"
          maxLength={4000}
        />
        <button type="submit" disabled={enviando || !texto.trim()} className="btn-primary mt-2 w-full py-2.5">
          {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Enviar
        </button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Notas privadas (o paciente nunca vê)
// ---------------------------------------------------------------------------

function AbaNotas({ patientId, nutriId, notas, setErro, supabase, router }: any) {
  const [texto, setTexto] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const body = texto.trim();
    if (!body) return;
    setSalvando(true);
    setErro(null);
    const { error } = await supabase.from("patient_notes").insert({
      nutritionist_id: nutriId,
      patient_id: patientId,
      author_id: nutriId,
      body,
      visibility: "private",
    });
    setSalvando(false);
    if (error) {
      setErro("Não foi possível salvar a nota.");
      return;
    }
    setTexto("");
    router.refresh();
  }

  async function excluir(id: string) {
    if (!confirm("Excluir esta nota?")) return;
    const { error } = await supabase.from("patient_notes").delete().eq("id", id);
    if (error) setErro("Não foi possível excluir a nota.");
    else router.refresh();
  }

  return (
    <div className="card">
      <h2 className="section-title mb-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
          <Lock className="h-4 w-4" />
        </span>
        Notas privadas
      </h2>
      <p className="mb-4 flex items-start gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
        <Lock className="mt-0.5 h-3 w-3 shrink-0" />
        Só você vê. Use para anamnese, conduta e o que observar no próximo
        retorno — o paciente não tem acesso a nada aqui.
      </p>

      <form onSubmit={salvar} className="mb-4">
        <textarea
          className="input min-h-[90px] resize-y"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Ex.: relata compulsão à noite; revisar distribuição de carboidrato no jantar."
          maxLength={4000}
        />
        <button type="submit" disabled={salvando || !texto.trim()} className="btn-primary mt-2 w-full py-2.5">
          {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Salvar nota
        </button>
      </form>

      {notas.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Nenhuma nota ainda.
        </p>
      ) : (
        <ul className="space-y-2">
          {notas.map((n: Mensagem) => (
            <li
              key={n.id}
              className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 dark:border-white/[0.07] dark:bg-slate-800/40"
            >
              <p className="whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-200">
                {n.body}
              </p>
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {formatDate(n.created_at.slice(0, 10))}
                </span>
                <button
                  onClick={() => excluir(n.id)}
                  className="tappable rounded-lg p-1 text-slate-400 hover:text-rose-600"
                  aria-label="Excluir nota"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
