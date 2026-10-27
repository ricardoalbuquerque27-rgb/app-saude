import { describe, it, expect } from "vitest";
import { semExameNemTratamento } from "./historicoDaIa";

// As análises guardadas da Saúde e os Relatórios de antes do uso pretendido
// têm cartões das áreas "Exames" e "Tratamento" (ligavam "um exame alterado a
// um padrão da dieta"). Eles seguem no banco, mas não aparecem mais.
describe("semExameNemTratamento", () => {
  it("tira os cartões de exame e de tratamento, em qualquer grafia", () => {
    const itens = [
      { area: "Exames", titulo: "a" },
      { area: "Dieta", titulo: "b" },
      { area: "Tratamento", titulo: "c" },
      { area: "exame", titulo: "d" },
      { area: "TRATAMENTO ", titulo: "e" },
      { area: "Hábitos", titulo: "f" },
    ];
    expect(semExameNemTratamento(itens).map((i) => i.titulo)).toEqual(["b", "f"]);
  });
  it("lista ausente vira vazia; cartão sem área fica", () => {
    expect(semExameNemTratamento(null)).toEqual([]);
    expect(semExameNemTratamento(undefined)).toEqual([]);
    expect(semExameNemTratamento([{ titulo: "x" } as { area?: string; titulo: string }])).toHaveLength(1);
  });
});
