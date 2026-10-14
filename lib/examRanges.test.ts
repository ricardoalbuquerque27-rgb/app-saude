import { describe, it, expect } from "vitest";
import {
  chaveDoExame,
  classifyExam,
  dentroDaFaixa,
  faixaDaTabela,
  parseReferenceRange,
  TEXTOS_DE_FAIXA_DA_TABELA,
} from "./examRanges";

describe("parseReferenceRange", () => {
  it.each([
    ["70-99", { min: 70, max: 99 }],
    ["70 a 99", { min: 70, max: 99 }],
    ["70 – 99", { min: 70, max: 99 }],
    ["< 200", { max: 200, maxExclusivo: true }],
    ["até 150", { max: 150 }],
    ["> 40", { min: 40, minExclusivo: true }],
    ["≥ 30", { min: 30 }],
  ])("%s", (texto, esperado) => {
    expect(parseReferenceRange(texto)).toEqual(esperado);
  });

  // "< 190" quer dizer que 190 já não é desejável: lido como "até 190", o
  // colesterol de 190 "entrava na faixa" no comparativo e saía "normal" pelo
  // laudo, onde a tabela do app dizia "atenção".
  it.each([
    ["< 200", 200],
    ["menor que 200", 200],
    ["Menor do que 200", 200],
    ["abaixo de 200", 200],
    ["Inferior a 5,7%", 5.7],
  ])("'%s' é um máximo estrito", (texto, max) => {
    expect(parseReferenceRange(texto)).toEqual({ max, maxExclusivo: true });
  });

  it.each([
    ["> 40", 40],
    ["maior que 40", 40],
    ["acima de 40", 40],
    ["Superior a 40 mg/dL", 40],
  ])("'%s' é um mínimo estrito", (texto, min) => {
    expect(parseReferenceRange(texto)).toEqual({ min, minExclusivo: true });
  });

  it.each([
    ["≤ 200", { max: 200 }],
    ["<= 200", { max: 200 }],
    ["até 150", { max: 150 }],
    ["ate 150", { max: 150 }],
    ["≥ 30", { min: 30 }],
    [">= 30", { min: 30 }],
    ["maior ou igual a 40", { min: 40 }],
    ["igual ou superior a 126", { min: 126 }],
  ])("'%s' é inclusivo", (texto, esperado) => {
    expect(parseReferenceRange(texto)).toEqual(esperado);
  });

  it("'>=' e '<=' são lidos inteiros, não como '>' ou '<' seguido de lixo", () => {
    // A expressão antiga achava o '>' e só acertava por retrocesso; com o
    // operador decidindo se a borda é dentro, o '=' tem de fazer parte dele.
    expect(parseReferenceRange(">=40")).toEqual({ min: 40 });
    expect(parseReferenceRange("<=5,7")).toEqual({ max: 5.7 });
  });

  it("intervalo 'a–b' é inclusivo nas duas pontas, em qualquer ordem", () => {
    expect(parseReferenceRange("99 a 70")).toEqual({ min: 70, max: 99 });
    expect(parseReferenceRange("70 até 99")).toEqual({ min: 70, max: 99 });
  });

  it("vírgula decimal nas duas pontas: '0,9 a 1,7' é 0,9 a 1,7 (não 0,9 a 1)", () => {
    // O replace trocava só a primeira vírgula; a faixa da tabela do app tem
    // várias assim (t4 livre, creatinina, potássio).
    expect(parseReferenceRange("0,9 a 1,7")).toEqual({ min: 0.9, max: 1.7 });
    expect(parseReferenceRange("3,5–5,1")).toEqual({ min: 3.5, max: 5.1 });
    expect(parseReferenceRange("0,6 - 1,1")).toEqual({ min: 0.6, max: 1.1 });
  });

  it("vírgula decimal numa faixa de um lado só", () => {
    expect(parseReferenceRange("< 5,7")).toEqual({ max: 5.7, maxExclusivo: true });
    expect(parseReferenceRange(">= 0,5")).toEqual({ min: 0.5 });
  });

  it("texto sem número não é faixa", () => {
    expect(parseReferenceRange("ver tabela do laboratório")).toBeNull();
    expect(parseReferenceRange(null)).toBeNull();
  });
});

