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
  CalendarCheck,
  Eye,
  Send,
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

export type PlanoItem = {
  id: string;
  day_of_week: number;
  sport: string;
  title: string | null;
  prescribed_by: string | null;
};

export type Comentario = {
  id: string;
  body: string;
  created_at: string;
  read_at: string | null;
};

export default function PrescricaoClient({
  patientId,
  nutriId,
  metas,
  plano,
  comentarios,
}: {
  patientId: string;
  nutriId: string;
  metas: {
    daily_calorie_goal: number | null;
    protein_goal_g: number | null;
    daily_water_goal_ml: number | null;
    weight_goal_kg: number | null;
  };
  plano: PlanoItem[];
  comentarios: Comentario[];
}) {
  const supabase = createClient();
  const router = useRouter();

  const [kcal, setKcal] = useState(metas.daily_calorie_goal?.toString() ?? "");
  const [prot, setProt] = useState(metas.protein_goal_g?.toString() ?? "");
  const [agua, setAgua] = useState(metas.daily_water_goal_ml?.toString() ?? "");
  const [peso, setPeso] = useState(metas.weight_goal_kg?.toString() ?? "");
  const [obs, setObs] = useState("");
  const [salvandoMetas, setSalvandoMetas] = useState(false);
  const [metasOk, setMetasOk] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [dia, setDia] = useState(0);
  const [esporte, setEsporte] = useState(ESPORTES[0]);
  const [titulo, setTitulo] = useState("");
  const [addingPlano, setAddingPlano] = useState(false);

  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function salvarMetas(e: React.FormEvent) {
    e.preventDefault();
    setSalvandoMetas(true);
    setErro(null);
    setMetasOk(false);

    const { data, error } = await supabase.rpc("set_patient_goals", {
      p_patient: patientId,
      p_calories: kcal ? Number(kcal) : null,
      p_protein: prot ? Number(prot) : null,
      p_water: agua ? Number(agua) : null,
      p_weight: peso ? Number(peso) : null,
      p_notes: obs.trim() || null,
    });

    setSalvandoMetas(false);
    const res = data as { ok?: boolean; error?: string } | null;
    if (error || res?.ok === false) {
      setErro(res?.error ?? "Não foi possível salvar as metas.");
      return;
    }
    setObs("");
    setMetasOk(true);
    setTimeout(() => setMetasOk(false), 2500);
    router.refresh();
  }

  async function addSessao() {
    if (addingPlano) return;
    setAddingPlano(true);
    setErro(null);
    const { error } = await supabase.from("workout_plan").insert({
      user_id: patientId,
      day_of_week: dia,
      sport: esporte,
      title: titulo.trim() || null,
      prescribed_by: nutriId,
    });
    setAddingPlano(false);
    if (error) {
      setErro("Não foi possível adicionar a sessão ao plano.");
      return;
    }
    setTitulo("");
    router.refresh();
  }

  async function removerSessao(id: string) {
    if (!confirm("Remover esta sessão do plano do paciente?")) return;
    const { error } = await supabase.from("workout_plan").delete().eq("id", id);
    if (error) {
      setErro("Não foi possível remover a sessão.");
      return;
    }
    router.refresh();
  }

  async function enviarComentario(e: React.FormEvent) {
    e.preventDefault();
    const body = texto.trim();
    if (!body) return;
    setEnviando(true);
    setErro(null);
    const { error } = await supabase.from("patient_notes").insert({
      nutritionist_id: nutriId,
      patient_id: patientId,
      body,
    });
    setEnviando(false);
    if (error) {
      setErro("Não foi possível enviar o comentário.");
      return;
    }
    setTexto("");
    router.refresh();
  }

  return (
    <>
      {erro && (
        <p className="card mb-4 border-rose-200 bg-rose-50 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
          {erro}
        </p>
      )}

      {/* ---------------- Metas ---------------- */}
      <form onSubmit={salvarMetas} className="card mb-4">
        <h2 className="section-title mb-3">
          <span className="icon-badge">
            <Target className="h-4 w-4" />
          </span>
          Metas do paciente
        </h2>
        <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
          O que você definir aqui passa a valer no app do paciente — anéis do
          dia, Score de Saúde e avisos da Gaia.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Calorias/dia">
            <input
              type="number"
              className="input"
              value={kcal}
              onChange={(e) => setKcal(e.target.value)}
              placeholder="1800"
            />
          </Field>
          <Field label="Proteína/dia (g)">
            <input
              type="number"
              className="input"
              value={prot}
              onChange={(e) => setProt(e.target.value)}
              placeholder="110"
            />
          </Field>
          <Field label="Água/dia (ml)">
            <input
              type="number"
              className="input"
              value={agua}
              onChange={(e) => setAgua(e.target.value)}
              placeholder="2500"
            />
          </Field>
          <Field label="Peso alvo (kg)">
            <input
              type="number"
              step="0.1"
              className="input"
              value={peso}
              onChange={(e) => setPeso(e.target.value)}
              placeholder="62"
            />
          </Field>
        </div>

        <Field label="Observação da prescrição (opcional)">
          <input
            className="input"
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            placeholder="Ex.: ajuste após retorno de 30 dias"
          />
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Fica no histórico da prescrição, para você lembrar do motivo.
          </p>
        </Field>

        <button
          type="submit"
          disabled={salvandoMetas}
          className="btn-primary mt-2 w-full py-2.5"
        >
          {salvandoMetas ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : metasOk ? (
            <Check className="h-4 w-4" />
          ) : null}
          {metasOk ? "Metas aplicadas!" : "Aplicar metas"}
        </button>
      </form>

      {/* ---------------- Plano semanal ---------------- */}
      <div className="card mb-4">
        <h2 className="section-title mb-3">
          <span className="icon-badge">
            <CalendarCheck className="h-4 w-4" />
          </span>
          Plano de treino
        </h2>

        {plano.length === 0 ? (
          <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
            Nenhuma sessão no plano deste paciente ainda.
          </p>
        ) : (
          <ul className="mb-4 divide-y divide-slate-100 dark:divide-slate-800">
            {plano.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2">
                <span className="w-20 shrink-0 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                  {DIAS[p.day_of_week]?.slice(0, 3)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                    {p.title || p.sport}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {p.sport}
                    {p.prescribed_by
                      ? " · prescrito por você"
                      : " · montado pelo paciente"}
                  </p>
                </div>
                <button
                  onClick={() => removerSessao(p.id)}
                  className="tappable rounded-lg p-1.5 text-slate-400 hover:text-rose-600"
                  aria-label="Remover sessão"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="rounded-xl border border-dashed border-slate-300 p-3 dark:border-slate-700">
          <p className="eyebrow mb-2">Adicionar sessão</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <select
              className="input"
              value={dia}
              onChange={(e) => setDia(Number(e.target.value))}
            >
              {DIAS.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
            <select
              className="input"
              value={esporte}
              onChange={(e) => setEsporte(e.target.value)}
            >
              {ESPORTES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <input
              className="input"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Título (opcional)"
            />
          </div>
          <button
            onClick={addSessao}
            disabled={addingPlano}
            className="btn-ghost mt-2 w-full py-2 text-sm"
          >
            {addingPlano ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Adicionar ao plano
          </button>
        </div>
      </div>

      {/* ---------------- Comentários ---------------- */}
      <div className="card">
        <h2 className="section-title mb-3">
          <span className="icon-badge">
            <MessageSquare className="h-4 w-4" />
          </span>
          Comentários para o paciente
        </h2>

        <form onSubmit={enviarComentario} className="mb-4">
          <textarea
            className="input min-h-[80px] resize-y"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Ex.: Maria, aumente a proteína no café da manhã e mantenha o treino de quarta."
            maxLength={4000}
          />
          <button
            type="submit"
            disabled={enviando || !texto.trim()}
            className="btn-primary mt-2 w-full py-2.5"
          >
            {enviando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Enviar para o paciente
          </button>
        </form>

        {comentarios.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Nenhum comentário enviado ainda.
          </p>
        ) : (
          <ul className="space-y-2">
            {comentarios.map((c) => (
              <li
                key={c.id}
                className="rounded-xl border border-slate-200/80 bg-white p-3 dark:border-white/[0.07] dark:bg-slate-900/60"
              >
                <p className="whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-200">
                  {c.body}
                </p>
                <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                  {formatDate(c.created_at.slice(0, 10))}
                  {c.read_at ? (
                    <span className="inline-flex items-center gap-1 text-brand-600 dark:text-brand-400">
                      <Eye className="h-3 w-3" /> lido
                    </span>
                  ) : (
                    <span>· ainda não lido</span>
                  )}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
