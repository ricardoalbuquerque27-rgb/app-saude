import { describe, it, expect } from "vitest";
import { bancoEmMemoria } from "./bancoEmMemoria";
import { gravarTreino, salvarRotina } from "./treinos";

const UID = "pac-a";

const treino = { user_id: UID, date: "2026-10-22", name: "Treino A", category: null, duration_min: 50, notes: null };
const serie = (nome: string, posicao: number) => ({
  user_id: UID, name: nome, sets: 3, reps: 10, weight_kg: 40, sets_json: null, rpe: null, position: posicao,
});

describe("gravarTreino", () => {
  it("grava o treino e as séries com o id dele", async () => {
    const t: Record<string, any[]> = {};
    const r = await gravarTreino(bancoEmMemoria(t), treino, [serie("Supino", 0), serie("Remada", 1)]);
    expect(r).toEqual({ ok: true, id: t.workouts[0].id });
    expect(t.exercises.map((e) => [e.name, e.workout_id])).toEqual([
      ["Supino", t.workouts[0].id],
      ["Remada", t.workouts[0].id],
    ]);
  });

  it("sem séries, grava só o treino", async () => {
    const t: Record<string, any[]> = {};
    const r = await gravarTreino(bancoEmMemoria(t), treino, []);
    expect(r.ok).toBe(true);
    expect(t.workouts).toHaveLength(1);
    expect(t.exercises).toBeUndefined();
  });

  it("o treino que falha não grava nada", async () => {
    const t: Record<string, any[]> = {};
    const banco = bancoEmMemoria(t, { falhar: (c) => c.tabela === "workouts" });
    const r = await gravarTreino(banco, treino, [serie("Supino", 0)]);
    expect(r).toEqual({ ok: false });
    expect(t.exercises).toBeUndefined();
  });

  it("as séries que falham apagam o treino, para tentar de novo sem duplicar", async () => {
    // O "Registrar treino" ignorava o erro: fechava o formulário, limpava o que
    // foi digitado e deixava no Histórico um treino sem as séries.
    const t: Record<string, any[]> = {};
    const banco = bancoEmMemoria(t, { falhar: (c) => c.tabela === "exercises" });
    const r = await gravarTreino(banco, treino, [serie("Supino", 0)]);
    expect(r).toEqual({ ok: false });
    expect(t.workouts).toEqual([]);
  });
});

