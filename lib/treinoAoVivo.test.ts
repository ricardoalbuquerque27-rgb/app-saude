import { describe, it, expect } from "vitest";
import { bancoEmMemoria } from "./bancoEmMemoria";
import { gravarTreinoAoVivo, ERRO_DO_TREINO, AVISO_DO_PLANO } from "./treinoAoVivo";

const UID = "pac-a";
// Sábado. A segunda da mesma semana é 12/10; a quinta seguinte, 22/10.
const HOJE = "2026-10-17";

const treino = {
  name: "Treino A — Superiores",
  durationMin: 52,
  exercises: [
    { name: "Supino", sets: [{ reps: 10, weight: 40 }, { reps: 8, weight: 45 }] },
    // Exercício sem série feita: não vira linha.
    { name: "Remada", sets: [] },
    { name: "Rosca", sets: [{ reps: 12, weight: null }] },
  ],
};

describe("gravarTreinoAoVivo", () => {
  it("grava o treino com a data de hoje e uma linha por exercício com série", async () => {
    const tabelas: Record<string, any[]> = {};
    const r = await gravarTreinoAoVivo(bancoEmMemoria(tabelas), UID, treino, null, HOJE);
    expect(r).toEqual({ ok: true, aviso: null });
    expect(tabelas.workouts).toHaveLength(1);
    expect(tabelas.workouts[0]).toMatchObject({
      user_id: UID,
      date: HOJE,
      name: "Treino A — Superiores",
      duration_min: 52,
      notes: "Sessão ao vivo",
    });
    const w = tabelas.workouts[0].id;
    expect(tabelas.exercises.map((e) => [e.name, e.sets, e.reps, e.weight_kg, e.position, e.workout_id])).toEqual([
      ["Supino", 2, 10, 45, 0, w],
      ["Rosca", 1, 12, null, 2, w],
    ]);
    expect(tabelas.plan_completions).toBeUndefined();
  });

  it("sessão de um dia que já passou: o check-in vai no dia da sessão, ligado ao treino de hoje", async () => {
    // Era `todayISO()`: o "Feito" ia com o id da sessão de segunda e a data de
    // sábado, e nenhum dia da semana o mostrava. A segunda seguia sem resposta.
    const tabelas: Record<string, any[]> = {};
    const r = await gravarTreinoAoVivo(
      bancoEmMemoria(tabelas),
      UID,
      treino,
      { planId: "p-seg", data: "2026-10-12" },
      HOJE
    );
    expect(r).toEqual({ ok: true, aviso: null });
    expect(tabelas.workouts[0].date).toBe(HOJE);
    expect(tabelas.plan_completions).toHaveLength(1);
    expect(tabelas.plan_completions[0]).toMatchObject({
      user_id: UID,
      plan_id: "p-seg",
      date: "2026-10-12",
      status: "done",
      workout_id: tabelas.workouts[0].id,
    });
  });

  it("sessão de hoje: o check-in vai em hoje", async () => {
    const tabelas: Record<string, any[]> = {};
    await gravarTreinoAoVivo(bancoEmMemoria(tabelas), UID, treino, { planId: "p-sab", data: HOJE }, HOJE);
    expect(tabelas.plan_completions[0]).toMatchObject({ plan_id: "p-sab", date: HOJE, status: "done" });
  });

  it("sessão de um dia que ainda não chegou: grava o treino e não responde o check-in", async () => {
    // O check-in só existe em dia que já chegou: marcar a quinta como "Feito"
    // na segunda diria que ele foi num dia que ainda não houve.
    const tabelas: Record<string, any[]> = {};
    const r = await gravarTreinoAoVivo(
      bancoEmMemoria(tabelas),
      UID,
      treino,
      { planId: "p-qui", data: "2026-10-22" },
      HOJE
    );
    expect(r).toEqual({ ok: true, aviso: null });
    expect(tabelas.workouts).toHaveLength(1);
    expect(tabelas.plan_completions).toBeUndefined();
  });

  it('um "não fui" gravado no dia vira "feito", com o treino de hoje', async () => {
    const tabelas: Record<string, any[]> = {
      plan_completions: [
        { id: "c-1", user_id: UID, plan_id: "p-seg", date: "2026-10-12", status: "skipped", workout_id: null },
      ],
    };
    await gravarTreinoAoVivo(bancoEmMemoria(tabelas), UID, treino, { planId: "p-seg", data: "2026-10-12" }, HOJE);
    expect(tabelas.plan_completions).toHaveLength(1);
    expect(tabelas.plan_completions[0]).toMatchObject({
      id: "c-1",
      status: "done",
      workout_id: tabelas.workouts[0].id,
    });
  });

  it('um "feito" já gravado no dia fica como está', async () => {
    // Trocar o workout_id deixaria solto o treino que o "Fui" gerou.
    const feito = {
      id: "c-1", user_id: UID, plan_id: "p-seg", date: "2026-10-12", status: "done", workout_id: "w-confirmado",
    };
    const tabelas: Record<string, any[]> = { plan_completions: [{ ...feito }] };
    const r = await gravarTreinoAoVivo(
      bancoEmMemoria(tabelas),
      UID,
      treino,
      { planId: "p-seg", data: "2026-10-12" },
      HOJE
    );
    expect(r).toEqual({ ok: true, aviso: null });
    expect(tabelas.plan_completions).toEqual([feito]);
  });

  it("o treino que falha não grava mais nada e devolve o erro", async () => {
    // Era `const { data: workout } = …` sem o `error`: a sessão fechava, a aba
    // ia para o Histórico e o treino inteiro sumia calado.
    const tabelas: Record<string, any[]> = {};
    const banco = bancoEmMemoria(tabelas, { falhar: (c) => c.tabela === "workouts" && c.op === "insert" });
    const r = await gravarTreinoAoVivo(banco, UID, treino, { planId: "p-seg", data: "2026-10-12" }, HOJE);
    expect(r).toEqual({ ok: false, erro: ERRO_DO_TREINO });
    expect(tabelas.exercises).toBeUndefined();
    expect(tabelas.plan_completions).toBeUndefined();
  });

  it("as séries que falham apagam o treino, para tentar de novo sem duplicar", async () => {
    const tabelas: Record<string, any[]> = {};
    const banco = bancoEmMemoria(tabelas, { falhar: (c) => c.tabela === "exercises" });
    const r = await gravarTreinoAoVivo(banco, UID, treino, { planId: "p-seg", data: "2026-10-12" }, HOJE);
    expect(r).toEqual({ ok: false, erro: ERRO_DO_TREINO });
    expect(tabelas.workouts).toEqual([]);
    expect(tabelas.plan_completions).toBeUndefined();
  });

  it("o check-in que falha deixa o treino salvo e avisa", async () => {
    // Desfazer o treino por causa do check-in perderia as séries; tentar de
    // novo duplicaria o treino.
    const tabelas: Record<string, any[]> = {};
    const banco = bancoEmMemoria(tabelas, { falhar: (c) => c.tabela === "plan_completions" && c.op === "upsert" });
    const r = await gravarTreinoAoVivo(banco, UID, treino, { planId: "p-seg", data: "2026-10-12" }, HOJE);
    expect(r).toEqual({ ok: true, aviso: AVISO_DO_PLANO });
    expect(tabelas.workouts).toHaveLength(1);
    expect(tabelas.exercises).toHaveLength(2);
  });

  it("a leitura do check-in que falha não grava por cima e avisa", async () => {
    // Sem saber o que o dia tem, gravar "feito" poderia trocar o treino de um
    // "Fui" que já estava lá.
    const tabelas: Record<string, any[]> = {};
    const banco = bancoEmMemoria(tabelas, { falhar: (c) => c.tabela === "plan_completions" && c.op === "select" });
    const r = await gravarTreinoAoVivo(banco, UID, treino, { planId: "p-seg", data: "2026-10-12" }, HOJE);
    expect(r).toEqual({ ok: true, aviso: AVISO_DO_PLANO });
    expect(tabelas.workouts).toHaveLength(1);
    expect(tabelas.plan_completions).toBeUndefined();
  });

  it("rotina sem nenhuma série feita grava só o treino", async () => {
    const tabelas: Record<string, any[]> = {};
    const r = await gravarTreinoAoVivo(
      bancoEmMemoria(tabelas),
      UID,
      { name: "Treino B", durationMin: 3, exercises: [{ name: "Agachamento", sets: [] }] },
      null,
      HOJE
    );
    expect(r).toEqual({ ok: true, aviso: null });
    expect(tabelas.workouts).toHaveLength(1);
    expect(tabelas.exercises).toBeUndefined();
  });
});
