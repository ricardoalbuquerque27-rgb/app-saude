import { describe, it, expect } from "vitest";
import { bancoEmMemoria } from "./bancoEmMemoria";
import { lerTreinos } from "./treinosDb";

const UID = "pac-a";
const SEMANA = ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25"];

const base = () => ({
  workout_plan: [
    { id: "p-2", user_id: UID, day_of_week: 3, sport: "Musculação", title: "Treino A", notes: null, position: 0, routine_id: "r-1", prescribed_by: "nut" },
    { id: "p-1", user_id: UID, day_of_week: 0, sport: "Corrida", title: null, notes: null, position: 0, routine_id: null, prescribed_by: null },
  ],
  plan_completions: [
    { id: "c-1", user_id: UID, plan_id: "p-1", date: "2026-10-19", status: "done", workout_id: null },
    // Da semana anterior: fica fora.
    { id: "c-0", user_id: UID, plan_id: "p-1", date: "2026-10-12", status: "done", workout_id: null },
  ],
  routines: [{ id: "r-1", user_id: UID, name: "Treino A", notes: null, position: 0, created_at: "2026-10-01T10:00:00Z", prescribed_by: "nut" }],
  routine_exercises: [
    { id: "re-2", routine_id: "r-1", user_id: UID, name: "Remada", target_sets: 3, target_reps: 10, target_weight_kg: null, rest_seconds: 90, position: 1 },
    { id: "re-1", routine_id: "r-1", user_id: UID, name: "Supino", target_sets: 3, target_reps: 10, target_weight_kg: 40, rest_seconds: 90, position: 0 },
  ],
  workouts: [
    { id: "w-1", user_id: UID, date: "2026-10-20", name: "Treino A", category: null, duration_min: 50, notes: null, created_at: "2026-10-20T10:00:00Z" },
    { id: "w-2", user_id: UID, date: "2026-10-21", name: "Treino B", category: null, duration_min: 40, notes: null, created_at: "2026-10-21T10:00:00Z" },
  ],
  exercises: [
    { id: "e-2", workout_id: "w-1", user_id: UID, name: "Remada", position: 1 },
    { id: "e-1", workout_id: "w-1", user_id: UID, name: "Supino", position: 0 },
  ],
  patient_links: [{ nutritionist_id: "nut", status: "active" }],
});

describe("lerTreinos", () => {
  it("lê o plano, as respostas da semana, as rotinas com os exercícios e o histórico com as séries", async () => {
    const r = await lerTreinos(bancoEmMemoria(base()), SEMANA);
    expect(r.falhou).toEqual({ plano: false, respostas: false, rotinas: false, historico: false });
    expect(r.plano.map((p) => p.id)).toEqual(["p-1", "p-2"]);
    expect(r.respostas.map((c) => c.id)).toEqual(["c-1"]);
    expect(r.rotinas).toHaveLength(1);
    expect(r.rotinas[0].exercises.map((e) => e.name)).toEqual(["Supino", "Remada"]);
    expect(r.treinos.map((w) => w.id)).toEqual(["w-2", "w-1"]);
    expect(r.seriesPorTreino["w-1"].map((e) => e.name)).toEqual(["Supino", "Remada"]);
    expect(r.vinculoAtivo).toBe(true);
  });

  it("a rotina traz o prescribed_by (o selo \"do nutri\" das rotinas nunca aparecia)", async () => {
    const r = await lerTreinos(bancoEmMemoria(base()), SEMANA);
    expect(r.rotinas[0].prescribed_by).toBe("nut");
  });

  it("o plano que falha diz que falhou, e o resto vale", async () => {
    // Era `planRes.data ?? []`: a semana inteira dizia "Nada planejado."
    const banco = bancoEmMemoria(base(), { falhar: (c) => c.tabela === "workout_plan" });
    const r = await lerTreinos(banco, SEMANA);
    expect(r.falhou.plano).toBe(true);
    expect(r.plano).toEqual([]);
    expect(r.falhou.historico).toBe(false);
    expect(r.treinos).toHaveLength(2);
  });

  it("as respostas que falham dizem que falharam", async () => {
    // Sem elas, todo dia respondido aparecia "sem resposta", com o "Fui" sólido.
    const banco = bancoEmMemoria(base(), { falhar: (c) => c.tabela === "plan_completions" });
    const r = await lerTreinos(banco, SEMANA);
    expect(r.falhou.respostas).toBe(true);
    expect(r.falhou.plano).toBe(false);
  });

  it("os exercícios das rotinas que falham fazem as rotinas falharem", async () => {
    // Rotina sem os exercícios seria "0 exercício(s)" e um "Iniciar treino" vazio.
    const banco = bancoEmMemoria(base(), { falhar: (c) => c.tabela === "routine_exercises" });
    const r = await lerTreinos(banco, SEMANA);
    expect(r.falhou.rotinas).toBe(true);
    expect(r.rotinas).toEqual([]);
  });

  it("as séries que falham fazem o histórico falhar", async () => {
    const banco = bancoEmMemoria(base(), { falhar: (c) => c.tabela === "exercises" });
    const r = await lerTreinos(banco, SEMANA);
    expect(r.falhou.historico).toBe(true);
    expect(r.treinos).toEqual([]);
  });

  it("o histórico passa de 1.000 treinos sem cortar", async () => {
    // Sem páginas, o PostgREST cortava em 1.000 sem erro, e o resto sumia do
    // Histórico e da Progressão.
    const t: Record<string, any[]> = base();
    t.workouts = Array.from({ length: 1500 }, (_, i) => ({
      id: `w-${String(i).padStart(4, "0")}`, user_id: UID, date: "2026-01-01", name: "Treino", category: null,
      duration_min: null, notes: null, created_at: `2026-01-01T10:00:00Z`,
    }));
    const r = await lerTreinos(bancoEmMemoria(t, { maxRows: 1000 }), SEMANA);
    expect(r.falhou.historico).toBe(false);
    expect(r.treinos).toHaveLength(1500);
  });

  it("as séries passam de 1.000 linhas sem cortar", async () => {
    const t: Record<string, any[]> = base();
    t.exercises = Array.from({ length: 1200 }, (_, i) => ({
      id: `e-${String(i).padStart(4, "0")}`, workout_id: "w-1", user_id: UID, name: `Ex ${i}`, position: i,
    }));
    const r = await lerTreinos(bancoEmMemoria(t, { maxRows: 1000 }), SEMANA);
    expect(r.seriesPorTreino["w-1"]).toHaveLength(1200);
  });

  it("com a leitura do vínculo falhando, vale o prescribed_by", async () => {
    // Tirar o "Não fui" de quem tem nutricionista por uma falha de leitura
    // seria pior: o check-in grava a mesma linha nos dois casos.
    const banco = bancoEmMemoria(base(), { falhar: (c) => c.tabela === "patient_links" });
    const r = await lerTreinos(banco, SEMANA);
    expect(r.vinculoAtivo).toBe(true);
  });

  it("sem vínculo ativo", async () => {
    const t = base();
    t.patient_links = [];
    const r = await lerTreinos(bancoEmMemoria(t), SEMANA);
    expect(r.vinculoAtivo).toBe(false);
  });
});
