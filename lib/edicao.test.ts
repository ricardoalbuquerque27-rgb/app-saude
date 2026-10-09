import { describe, it, expect } from "vitest";
import { podeAbrir, reduzirEdicao } from "./edicao";

const vazio = { aberta: null, suja: false };

describe("reduzirEdicao", () => {
  it("abre e marca como suja", () => {
    const e = reduzirEdicao(reduzirEdicao(vazio, { tipo: "abrir", secao: "metas" }), { tipo: "sujar" });
    expect(e).toEqual({ aberta: "metas", suja: true });
  });

  it("seção suja bloqueia as outras, não a si mesma", () => {
    const e = { aberta: "metas" as const, suja: true };
    expect(podeAbrir(e, "treino")).toBe(false);
    expect(podeAbrir(e, "metas")).toBe(true);
    expect(reduzirEdicao(e, { tipo: "abrir", secao: "treino" })).toEqual(e);
  });

  it("seção limpa cede o lugar", () => {
    expect(reduzirEdicao({ aberta: "metas", suja: false }, { tipo: "abrir", secao: "treino" }))
      .toEqual({ aberta: "treino", suja: false });
  });

  it("fechar limpa tudo", () => {
    expect(reduzirEdicao({ aberta: "treino", suja: true }, { tipo: "fechar" })).toEqual(vazio);
  });
});
