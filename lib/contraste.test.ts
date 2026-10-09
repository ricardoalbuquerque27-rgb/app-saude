import { describe, it, expect } from "vitest";
import { razaoContraste } from "./contraste";

describe("razaoContraste", () => {
  it("preto sobre branco é o máximo da escala WCAG, 21:1", () => {
    expect(razaoContraste("#000000", "#ffffff")).toBeCloseTo(21, 1);
  });

  it("cor sobre ela mesma é 1:1", () => {
    expect(razaoContraste("#ffffff", "#ffffff")).toBe(1);
  });

  it("não depende de qual cor é a frente e qual é o fundo", () => {
    expect(razaoContraste("#0e5d34", "#ffffff")).toBe(
      razaoContraste("#ffffff", "#0e5d34")
    );
  });
});