describe("salvarRotina", () => {
  const exercicio = (nome: string, posicao: number) => ({
    name: nome, target_sets: 3, target_reps: 10, target_weight_kg: null, rest_seconds: 90, position: posicao,
  });
  const rotinaGravada = () => ({
    routines: [{ id: "r-1", user_id: UID, name: "Treino A", notes: null, position: 0 }],
    routine_exercises: [
      { id: "re-1", routine_id: "r-1", user_id: UID, ...exercicio("Supino", 0) },
      { id: "re-2", routine_id: "r-1", user_id: UID, ...exercicio("Remada", 1) },
    ],
  });
  const nomes = (t: Record<string, any[]>) => t.routine_exercises.map((e) => e.name);

  it("rotina nova: cria a rotina e os exercícios dela", async () => {
    const t: Record<string, any[]> = {};
    const r = await salvarRotina(bancoEmMemoria(t), UID, { id: null, nome: "Treino B", notas: null, posicao: 1 }, [
      exercicio("Agachamento", 0),
    ]);
    expect(r).toEqual({ ok: true, id: t.routines[0].id });
    expect(t.routines[0]).toMatchObject({ user_id: UID, name: "Treino B", position: 1 });
    expect(t.routine_exercises[0]).toMatchObject({ routine_id: t.routines[0].id, user_id: UID, name: "Agachamento" });
  });

  it("rotina nova cujos exercícios falham é apagada", async () => {
    // Sem isso, ficava uma rotina vazia, e o novo "Criar rotina" faria outra.
    const t: Record<string, any[]> = {};
    const banco = bancoEmMemoria(t, { falhar: (c) => c.tabela === "routine_exercises" });
    const r = await salvarRotina(banco, UID, { id: null, nome: "Treino B", notas: null, posicao: 1 }, [
      exercicio("Agachamento", 0),
    ]);
    expect(r).toEqual({ ok: false });
    expect(t.routines).toEqual([]);
  });

  it("rotina nova que falha não grava nada", async () => {
    const t: Record<string, any[]> = {};
    const banco = bancoEmMemoria(t, { falhar: (c) => c.tabela === "routines" });
    const r = await salvarRotina(banco, UID, { id: null, nome: "Treino B", notas: null, posicao: 1 }, [
      exercicio("Agachamento", 0),
    ]);
    expect(r).toEqual({ ok: false });
    expect(t.routine_exercises).toBeUndefined();
  });

  it("editar troca os exercícios e o nome", async () => {
    const t: Record<string, any[]> = rotinaGravada();
    const r = await salvarRotina(bancoEmMemoria(t), UID, { id: "r-1", nome: "Treino A2", notas: "leve", posicao: 0 }, [
      exercicio("Supino inclinado", 0),
    ]);
    expect(r).toEqual({ ok: true, id: "r-1" });
    expect(nomes(t)).toEqual(["Supino inclinado"]);
    expect(t.routines[0]).toMatchObject({ name: "Treino A2", notes: "leve" });
  });

  it("editar com os exercícios novos falhando deixa a rotina como estava", async () => {
    // Apagava os exercícios antes de gravar os novos: com o insert falhando, a
    // rotina ficava vazia e o "Iniciar treino" abria uma sessão sem nada.
    const t: Record<string, any[]> = rotinaGravada();
    const banco = bancoEmMemoria(t, { falhar: (c) => c.tabela === "routine_exercises" && c.op === "insert" });
    const r = await salvarRotina(banco, UID, { id: "r-1", nome: "Treino A2", notas: null, posicao: 0 }, [
      exercicio("Supino inclinado", 0),
    ]);
    expect(r).toEqual({ ok: false });
    expect(nomes(t)).toEqual(["Supino", "Remada"]);
    expect(t.routines[0].name).toBe("Treino A");
  });

  it("editar com a exclusão dos antigos falhando tira os novos e deixa a rotina como estava", async () => {
    const t: Record<string, any[]> = rotinaGravada();
    let apagou = 0;
    const banco = bancoEmMemoria(t, {
      // Só a primeira exclusão (a dos antigos) falha; a dos novos, não.
      falhar: (c) => c.tabela === "routine_exercises" && c.op === "delete" && apagou++ === 0,
    });
    const r = await salvarRotina(banco, UID, { id: "r-1", nome: "Treino A2", notas: null, posicao: 0 }, [
      exercicio("Supino inclinado", 0),
    ]);
    expect(r).toEqual({ ok: false });
    expect(nomes(t)).toEqual(["Supino", "Remada"]);
    expect(t.routines[0].name).toBe("Treino A");
  });

  it("editar com a leitura dos antigos falhando não muda nada", async () => {
    const t: Record<string, any[]> = rotinaGravada();
    const banco = bancoEmMemoria(t, { falhar: (c) => c.tabela === "routine_exercises" && c.op === "select" });
    const r = await salvarRotina(banco, UID, { id: "r-1", nome: "Treino A2", notas: null, posicao: 0 }, [
      exercicio("Supino inclinado", 0),
    ]);
    expect(r).toEqual({ ok: false });
    expect(nomes(t)).toEqual(["Supino", "Remada"]);
  });

  it("editar tirando todos os exercícios apaga os antigos", async () => {
    const t: Record<string, any[]> = rotinaGravada();
    const r = await salvarRotina(bancoEmMemoria(t), UID, { id: "r-1", nome: "Treino A", notas: null, posicao: 0 }, []);
    expect(r).toEqual({ ok: true, id: "r-1" });
    expect(t.routine_exercises).toEqual([]);
  });

  it("editar com o nome falhando avisa", async () => {
    const t: Record<string, any[]> = rotinaGravada();
    const banco = bancoEmMemoria(t, { falhar: (c) => c.tabela === "routines" && c.op === "update" });
    const r = await salvarRotina(banco, UID, { id: "r-1", nome: "Treino A2", notas: null, posicao: 0 }, [
      exercicio("Supino inclinado", 0),
    ]);
    expect(r).toEqual({ ok: false });
  });
});
