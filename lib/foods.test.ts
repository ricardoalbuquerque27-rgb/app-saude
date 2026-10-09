import { describe, it, expect } from "vitest";
import { buscarAlimentos, porcao, normalizar } from "./foods";

const nomes = (q: string, n = 5) =>
  buscarAlimentos(q, n).map((a) => a.n);

describe("buscarAlimentos", () => {
  it("encontra sem acento e sem ligar para maiúsculas", () => {
    expect(nomes("FEIJAO").length).toBeGreaterThan(0);
    expect(nomes("feijão").length).toBeGreaterThan(0);
    expect(normalizar("Açúcar Mascavo")).toBe("acucar mascavo");
  });

  it("exige TODOS os termos, não qualquer um", () => {
    // Sem isto, "frango grelhado" devolvia todo frango da tabela.
    for (const nome of nomes("frango grelhado", 10)) {
      const b = normalizar(nome);
      expect(b).toContain("frango");
      expect(b).toContain("grelhad");
    }
  });

  it("põe o preparado na frente do cru", () => {
    // Quem registra refeição comeu comida pronta. Sem o bônus de preparo,
    // "feijao" trazia os grãos crus no topo (nomes mais curtos) e o feijão
    // cozido — o prato mais comum da mesa brasileira — ficava de fora dos
    // primeiros.
    const top = nomes("feijao", 5).map(normalizar);
    const primeiroCozido = top.findIndex((n) => n.includes("cozido"));
    const primeiroCru = top.findIndex((n) => n.includes("cru"));
    expect(primeiroCozido).toBeGreaterThanOrEqual(0);
    if (primeiroCru >= 0) expect(primeiroCozido).toBeLessThan(primeiroCru);
  });

  it("não castiga o cru: fruta se come crua", () => {
    // A primeira versão do ranking penalizava "cru" e jogava "Banana,
    // crua" abaixo de "Banana, doce em barra". Punir o preparo ao contrário
    // quebra justamente o caso mais comum de fruta.
    const top = nomes("banana", 5).map(normalizar);
    expect(top.some((n) => n.includes("crua"))).toBe(true);
  });

  it("prefere quem começa com o termo", () => {
    // "arroz" deve trazer arroz, não bolo de arroz.
    expect(normalizar(nomes("arroz", 1)[0])).toMatch(/^arroz/);
  });

  it("devolve vazio para consulta curta ou sem sentido", () => {
    expect(buscarAlimentos("")).toHaveLength(0);
    expect(buscarAlimentos("a")).toHaveLength(0); // termo de 1 letra é ignorado
    expect(buscarAlimentos("zzzzzz")).toHaveLength(0);
  });

  it("respeita o limite pedido", () => {
    expect(buscarAlimentos("arroz", 3)).toHaveLength(3);
  });
});

describe("porcao", () => {
  const cem = { i: 1, n: "Teste", c: "x", b: "teste", k: 200, p: 10, ch: 30, g: 5, f: 2 };

  it("100 g devolve os valores da tabela", () => {
    expect(porcao(cem, 100)).toEqual({
      calories: 200, protein_g: 10, carbs_g: 30, fat_g: 5, fiber_g: 2,
    });
  });

  it("escala proporcionalmente", () => {
    expect(porcao(cem, 50).calories).toBe(100);
    expect(porcao(cem, 250).protein_g).toBe(25);
  });

  it("zero grama zera tudo", () => {
    expect(porcao(cem, 0)).toEqual({
      calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0,
    });
  });

  it("arredonda calorias para inteiro e macros para uma casa", () => {
    const r = porcao(cem, 33);
    expect(Number.isInteger(r.calories)).toBe(true);
    expect(r.protein_g).toBe(3.3);
  });
});
