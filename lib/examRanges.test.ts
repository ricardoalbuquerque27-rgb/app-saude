import { describe, it, expect } from "vitest";
import { chaveDoExame, classifyExam, faixaDaTabela, parseReferenceRange } from "./examRanges";

describe("parseReferenceRange", () => {
  it.each([
    ["70-99", { min: 70, max: 99 }],
    ["70 a 99", { min: 70, max: 99 }],
    ["70 – 99", { min: 70, max: 99 }],
    ["< 200", { max: 200 }],
    ["até 150", { max: 150 }],
    ["> 40", { min: 40 }],
    ["≥ 30", { min: 30 }],
  ])("%s", (texto, esperado) => {
    expect(parseReferenceRange(texto)).toEqual(esperado);
  });

  it("vírgula decimal nas duas pontas: '0,9 a 1,7' é 0,9 a 1,7 (não 0,9 a 1)", () => {
    // O replace trocava só a primeira vírgula; a faixa da tabela do app tem
    // várias assim (t4 livre, creatinina, potássio).
    expect(parseReferenceRange("0,9 a 1,7")).toEqual({ min: 0.9, max: 1.7 });
    expect(parseReferenceRange("3,5–5,1")).toEqual({ min: 3.5, max: 5.1 });
    expect(parseReferenceRange("0,6 - 1,1")).toEqual({ min: 0.6, max: 1.1 });
  });

  it("vírgula decimal numa faixa de um lado só", () => {
    expect(parseReferenceRange("< 5,7")).toEqual({ max: 5.7 });
    expect(parseReferenceRange(">= 0,5")).toEqual({ min: 0.5 });
  });

  it("texto sem número não é faixa", () => {
    expect(parseReferenceRange("ver tabela do laboratório")).toBeNull();
    expect(parseReferenceRange(null)).toBeNull();
  });
});

describe("classifyExam (faixa do laudo)", () => {
  it("a faixa do laudo com duas vírgulas decimais classifica pelos dois lados", () => {
    // Antes: 0,9 a 1 -> o 1,5 normal saía "alterado, acima".
    const dentro = classifyExam({ name: "Marcador Zeta", value: "1,5", reference: "0,9 a 1,7" });
    expect(dentro.source).toBe("referencia");
    expect(dentro.status).toBe("normal");
    const fora = classifyExam({ name: "Marcador Zeta", value: "1,8", reference: "0,9 a 1,7" });
    expect(fora.status).toBe("alterado");
    expect(fora.direction).toBe("alto");
  });

  it("a tabela continua mandando no exame que ela conhece", () => {
    const r = classifyExam({ name: "Glicose", value: 92, reference: "10 a 20" });
    expect(r.source).toBe("tabela");
    expect(r.status).toBe("normal");
  });
});

describe("chaveDoExame", () => {
  it("só junta ao da tabela quando o nome é igual a uma das chaves dela", () => {
    const glicose = chaveDoExame("Glicose");
    expect(glicose).toBe("glicose");
    expect(chaveDoExame("Glicemia de jejum")).toBe(glicose);
    expect(chaveDoExame("glicose em jejum")).toBe(glicose);
    expect(chaveDoExame("  GLICEMIA ")).toBe(glicose);
  });

  it("exame que só CONTÉM o nome de uma entrada não é aquela entrada", () => {
    // Pelo casamento por palavra inteira (o do classifyExam), cada um destes
    // virava o exame da direita e o comparativo juntava exames diferentes.
    expect(chaveDoExame("VLDL-colesterol")).toBe("vldl colesterol"); // não "colesterol total"
    expect(chaveDoExame("Colesterol não-HDL")).toBe("colesterol nao hdl"); // não "colesterol total"
    expect(chaveDoExame("Vitamina K")).toBe("vitamina k"); // não "potassio" (chave "k")
    expect(chaveDoExame("Hemoglobina corpuscular média")).toBe("hemoglobina corpuscular media"); // não "hemoglobina"
    expect(chaveDoExame("Capacidade total de ligação do ferro")).toBe(
      "capacidade total de ligacao do ferro" // não "ferro"
    );
  });

  it("hemoglobina e hemoglobina glicada seguem separadas", () => {
    expect(chaveDoExame("Hemoglobina")).toBe("hemoglobina");
    expect(chaveDoExame("Hemoglobina glicada")).toBe("hemoglobina glicada");
  });

  it("fora da tabela, o nome sem acento, caixa nem pontuação", () => {
    expect(chaveDoExame("Ácido Fólico")).toBe("acido folico");
    expect(chaveDoExame("  ácido   FÓLICO! ")).toBe("acido folico");
  });
});

describe("faixaDaTabela", () => {
  it("devolve o texto da faixa e a unidade da entrada", () => {
    expect(faixaDaTabela("Glicose", 92, {})).toEqual({ faixa: "70–99 mg/dL (jejum)", unidade: "mg/dL" });
    expect(faixaDaTabela("Glicemia de jejum", 92, {})?.unidade).toBe("mg/dL");
  });

  it("nome que só contém o de uma entrada não tem faixa", () => {
    expect(faixaDaTabela("Vitamina K", 1.2, {})).toBeNull();
    expect(faixaDaTabela("VLDL-colesterol", 24, {})).toBeNull();
    expect(faixaDaTabela("Hemoglobina corpuscular média", 30, {})).toBeNull();
    expect(faixaDaTabela("Capacidade total de ligação do ferro", 300, {})).toBeNull();
  });

  it("entrada que depende do sexo, sem o sexo: não chuta", () => {
    expect(faixaDaTabela("Colesterol HDL", 45, {})).toBeNull();
    expect(faixaDaTabela("Colesterol HDL", 45, { sex: "F" })?.faixa).toBe("≥ 50 mg/dL (mulheres)");
    expect(faixaDaTabela("Colesterol HDL", 45, { sex: "M" })?.faixa).toBe("≥ 40 mg/dL (homens)");
  });
});
