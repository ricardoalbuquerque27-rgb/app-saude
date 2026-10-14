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
  it("nome igual a uma chave da tabela dá a primeira chave da entrada", () => {
    const glicose = chaveDoExame("Glicose");
    expect(glicose).toBe("glicose");
    expect(chaveDoExame("Glicemia de jejum")).toBe(glicose);
    expect(chaveDoExame("glicose em jejum")).toBe(glicose);
    expect(chaveDoExame("  GLICEMIA ")).toBe(glicose);
  });

  it("a palavra que diferencia o exame o separa: VLDL, não-HDL, vitamina K, corpuscular...", () => {
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

  it("outras grafias separadas por uma palavra que a tabela não tem", () => {
    expect(chaveDoExame("Colesterol (VLDL)")).toBe("colesterol vldl");
    expect(chaveDoExame("Glicose pós-prandial")).toBe("glicose pos prandial");
  });

  it("palavras todas de uma entrada só, sem exata: junta (o sufixo redundante)", () => {
    expect(chaveDoExame("Hemoglobina glicada (HbA1c)")).toBe("hemoglobina glicada");
    expect(chaveDoExame("Glicose (jejum)")).toBe("glicose");
    expect(chaveDoExame("Glicemia, jejum")).toBe("glicose");
    expect(chaveDoExame("Triglicerídeos (TG)")).toBe("triglicerideos");
  });

  it("LDL colesterol e Colesterol LDL são o mesmo exame", () => {
    expect(chaveDoExame("LDL colesterol")).toBe("ldl");
    expect(chaveDoExame("Colesterol LDL")).toBe("ldl");
  });

  it("todas as palavras numa entrada só, mas sem nenhuma key inteira: não casa", () => {
    // 'T4' é palavra da entrada do T4 livre, mas T4 sozinho pode ser o total;
    // 'jejum', 'livre' e 'hormônio' são palavras soltas de glicose, T4 livre e TSH.
    expect(chaveDoExame("T4")).toBe("t4");
    expect(chaveDoExame("Jejum")).toBe("jejum");
    expect(chaveDoExame("Em jejum")).toBe("em jejum");
    expect(chaveDoExame("Livre")).toBe("livre");
    expect(chaveDoExame("Hormônio")).toBe("hormonio");
    // com a key inteira, casa
    expect(chaveDoExame("T4 livre")).toBe("t4 livre");
    expect(chaveDoExame("Tiroxina livre (T4)")).toBe("t4 livre");
  });

  it("palavras de entradas diferentes ou de mais de uma entrada: não casa com nenhuma", () => {
    // 'vitamina' está na D e na B12; 'total' no colesterol total e na testosterona.
    expect(chaveDoExame("Vitamina")).toBe("vitamina");
    expect(chaveDoExame("Total")).toBe("total");
    // as palavras estão na tabela, mas em entradas diferentes
    expect(chaveDoExame("Testosterona livre")).toBe("testosterona livre");
  });

  it("palavra de amostra (soro, plasma, sangue) não conta contra o nome", () => {
    expect(chaveDoExame("Potássio sérico")).toBe("potassio");
    expect(chaveDoExame("Glicose plasmática")).toBe("glicose");
    expect(chaveDoExame("Sódio, soro")).toBe("sodio");
    // urina é outro exame: não entra na lista
    expect(chaveDoExame("Glicose na urina")).toBe("glicose na urina");
    expect(chaveDoExame("Glicose urina")).toBe("glicose urina"); // sem a preposição também
    expect(chaveDoExame("Glicose urinária")).toBe("glicose urinaria");
    expect(chaveDoExame("Creatinina urinária")).toBe("creatinina urinaria");
  });

  it("palavra de amostra sozinha não casa, e com ela a key inteira continua sendo exigida", () => {
    expect(chaveDoExame("Soro")).toBe("soro");
    expect(chaveDoExame("Sangue")).toBe("sangue");
    expect(chaveDoExame("Soro plasma")).toBe("soro plasma");
  });

  it("a exata vence a que só cobre as palavras", () => {
    // 'hemoglobina' é palavra da entrada da hemoglobina e da glicada (que a
    // tem entre as keys): pela cobertura seriam duas e não casaria com nenhuma;
    // a exata decide.
    expect(chaveDoExame("Hemoglobina")).toBe("hemoglobina");
    expect(chaveDoExame("Colesterol")).toBe("colesterol total");
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

  it("a faixa também vale para as palavras todas de uma entrada só", () => {
    expect(faixaDaTabela("Hemoglobina glicada (HbA1c)", 5.6, {})).toEqual({ faixa: "< 5,7%", unidade: "%" });
    expect(faixaDaTabela("Glicose (jejum)", 92, {})?.faixa).toBe("70–99 mg/dL (jejum)");
  });

  it("nome sem key inteira, ou só com palavra de amostra, não tem faixa", () => {
    expect(faixaDaTabela("T4", 1.2, {})).toBeNull();
    expect(faixaDaTabela("Jejum", 92, {})).toBeNull();
    expect(faixaDaTabela("Soro", 92, {})).toBeNull();
    expect(faixaDaTabela("T4 livre", 1.2, {})?.faixa).toBe("0,9–1,7 ng/dL");
  });

  it("palavra de amostra não tira a faixa; urina tira", () => {
    expect(faixaDaTabela("Potássio sérico", 4.2, {})?.faixa).toBe("3,5–5,1 mEq/L");
    expect(faixaDaTabela("Glicose plasmática", 92, {})?.faixa).toBe("70–99 mg/dL (jejum)");
    expect(faixaDaTabela("Glicose na urina", 0, {})).toBeNull();
  });

  it("nome com uma palavra que a entrada não tem não leva a faixa dela", () => {
    expect(faixaDaTabela("Colesterol (VLDL)", 24, {})).toBeNull();
    expect(faixaDaTabela("Glicose pós-prandial", 140, {})).toBeNull();
    expect(faixaDaTabela("Colesterol não-HDL", 130, {})).toBeNull();
    expect(faixaDaTabela("Vitamina", 30, {})).toBeNull(); // cabe na D e na B12
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
