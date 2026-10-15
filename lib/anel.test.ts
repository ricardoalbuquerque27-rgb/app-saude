import { describe, it, expect } from "vitest";
import { rotuloDoAnel, avisoDoAnel } from "./anel";

describe("rotuloDoAnel", () => {
  it("o papel vai depois do nome, separado por ponto médio", () => {
    expect(rotuloDoAnel("Calorias", "limite")).toBe("Calorias · limite");
    expect(rotuloDoAnel("Calorias", "meta")).toBe("Calorias · meta");
  });
  it("sem papel, só o nome", () => {
    expect(rotuloDoAnel("Calorias", null)).toBe("Calorias");
  });
});

describe("avisoDoAnel", () => {
  it("acima de 100% de um limite, avisa", () => {
    expect(avisoDoAnel(1.01, true)).toBe("acima do limite");
  });
  it("exatamente 100% é o limite batido, não passado", () => {
    expect(avisoDoAnel(1, true)).toBeNull();
  });
  it("abaixo do limite, nada", () => {
    expect(avisoDoAnel(0.4, true)).toBeNull();
  });
  it("sem avisoAcima, passar de 100% é só meta batida", () => {
    expect(avisoDoAnel(1.5, false)).toBeNull();
  });
});
