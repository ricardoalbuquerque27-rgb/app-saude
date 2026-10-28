import { describe, it, expect } from "vitest";
import { refeicoesQueFaltam, montarParaHoje, type EntradaParaHoje } from "./paraHoje";

/** Dia sem nada a fazer e com todas as leituras certas. */
const VAZIA: EntradaParaHoje = {
  recados: [],
  treinos: [],
  confirmados: [],
  temNutri: true,
  aplicacao: null,
  refeicoesFaltando: 0,
  pendencias: [],
  falhou: false,
};

const com = (parte: Partial<EntradaParaHoje>): EntradaParaHoje => ({ ...VAZIA, ...parte });

describe("montarParaHoje", () => {
  it("dia sem nada: nenhuma linha e em dia", () => {
    expect(montarParaHoje(VAZIA)).toEqual({ linhas: [], pendentes: 0, estado: "em-dia" });
  });

  it("a ordem é recados, treinos do nutri, treinos próprios, aplicação, cardápio, pendências", () => {
    const r = montarParaHoje(
      com({
        // O treino próprio vem ANTES do prescrito na entrada: a ordem não é a da leitura.
        treinos: [
          { id: "proprio", prescribed_by: null },
          { id: "nutri", prescribed_by: "n1" },
        ],
        // Pendências fora de ordem, para provar que o cardápio e a aplicação não dependem dela.
        pendencias: [{ key: "perfil" }, { key: "metas" }],
        refeicoesFaltando: 2,
        aplicacao: { atrasada: false },
        recados: [{ id: "r1" }, { id: "r2" }],
      })
    );
    expect(r.linhas).toEqual([
      { tipo: "recados", quantidade: 2 },
      { tipo: "treino", id: "nutri", doNutri: true, confirmado: false },
      { tipo: "treino", id: "proprio", doNutri: false, confirmado: false },
      { tipo: "aplicacao", atrasada: false },
      { tipo: "cardapio", faltam: 2 },
      { tipo: "pendencia", key: "perfil", urgente: false },
      { tipo: "pendencia", key: "metas", urgente: false },
    ]);
  });

  it("recados: a quantidade é o número deles e cada um conta 1", () => {
    const r = montarParaHoje(com({ recados: [{ id: "a" }, { id: "b" }, { id: "c" }] }));
    expect(r.linhas).toEqual([{ tipo: "recados", quantidade: 3 }]);
    expect(r.pendentes).toBe(3);
    expect(r.estado).toBe("pendente");
  });

  it("treino confirmado aparece, mas não conta", () => {
    const r = montarParaHoje(
      com({
        treinos: [
          { id: "t1", prescribed_by: "n1" },
          { id: "t2", prescribed_by: "n1" },
        ],
        confirmados: ["t1"],
      })
    );
    expect(r.linhas).toEqual([
      { tipo: "treino", id: "t1", doNutri: true, confirmado: true },
      { tipo: "treino", id: "t2", doNutri: true, confirmado: false },
    ]);
    expect(r.pendentes).toBe(1);
  });

  it("dose: com aplicação a pendência dose sai", () => {
    const r = montarParaHoje(
      com({
        aplicacao: { atrasada: true },
        pendencias: [{ key: "dose", urgent: true }, { key: "perfil" }],
      })
    );
    expect(r.linhas).toEqual([
      { tipo: "aplicacao", atrasada: true },
      { tipo: "pendencia", key: "perfil", urgente: false },
    ]);
    expect(r.pendentes).toBe(2);
  });

  it("dose: sem aplicação a pendência fica e a urgência vem de urgent", () => {
    const r = montarParaHoje(
      com({ pendencias: [{ key: "dose", urgent: true }, { key: "perfil" }] })
    );
    expect(r.linhas).toEqual([
      { tipo: "pendencia", key: "dose", urgente: true },
      { tipo: "pendencia", key: "perfil", urgente: false },
    ]);
  });

  it("sem vínculo, o treino com prescribed_by não é do nutri", () => {
    // O vínculo foi revogado: a sessão prescrita continua no plano do
    // paciente, mas "do seu nutricionista" seria mentira.
    const r = montarParaHoje(
      com({
        temNutri: false,
        treinos: [
          { id: "t1", prescribed_by: "n1" },
          { id: "t2", prescribed_by: null },
        ],
      })
    );
    expect(r.linhas).toEqual([
      { tipo: "treino", id: "t1", doNutri: false, confirmado: false },
      { tipo: "treino", id: "t2", doNutri: false, confirmado: false },
    ]);
  });

  it("cardápio: zero refeições faltando não dá linha, e faltando dá uma que conta 1", () => {
    expect(montarParaHoje(com({ refeicoesFaltando: 0 })).linhas).toEqual([]);
    const r = montarParaHoje(com({ refeicoesFaltando: 4 }));
    expect(r.linhas).toEqual([{ tipo: "cardapio", faltam: 4 }]);
    expect(r.pendentes).toBe(1);
  });

  describe("estado", () => {
    it("nada pendente é em dia", () => {
      expect(montarParaHoje(VAZIA).estado).toBe("em-dia");
    });

    it("só treino confirmado é em dia, e a linha continua lá", () => {
      const r = montarParaHoje(
        com({ treinos: [{ id: "t1", prescribed_by: "n1" }], confirmados: ["t1"] })
      );
      expect(r.estado).toBe("em-dia");
      expect(r.pendentes).toBe(0);
      expect(r.linhas).toHaveLength(1);
    });

    it("algo pendente é pendente", () => {
      expect(montarParaHoje(com({ refeicoesFaltando: 1 })).estado).toBe("pendente");
      expect(montarParaHoje(com({ aplicacao: { atrasada: false } })).estado).toBe("pendente");
    });

    it("leitura que falhou é incompleto, nunca em dia, mesmo sem linhas", () => {
      const r = montarParaHoje(com({ falhou: true }));
      expect(r).toEqual({ linhas: [], pendentes: 0, estado: "incompleto" });
    });

    it("leitura que falhou com linhas: incompleto, contando só as que vieram", () => {
      const r = montarParaHoje(
        com({ falhou: true, recados: [{ id: "r1" }], refeicoesFaltando: 2 })
      );
      expect(r.estado).toBe("incompleto");
      expect(r.pendentes).toBe(2);
      expect(r.linhas).toEqual([
        { tipo: "recados", quantidade: 1 },
        { tipo: "cardapio", faltam: 2 },
      ]);
    });
  });
});

describe("refeicoesQueFaltam", () => {
  it("registrada ou respondida (comi ou não comi) não falta", () => {
    expect(refeicoesQueFaltam(["Café da manhã", "Almoço", "Almoço", "Jantar"], ["Café da manhã"], ["Jantar"])).toBe(1);
  });
  it("sem registro nem resposta, falta", () => {
    expect(refeicoesQueFaltam(["Almoço"], [], [])).toBe(1);
  });
  it("registro ou resposta de refeição fora do plano não conta", () => {
    expect(refeicoesQueFaltam([], ["Almoço"], ["Jantar"])).toBe(0);
    expect(refeicoesQueFaltam(["Almoço", "Jantar"], ["Lanche"], ["Ceia"])).toBe(2);
  });
});
