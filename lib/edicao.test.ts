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

describe("fechar/sujar com a seção de quem chama", () => {
  // Cenário que motivou o campo `secao`: A (limpa) está salvando, o usuário
  // abre B, A desmonta, e o salvar de A termina chamando fechar(). Sem a
  // seção na ação, isso fechava B e jogava fora o rascunho dela.
  it("fechar de seção que não está aberta não faz nada", () => {
    const e = { aberta: "treino" as const, suja: true };
    expect(reduzirEdicao(e, { tipo: "fechar", secao: "metas" })).toEqual(e);
  });

  it("sujar de seção que não está aberta não faz nada", () => {
    const e = { aberta: "treino" as const, suja: false };
    expect(reduzirEdicao(e, { tipo: "sujar", secao: "metas" })).toEqual(e);
  });

  it("fechar e sujar da própria seção aberta funcionam", () => {
    const e = { aberta: "treino" as const, suja: false };
    expect(reduzirEdicao(e, { tipo: "sujar", secao: "treino" }))
      .toEqual({ aberta: "treino", suja: true });
    expect(reduzirEdicao({ aberta: "treino", suja: true }, { tipo: "fechar", secao: "treino" }))
      .toEqual(vazio);
  });

  it("fechar tardio da seção que cedeu o lugar não derruba a nova", () => {
    let e = reduzirEdicao(vazio, { tipo: "abrir", secao: "metas" });
    e = reduzirEdicao(e, { tipo: "abrir", secao: "treino" }); // metas estava limpa
    e = reduzirEdicao(e, { tipo: "sujar", secao: "treino" });
    e = reduzirEdicao(e, { tipo: "fechar", secao: "metas" }); // salvar de metas terminou
    expect(e).toEqual({ aberta: "treino", suja: true });
  });

  it("fechar sem seção continua agindo sobre a que está aberta", () => {
    expect(reduzirEdicao({ aberta: "cardapio", suja: true }, { tipo: "fechar" })).toEqual(vazio);
  });
});

describe("limpar", () => {
  // Seção que grava a cada ação (treino) continua aberta depois de salvar;
  // sem "limpar", o aviso de alteração não salva sobrevivia ao que o motivou
  // e travava as outras seções por nada.
  it("na seção aberta e suja, tira a marca e mantém a seção aberta", () => {
    expect(reduzirEdicao({ aberta: "treino", suja: true }, { tipo: "limpar" }))
      .toEqual({ aberta: "treino", suja: false });
    expect(reduzirEdicao({ aberta: "treino", suja: true }, { tipo: "limpar", secao: "treino" }))
      .toEqual({ aberta: "treino", suja: false });
  });

  it("com a guarda de outra seção, devolve o mesmo estado", () => {
    const e = { aberta: "treino" as const, suja: true };
    expect(reduzirEdicao(e, { tipo: "limpar", secao: "metas" })).toBe(e);
  });

  it("sem seção aberta, devolve o mesmo estado", () => {
    expect(reduzirEdicao(vazio, { tipo: "limpar" })).toBe(vazio);
    expect(reduzirEdicao(vazio, { tipo: "limpar", secao: "treino" })).toBe(vazio);
  });

  it("seção que já está limpa devolve o mesmo estado", () => {
    const e = { aberta: "treino" as const, suja: false };
    expect(reduzirEdicao(e, { tipo: "limpar", secao: "treino" })).toBe(e);
  });

  it("depois de limpar, as outras seções podem abrir", () => {
    const suja = { aberta: "treino" as const, suja: true };
    expect(podeAbrir(suja, "metas")).toBe(false);
    const limpa = reduzirEdicao(suja, { tipo: "limpar", secao: "treino" });
    expect(podeAbrir(limpa, "metas")).toBe(true);
    expect(reduzirEdicao(limpa, { tipo: "abrir", secao: "metas" }))
      .toEqual({ aberta: "metas", suja: false });
  });

  it("limpar tardio de seção que cedeu o lugar não limpa a nova", () => {
    let e = reduzirEdicao(vazio, { tipo: "abrir", secao: "treino" });
    e = reduzirEdicao(e, { tipo: "abrir", secao: "metas" }); // treino estava limpa
    e = reduzirEdicao(e, { tipo: "sujar", secao: "metas" });
    e = reduzirEdicao(e, { tipo: "limpar", secao: "treino" }); // gravação do treino terminou
    expect(e).toEqual({ aberta: "metas", suja: true });
  });
});