describe("parseReferenceRange: referência em níveis é ilegível", () => {
  // Lida pela primeira faixa, a hemoglobina glicada de 5,4 para 6,0 com
  // "Normal: < 5,7; Pré-diabetes: 5,7 a 6,4; ..." virava "< 5,7" e o
  // comparativo dizia "saiu da faixa" por acaso; a glicose com "Normal:
  // inferior a 100; alterada: 100 a 125" idem. Pior, um laudo por sexo dava a
  // faixa do homem à mulher. Sem faixa, a linha diz "sem faixa para comparar"
  // e o texto inteiro continua na tela, no "ref.".
  it.each([
    "Normal: < 5,7 %; Pré-diabetes: 5,7 a 6,4 %; Diabetes: ≥ 6,5 %",
    "Normal: inferior a 100 mg/dL; Glicemia de jejum alterada: 100 a 125 mg/dL; Diabetes: igual ou superior a 126",
    "Homens 20 a 59 anos: 0,7 a 1,3",
    "Masculino: 8 a 61; Feminino: 5 a 36",
    "Desejável: < 200; Limítrofe: 200 a 239; Alto: ≥ 240",
    "Desejável < 150; Limítrofe 150 a 199; Alto 200 a 499; Muito alto ≥ 500",
    "Acima de 20 ng/mL (população geral); 30 a 60 ng/mL (grupos de risco)",
  ])("'%s' dá null", (texto) => {
    expect(parseReferenceRange(texto)).toBeNull();
  });

  it.each([
    "Mulheres: 0,6 a 1,1",
    "Feminino: 5 a 36",
    "Adultos acima de 18 anos: 70 a 99",
    "Fase folicular: 2 a 12",
    "Baixo risco: < 100",
    "Ótimo: < 100",
  ])("palavra de estrato fora de parênteses ('%s') também dá null", (texto) => {
    expect(parseReferenceRange(texto)).toBeNull();
  });

  it("o que está entre parênteses não conta: '< 130 mg/dL (ideal < 100)' é '< 130'", () => {
    expect(parseReferenceRange("< 130 mg/dL (ideal < 100)")).toEqual({ max: 130, maxExclusivo: true });
    expect(parseReferenceRange("≥ 50 mg/dL (mulheres)")).toEqual({ min: 50 });
    expect(parseReferenceRange("70–99 mg/dL (jejum)")).toEqual({ min: 70, max: 99 });
  });
});

describe("TEXTOS_DE_FAIXA_DA_TABELA", () => {
  // Caracterização: os 32 textos de faixa da tabela do app, com os números que
  // `parseReferenceRange` dava antes da regra dos níveis e dos operadores
  // estritos. Cada um continua legível e com os mesmos números; os de "<"
  // ganham só a borda estrita. Texto novo na tabela entra aqui também.
  const ANTES: Record<string, { min?: number; max?: number }> = {
    "70–99 mg/dL (jejum)": { min: 70, max: 99 },
    "< 5,7%": { max: 5.7 },
    "< 190 mg/dL": { max: 190 },
    "< 130 mg/dL (ideal < 100)": { max: 130 },
    "≥ 50 mg/dL (mulheres)": { min: 50 },
    "≥ 40 mg/dL (homens)": { min: 40 },
    "< 150 mg/dL": { max: 150 },
    "30–100 ng/mL": { min: 30, max: 100 },
    "0,4–4,0 µUI/mL": { min: 0.4, max: 4 },
    "0,9–1,7 ng/dL": { min: 0.9, max: 1.7 },
    "0,6–1,1 mg/dL (mulheres)": { min: 0.6, max: 1.1 },
    "0,7–1,3 mg/dL (homens)": { min: 0.7, max: 1.3 },
    "15–45 mg/dL": { min: 15, max: 45 },
    "2,4–6,0 mg/dL (mulheres)": { min: 2.4, max: 6 },
    "3,4–7,0 mg/dL (homens)": { min: 3.4, max: 7 },
    "12–16 g/dL (mulheres)": { min: 12, max: 16 },
    "13–17 g/dL (homens)": { min: 13, max: 17 },
    "36–46% (mulheres)": { min: 36, max: 46 },
    "40–52% (homens)": { min: 40, max: 52 },
    "15–150 ng/mL (mulheres)": { min: 15, max: 150 },
    "30–400 ng/mL (homens)": { min: 30, max: 400 },
    "15–70 ng/dL (mulheres)": { min: 15, max: 70 },
    "264–916 ng/dL (homens)": { min: 264, max: 916 },
    "200–900 pg/mL": { min: 200, max: 900 },
    "60–160 µg/dL": { min: 60, max: 160 },
    "até 32 U/L (mulheres)": { max: 32 },
    "até 40 U/L (homens)": { max: 40 },
    "até 33 U/L (mulheres)": { max: 33 },
    "até 41 U/L (homens)": { max: 41 },
    "< 3 mg/L": { max: 3 },
    "3,5–5,1 mEq/L": { min: 3.5, max: 5.1 },
    "135–145 mEq/L": { min: 135, max: 145 },
  };

  it("são exatamente os textos que as entradas da tabela dão", () => {
    expect(Array.from(TEXTOS_DE_FAIXA_DA_TABELA).sort()).toEqual(Object.keys(ANTES).sort());
  });

  it.each(Object.entries(ANTES))("'%s' continua legível, com os mesmos números", (texto, numeros) => {
    const f = parseReferenceRange(texto);
    expect(f).not.toBeNull();
    expect({ min: f!.min, max: f!.max }).toEqual({ min: numeros.min, max: numeros.max });
    // só o "<" é estrito; "até", "≥" e o intervalo são inclusivos
    expect(!!f!.maxExclusivo).toBe(texto.startsWith("<"));
    expect(!!f!.minExclusivo).toBe(false);
  });
});

