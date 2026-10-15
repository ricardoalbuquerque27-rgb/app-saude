import { describe, it, expect } from "vitest";
import { getExamesDoPaciente, TETO_DE_EXAMES } from "./examesDb";
import { bancoEmMemoria } from "./bancoEmMemoria";
import { addDaysISO } from "./date";

const PACIENTE = "pac-1";

/** `n` resultados de exame do paciente, de dias diferentes. */
function exames(n: number) {
  return Array.from({ length: n }, (_, i) => {
    const data = addDaysISO("2026-10-14", -(i % 3000));
    return {
      id: `ex-${String(i).padStart(5, "0")}`,
      user_id: PACIENTE,
      date: data,
      title: "Glicose",
      result_value: String(80 + (i % 20)),
      unit: "mg/dL",
      reference_range: "70 a 99",
      status: "normal",
      notes: null,
      created_at: `${data}T12:00:00Z`,
    };
  });
}

describe("getExamesDoPaciente", () => {
  it.each([999, 1000, 1001])("%i resultados: todos, e não é falha", async (n) => {
    // Antes era `.limit(200)` com "vir 200 é falha": oito laudos de 25 exames
    // e a aba Clínico morria de vez, o tratamento junto.
    const banco = bancoEmMemoria({ exams: exames(n) });
    const r = await getExamesDoPaciente(banco, PACIENTE);
    expect(r.falhou).toBe(false);
    expect(r.data).toHaveLength(n);
    expect(banco.chamadas.map((c) => c.range)).toEqual(
      Array.from({ length: Math.floor(n / 1000) + 1 }, (_, i) => [i * 1000, i * 1000 + 999])
    );
  });

  it(`passar do teto (${TETO_DE_EXAMES}) é falha`, async () => {
    expect(TETO_DE_EXAMES).toBe(5000);
    const r = await getExamesDoPaciente(bancoEmMemoria({ exams: exames(TETO_DE_EXAMES + 1) }), PACIENTE);
    expect(r.falhou).toBe(true);
  });

  it("erro numa página é falha", async () => {
    const r = await getExamesDoPaciente(
      bancoEmMemoria({ exams: exames(1500) }, { falhar: (_c, i) => i === 1 }),
      PACIENTE
    );
    expect(r.falhou).toBe(true);
  });

  it("pede a contagem na primeira página e só nela", async () => {
    const banco = bancoEmMemoria({ exams: exames(2500) });
    const r = await getExamesDoPaciente(banco, PACIENTE);
    expect(r.falhou).toBe(false);
    expect(banco.chamadas.map((c) => c.contagem)).toEqual(["exact", null, null]);
  });

  it("projeto com max-rows menor que a página (500): é falha, e não os exames cortados como se fossem todos", async () => {
    // A 1ª página chega com 500 linhas e parece "curta"; sem a contagem, o
    // comparativo ficaria sem os exames mais novos (ou os mais velhos), calado.
    const banco = bancoEmMemoria({ exams: exames(1200) }, { maxRows: 500 });
    const r = await getExamesDoPaciente(banco, PACIENTE);
    expect(r.falhou).toBe(true);
    expect(r.data).toEqual([]);
  });

  it("com o max-rows padrão de 1.000, mais de mil exames são lidos inteiros", async () => {
    const r = await getExamesDoPaciente(bancoEmMemoria({ exams: exames(2500) }, { maxRows: 1000 }), PACIENTE);
    expect(r.falhou).toBe(false);
    expect(r.data).toHaveLength(2500);
  });

  it("só do paciente, por data e, no mesmo dia, pela gravação; com as colunas do comparativo e da lista", async () => {
    const base = exames(1)[0];
    const banco = bancoEmMemoria({
      exams: [
        { ...base, id: "b", date: "2026-10-02", created_at: "2026-10-02T15:00:00Z", result_value: "92" },
        { ...base, id: "c", date: "2026-07-10", created_at: "2026-07-10T09:00:00Z", result_value: "98" },
        { ...base, id: "a", date: "2026-10-02", created_at: "2026-10-02T09:00:00Z", result_value: "95" },
        { ...base, id: "outro", user_id: "pac-2", result_value: "300" },
      ],
    });
    const r = await getExamesDoPaciente(banco, PACIENTE);
    // compararExames fica com o ÚLTIMO da entrada num dia com dois resultados:
    // a ordem de gravação decide qual.
    expect(r.data.map((e) => e.result_value)).toEqual(["98", "95", "92"]);
    expect(Object.keys(r.data[0]).sort()).toEqual(
      ["date", "notes", "reference_range", "result_value", "status", "title", "unit"].sort()
    );
    expect(banco.chamadas[0].filtros).toEqual([["eq", "user_id", PACIENTE]]);
  });
});
