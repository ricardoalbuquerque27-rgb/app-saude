import { describe, it, expect } from "vitest";
import { transcricaoDoLaudo } from "./laudo";

describe("transcricaoDoLaudo", () => {
  it("fica só com nome, valor, unidade e referência, e joga fora o resto", () => {
    const r = transcricaoDoLaudo({
      resumo: "Seu colesterol está alto", interpretacao: ["x"], recomendacoes: ["y"],
      itens: [{ nome: " LDL-c ", valor: 180, unidade: "mg/dL", referencia: "< 130", status: "alterado", explicacao: "z" }],
    });
    expect(r).toEqual([{ nome: "LDL-c", valor: "180", unidade: "mg/dL", referencia: "< 130" }]);
  });
  it("o que não é texto vira nulo; item sem nome sai", () => {
    expect(transcricaoDoLaudo({ itens: [{ nome: "TSH", valor: "2,1", unidade: 5, referencia: { a: 1 } }, { nome: "", valor: "1" }, { valor: "2" }] }))
      .toEqual([{ nome: "TSH", valor: "2,1", unidade: null, referencia: null }]);
  });
  it("número que não é finito e item que não é objeto saem como nulo ou somem", () => {
    expect(transcricaoDoLaudo({ itens: [{ nome: "TSH", valor: Number.NaN, unidade: " ", referencia: "  0,4 a 4,0 " }, null, "x", 3] }))
      .toEqual([{ nome: "TSH", valor: null, unidade: null, referencia: "0,4 a 4,0" }]);
  });
  it.each([[null], ["texto"], [[]], [{ itens: "x" }], [{}]])("%s vira lista vazia", (j) => {
    expect(transcricaoDoLaudo(j)).toEqual([]);
  });
});