describe("dentroDaFaixa", () => {
  it("a borda estrita fica fora; a inclusiva, dentro", () => {
    expect(dentroDaFaixa(190, parseReferenceRange("< 190")!)).toBe(false);
    expect(dentroDaFaixa(189.9, parseReferenceRange("< 190")!)).toBe(true);
    expect(dentroDaFaixa(190, parseReferenceRange("≤ 190")!)).toBe(true);
    expect(dentroDaFaixa(190, parseReferenceRange("até 190")!)).toBe(true);
    expect(dentroDaFaixa(40, parseReferenceRange("> 40")!)).toBe(false);
    expect(dentroDaFaixa(40, parseReferenceRange(">= 40")!)).toBe(true);
    expect(dentroDaFaixa(70, parseReferenceRange("70 a 99")!)).toBe(true);
    expect(dentroDaFaixa(99, parseReferenceRange("70 a 99")!)).toBe(true);
    expect(dentroDaFaixa(99.5, parseReferenceRange("70 a 99")!)).toBe(false);
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

  it("a borda estrita do laudo vale: 190 com '< 190' está acima", () => {
    const r = classifyExam({ name: "Marcador Zeta", value: "190", reference: "< 190" });
    expect(r.source).toBe("referencia");
    expect(r.status).toBe("alterado");
    expect(r.direction).toBe("alto");
    expect(classifyExam({ name: "Marcador Zeta", value: "190", reference: "≤ 190" }).status).toBe("normal");
    const min = classifyExam({ name: "Marcador Zeta", value: "40", reference: "> 40" });
    expect(min.status).toBe("alterado");
    expect(min.direction).toBe("baixo");
  });

  it("laudo em níveis não classifica pela primeira faixa", () => {
    const r = classifyExam({
      name: "Marcador Zeta",
      value: "6,0",
      reference: "Normal: < 5,7 %; Pré-diabetes: 5,7 a 6,4 %; Diabetes: ≥ 6,5 %",
    });
    expect(r.matched).toBe(false);
    expect(r.source).toBe("nenhuma");
  });
});

describe("classifyExam: o nome casa pela regra estrita, e a tabela só vale na unidade dela", () => {
  // O classifyExam casava o nome por palavra solta (findDef): "Vitamina K"
  // era julgada pela faixa do potássio (chave "k"), HCM pela da hemoglobina,
  // VLDL e não-HDL pela do colesterol total. E usava a tabela em qualquer
  // unidade: a B12 em pmol/L ia contra 200–900 pg/mL e saía "atenção" com o
  // laudo dizendo que estava dentro. É o que a página Exames do paciente
  // mostra, o que a IA grava e o que o formulário preenche.
  const tabela = (r: ReturnType<typeof classifyExam>) => r.source === "tabela";

  it("Vitamina K não usa a faixa do potássio", () => {
    expect(tabela(classifyExam({ name: "Vitamina K", value: "1,2" }))).toBe(false);
    const comLaudo = classifyExam({ name: "Vitamina K", value: "1,2", reference: "0,2 a 3,2" });
    expect(comLaudo.source).toBe("referencia");
    expect(comLaudo.status).toBe("normal");
  });

  it("HCM não usa a faixa da hemoglobina", () => {
    const r = classifyExam({ name: "Hemoglobina corpuscular média", value: "30", unit: "pg", ctx: { sex: "F" } });
    expect(tabela(r)).toBe(false);
    expect(r.faixa).not.toContain("g/dL");
  });

  it("VLDL e não-HDL não usam a faixa do colesterol total", () => {
    const vldl = classifyExam({ name: "VLDL-colesterol", value: "35", unit: "mg/dL", reference: "< 30" });
    expect(vldl.source).toBe("referencia");
    expect(vldl.faixa).toBe("< 30");
    expect(vldl.status).toBe("alterado");
    const naoHdl = classifyExam({ name: "Colesterol não-HDL", value: "170", unit: "mg/dL", reference: "< 160" });
    expect(naoHdl.source).toBe("referencia");
    expect(naoHdl.status).toBe("alterado");
  });

  it("Glicose pós-prandial não usa a faixa da glicose de jejum", () => {
    const r = classifyExam({ name: "Glicose pós-prandial", value: "135", unit: "mg/dL" });
    expect(tabela(r)).toBe(false);
    expect(r.faixa).not.toBe("70–99 mg/dL (jejum)");
  });

  it("B12 em pmol/L vai pelo laudo: 235 com '148 a 664' é normal", () => {
    const r = classifyExam({ name: "Vitamina B12", value: "235", unit: "pmol/L", reference: "148 a 664" });
    expect(r.source).toBe("referencia");
    expect(r.status).toBe("normal");
    expect(r.faixa).toBe("148 a 664");
  });

  it("na unidade da tabela (ou sem unidade), a tabela continua mandando", () => {
    expect(classifyExam({ name: "Vitamina B12", value: "235", unit: "pg/mL" }).status).toBe("atencao");
    expect(classifyExam({ name: "Vitamina B12", value: "235" }).source).toBe("tabela");
    expect(classifyExam({ name: "TSH", value: "2,1", unit: "mUI/L" }).source).toBe("tabela");
  });

  it("'Glicose em jejum - soro' continua sendo glicose", () => {
    const r = classifyExam({ name: "Glicose em jejum - soro", value: "92", unit: "mg/dL" });
    expect(r.source).toBe("tabela");
    expect(r.faixa).toBe("70–99 mg/dL (jejum)");
  });

  it("glicose em mmol/L sem laudo não é 'alterado, abaixo' pela faixa em mg/dL", () => {
    const r = classifyExam({ name: "Glicose", value: "5,1", unit: "mmol/L" });
    expect(r.matched).toBe(false);
    expect(classifyExam({ name: "Glicose", value: "5,1", unit: "mmol/L", reference: "3,9 a 5,5" }).status).toBe("normal");
  });

  it("o texto da tabela na referência não vale como laudo de outra unidade", () => {
    // O formulário preenche a referência com o texto da tabela assim que o
    // nome casa; trocada a unidade depois, a glicose de 5,1 mmol/L ia contra
    // "70–99 mg/dL (jejum)" pelo caminho do laudo e saía "alterado, abaixo".
    const r = classifyExam({ name: "Glicose", value: "5,1", unit: "mmol/L", reference: "70–99 mg/dL (jejum)" });
    expect(r.matched).toBe(false);
  });

  it("TSH ultrassensível é o TSH, em qualquer grafia", () => {
    for (const nome of ["TSH ultrassensível", "TSH ultra-sensível", "TSH ultra sensível"]) {
      const r = classifyExam({ name: nome, value: "5,1", unit: "µUI/mL" });
      expect(r.source).toBe("tabela");
      expect(r.faixa).toBe("0,4–4,0 µUI/mL");
    }
  });

  it("potássio e sódio aceitam mmol/L, que é o mesmo número que mEq/L", () => {
    expect(classifyExam({ name: "Potássio", value: "5,6", unit: "mmol/L" }).source).toBe("tabela");
    expect(classifyExam({ name: "Sódio", value: "140", unit: "mmol/L" }).status).toBe("normal");
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

  it("TSH ultrassensível é o TSH: uma linha só no comparativo", () => {
    expect(chaveDoExame("TSH ultrassensível")).toBe("tsh");
    expect(chaveDoExame("TSH ultra-sensível")).toBe("tsh");
    expect(chaveDoExame("TSH ultra sensível")).toBe("tsh");
    expect(chaveDoExame("TSH")).toBe("tsh");
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

  it("só na unidade da entrada (ou sem unidade); potássio e sódio aceitam mmol/L", () => {
    expect(faixaDaTabela("Glicose", 92, {}, "mg/dL")?.faixa).toBe("70–99 mg/dL (jejum)");
    expect(faixaDaTabela("Glicose", 92, {}, "")?.faixa).toBe("70–99 mg/dL (jejum)");
    expect(faixaDaTabela("Glicose", 5.1, {}, "mmol/L")).toBeNull();
    expect(faixaDaTabela("Vitamina B12", 235, {}, "pmol/L")).toBeNull();
    expect(faixaDaTabela("Potássio", 4.2, {}, "mmol/L")?.faixa).toBe("3,5–5,1 mEq/L");
    expect(faixaDaTabela("Sódio", 140, {}, "MMOL/L")?.faixa).toBe("135–145 mEq/L");
  });

  it("entrada que depende do sexo, sem o sexo: não chuta", () => {
    expect(faixaDaTabela("Colesterol HDL", 45, {})).toBeNull();
    expect(faixaDaTabela("Colesterol HDL", 45, { sex: "F" })?.faixa).toBe("≥ 50 mg/dL (mulheres)");
    expect(faixaDaTabela("Colesterol HDL", 45, { sex: "M" })?.faixa).toBe("≥ 40 mg/dL (homens)");
  });
});
