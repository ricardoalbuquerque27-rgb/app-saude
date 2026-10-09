"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Plus,
  Trash2,
  Dumbbell,
  X,
  CalendarPlus,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import TemplateBar from "@/components/TemplateBar";
import { useEdicao } from "./Edicao";
import { useGravacaoNaSecao } from "./Editavel";
import { ErroInline } from "./ErroInline";
import { useRecarregar } from "./useRecarregar";
import type { ExercicioRotina, PlanoItem, Rotina } from "./tipos";

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

// Rotinas com exercícios e o encaixe nos dias da semana, movidos da antiga aba
// Prescrição com as mesmas chamadas ao banco. Cada ação grava na
// hora, por isso não há Cancelar: a saída é o "Fechar edição" do <Editavel>,
// desligado enquanto alguma gravação daqui está em voo (cada uma passa por
// `gravacao`), para o erro dela não cair num editor já fechado.
export function EditorTreino({
  pacienteId,
  nutriId,
  rotinas,
  exercicios,
  plano,
}: {
  pacienteId: string;
  nutriId: string;
  rotinas: Rotina[];
  exercicios: ExercicioRotina[];
  plano: PlanoItem[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const { marcarSuja, marcarLimpa } = useEdicao("treino");
  const gravacao = useGravacaoNaSecao();
  // Só o encaixe espera a página nova: até ela chegar, a lista da semana
  // ainda não tem a sessão, e um segundo clique inseria outra linha igual em
  // workout_plan, que o paciente vê.
  const [atualizandoSemana, recarregarSemana] = useRecarregar();
  // Um erro por bloco, cada um embaixo do que falhou: o das rotinas fica
  // entre o formulário de nova rotina e a lista, o da semana embaixo do
  // encaixe. Um só no fim do editor ficaria longe de quem acabou de clicar.
  const [erroRotinas, setErroRotinas] = useState<string | null>(null);
  const [erroSemana, setErroSemana] = useState<string | null>(null);

  // Só o rascunho de rotina nova é trabalho não salvo: o resto grava a cada
  // ação. A primeira alteração nele avisa a página (para ela não deixar outra
  // seção abrir por cima e perder o que foi digitado). Vem do onChange, não de
  // um useEffect, e a ref evita repetir a ação a cada tecla.
  //
  // A marca é DO RASCUNHO e some com ele: o treino continua aberto depois de
  // salvar a rotina, e uma marca que sobrevivesse ao rascunho trancaria as
  // outras seções ("Salve ou cancele a edição de Treino") sem nada a salvar.
  // Por isso `sujou` é exatamente "há rascunho com alteração", e só salvar ou
  // cancelar o rascunho a solta. Encaixar, excluir e remover não mexem nela:
  // com rascunho aberto ele continua pendente, e sem rascunho ela já está solta.
  const sujou = useRef(false);
  function alterouRascunho() {
    if (sujou.current) return;
    sujou.current = true;
    marcarSuja();
  }
  function soltarMarca() {
    if (!sujou.current) return;
    sujou.current = false;
    marcarLimpa();
  }

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
    alterouRascunho();
    setLinhas((prev) =>
      prev.map((l, k) => (k === i ? { ...l, [campo]: valor } : l))
    );
  }

  async function salvarRotina() {
    const validos = linhas.filter((l) => l.nome.trim());
    if (!nome.trim() || validos.length === 0) {
      setErroRotinas("Dê um nome à rotina e adicione ao menos um exercício.");
      return;
    }
    setSalvando(true);
    setErroRotinas(null);

    const { data: r, error: e1 } = await supabase
      .from("routines")
      .insert({
        user_id: pacienteId,
        name: nome.trim(),
        notes: obsRotina.trim() || null,
        prescribed_by: nutriId,
      })
      .select("id")
      .single();

    if (e1 || !r) {
      setSalvando(false);
      setErroRotinas("Não foi possível criar a rotina.");
      return;
    }

    const { error: e2 } = await supabase.from("routine_exercises").insert(
      validos.map((l, i) => ({
        routine_id: (r as any).id,
        user_id: pacienteId,
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
      setErroRotinas("A rotina foi criada, mas os exercícios falharam. Tente editar.");
      return;
    }
    descartarRascunho();
    router.refresh();
  }

  // Salvou ou cancelou: o rascunho some por inteiro. Antes o Cancelar só
  // escondia o formulário e o texto voltava ao reabrir; com a marca de
  // alteração solta, o rascunho escondido seria trabalho a perder sem aviso.
  function descartarRascunho() {
    setNome("");
    setObsRotina("");
    setLinhas([{ ...LINHA_VAZIA }]);
    setCriando(false);
    soltarMarca();
  }

  // Modelo de treino = as rotinas com seus exercícios, sem ids.
  function capturarModelo() {
    if (rotinas.length === 0) return null;
    return rotinas.map((r: Rotina) => ({
      name: r.name,
      notes: r.notes,
      exercicios: exercicios
        .filter((e: ExercicioRotina) => e.routine_id === r.id)
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .map((e: ExercicioRotina) => ({
          name: e.name,
          target_sets: e.target_sets,
          target_reps: e.target_reps,
          target_weight_kg: e.target_weight_kg,
          rest_seconds: e.rest_seconds,
        })),
    }));
  }

  async function aplicarModelo(conteudo: any[]) {
    for (const r of conteudo) {
      if (!r?.name) continue;
      const { data: nova, error } = await supabase
        .from("routines")
        .insert({
          user_id: pacienteId,
          name: String(r.name),
          notes: r.notes ?? null,
          prescribed_by: nutriId,
        })
        .select("id")
        .single();
      if (error || !nova) throw error ?? new Error("rotina");

      const exs = Array.isArray(r.exercicios) ? r.exercicios : [];
      if (exs.length > 0) {
        const { error: e2 } = await supabase.from("routine_exercises").insert(
          exs
            .filter((e: any) => e?.name)
            .map((e: any, i: number) => ({
              routine_id: (nova as any).id,
              user_id: pacienteId,
              name: String(e.name),
              target_sets: e.target_sets ?? null,
              target_reps: e.target_reps ?? null,
              target_weight_kg: e.target_weight_kg ?? null,
              rest_seconds: e.rest_seconds ?? null,
              position: i + 1,
            }))
        );
        if (e2) throw e2;
      }
    }
    router.refresh();
  }

  async function excluirRotina(id: string) {
    if (!confirm("Excluir esta rotina do paciente? Os exercícios vão junto."))
      return;
    const { error } = await supabase.from("routines").delete().eq("id", id);
    if (error) setErroRotinas("Não foi possível excluir a rotina.");
    else router.refresh();
  }

  async function encaixarNoDia() {
    setEncaixando(true);
    setErroSemana(null);
    const rot = rotinas.find((r: Rotina) => r.id === rotinaId);
    const { error } = await supabase.from("workout_plan").insert({
      user_id: pacienteId,
      day_of_week: dia,
      sport: esporte,
      title: rot?.name ?? null,
      routine_id: rotinaId || null,
      prescribed_by: nutriId,
    });
    if (error) {
      setEncaixando(false);
      setErroSemana("Não foi possível encaixar no plano.");
      return;
    }
    recarregarSemana();
    setEncaixando(false);
  }
  const ocupadoEncaixe = encaixando || atualizandoSemana;

  async function removerDoDia(id: string) {
    const { error } = await supabase.from("workout_plan").delete().eq("id", id);
    if (error) setErroSemana("Não foi possível remover do plano.");
    else router.refresh();
  }

  return (
    <>
      <TemplateBar
        kind="treino"
        nutriId={nutriId}
        capturarAtual={capturarModelo}
        aplicar={(conteudo) => gravacao(() => aplicarModelo(conteudo))}
        rotulo="treino"
      />

      {/* ---- Rotinas com exercícios ---- */}
      <div className="card mb-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="section-title">
            <span className="icon-badge">
              <Dumbbell className="h-4 w-4" />
            </span>
            Rotinas
          </h3>
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
                onChange={(e) => {
                  setNome(e.target.value);
                  alterouRascunho();
                }}
                placeholder="Nome da rotina (ex.: Treino A — Superiores)"
              />
              <input
                className="input"
                value={obsRotina}
                onChange={(e) => {
                  setObsRotina(e.target.value);
                  alterouRascunho();
                }}
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
                        className="tappable inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg px-2 text-slate-500 hover:text-rose-600"
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
                        <label className="mb-0.5 block text-[11px] font-medium text-slate-500 dark:text-slate-400">
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
              <button onClick={() => gravacao(salvarRotina)} disabled={salvando} className="btn-primary flex-1 py-2 text-sm">
                {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
                Salvar rotina
              </button>
              <button
                onClick={() => {
                  descartarRascunho();
                  setErroRotinas(null);
                }}
                className="btn-ghost px-4 py-2 text-sm"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        <ErroInline mensagem={erroRotinas} className="mb-3" />

        {rotinas.length === 0 && !criando ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Nenhuma rotina ainda. Crie uma com os exercícios, séries e cargas.
          </p>
        ) : (
          <ul className="space-y-2">
            {rotinas.map((r: Rotina) => {
              const exs = exercicios
                .filter((e: ExercicioRotina) => e.routine_id === r.id)
                .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
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
                      onClick={() => gravacao(() => excluirRotina(r.id))}
                      className="tappable inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg p-1.5 text-slate-500 hover:text-rose-600"
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
        <h3 className="section-title mb-3">
          <span className="icon-badge">
            <CalendarPlus className="h-4 w-4" />
          </span>
          Semana do paciente
        </h3>

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
                  onClick={() => gravacao(() => removerDoDia(p.id))}
                  className="tappable inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg p-1.5 text-slate-500 hover:text-rose-600"
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
          <button onClick={() => gravacao(encaixarNoDia)} disabled={ocupadoEncaixe} className="btn-ghost mt-2 w-full py-2 text-sm">
            {ocupadoEncaixe ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {ocupadoEncaixe ? "Encaixando…" : "Encaixar no plano"}
          </button>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Com uma rotina ligada, o paciente vê o botão “Iniciar treino” e faz a
            sessão série por série.
          </p>
          <ErroInline mensagem={erroSemana} />
        </div>
      </div>
    </>
  );
}
