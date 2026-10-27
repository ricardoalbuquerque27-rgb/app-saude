import { describe, it, expect } from "vitest";
import { chaveDoExame, type ExamContext } from "./examRanges";
import {
  avisosDaLinha,
  compararExames,
  dataDoComparativo,
  fraseSemComparacao,
  resumoDoComparativo,
  descricaoDaSerie,
  exameParaGravar,
  notasDoExame,
  semExplicacaoAutomatica,
  situacaoParaANutricionista,
  type LinhaDeExame,
  type LinhaDoComparativo,
} from "./exames";

/** O "hoje" dos testes de data: 2026, o mesmo ano dos resultados de 2026. */
const HOJE = "2026-10-14";

/** Um resultado de exame; só o que o teste quer dizer vai nos argumentos. */
function ex(
  date: string,
  title: string,
  result_value: string | null,
  extra: Partial<LinhaDeExame> = {}
): LinhaDeExame {
  return {
    date,
    title,
    result_value,
    unit: null,
    reference_range: null,
    status: null,
    ...extra,
  };
}

/**
 * Um exame que NÃO está na tabela do app: a faixa só pode vir do laudo, e o
 * teste não muda de resposta se a tabela ganhar mais entradas.
 */
const FORA_DA_TABELA = "Marcador Zeta";

/** O comparativo de um exame só, de dois resultados, com a faixa do laudo. */
function dois(anterior: string, ultimo: string, faixa: string | null = "70 a 99") {
  const [linha] = compararExames(
    [
      ex("2026-07-10", FORA_DA_TABELA, anterior, { reference_range: faixa }),
      ex("2026-10-02", FORA_DA_TABELA, ultimo, { reference_range: faixa }),
    ],
    {}
  );
  return linha;
}

/**
 * A regra da nutricionista (o selo do comparativo e o `status` gravado). Os
 * testes vieram do `classifyExam`, que punha a tabela do app antes do laudo;
 * agora o laudo vem primeiro, como no comparativo (spec do uso pretendido).
 */
describe("situacaoParaANutricionista", () => {
  const sit = (titulo: string, valor: unknown, unidade?: unknown, referencia?: unknown, ctx: ExamContext = {}) =>
    situacaoParaANutricionista(
      { titulo, valor, unidade: (unidade ?? null) as string | null, referencia: (referencia ?? null) as string | null },
      ctx
    );

  describe("a faixa do laudo", () => {
    it("a faixa do laudo com duas vírgulas decimais classifica pelos dois lados", () => {
      expect(sit("Marcador Zeta", "1,5", null, "0,9 a 1,7")).toEqual({ situacao: "normal", faixa: "0,9 a 1,7", fonte: "laudo" });
      expect(sit("Marcador Zeta", "1,8", null, "0,9 a 1,7").situacao).toBe("alterado");
    });

    it("a faixa do laudo vence a da tabela", () => {
      const r = situacaoParaANutricionista({ titulo: "Glicose", valor: 92, unidade: null, referencia: "10 a 20" }, {});
      expect(r).toEqual({ situacao: "alterado", faixa: "10 a 20", fonte: "laudo" });
    });

    it("a borda estrita do laudo vale: 190 com '< 190' está fora", () => {
      expect(sit("Marcador Zeta", "190", null, "< 190").situacao).toBe("alterado");
      expect(sit("Marcador Zeta", "190", null, "≤ 190").situacao).toBe("normal");
      expect(sit("Marcador Zeta", "40", null, "> 40").situacao).toBe("alterado");
    });

    it("laudo em níveis não classifica pela primeira faixa", () => {
      const r = sit("Marcador Zeta", "6,0", null, "Normal: < 5,7 %; Pré-diabetes: 5,7 a 6,4 %; Diabetes: ≥ 6,5 %");
      expect(r).toEqual({ situacao: null, faixa: null, fonte: null });
    });

    it("valor sem número não tem situação", () => {
      expect(sit("Marcador Zeta", "Não reagente", null, "< 1,0")).toEqual({ situacao: null, faixa: null, fonte: null });
    });
  });

  describe("o nome casa pela regra estrita, e a tabela só vale na unidade dela", () => {
    it("Vitamina K não usa a faixa do potássio", () => {
      expect(sit("Vitamina K", "1,2").fonte).toBeNull();
      expect(sit("Vitamina K", "1,2", null, "0,2 a 3,2")).toEqual({ situacao: "normal", faixa: "0,2 a 3,2", fonte: "laudo" });
    });

    it("HCM não usa a faixa da hemoglobina", () => {
      const r = sit("Hemoglobina corpuscular média", "30", "pg", null, { sex: "F" });
      expect(r.fonte).not.toBe("tabela");
      expect(r.faixa ?? "").not.toContain("g/dL");
    });

    it("VLDL e não-HDL não usam a faixa do colesterol total", () => {
      expect(sit("VLDL-colesterol", "35", "mg/dL", "< 30")).toEqual({ situacao: "alterado", faixa: "< 30", fonte: "laudo" });
      expect(sit("Colesterol não-HDL", "170", "mg/dL", "< 160")).toMatchObject({ situacao: "alterado", fonte: "laudo" });
    });

    it("Glicose pós-prandial não usa a faixa da glicose de jejum", () => {
      const r = sit("Glicose pós-prandial", "135", "mg/dL");
      expect(r.fonte).not.toBe("tabela");
      expect(r.faixa).not.toBe("70–99 mg/dL (jejum)");
    });

    it("B12 em pmol/L vai pelo laudo: 235 com '148 a 664' é normal", () => {
      expect(sit("Vitamina B12", "235", "pmol/L", "148 a 664")).toEqual({ situacao: "normal", faixa: "148 a 664", fonte: "laudo" });
    });

    it("sem laudo, na unidade da tabela (ou sem unidade), vale a tabela", () => {
      expect(sit("Vitamina B12", "235", "pg/mL").situacao).toBe("atencao");
      expect(sit("Vitamina B12", "235").fonte).toBe("tabela");
      expect(sit("TSH", "2,1", "mUI/L").fonte).toBe("tabela");
    });

    it("'Glicose em jejum - soro' continua sendo glicose", () => {
      expect(sit("Glicose em jejum - soro", "92", "mg/dL")).toEqual({ situacao: "normal", faixa: "70–99 mg/dL (jejum)", fonte: "tabela" });
    });

    it("glicose em mmol/L sem laudo não é 'alterado' pela faixa em mg/dL", () => {
      expect(sit("Glicose", "5,1", "mmol/L")).toEqual({ situacao: null, faixa: null, fonte: null });
      expect(sit("Glicose", "5,1", "mmol/L", "3,9 a 5,5").situacao).toBe("normal");
    });

    it("o texto da tabela na referência não vale como laudo de outra unidade", () => {
      expect(sit("Glicose", "5,1", "mmol/L", "70–99 mg/dL (jejum)")).toEqual({ situacao: null, faixa: null, fonte: null });
    });

    it("TSH ultrassensível é o TSH, em qualquer grafia", () => {
      for (const nome of ["TSH ultrassensível", "TSH ultra-sensível", "TSH ultra sensível"]) {
        expect(sit(nome, "5,1", "µUI/mL")).toMatchObject({ fonte: "tabela", faixa: "0,4–4,0 µUI/mL" });
      }
    });

    it("potássio e sódio aceitam mmol/L, que é o mesmo número que mEq/L", () => {
      expect(sit("Potássio", "5,6", "mmol/L").fonte).toBe("tabela");
      expect(sit("Sódio", "140", "mmol/L").situacao).toBe("normal");
    });

    it("sem o sexo, o exame que depende dele fica sem situação (não chutamos)", () => {
      expect(sit("HDL-c", 30, "mg/dL")).toEqual({ situacao: null, faixa: null, fonte: null });
      expect(sit("HDL-c", 30, "mg/dL", null, { sex: "F" }).faixa).toBe("≥ 50 mg/dL (mulheres)");
    });
  });

  describe("unidade e referência que não são texto", () => {
    it.each([
      ["número", 12],
      ["nulo", null],
      ["objeto", { texto: "70 a 99" }],
      ["lista", ["70", "99"]],
      ["booleano", true],
    ])("unidade e referência %s não lançam erro", (_rotulo, valor) => {
      // exame da tabela: a unidade que não é texto conta como em branco, e a tabela manda
      expect(sit("Glicose", 92, valor, valor)).toMatchObject({ situacao: "normal", fonte: "tabela" });
      // exame fora da tabela: sem referência legível, sem situação, sem erro
      expect(sit("Marcador Zeta", "1,5", valor, valor)).toEqual({ situacao: null, faixa: null, fonte: null });
    });

    it("referência que não é texto não vira faixa nem some com a que é texto", () => {
      expect(sit("Marcador Zeta", "1,5", 5, "0,9 a 1,7").situacao).toBe("normal");
    });
  });

  describe("as grafias comuns do laudo vão para a entrada da tabela", () => {
    // Homem, porque HDL, TGO e hemoglobina mudam por sexo. Cada valor a tabela julga "alterado".
    const ALTERADO: [string, number, string, string][] = [
      ["LDL-c", 180, "mg/dL", "< 130 mg/dL (ideal < 100)"],
      ["LDL-COLESTEROL (CALCULADO)", 180, "mg/dL", "< 130 mg/dL (ideal < 100)"],
      ["Colesterol LDL calculado", 180, "mg/dL", "< 130 mg/dL (ideal < 100)"],
      ["COLESTEROL LDL - FRIEDEWALD", 180, "mg/dL", "< 130 mg/dL (ideal < 100)"],
      ["HDL-C", 30, "mg/dL", "≥ 40 mg/dL (homens)"],
      ["Colesterol total e frações", 260, "mg/dL", "< 190 mg/dL"],
      ["Colesterol e frações", 260, "mg/dL", "< 190 mg/dL"],
      ["PCR ultrassensível", 12, "mg/L", "< 3 mg/L"],
      ["PCR-US", 12, "mg/L", "< 3 mg/L"],
      ["Proteína C reativa ultrassensível", 12, "mg/L", "< 3 mg/L"],
      ["PCR ultra-sensível", 12, "mg/L", "< 3 mg/L"],
      ["Proteína C reativa ultra sensível", 12, "mg/L", "< 3 mg/L"],
      ["25-Hidroxi Vitamina D", 15, "ng/mL", "30–100 ng/mL"],
      ["VITAMINA D (25-HIDROXI)", 15, "ng/mL", "30–100 ng/mL"],
      ["Glicose basal", 130, "mg/dL", "70–99 mg/dL (jejum)"],
      ["Hemograma - Hemoglobina", 10, "g/dL", "13–17 g/dL (homens)"],
      ["Hemoglobina (hemograma)", 10, "g/dL", "13–17 g/dL (homens)"],
      ["TRANSAMINASE OXALACÉTICA (TGO/AST)", 70, "U/L", "até 40 U/L (homens)"],
      ["Transaminase glutâmico oxalacética (TGO)", 70, "U/L", "até 40 U/L (homens)"],
      ["Transaminase pirúvica (TGP/ALT)", 70, "U/L", "até 41 U/L (homens)"],
      ["Transaminase glutâmico pirúvica (TGP)", 70, "U/L", "até 41 U/L (homens)"],
      ["Triglicérides séricos", 260, "mg/dL", "< 150 mg/dL"],
    ];

    it.each(ALTERADO)("'%s' sem laudo é julgado pela tabela, como 'alterado'", (nome, valor, unidade, faixa) => {
      expect(sit(nome, valor, unidade, null, { sex: "M" })).toEqual({ situacao: "alterado", faixa, fonte: "tabela" });
    });

    it("e sem unidade também: o laudo muitas vezes a omite", () => {
      expect(sit("LDL-c", 180, null, null, { sex: "M" }).situacao).toBe("alterado");
      expect(sit("PCR-US", "12").fonte).toBe("tabela");
    });
  });

  describe("as grafias novas não juntam exame diferente", () => {
    // A lista do teste da chaveDoExame em examRanges.test.ts ("não casa com nenhuma entrada").
    it.each([
      "VLDL-colesterol",
      "VLDL-colesterol (calculado)",
      "Colesterol (VLDL) calculado",
      "Colesterol não-HDL",
      "Colesterol não-HDL calculado",
      "Vitamina K",
      "Vitamina K (25-hidroxi)",
      "Hemoglobina corpuscular média",
      "Hemoglobina corpuscular média (hemograma)",
      "HCM",
      "Glicose pós-prandial",
      "Glicose basal pós-prandial",
      "Capacidade total de ligação do ferro",
      "Capacidade total de ligação do ferro (calculada)",
      "T4",
      "T4 basal",
      "Jejum",
      "Jejum basal",
      "Calculado",
      "Calculada",
      "Friedewald",
      "Ultrassensível",
      "Basal",
      "Hemograma",
      "Transaminase",
      "Séricos",
      "Séricas",
      "Vitamina C",
      "Proteína C",
      "1,25-Dihidroxivitamina D",
      "17-Hidroxiprogesterona",
      "Hemoglobina e frações",
      "Proteínas totais e frações",
      "Troponina ultrassensível",
      "Insulina basal",
      "LDL e HDL",
      "TGO e TGP",
    ])("'%s' sem laudo não tem situação", (nome) => {
      expect(sit(nome, 5, "mg/dL", null, { sex: "M" })).toEqual({ situacao: null, faixa: null, fonte: null });
    });
  });
});

describe("exameParaGravar", () => {
  const base = { data: "2026-10-27", tipo: null, notas: null };
  it("grava a faixa do laudo, aparada, e o status pela regra da nutricionista", () => {
    const r = exameParaGravar({ ...base, titulo: " LDL-c ", valor: "180", unidade: "mg/dL", referencia: " < 130 " }, { sex: "M" });
    expect(r).toMatchObject({ title: "LDL-c", result_value: "180", unit: "mg/dL", reference_range: "< 130", status: "alterado", notes: null });
  });
  it("sem laudo: a referência fica vazia, nunca o texto da tabela, e o status vem da tabela", () => {
    const r = exameParaGravar({ ...base, titulo: "Glicose", valor: "92", unidade: "mg/dL", referencia: null }, {});
    expect(r.reference_range).toBeNull();
    expect(r.status).toBe("normal");
  });
  it("sem faixa nenhuma, o status é nulo", () => {
    expect(exameParaGravar({ ...base, titulo: "Marcador Zeta", valor: "1,5", unidade: null, referencia: null }, {}).status).toBeNull();
  });
  it("notes é só o que a pessoa escreveu", () => {
    expect(exameParaGravar({ ...base, titulo: "TSH", valor: "2,1", unidade: "mUI/L", referencia: "0,4 a 4,0", notas: " jejum de 12 h " }, {}).notes).toBe("jejum de 12 h");
  });
  it("texto vazio vira nulo, e a data e o tipo passam", () => {
    const r = exameParaGravar({ titulo: "TSH", valor: " ", unidade: "", referencia: "  ", data: "2026-09-01", tipo: " Laboratório ", notas: "" }, {});
    expect(r).toEqual({
      title: "TSH", result_value: null, unit: null, reference_range: null,
      status: null, notes: null, date: "2026-09-01", exam_type: "Laboratório",
    });
  });
});

describe("semExplicacaoAutomatica", () => {
  it("tira as frases-modelo do classifyExam antigo", () => {
    expect(semExplicacaoAutomatica("Resultado acima da faixa de referência (< 190 mg/dL). Isto é uma orientação geral — confirme com um médico para avaliação.")).toBeNull();
    expect(semExplicacaoAutomatica("Resultado no limite, acima da faixa (200–900 pg/mL). Vale acompanhar. Isto é uma orientação geral — confirme com um médico para avaliação.")).toBeNull();
    expect(semExplicacaoAutomatica("Resultado dentro da faixa de referência (70–99 mg/dL (jejum)).")).toBeNull();
    expect(semExplicacaoAutomatica("Resultado abaixo da referência informada (15 a 40). Confirme com um médico.")).toBeNull();
    expect(semExplicacaoAutomatica("Resultado dentro da referência informada (15 a 40).")).toBeNull();
    expect(semExplicacaoAutomatica("Dica: informe seu sexo no perfil para uma faixa mais precisa.")).toBeNull();
    expect(semExplicacaoAutomatica("Atenção: faixas de adulto; para menores de 18, siga a referência do pediatra.")).toBeNull();
    expect(semExplicacaoAutomatica("Para avaliar Ferritina eu preciso saber o sexo — as faixas de referência mudam bastante entre homens e mulheres.")).toBeNull();
  });
  it("tira as frases juntas, como o classifyExam as escrevia", () => {
    expect(
      semExplicacaoAutomatica(
        "Resultado acima da faixa de referência (≥ 50 mg/dL (mulheres)). Isto é uma orientação geral — confirme com um médico para avaliação. Dica: informe seu sexo no perfil para uma faixa mais precisa. Atenção: faixas de adulto; para menores de 18, siga a referência do pediatra."
      )
    ).toBeNull();
  });
  it("mantém a nota do paciente e tira o ' — ' que ligava", () => {
    expect(semExplicacaoAutomatica("jejum de 12 h — Resultado dentro da faixa de referência (70–99 mg/dL (jejum)).")).toBe("jejum de 12 h");
  });
  it("nota sem frase-modelo volta igual; vazio vira nulo", () => {
    expect(semExplicacaoAutomatica("Coletado no laboratório X")).toBe("Coletado no laboratório X");
    expect(semExplicacaoAutomatica("Coletado às 7h — em jejum")).toBe("Coletado às 7h — em jejum");
    expect(semExplicacaoAutomatica("")).toBeNull();
    expect(semExplicacaoAutomatica(null)).toBeNull();
  });
});

describe("notasDoExame: o que o paciente vê nas notas", () => {
  it("a leitura antiga do laudo ('Exame (IA)') só gravava nota automática: nada aparece", () => {
    expect(notasDoExame({ exam_type: "Exame (IA)", notes: "Seu LDL está alto; reduza frituras." })).toBeNull();
  });
  it("nas outras, a nota sem a explicação automática", () => {
    expect(notasDoExame({ exam_type: null, notes: "jejum de 12 h — Resultado dentro da faixa de referência (70–99 mg/dL (jejum))." })).toBe("jejum de 12 h");
    expect(notasDoExame({ exam_type: "Laboratório", notes: null })).toBeNull();
  });
});

describe("chaveDoExame", () => {
  it("as grafias da mesma entrada da tabela dão a mesma chave", () => {
    const a = chaveDoExame("Glicose");
    expect(chaveDoExame("Glicemia de jejum")).toBe(a);
    expect(chaveDoExame("glicose em jejum")).toBe(a);
    expect(chaveDoExame("  GLICEMIA ")).toBe(a);
  });

  it("a chave da tabela é a primeira chave da entrada", () => {
    expect(chaveDoExame("Glicemia de jejum")).toBe("glicose");
    expect(chaveDoExame("25 OH Vitamina D")).toBe("vitamina d");
    expect(chaveDoExame("Triglicerídeos")).toBe("triglicerideos");
  });

  it("não confunde o exame com outro que contém o nome dele", () => {
    expect(chaveDoExame("Hemoglobina")).not.toBe(chaveDoExame("Hemoglobina glicada"));
  });

  it("fora da tabela, a chave é o nome sem acento, caixa nem pontuação", () => {
    expect(chaveDoExame("Ácido Fólico")).toBe("acido folico");
    expect(chaveDoExame("  ácido   FÓLICO! ")).toBe("acido folico");
  });
});

describe("compararExames: o que mudou", () => {
  // A tabela "O que mudou" da spec, com a faixa 70 a 99 nas duas pontas.
  it.each([
    // [anterior, último, mudança, diferença, grupo]
    ["90", "92", "segue na faixa", 2, 3],
    ["105", "92", "entrou na faixa", -13, 3],
    ["92", "105", "saiu da faixa", 13, 1],
    ["120", "110", "mais perto da faixa", -10, 2],
    ["110", "120", "mais longe da faixa", 10, 1],
    ["110", "110", "igual ao anterior", 0, 2],
  ] as const)("%s -> %s: %s", (anterior, ultimo, mudanca, diferenca, grupo) => {
    const l = dois(anterior, ultimo);
    expect(l.mudanca).toBe(mudanca);
    expect(l.diferenca).toBe(diferenca);
    expect(l.grupo).toBe(grupo);
    expect(l.anterior).toEqual({ valor: Number(anterior), data: "2026-07-10" });
    expect(l.ultimo.valor).toBe(Number(ultimo));
  });

  it("sem faixa no laudo e fora da tabela: só a diferença, no grupo 2", () => {
    const l = dois("10", "12", null);
    expect(l.mudanca).toBe("sem faixa para comparar");
    expect(l.diferenca).toBe(2);
    expect(l.grupo).toBe(2);
    expect(l.faixa).toBeNull();
    expect(l.faixaTexto).toBeNull();
  });

  it("um resultado só: primeiro resultado, no grupo 4", () => {
    const [l] = compararExames([ex("2026-10-02", FORA_DA_TABELA, "92", { reference_range: "70 a 99" })], {});
    expect(l.mudanca).toBe("primeiro resultado");
    expect(l.anterior).toBeNull();
    expect(l.diferenca).toBeNull();
    expect(l.grupo).toBe(4);
    expect(l.serie).toBeNull();
  });

  it("as bordas da faixa estão dentro", () => {
    expect(dois("70", "99").mudanca).toBe("segue na faixa");
    expect(dois("99.5", "99").mudanca).toBe("entrou na faixa");
    expect(dois("99", "99.5").mudanca).toBe("saiu da faixa");
  });

  it("a diferença não leva o ruído do ponto flutuante", () => {
    // 5,6 - 5,3 dá 0.2999999999999998 em ponto flutuante
    expect(dois("5.3", "5.6", null).diferenca).toBe(0.3);
    expect(dois("5.6", "5.6", null).diferenca).toBe(0);
    expect(Object.is(dois("5.6", "5.6", null).diferenca, 0)).toBe(true);
  });

  it("a distância à faixa não leva o ruído: 0,1 e 0,1 são a mesma distância", () => {
    // 0,1 - 0 é 0.1 e 0,4 - 0,3 é 0.10000000000000003: sem arredondar, o
    // "igual" virava "mais longe da faixa" (e subia para o grupo 1).
    const l = dois("0", "0.4", "0,1 a 0,3");
    expect(l.mudanca).toBe("igual ao anterior");
  });

  it("o mesmo, com o ruído do lado de baixo da faixa", () => {
    // 0,6 - 0,2 é 0.39999999999999997 e 1,3 - 0,9 é 0.4
    expect(dois("0.2", "1.3", "0,6 a 0,9").mudanca).toBe("igual ao anterior");
  });

  it("os dois fora, um de cada lado e à mesma distância: igual ao anterior", () => {
    // Pela régua da spec (distância até a faixa). A diferença mostra o salto.
    const l = dois("60", "109");
    expect(l.mudanca).toBe("igual ao anterior");
    expect(l.diferenca).toBe(49);
  });

  it("'<' é estrito: 200 → 190 com '< 190' fica mais perto, e não entra", () => {
    // O 190 "entrava na faixa" com o '<' lido como "até": o colesterol total
    // da Helena (200 → 190, ref. "< 190") aparecia entre os que estão dentro.
    const perto = dois("200", "190", "< 190");
    expect(perto.mudanca).toBe("mais perto da faixa");
    expect(perto.grupo).toBe(2);
    expect(dois("190", "180", "< 190").mudanca).toBe("entrou na faixa");
    expect(dois("180", "190", "< 190").mudanca).toBe("saiu da faixa");
    expect(dois("40", "45", "> 40").mudanca).toBe("entrou na faixa");
    expect(dois("45", "40", "> 40").mudanca).toBe("saiu da faixa");
    // com "≤" e "até" a borda continua dentro
    expect(dois("200", "190", "≤ 190").mudanca).toBe("entrou na faixa");
    expect(dois("200", "190", "até 190").mudanca).toBe("entrou na faixa");
  });

  it("faixa de um lado só ('< 200' e '>= 40')", () => {
    const max = (a: string, u: string) => dois(a, u, "< 200").mudanca;
    expect(max("250", "180")).toBe("entrou na faixa");
    expect(max("150", "250")).toBe("saiu da faixa");
    const min = (a: string, u: string) => dois(a, u, ">= 40").mudanca;
    expect(min("35", "45")).toBe("entrou na faixa");
    expect(min("45", "35")).toBe("saiu da faixa");
    expect(min("30", "35")).toBe("mais perto da faixa");
  });

  it("o texto do último vem do último resultado; o status gravado não entra", () => {
    const [l] = compararExames(
      [
        ex("2026-07-10", FORA_DA_TABELA, "88", { status: "normal", unit: "mg/dL" }),
        ex("2026-10-02", FORA_DA_TABELA, "92", { status: "atencao", unit: "mg/dL" }),
      ],
      {}
    );
    expect(l.ultimo).toEqual({ valor: 92, texto: "92 mg/dL", data: "2026-10-02" });
  });

  it("o último sem unidade fica só com o texto do valor", () => {
    const [l] = compararExames([ex("2026-10-02", FORA_DA_TABELA, " 92 ")], {});
    expect(l.ultimo).toEqual({ valor: 92, texto: "92", data: "2026-10-02" });
  });
});

describe("compararExames: unidades", () => {
  const glicose = (
    anterior: { v: string; u: string | null },
    ultimo: { v: string; u: string | null }
  ) =>
    compararExames(
      [
        ex("2026-07-10", "Glicose", anterior.v, { unit: anterior.u }),
        ex("2026-10-02", "Glicose", ultimo.v, { unit: ultimo.u }),
      ],
      {}
    )[0];

  it("mmol/L contra mg/dL: não se compara, sem diferença", () => {
    const l = glicose({ v: "5,1", u: "mmol/L" }, { v: "92", u: "mg/dL" });
    expect(l.mudanca).toBe("unidade diferente do anterior");
    expect(l.diferenca).toBeNull();
    expect(l.anterior).toEqual({ valor: 5.1, data: "2026-07-10" });
  });

  it("o grupo vai pelo último: dentro da faixa é 3, fora ou sem faixa é 2", () => {
    // Glicose: a tabela dá 70-99 mg/dL
    expect(glicose({ v: "5,1", u: "mmol/L" }, { v: "92", u: "mg/dL" }).grupo).toBe(3);
    expect(glicose({ v: "5,1", u: "mmol/L" }, { v: "110", u: "mg/dL" }).grupo).toBe(2);
    const semFaixa = compararExames(
      [
        ex("2026-07-10", FORA_DA_TABELA, "5,1", { unit: "mmol/L" }),
        ex("2026-10-02", FORA_DA_TABELA, "92", { unit: "mg/dL" }),
      ],
      {}
    )[0];
    expect(semFaixa.mudanca).toBe("unidade diferente do anterior");
    expect(semFaixa.grupo).toBe(2);
  });

  it("espaço e caixa não fazem unidade diferente", () => {
    const l = glicose({ v: "90", u: "mg/dL" }, { v: "92", u: " MG / DL " });
    expect(l.mudanca).toBe("segue na faixa");
    expect(l.diferenca).toBe(2);
  });

  it("o sinal de micro e a letra grega mi são a mesma unidade", () => {
    // O laudo copiado de um PDF traz um ou outro (U+00B5 e U+03BC).
    const l = compararExames(
      [
        ex("2026-07-10", "Ferro", "70", { unit: "µg/dL" }),
        ex("2026-10-02", "Ferro", "80", { unit: "μg/dL" }),
      ],
      {}
    )[0];
    expect(l.mudanca).toBe("segue na faixa");
  });

  it.each(["mcg/dL", "MCG/DL", "ug/dL", "\u00b5g/dL", "\u03bcg/dL"])(
    "ferro 70 µg/dL depois 80 %s: a mesma unidade, compara pela tabela",
    (unidade) => {
      const [l] = compararExames(
        [
          ex("2026-07-10", "Ferro", "70", { unit: "\u00b5g/dL" }),
          ex("2026-10-02", "Ferro", "80", { unit: unidade }),
        ],
        {}
      );
      expect(l.mudanca).toBe("segue na faixa");
      expect(l.diferenca).toBe(10);
      expect(l.faixa).toEqual({ min: 60, max: 160 });
    }
  );

  it.each(["mUI/L", "MUI/L", "uUI/mL", "\u00b5UI/mL", "\u03bcUI/mL", "mcUI/mL", "mIU/L", "mU/L"])(
    "TSH 2,1 em %s usa a faixa da tabela (µUI/mL)",
    (unit) => {
      // µUI/mL e mUI/L são o mesmo número (1 µUI/mL = 1 mUI/L)
      const [l] = compararExames([ex("2026-10-02", "TSH", "2,1", { unit })], {});
      expect(l.faixa).toEqual({ min: 0.4, max: 4 });
      expect(l.faixaTexto).toBe("0,4–4,0 µUI/mL");
    }
  );

  it("TSH em mUI/L depois de µUI/mL compara normalmente", () => {
    const [l] = compararExames(
      [
        ex("2026-07-10", "TSH", "5,2", { unit: "\u00b5UI/mL" }),
        ex("2026-10-02", "TSH", "2,1", { unit: "mUI/L" }),
      ],
      {}
    );
    expect(l.mudanca).toBe("entrou na faixa");
    expect(l.diferenca).toBe(-3.1);
  });

  it("U/L e UI/L são a mesma unidade (TGO comparado ao anterior)", () => {
    const [l] = compararExames(
      [
        ex("2026-07-10", "TGO", "30", { unit: "U/L" }),
        ex("2026-10-02", "TGO", "35", { unit: "UI/L" }),
      ],
      { sex: "M" }
    );
    expect(l.mudanca).toBe("segue na faixa");
    expect(l.diferenca).toBe(5);
    expect(l.faixa).toEqual({ max: 40 });
  });

  it("UI, IU e U se equivalem; as outras escalas não", () => {
    const mudanca = (a: string, b: string) =>
      compararExames(
        [
          ex("2026-07-10", "Marcador Zeta", "10", { unit: a, reference_range: "5 a 20" }),
          ex("2026-10-02", "Marcador Zeta", "12", { unit: b, reference_range: "5 a 20" }),
        ],
        {}
      )[0].mudanca;
    expect(mudanca("UI/L", "IU/L")).toBe("segue na faixa");
    expect(mudanca("U/L", "IU/L")).toBe("segue na faixa");
    // sem equivalência criada além das pedidas:
    expect(mudanca("U/L", "mU/L")).toBe("unidade diferente do anterior"); // mili não é inteiro
    expect(mudanca("\u00b5UI/mL", "mUI/mL")).toBe("unidade diferente do anterior"); // micro não é mili
    expect(mudanca("\u00b5g/mL", "mg/L")).toBe("unidade diferente do anterior"); // só vale para UI
    expect(mudanca("mg/dL", "g/dL")).toBe("unidade diferente do anterior");
  });

  it("o prefixo micro vale em qualquer unidade: umol/L, µmol/L e mcmol/L são a mesma", () => {
    const mudanca = (a: string, b: string) =>
      compararExames(
        [
          ex("2026-07-10", "Marcador Zeta", "10", { unit: a, reference_range: "5 a 20" }),
          ex("2026-10-02", "Marcador Zeta", "12", { unit: b, reference_range: "5 a 20" }),
        ],
        {}
      )[0].mudanca;
    expect(mudanca("umol/L", "\u00b5mol/L")).toBe("segue na faixa");
    expect(mudanca("mcmol/L", "\u03bcmol/L")).toBe("segue na faixa");
    expect(mudanca("cel/uL", "cel/\u00b5L")).toBe("segue na faixa");
    expect(mudanca("mmol/L", "umol/L")).toBe("unidade diferente do anterior");
  });

  it("mcg não é mg: 70 mg/dL e 80 mcg/dL são unidades diferentes", () => {
    const [l] = compararExames(
      [
        ex("2026-07-10", "Ferro", "70", { unit: "mg/dL" }),
        ex("2026-10-02", "Ferro", "80", { unit: "mcg/dL" }),
      ],
      {}
    );
    expect(l.mudanca).toBe("unidade diferente do anterior");
  });

  it("unidade que falta de um lado conta como a mesma (laudo que omite)", () => {
    expect(glicose({ v: "90", u: null }, { v: "92", u: "mg/dL" }).mudanca).toBe("segue na faixa");
    expect(glicose({ v: "90", u: "mg/dL" }, { v: "92", u: null }).mudanca).toBe("segue na faixa");
    expect(glicose({ v: "90", u: "" }, { v: "92", u: "  " }).mudanca).toBe("segue na faixa");
  });
});

describe("compararExames: o valor", () => {
  it("tira o número do texto: '< 0,5' é 0,5 e '5,6 %' é 5,6", () => {
    const [a] = compararExames([ex("2026-10-02", "Marcador A", "< 0,5")], {});
    expect(a.ultimo.valor).toBe(0.5);
    expect(a.ultimo.texto).toBe("< 0,5");
    const [b] = compararExames([ex("2026-10-02", "Marcador B", "5,6 %")], {});
    expect(b.ultimo.valor).toBe(5.6);
  });

  it("resultado sem número fica fora: exame só com 'reagente' não aparece", () => {
    const linhas = compararExames(
      [
        ex("2026-10-02", "Anti-HCV", "reagente"),
        ex("2026-07-10", "Anti-HCV", "Não reagente"),
        ex("2026-10-02", "Glicose", null),
        ex("2026-10-02", "Ferro", ""),
      ],
      {}
    );
    expect(linhas).toEqual([]);
  });

  it("o resultado sem número no meio dos outros não vira o último nem o anterior", () => {
    const [l] = compararExames(
      [
        ex("2026-04-01", "Marcador A", "40"),
        ex("2026-07-10", "Marcador A", "negativo"),
        ex("2026-10-02", "Marcador A", "44"),
      ],
      {}
    );
    expect(l.ultimo.data).toBe("2026-10-02");
    expect(l.anterior).toEqual({ valor: 40, data: "2026-04-01" });
  });

  it("exame sem nome não entra (não tem como saber de qual é)", () => {
    expect(compararExames([ex("2026-10-02", "   ", "90"), ex("2026-10-02", "???", "90")], {})).toEqual([]);
  });
});

describe("compararExames: mesmo exame, grafias e datas", () => {
  it("Glicose e Glicemia de jejum numa linha só, com o nome do último", () => {
    const linhas = compararExames(
      [
        ex("2026-01-15", "Glicose", "101"),
        ex("2026-07-10", "Glicemia de jejum", "98"),
        ex("2026-10-02", "glicose em jejum", "92"),
        ex("2026-10-02", "Ferritina", "45", { reference_range: "30 a 400" }),
      ],
      {}
    );
    expect(linhas).toHaveLength(2);
    const g = linhas.find((l) => l.chave === "glicose")!;
    expect(g.nome).toBe("glicose em jejum");
    expect(g.serie).toHaveLength(3);
    expect(g.anterior).toEqual({ valor: 98, data: "2026-07-10" });
  });

  it("LDL-c e Colesterol LDL calculado numa linha só: a grafia do laudo junta com a curta", () => {
    // O casamento estrito deixou "LDL-c" e "Colesterol LDL calculado" sem
    // entrada, e o comparativo mostrava uma linha por grafia, cada uma com um
    // resultado só e nada para comparar.
    const linhas = compararExames(
      [
        ex("2026-01-15", "Colesterol LDL", "158", { unit: "mg/dL" }),
        ex("2026-07-10", "LDL-COLESTEROL (CALCULADO)", "141", { unit: "mg/dL" }),
        ex("2026-10-02", "LDL-c", "132", { unit: "mg/dL" }),
        // outro exame do mesmo laudo, que continua à parte
        ex("2026-10-02", "VLDL-colesterol", "24", { unit: "mg/dL" }),
        ex("2026-10-02", "Colesterol não-HDL calculado", "150", { unit: "mg/dL" }),
      ],
      {}
    );
    expect(linhas.map((l) => l.chave).sort()).toEqual(["colesterol nao hdl calculado", "ldl", "vldl colesterol"]);
    const ldl = linhas.find((l) => l.chave === "ldl")!;
    expect(ldl.nome).toBe("LDL-c");
    expect(ldl.serie).toHaveLength(3);
    expect(ldl.anterior).toEqual({ valor: 141, data: "2026-07-10" });
    // e a faixa dele é a da entrada do LDL (o laudo não trouxe), não a do colesterol total
    expect(ldl.faixaTexto).toBe("< 130 mg/dL (ideal < 100)");
    expect(ldl.situacao).toBe("atencao");
  });

  it("nome fora da tabela: grafias que só diferem em acento e caixa são o mesmo exame", () => {
    const linhas = compararExames(
      [ex("2026-07-10", "Ácido Fólico", "8"), ex("2026-10-02", "acido folico", "9")],
      {}
    );
    expect(linhas).toHaveLength(1);
    expect(linhas[0].chave).toBe("acido folico");
    expect(linhas[0].diferenca).toBe(1);
  });

  it("dois resultados no mesmo dia: vale o último da entrada, e o anterior é de outro dia", () => {
    const [l] = compararExames(
      [
        ex("2026-10-02", "Glicose", "95"),
        ex("2026-10-02", "Glicose", "92"),
        ex("2026-07-10", "Glicose", "98"),
      ],
      {}
    );
    expect(l.ultimo.valor).toBe(92);
    expect(l.anterior).toEqual({ valor: 98, data: "2026-07-10" });
  });

  it("a ordem da entrada não muda a conta: o último é o de data maior", () => {
    const [l] = compararExames(
      [
        ex("2026-10-02", "Glicose", "92"),
        ex("2026-01-15", "Glicose", "101"),
        ex("2026-07-10", "Glicose", "98"),
      ],
      {}
    );
    expect(l.ultimo.data).toBe("2026-10-02");
    expect(l.anterior?.data).toBe("2026-07-10");
  });

  it("só resultados do mesmo dia: é primeiro resultado (nunca anterior do mesmo dia)", () => {
    const [l] = compararExames(
      [ex("2026-10-02", "Glicose", "95"), ex("2026-10-02", "Glicose", "92")],
      {}
    );
    expect(l.ultimo.valor).toBe(92);
    expect(l.anterior).toBeNull();
    expect(l.mudanca).toBe("primeiro resultado");
    expect(l.grupo).toBe(4);
  });

  it("o resultado sem número do mesmo dia não apaga o que tem número", () => {
    const [l] = compararExames(
      [ex("2026-10-02", "Marcador A", "44"), ex("2026-10-02", "Marcador A", "ver laudo")],
      {}
    );
    expect(l.ultimo.valor).toBe(44);
  });
});

describe("compararExames: referência em níveis", () => {
  // Lida pela primeira faixa que a expressão achava, a referência em níveis
  // virava uma conclusão errada em piora: a hemoglobina glicada de 5,4 para 6,0
  // com "Normal: < 5,7; Pré-diabetes: 5,7 a 6,4; ..." ia contra 5,7–6,4 e
  // "entrava na faixa", e a glicose de 92 para 112 com "inferior a 100;
  // alterada: 100 a 125" idem.
  const NIVEIS_A1C = "Normal: < 5,7 %; Pré-diabetes: 5,7 a 6,4 %; Diabetes: ≥ 6,5 %";
  const NIVEIS_GLICOSE =
    "Normal: inferior a 100 mg/dL; Glicemia de jejum alterada: 100 a 125 mg/dL; Diabetes: igual ou superior a 126";

  it("hemoglobina glicada 5,4 → 6,0: vale a tabela (< 5,7%), e saiu da faixa", () => {
    const [l] = compararExames(
      [
        ex("2026-03-01", "Hemoglobina glicada", "5,4", { unit: "%", reference_range: NIVEIS_A1C }),
        ex("2026-09-01", "Hemoglobina glicada", "6,0", { unit: "%", reference_range: NIVEIS_A1C }),
      ],
      {}
    );
    expect(l.mudanca).toBe("saiu da faixa");
    expect(l.grupo).toBe(1);
    expect(l.faixaTexto).toBe("< 5,7%");
  });

  it("glicose 92 → 112: vale a tabela (70–99), e saiu da faixa", () => {
    const [l] = compararExames(
      [
        ex("2026-03-01", "Glicose", "92", { unit: "mg/dL", reference_range: NIVEIS_GLICOSE }),
        ex("2026-09-01", "Glicose", "112", { unit: "mg/dL", reference_range: NIVEIS_GLICOSE }),
      ],
      {}
    );
    expect(l.mudanca).toBe("saiu da faixa");
    expect(l.grupo).toBe(1);
  });

  it("fora da tabela, a referência em níveis fica sem faixa para comparar", () => {
    const [l] = compararExames(
      [
        ex("2026-03-01", FORA_DA_TABELA, "8", { reference_range: "Masculino: 8 a 61; Feminino: 5 a 36" }),
        ex("2026-09-01", FORA_DA_TABELA, "40", { reference_range: "Masculino: 8 a 61; Feminino: 5 a 36" }),
      ],
      { sex: "F" }
    );
    expect(l.mudanca).toBe("sem faixa para comparar");
    expect(l.faixa).toBeNull();
  });
});

describe("compararExames: TSH ultrassensível e as unidades de potássio e sódio", () => {
  it("TSH e TSH ultrassensível são uma linha só", () => {
    const linhas = compararExames(
      [
        ex("2026-03-01", "TSH", "2,1", { unit: "\u00b5UI/mL" }),
        ex("2026-09-01", "TSH ultrassensível", "5,1", { unit: "mUI/L" }),
      ],
      {}
    );
    expect(linhas).toHaveLength(1);
    expect(linhas[0].mudanca).toBe("saiu da faixa");
    expect(linhas[0].faixaTexto).toBe("0,4–4,0 \u00b5UI/mL");
  });

  it("K 4,0 mEq/L depois 5,6 mmol/L: compara (é o mesmo número), saiu da faixa", () => {
    const [l] = compararExames(
      [
        ex("2026-03-01", "Potássio", "4,0", { unit: "mEq/L" }),
        ex("2026-09-01", "Potássio", "5,6", { unit: "mmol/L" }),
      ],
      {}
    );
    expect(l.mudanca).toBe("saiu da faixa");
    expect(l.grupo).toBe(1);
    expect(l.diferenca).toBe(1.6);
    expect(l.faixa).toEqual({ min: 3.5, max: 5.1 });
  });

  it("sódio em mmol/L usa a faixa da tabela (mEq/L), e a série junta as duas grafias", () => {
    const [l] = compararExames(
      [
        ex("2026-01-01", "Sódio", "138", { unit: "mEq/L" }),
        ex("2026-05-01", "Sódio", "141", { unit: "mmol/L" }),
        ex("2026-09-01", "Sódio", "147", { unit: "mmol/L" }),
      ],
      {}
    );
    expect(l.faixa).toEqual({ min: 135, max: 145 });
    expect(l.mudanca).toBe("saiu da faixa");
    expect(l.serie?.map((p) => p.valor)).toEqual([138, 141, 147]);
  });

  it("a equivalência é só de potássio e sódio: cálcio em mEq/L e mmol/L não se compara", () => {
    // 1 mmol/L de cálcio são 2 mEq/L: a regra geral daria uma "melhora" falsa.
    const [l] = compararExames(
      [
        ex("2026-03-01", "Cálcio iônico", "2,4", { unit: "mEq/L" }),
        ex("2026-09-01", "Cálcio iônico", "1,2", { unit: "mmol/L" }),
      ],
      {}
    );
    expect(l.mudanca).toBe("unidade diferente do anterior");
  });
});

describe("compararExames: o nome do exame e a tabela", () => {
  it("VLDL-colesterol e colesterol total no mesmo dia ficam em linhas separadas", () => {
    // Juntos, o VLDL (24) era o "último" do dia e apagava o 190 do colesterol
    // total: uma linha só, "VLDL-colesterol, 24, entrou na faixa".
    const linhas = compararExames(
      [
        ex("2026-07-10", "Colesterol total", "200"),
        ex("2026-10-02", "Colesterol total", "190"),
        ex("2026-10-02", "VLDL-colesterol", "24"),
      ],
      {}
    );
    expect(linhas).toHaveLength(2);
    const total = linhas.find((l) => l.chave === "colesterol total")!;
    expect(total.ultimo.valor).toBe(190);
    expect(total.anterior).toEqual({ valor: 200, data: "2026-07-10" });
    const vldl = linhas.find((l) => l.nome === "VLDL-colesterol")!;
    expect(vldl.chave).toBe("vldl colesterol");
    expect(vldl.ultimo.valor).toBe(24);
    expect(vldl.mudanca).toBe("primeiro resultado");
    // e o VLDL não leva a faixa do colesterol total (< 190)
    expect(vldl.faixa).toBeNull();
  });

  it("colesterol não-HDL não é colesterol total", () => {
    const linhas = compararExames(
      [ex("2026-10-02", "Colesterol total", "190"), ex("2026-10-02", "Colesterol não-HDL", "130")],
      {}
    );
    expect(linhas.map((l) => l.chave).sort()).toEqual(["colesterol nao hdl", "colesterol total"]);
  });

  it("Vitamina K não pega a faixa do potássio (a chave 'k')", () => {
    const [l] = compararExames([ex("2026-10-02", "Vitamina K", "1,2")], {});
    expect(l.chave).toBe("vitamina k");
    expect(l.faixa).toBeNull();
    expect(l.faixaTexto).toBeNull();
  });

  it("Hemoglobina corpuscular média não pega a faixa da hemoglobina", () => {
    const [l] = compararExames([ex("2026-10-02", "Hemoglobina corpuscular média", "30")], { sex: "F" });
    expect(l.faixa).toBeNull();
  });

  it("Capacidade total de ligação do ferro não pega a faixa do ferro", () => {
    const [l] = compararExames([ex("2026-10-02", "Capacidade total de ligação do ferro", "320")], {});
    expect(l.chave).toBe("capacidade total de ligacao do ferro");
    expect(l.faixa).toBeNull();
  });

  it("sem a faixa da tabela, o laudo ainda vale", () => {
    const [l] = compararExames(
      [ex("2026-10-02", "Vitamina K", "1,2", { reference_range: "0,2 a 3,2" })],
      {}
    );
    expect(l.faixa).toEqual({ min: 0.2, max: 3.2 });
  });

  it("Glicose, Glicemia de jejum e glicose em jejum continuam juntas", () => {
    const linhas = compararExames(
      [
        ex("2026-01-15", "Glicose", "101"),
        ex("2026-07-10", "Glicemia de jejum", "98"),
        ex("2026-10-02", "glicose em jejum", "92"),
      ],
      {}
    );
    expect(linhas).toHaveLength(1);
    expect(linhas[0].serie).toHaveLength(3);
  });

  it("sufixo redundante junta: Hemoglobina glicada (HbA1c) com Hemoglobina glicada, com a faixa da tabela", () => {
    const linhas = compararExames(
      [
        ex("2026-07-10", "Hemoglobina glicada", "5,9"),
        ex("2026-10-02", "Hemoglobina glicada (HbA1c)", "5,6"),
      ],
      {}
    );
    expect(linhas).toHaveLength(1);
    expect(linhas[0].chave).toBe("hemoglobina glicada");
    expect(linhas[0].nome).toBe("Hemoglobina glicada (HbA1c)");
    expect(linhas[0].faixaTexto).toBe("< 5,7%");
    expect(linhas[0].mudanca).toBe("entrou na faixa");
  });

  it("Glicose (jejum) junta com Glicose; LDL colesterol com Colesterol LDL", () => {
    const g = compararExames(
      [ex("2026-07-10", "Glicose", "98"), ex("2026-10-02", "Glicose (jejum)", "92")],
      {}
    );
    expect(g).toHaveLength(1);
    expect(g[0].diferenca).toBe(-6);
    const ldl = compararExames(
      [ex("2026-07-10", "Colesterol LDL", "145"), ex("2026-10-02", "LDL colesterol", "132")],
      {}
    );
    expect(ldl).toHaveLength(1);
    expect(ldl[0].chave).toBe("ldl");
  });

  it("Colesterol (VLDL) e Glicose pós-prandial ficam separados, sem a faixa errada", () => {
    const linhas = compararExames(
      [
        ex("2026-07-10", "Colesterol total", "200"),
        ex("2026-10-02", "Colesterol total", "190"),
        ex("2026-10-02", "Colesterol (VLDL)", "24"),
        ex("2026-07-10", "Glicose", "98"),
        ex("2026-10-02", "Glicose", "92"),
        ex("2026-10-02", "Glicose pós-prandial", "140"),
      ],
      {}
    );
    expect(linhas.map((l) => l.chave).sort()).toEqual([
      "colesterol total",
      "colesterol vldl",
      "glicose",
      "glicose pos prandial",
    ]);
    expect(linhas.find((l) => l.chave === "colesterol total")!.ultimo.valor).toBe(190);
    expect(linhas.find((l) => l.chave === "glicose")!.ultimo.valor).toBe(92);
    expect(linhas.find((l) => l.chave === "colesterol vldl")!.faixa).toBeNull();
    expect(linhas.find((l) => l.chave === "glicose pos prandial")!.faixa).toBeNull();
  });

  it("T4 sozinho não é T4 livre: chave própria e sem a faixa do livre", () => {
    const [l] = compararExames([ex("2026-10-02", "T4", "8,1")], {});
    expect(l.chave).toBe("t4");
    expect(l.faixa).toBeNull();
    const livre = compararExames([ex("2026-10-02", "T4 livre", "1,2")], {})[0];
    expect(livre.chave).toBe("t4 livre");
    expect(livre.faixa).toEqual({ min: 0.9, max: 1.7 });
  });

  it("Potássio sérico junta com Potássio e usa a faixa da tabela", () => {
    const linhas = compararExames(
      [ex("2026-07-10", "Potássio", "5,4"), ex("2026-10-02", "Potássio sérico", "4,8")],
      {}
    );
    expect(linhas).toHaveLength(1);
    expect(linhas[0].chave).toBe("potassio");
    expect(linhas[0].faixa).toEqual({ min: 3.5, max: 5.1 });
    expect(linhas[0].mudanca).toBe("entrou na faixa");
  });

  it("Glicose plasmática junta com Glicose; Glicose na urina fica separada, sem a faixa da glicose", () => {
    const linhas = compararExames(
      [
        ex("2026-07-10", "Glicose", "98"),
        ex("2026-10-02", "Glicose plasmática", "92"),
        ex("2026-10-02", "Glicose na urina", "0"),
      ],
      {}
    );
    expect(linhas.map((l) => l.chave).sort()).toEqual(["glicose", "glicose na urina"]);
    expect(linhas.find((l) => l.chave === "glicose")!.ultimo.valor).toBe(92);
    expect(linhas.find((l) => l.chave === "glicose na urina")!.faixa).toBeNull();
  });

  it("'Soro' sozinho não casa com a tabela", () => {
    const [l] = compararExames([ex("2026-10-02", "Soro", "92")], {});
    expect(l.chave).toBe("soro");
    expect(l.faixa).toBeNull();
  });

  it("palavra que cabe em duas entradas ('Vitamina'): sem faixa da tabela", () => {
    const [l] = compararExames([ex("2026-10-02", "Vitamina", "30")], {});
    expect(l.chave).toBe("vitamina");
    expect(l.faixa).toBeNull();
  });

  it("Hemoglobina e Hemoglobina glicada seguem separadas", () => {
    const linhas = compararExames(
      [
        ex("2026-07-10", "Hemoglobina", "13,5"),
        ex("2026-10-02", "Hemoglobina", "14"),
        ex("2026-07-10", "Hemoglobina glicada", "5,9"),
        ex("2026-10-02", "Hemoglobina glicada", "5,6"),
      ],
      { sex: "M" }
    );
    expect(linhas.map((l) => l.chave).sort()).toEqual(["hemoglobina", "hemoglobina glicada"]);
    const hb = linhas.find((l) => l.chave === "hemoglobina")!;
    expect(hb.faixaTexto).toBe("13–17 g/dL (homens)");
    const a1c = linhas.find((l) => l.chave === "hemoglobina glicada")!;
    expect(a1c.faixaTexto).toBe("< 5,7%");
  });
});

describe("compararExames: a faixa", () => {
  it("a do laudo do último resultado, com o texto e os números", () => {
    const [l] = compararExames(
      [
        ex("2026-07-10", FORA_DA_TABELA, "92", { reference_range: "10 a 20" }),
        ex("2026-10-02", FORA_DA_TABELA, "92", { reference_range: " 70 a 99 " }),
      ],
      {}
    );
    expect(l.faixa).toEqual({ min: 70, max: 99 });
    expect(l.faixaTexto).toBe("70 a 99");
  });

  it("a mesma faixa (a do último) vale para os dois valores", () => {
    // O laudo do anterior dizia '10 a 20'; se essa régua valesse para ele, o 15
    // estaria dentro e o 92 (fora de 10 a 20) seria "saiu da faixa". Com a do
    // último, 70 a 99, o 15 está fora e o 92 dentro: "entrou".
    const [l] = compararExames(
      [
        ex("2026-07-10", FORA_DA_TABELA, "15", { reference_range: "10 a 20" }),
        ex("2026-10-02", FORA_DA_TABELA, "92", { reference_range: "70 a 99" }),
      ],
      {}
    );
    expect(l.mudanca).toBe("entrou na faixa");
  });

  it("sem faixa no último, a da tabela; a do laudo antigo não vale", () => {
    const [l] = compararExames(
      [
        ex("2026-07-10", "Vitamina D", "18", { reference_range: "10 a 20" }),
        ex("2026-10-02", "Vitamina D", "38"),
      ],
      {}
    );
    expect(l.faixa).toEqual({ min: 30, max: 100 });
    expect(l.faixaTexto).toBe("30–100 ng/mL");
    expect(l.mudanca).toBe("entrou na faixa");
  });

  it("a faixa do laudo vence a da tabela", () => {
    const [l] = compararExames(
      [
        ex("2026-07-10", "Glicose", "85"),
        ex("2026-10-02", "Glicose", "92", { reference_range: "80 a 90" }),
      ],
      {}
    );
    expect(l.faixa).toEqual({ min: 80, max: 90 });
    expect(l.mudanca).toBe("saiu da faixa");
  });

  it("laudo que não dá para ler cai na tabela", () => {
    const [l] = compararExames(
      [ex("2026-10-02", "Vitamina D", "38", { reference_range: "ver tabela do laboratório" })],
      {}
    );
    expect(l.faixa).toEqual({ min: 30, max: 100 });
  });

  it("a tabela pelo sexo do paciente", () => {
    const hdl = [ex("2026-07-10", "Colesterol HDL", "42"), ex("2026-10-02", "Colesterol HDL", "45")];
    const mulher = compararExames(hdl, { sex: "F" })[0];
    expect(mulher.faixa).toEqual({ min: 50 });
    expect(mulher.mudanca).toBe("mais perto da faixa");
    const homem = compararExames(hdl, { sex: "M" })[0];
    expect(homem.faixa).toEqual({ min: 40 });
    expect(homem.mudanca).toBe("segue na faixa");
  });

  it("exame que depende do sexo, sem o sexo e sem laudo: sem faixa (não chuta)", () => {
    const [l] = compararExames(
      [ex("2026-07-10", "Colesterol HDL", "42"), ex("2026-10-02", "Colesterol HDL", "45")],
      { sex: null }
    );
    expect(l.faixa).toBeNull();
    expect(l.mudanca).toBe("sem faixa para comparar");
    expect(l.diferenca).toBe(3);
  });

  it("faixa com duas vírgulas decimais não perde a segunda casa", () => {
    // O parseReferenceRange trocava só a PRIMEIRA vírgula ('0,9 a 1,7' virava
    // 0,9 a 1 e o 1,5 normal aparecia como 'saiu da faixa'); a correção mora
    // nele (testada em examRanges.test.ts) e este caso garante que chega aqui.
    const laudo = compararExames(
      [
        ex("2026-07-10", FORA_DA_TABELA, "1.0", { reference_range: "0,9 a 1,7" }),
        ex("2026-10-02", FORA_DA_TABELA, "1,5", { reference_range: "0,9 a 1,7" }),
      ],
      {}
    )[0];
    expect(laudo.faixa).toEqual({ min: 0.9, max: 1.7 });
    expect(laudo.mudanca).toBe("segue na faixa");
    // O mesmo para a tabela do app ('3,5–5,1 mEq/L' do potássio).
    const tabela = compararExames(
      [ex("2026-07-10", "Potássio", "4,0"), ex("2026-10-02", "Potássio", "5,1")],
      {}
    )[0];
    expect(tabela.faixa).toEqual({ min: 3.5, max: 5.1 });
    expect(tabela.mudanca).toBe("segue na faixa");
  });

  it("a tabela só vale com a unidade da tabela: glicose em mmol/L fica sem faixa", () => {
    // 5,1 mmol/L é glicose normal; contra 70-99 mg/dL seria "abaixo da faixa".
    const um = compararExames([ex("2026-10-02", "Glicose", "5,1", { unit: "mmol/L" })], {})[0];
    expect(um.faixa).toBeNull();
    expect(um.faixaTexto).toBeNull();

    const dois = compararExames(
      [
        ex("2026-07-10", "Glicose", "5,6", { unit: "mmol/L" }),
        ex("2026-10-02", "Glicose", "5,1", { unit: "mmol/L" }),
      ],
      {}
    )[0];
    expect(dois.mudanca).toBe("sem faixa para comparar");
    expect(dois.diferenca).toBe(-0.5);
    expect(dois.grupo).toBe(2);
  });

  it("em mmol/L, o laudo ainda dá a faixa", () => {
    const [l] = compararExames(
      [
        ex("2026-07-10", "Glicose", "5,9", { unit: "mmol/L", reference_range: "3,9 a 5,5" }),
        ex("2026-10-02", "Glicose", "5,1", { unit: "mmol/L", reference_range: "3,9 a 5,5" }),
      ],
      {}
    );
    expect(l.faixa).toEqual({ min: 3.9, max: 5.5 });
    expect(l.mudanca).toBe("entrou na faixa");
  });

  it("a tabela vale sem unidade e com a unidade dela, de qualquer caixa e espaço", () => {
    const faixa = (unit: string | null) =>
      compararExames([ex("2026-10-02", "Glicose", "92", { unit })], {})[0].faixa;
    expect(faixa(null)).toEqual({ min: 70, max: 99 });
    expect(faixa("")).toEqual({ min: 70, max: 99 });
    expect(faixa(" MG / DL ")).toEqual({ min: 70, max: 99 });
    expect(faixa("mmol/L")).toBeNull();
  });

  it("a faixa também sai com um resultado só (o minigráfico e a coluna 'ref.' pedem)", () => {
    const [l] = compararExames([ex("2026-10-02", "Ferritina", "45")], { sex: "M" });
    expect(l.faixa).toEqual({ min: 30, max: 400 });
    expect(l.faixaTexto).toBe("30–400 ng/mL (homens)");
  });
});

describe("compararExames: a ordem", () => {
  // TG saiu (1), LDL mais perto (2), Vit D entrou (3), ferritina primeiro (4).
  // A entrada vem embaralhada de propósito.
  const linhas = [
    ex("2026-10-02", "Ferritina", "45"),
    ex("2026-01-15", "Vitamina D", "18"),
    ex("2026-07-10", "Vitamina D", "24"),
    ex("2026-10-02", "Vitamina D", "38"),
    ex("2026-07-10", "Triglicerídeos", "141"),
    ex("2026-10-02", "Triglicerídeos", "168"),
    ex("2026-07-10", "LDL", "145"),
    ex("2026-10-02", "LDL", "132"),
  ];

  it("saiu, depois mais perto, depois entrou, depois o resultado único", () => {
    const r = compararExames(linhas, { sex: "M" });
    expect(r.map((l) => l.chave)).toEqual(["triglicerideos", "ldl", "vitamina d", "ferritina"]);
    expect(r.map((l) => l.grupo)).toEqual([1, 2, 3, 4]);
    expect(r.map((l) => l.mudanca)).toEqual([
      "saiu da faixa",
      "mais perto da faixa",
      "entrou na faixa",
      "primeiro resultado",
    ]);
  });

  it("no mesmo grupo, o de último resultado mais recente primeiro", () => {
    const r = compararExames(
      [
        ex("2026-07-10", "Colesterol total", "230"),
        ex("2026-08-01", "Colesterol total", "220"), // mais perto, 01/08
        ex("2026-07-10", "LDL", "145"),
        ex("2026-10-02", "LDL", "132"), // mais perto, 02/10
        ex("2026-06-01", "Triglicerídeos", "160"),
        ex("2026-09-05", "Triglicerídeos", "155"), // mais perto, 05/09
      ],
      {}
    );
    expect(r.map((l) => l.grupo)).toEqual([2, 2, 2]);
    expect(r.map((l) => l.ultimo.data)).toEqual(["2026-10-02", "2026-09-05", "2026-08-01"]);
  });

  it("mesmo grupo e mesma data: pelo nome, para a ordem não depender da entrada", () => {
    const entrada = [
      ex("2026-07-10", "Zinco", "70", { reference_range: "60 a 120" }),
      ex("2026-10-02", "Zinco", "75", { reference_range: "60 a 120" }),
      ex("2026-07-10", "Cobre", "90", { reference_range: "70 a 140" }),
      ex("2026-10-02", "Cobre", "95", { reference_range: "70 a 140" }),
    ];
    const a = compararExames(entrada, {}).map((l) => l.nome);
    const b = compararExames([...entrada].reverse(), {}).map((l) => l.nome);
    expect(a).toEqual(["Cobre", "Zinco"]);
    expect(b).toEqual(a);
  });

  it("mesmo grupo e mesma data: o nome decide, não a chave", () => {
    // 'Colesterol HDL' tem a chave 'hdl' e 'Creatinina' a chave 'creatinina':
    // pela chave a Creatinina viria primeiro; pelo nome que o nutri lê, não.
    const r = compararExames(
      [
        ex("2026-07-10", "Creatinina", "1,0"),
        ex("2026-10-02", "Creatinina", "1,1"),
        ex("2026-07-10", "Colesterol HDL", "42"),
        ex("2026-10-02", "Colesterol HDL", "45"),
      ],
      { sex: "M" }
    );
    expect(r.map((l) => l.grupo)).toEqual([3, 3]);
    expect(r.map((l) => l.nome)).toEqual(["Colesterol HDL", "Creatinina"]);
  });

  it("'sem faixa' e 'unidade diferente' com o último fora ou sem faixa vão no grupo 2; dentro, no 3", () => {
    const r = compararExames(
      [
        // sem faixa para comparar -> 2
        ex("2026-07-10", "Marcador A", "10"),
        ex("2026-10-02", "Marcador A", "12"),
        // unidade diferente, último dentro da faixa da tabela -> 3
        ex("2026-07-10", "Glicose", "5,1", { unit: "mmol/L" }),
        ex("2026-10-02", "Glicose", "92", { unit: "mg/dL" }),
        // segue fora (mais perto) -> 2
        ex("2026-07-10", "LDL", "145"),
        ex("2026-10-02", "LDL", "132"),
      ],
      {}
    );
    const g = Object.fromEntries(r.map((l) => [l.chave, l.grupo]));
    expect(g).toEqual({ "marcador a": 2, glicose: 3, ldl: 2 });
  });
});

describe("compararExames: a série do minigráfico", () => {
  const vitD = (...v: [string, string, string | null][]) =>
    v.map(([d, valor, unit]) => ex(d, "Vitamina D", valor, { unit }));

  it("3 resultados: 3 pontos, em ordem de data, com o valor numérico", () => {
    const [l] = compararExames(
      vitD(["2026-10-02", "38", "ng/mL"], ["2026-01-15", "18", "ng/mL"], ["2026-07-10", "24", "ng/mL"]),
      {}
    );
    expect(l.serie).toEqual([
      { data: "2026-01-15", valor: 18 },
      { data: "2026-07-10", valor: 24 },
      { data: "2026-10-02", valor: 38 },
    ]);
  });

  it("2 resultados: sem série", () => {
    const [l] = compararExames(vitD(["2026-07-10", "24", "ng/mL"], ["2026-10-02", "38", "ng/mL"]), {});
    expect(l.serie).toBeNull();
  });

  it("3 resultados, um em outra unidade: sem série", () => {
    const [l] = compararExames(
      vitD(["2026-01-15", "45", "nmol/L"], ["2026-07-10", "24", "ng/mL"], ["2026-10-02", "38", "ng/mL"]),
      {}
    );
    expect(l.serie).toBeNull();
  });

  it("4 resultados, um em outra unidade: a série fica com os 3 da unidade do último", () => {
    const [l] = compararExames(
      vitD(
        ["2025-10-02", "45", "nmol/L"],
        ["2026-01-15", "18", "ng/mL"],
        ["2026-07-10", "24", "ng/mL"],
        ["2026-10-02", "38", "NG/ML"]
      ),
      {}
    );
    expect(l.serie?.map((p) => p.valor)).toEqual([18, 24, 38]);
  });

  it("a série só junta unidades iguais: sem unidade só com sem unidade", () => {
    // Na comparação com o anterior a falta de unidade vale como "a mesma"; na
    // série não: ela mistura 3 pontos num desenho só, e um 45 nmol/L ao lado
    // de 24 mcg/dL e 30 sem unidade seria uma linha sem sentido.
    const zinco = (...v: [string, string, string | null][]) =>
      compararExames(v.map(([d, valor, unit]) => ex(d, "Zinco", valor, { unit })), {})[0];

    expect(
      zinco(["2026-01-15", "45", "nmol/L"], ["2026-07-10", "24", "mcg/dL"], ["2026-10-02", "30", null]).serie
    ).toBeNull();
    // o último com unidade não puxa quem ficou sem
    expect(
      zinco(["2026-01-15", "18", null], ["2026-07-10", "24", "ng/mL"], ["2026-10-02", "38", "ng/mL"]).serie
    ).toBeNull();
    // todos sem unidade: é a mesma "unidade"
    expect(
      zinco(["2026-01-15", "18", null], ["2026-07-10", "24", ""], ["2026-10-02", "38", "  "]).serie
    ).toHaveLength(3);
  });

  it("a comparação com o anterior continua tratando a falta de unidade como a mesma", () => {
    const [l] = compararExames(
      [
        ex("2026-07-10", "Zinco", "24", { unit: "mcg/dL" }),
        ex("2026-10-02", "Zinco", "30"),
      ],
      {}
    );
    expect(l.mudanca).toBe("sem faixa para comparar");
    expect(l.diferenca).toBe(6);
  });

  it("dois no mesmo dia contam um ponto só (3 resultados em 2 dias: sem série)", () => {
    const [l] = compararExames(
      vitD(["2026-07-10", "24", "ng/mL"], ["2026-10-02", "30", "ng/mL"], ["2026-10-02", "38", "ng/mL"]),
      {}
    );
    expect(l.serie).toBeNull();
  });

  it("resultado sem número não entra na série", () => {
    const [l] = compararExames(
      vitD(
        ["2026-01-15", "18", "ng/mL"],
        ["2026-04-01", "indetectável", "ng/mL"],
        ["2026-07-10", "24", "ng/mL"]
      ),
      {}
    );
    expect(l.serie).toBeNull();
  });
});

describe("resumoDoComparativo", () => {
  it("melhores: entrou, segue, mais perto; piores: saiu, mais longe; e os de um resultado", () => {
    const r = compararExames(
      [
        ex("2026-10-02", "Ferritina", "45"),
        ex("2026-07-10", "Vitamina D", "18"),
        ex("2026-10-02", "Vitamina D", "38"),
        ex("2026-07-10", "Triglicerídeos", "141"),
        ex("2026-10-02", "Triglicerídeos", "168"),
        ex("2026-07-10", "LDL", "145"),
        ex("2026-10-02", "LDL", "132"),
      ],
      { sex: "M" }
    );
    expect(resumoDoComparativo(r)).toEqual({ melhores: 2, piores: 1, umResultado: 1 });
  });

  it("igual, sem faixa e unidade diferente não contam nem como melhor nem como pior", () => {
    const r = compararExames(
      [
        ex("2026-07-10", "Marcador A", "10"),
        ex("2026-10-02", "Marcador A", "12"),
        ex("2026-07-10", "Marcador B", "110", { reference_range: "70 a 99" }),
        ex("2026-10-02", "Marcador B", "110", { reference_range: "70 a 99" }),
        ex("2026-07-10", "Glicose", "5,1", { unit: "mmol/L" }),
        ex("2026-10-02", "Glicose", "92", { unit: "mg/dL" }),
      ],
      {}
    );
    expect(resumoDoComparativo(r)).toEqual({ melhores: 0, piores: 0, umResultado: 0 });
  });

  it("sem linhas: tudo zero", () => {
    expect(resumoDoComparativo([])).toEqual({ melhores: 0, piores: 0, umResultado: 0 });
  });
});

describe("descricaoDaSerie", () => {
  const vitD = (): LinhaDoComparativo =>
    compararExames(
      [
        ex("2026-01-15", "Vitamina D", "18"),
        ex("2026-07-10", "Vitamina D", "24"),
        ex("2026-10-02", "Vitamina D", "38"),
      ],
      {}
    )[0];

  it("os pontos em dd/mm e a faixa", () => {
    expect(descricaoDaSerie(vitD(), HOJE)).toBe(
      "Vitamina D: 18 em 15/01, 24 em 10/07, 38 em 02/10; faixa de 30 a 100."
    );
  });

  it("valor com decimais sai com vírgula", () => {
    const [l] = compararExames(
      [
        ex("2026-01-15", "TSH", "2.35"),
        ex("2026-07-10", "TSH", "3,1"),
        ex("2026-10-02", "TSH", "1.9"),
      ],
      {}
    );
    expect(descricaoDaSerie(l, HOJE)).toBe("TSH: 2,35 em 15/01, 3,1 em 10/07, 1,9 em 02/10; faixa de 0,4 a 4.");
  });

  it("faixa de um lado só", () => {
    const tres = (ref: string) =>
      compararExames(
        [
          ex("2026-01-15", FORA_DA_TABELA, "10", { reference_range: ref }),
          ex("2026-07-10", FORA_DA_TABELA, "12", { reference_range: ref }),
          ex("2026-10-02", FORA_DA_TABELA, "14", { reference_range: ref }),
        ],
        {}
      )[0];
    expect(descricaoDaSerie(tres("até 20"), HOJE)).toBe(
      "Marcador Zeta: 10 em 15/01, 12 em 10/07, 14 em 02/10; faixa até 20."
    );
    expect(descricaoDaSerie(tres(">= 5"), HOJE)).toBe(
      "Marcador Zeta: 10 em 15/01, 12 em 10/07, 14 em 02/10; faixa a partir de 5."
    );
  });

  it("borda estrita: 'abaixo de' e 'acima de', não 'até' e 'a partir de'", () => {
    const tres = (ref: string) =>
      compararExames(
        [
          ex("2026-01-15", FORA_DA_TABELA, "10", { reference_range: ref }),
          ex("2026-07-10", FORA_DA_TABELA, "12", { reference_range: ref }),
          ex("2026-10-02", FORA_DA_TABELA, "14", { reference_range: ref }),
        ],
        {}
      )[0];
    expect(descricaoDaSerie(tres("< 20"), HOJE)).toBe(
      "Marcador Zeta: 10 em 15/01, 12 em 10/07, 14 em 02/10; faixa abaixo de 20."
    );
    expect(descricaoDaSerie(tres("> 5"), HOJE)).toBe(
      "Marcador Zeta: 10 em 15/01, 12 em 10/07, 14 em 02/10; faixa acima de 5."
    );
  });

  it("sem faixa, a frase termina nos pontos", () => {
    const [l] = compararExames(
      [
        ex("2026-01-15", FORA_DA_TABELA, "10"),
        ex("2026-07-10", FORA_DA_TABELA, "12"),
        ex("2026-10-02", FORA_DA_TABELA, "14"),
      ],
      {}
    );
    expect(descricaoDaSerie(l, HOJE)).toBe("Marcador Zeta: 10 em 15/01, 12 em 10/07, 14 em 02/10.");
  });

  it("linha sem série descreve o último resultado", () => {
    const [l] = compararExames([ex("2026-10-02", "Ferritina", "45")], {});
    expect(descricaoDaSerie(l, HOJE)).toBe("Ferritina: 45 em 02/10.");
  });
});

describe("compararExames: referência gravada que é o texto da tabela", () => {
  // O casamento frouxo antigo do classifyExam gravava em `reference_range` o
  // texto da entrada que ele achava: o VLDL-colesterol saía com "< 190 mg/dL"
  // (o do colesterol total), a glicose pós-prandial com "70–99 mg/dL (jejum)".
  // Lido como laudo, o VLDL de 24 para 35 "seguia na faixa".
  it("VLDL 24 → 35 com 'ref. < 190 mg/dL' gravada: sem faixa para comparar", () => {
    const [l] = compararExames(
      [
        ex("2026-03-01", "VLDL-colesterol", "24", { unit: "mg/dL", reference_range: "< 190 mg/dL", status: "normal" }),
        ex("2026-09-01", "VLDL-colesterol", "35", { unit: "mg/dL", reference_range: "< 190 mg/dL", status: "normal" }),
      ],
      {}
    );
    expect(l.mudanca).toBe("sem faixa para comparar");
    expect(l.faixa).toBeNull();
    expect(l.faixaTexto).toBeNull();
    expect(l.situacao).toBeNull();
  });

  it("Glicose pós-prandial com o texto da glicose de jejum: sem faixa", () => {
    const [l] = compararExames(
      [
        ex("2026-03-01", "Glicose pós-prandial", "120", { unit: "mg/dL", reference_range: "70–99 mg/dL (jejum)" }),
        ex("2026-09-01", "Glicose pós-prandial", "135", { unit: "mg/dL", reference_range: " 70–99 mg/dL (jejum) " }),
      ],
      {}
    );
    expect(l.mudanca).toBe("sem faixa para comparar");
  });

  it("o texto da tabela vale como a tabela, com a regra estrita e a unidade", () => {
    // Para a glicose em mg/dL, é a faixa dela mesma; em mmol/L, nenhuma.
    const [mg] = compararExames(
      [ex("2026-09-01", "Glicose", "92", { unit: "mg/dL", reference_range: "70–99 mg/dL (jejum)" })],
      {}
    );
    expect(mg.faixa).toEqual({ min: 70, max: 99 });
    expect(mg.faixaTexto).toBe("70–99 mg/dL (jejum)");
    const [mmol] = compararExames(
      [ex("2026-09-01", "Glicose", "5,1", { unit: "mmol/L", reference_range: "70–99 mg/dL (jejum)" })],
      {}
    );
    expect(mmol.faixa).toBeNull();
  });
});

describe("compararExames: a situação (o selo do último)", () => {
  // O selo vinha do `status` gravado, que o classifyExam antigo calculava pela
  // tabela em outra unidade: a B12 de 235 pmol/L aparecia "Atenção" ao lado
  // de "ref. 148 a 664", que a põe dentro. Agora sai da mesma faixa da linha.
  it("faixa do laudo: dentro é normal, mesmo com 'atencao' gravado (B12 em pmol/L)", () => {
    const [l] = compararExames(
      [
        ex("2026-03-01", "Vitamina B12", "310", { unit: "pg/mL", reference_range: "200 a 900", status: "normal" }),
        ex("2026-09-01", "Vitamina B12", "235", { unit: "pmol/L", reference_range: "148 a 664", status: "atencao" }),
      ],
      {}
    );
    expect(l.situacao).toBe("normal");
    expect(l.mudanca).toBe("unidade diferente do anterior");
  });

  it("faixa do laudo: fora é alterado ('Colesterol não-HDL 170, ref < 160')", () => {
    const [l] = compararExames(
      [
        ex("2026-03-01", "Colesterol não-HDL", "150", { unit: "mg/dL", reference_range: "< 160" }),
        ex("2026-09-01", "Colesterol não-HDL", "170", { unit: "mg/dL", reference_range: "< 160", status: "normal" }),
      ],
      {}
    );
    expect(l.situacao).toBe("alterado");
    // na borda estrita também
    const [borda] = compararExames([ex("2026-09-01", FORA_DA_TABELA, "190", { reference_range: "< 190" })], {});
    expect(borda.situacao).toBe("alterado");
  });

  it("faixa da tabela: os três níveis da entrada", () => {
    const glicose = (v: string) => compararExames([ex("2026-09-01", "Glicose", v, { unit: "mg/dL" })], {})[0].situacao;
    expect(glicose("92")).toBe("normal");
    expect(glicose("110")).toBe("atencao");
    expect(glicose("130")).toBe("alterado");
  });

  it("sem faixa: sem selo", () => {
    const [l] = compararExames([ex("2026-09-01", FORA_DA_TABELA, "12", { status: "alterado" })], {});
    expect(l.situacao).toBeNull();
  });
});

describe("compararExames: quantos resultados", () => {
  it("os com número, um por dia, em qualquer unidade", () => {
    const [l] = compararExames(
      [
        ex("2026-01-15", "Vitamina D", "45", { unit: "nmol/L" }),
        ex("2026-04-01", "Vitamina D", "indetectável", { unit: "ng/mL" }),
        ex("2026-07-10", "Vitamina D", "24", { unit: "ng/mL" }),
        ex("2026-07-10", "Vitamina D", "25", { unit: "ng/mL" }),
        ex("2026-10-02", "Vitamina D", "38", { unit: "ng/mL" }),
      ],
      {}
    );
    // 45 nmol/L, 25 e 38: a série (só a unidade do último) teria 2 e não sai;
    // "2 resultados" mentiria sobre os três.
    expect(l.resultados).toBe(3);
    expect(l.serie).toBeNull();
  });

  it("um resultado: 1", () => {
    expect(compararExames([ex("2026-10-02", "Ferritina", "45")], {})[0].resultados).toBe(1);
  });
});

describe("compararExames: resultado sem número mais novo que o último", () => {
  // O resultado sem número ficava fora em silêncio: com 92, 95 e depois
  // "Amostra hemolisada", a linha dizia "95, segue na faixa" e não contava
  // que veio um resultado depois.
  const glicose = [
    ex("2026-03-01", "Glicose", "92", { unit: "mg/dL" }),
    ex("2026-06-01", "Glicose", "95", { unit: "mg/dL" }),
    ex("2026-09-01", "Glicose", "Amostra hemolisada", { unit: "mg/dL" }),
  ];

  it("a linha diz o que veio depois, e a comparação segue entre os números", () => {
    const [l] = compararExames(glicose, {});
    expect(l.ultimo.valor).toBe(95);
    expect(l.mudanca).toBe("segue na faixa");
    expect(l.depois).toEqual({ texto: "Amostra hemolisada", data: "2026-09-01" });
    expect(avisosDaLinha(l, HOJE)).toEqual(["depois: Amostra hemolisada em 01/09"]);
  });

  it("o sem número do mesmo dia do último, ou de antes, não é 'depois'", () => {
    const mesmoDia = compararExames(
      [ex("2026-06-01", "Glicose", "95"), ex("2026-06-01", "Glicose", "ver laudo")],
      {}
    )[0];
    expect(mesmoDia.depois).toBeNull();
    const antes = compararExames([ex("2026-03-01", "Glicose", "negativo"), ex("2026-06-01", "Glicose", "95")], {})[0];
    expect(antes.depois).toBeNull();
    expect(avisosDaLinha(antes, HOJE)).toEqual([]);
  });

  it("vale o mais novo dos sem número; sem texto, 'sem resultado'", () => {
    const [l] = compararExames(
      [
        ex("2026-06-01", "Glicose", "95"),
        ex("2026-08-01", "Glicose", "Amostra hemolisada"),
        ex("2026-09-01", "Glicose", null),
      ],
      {}
    );
    expect(l.depois).toEqual({ texto: "sem resultado", data: "2026-09-01" });
  });
});

describe("compararExames: mais de um resultado no mesmo dia", () => {
  // Dois laudos lançados no mesmo dia (a IA grava a data de hoje quando não
  // acha a do laudo): vale o último lançado, e o outro sumia sem aviso.
  it("valores diferentes na mesma data: a linha avisa", () => {
    const [l] = compararExames(
      [
        ex("2026-07-10", "Glicose", "98"),
        ex("2026-10-02", "Glicose", "110"),
        ex("2026-10-02", "Glicose", "92"),
      ],
      {}
    );
    expect(l.ultimo.valor).toBe(92);
    expect(l.maisDeUmNoDia).toEqual(["2026-10-02"]);
    expect(avisosDaLinha(l, HOJE)).toEqual(["mais de um resultado em 02/10"]);
  });

  it("também no dia do anterior; dois dias numa frase só", () => {
    const [l] = compararExames(
      [
        ex("2026-07-10", "Glicose", "98"),
        ex("2026-07-10", "Glicose", "101"),
        ex("2026-10-02", "Glicose", "110"),
        ex("2026-10-02", "Glicose", "92"),
      ],
      {}
    );
    expect(l.maisDeUmNoDia).toEqual(["2026-07-10", "2026-10-02"]);
    expect(avisosDaLinha(l, HOJE)).toEqual(["mais de um resultado em 10/07 e 02/10"]);
  });

  it("o mesmo valor lançado duas vezes não é aviso", () => {
    const [l] = compararExames([ex("2026-10-02", "Glicose", "92"), ex("2026-10-02", "Glicose", "92,0")], {});
    expect(l.maisDeUmNoDia).toEqual([]);
  });
});

describe("dataDoComparativo", () => {
  it("dd/mm no ano de hoje; dd/mm/aa em outro ano", () => {
    expect(dataDoComparativo("2026-02-11", HOJE)).toBe("11/02");
    expect(dataDoComparativo("2025-12-18", HOJE)).toBe("18/12/25");
    expect(dataDoComparativo("2027-01-02", HOJE)).toBe("02/01/27");
  });

  it("descricaoDaSerie e os avisos usam a mesma regra", () => {
    const [l] = compararExames(
      [
        ex("2025-12-18", "Vitamina D", "18"),
        ex("2026-02-11", "Vitamina D", "24"),
        ex("2026-04-05", "Vitamina D", "38"),
        ex("2026-04-05", "Vitamina D", "39"),
      ],
      {}
    );
    expect(descricaoDaSerie(l, HOJE)).toBe("Vitamina D: 18 em 18/12/25, 24 em 11/02, 39 em 05/04; faixa de 30 a 100.");
    expect(avisosDaLinha(l, "2027-01-05")).toEqual(["mais de um resultado em 05/04/26"]);
  });
});

describe("fraseSemComparacao", () => {
  it("há comparação: nula", () => {
    const linhas = [ex("2026-07-10", "Glicose", "98"), ex("2026-10-02", "Glicose", "92")];
    expect(fraseSemComparacao(linhas, compararExames(linhas, {}))).toBeNull();
  });

  it("cada exame com um resultado só: diz isso", () => {
    const linhas = [ex("2026-10-02", "Glicose", "92"), ex("2026-09-01", "Ferritina", "45")];
    expect(fraseSemComparacao(linhas, compararExames(linhas, {}))).toBe(
      "Sem comparação ainda: cada exame tem um resultado só."
    );
  });

  it("nenhum resultado com número", () => {
    const linhas = [ex("2026-10-02", "Anti-HCV", "não reagente")];
    expect(fraseSemComparacao(linhas, compararExames(linhas, {}))).toBe(
      "Sem comparação ainda: nenhum resultado tem número para comparar."
    );
  });

  it("um exame só com resultado sem número, ou com um sem número além do número: não diz 'um resultado só'", () => {
    // "Cada exame tem um resultado só" seria falso: o Anti-HCV tem dois, e a
    // glicose tem o 92 e um "Amostra hemolisada".
    const linhas = [
      ex("2026-07-10", "Anti-HCV", "não reagente"),
      ex("2026-10-02", "Anti-HCV", "não reagente"),
      ex("2026-07-10", "Glicose", "Amostra hemolisada"),
      ex("2026-10-02", "Glicose", "92"),
    ];
    const frase = fraseSemComparacao(linhas, compararExames(linhas, {}));
    expect(frase).toBe(
      "Sem comparação ainda: nenhum exame tem dois resultados com número em dias diferentes, e resultado sem número não se compara."
    );
  });

  it("dois resultados com número no mesmo dia: não diz 'um resultado só'", () => {
    const linhas = [ex("2026-10-02", "Glicose", "110"), ex("2026-10-02", "Glicose", "92")];
    expect(fraseSemComparacao(linhas, compararExames(linhas, {}))).toBe(
      "Sem comparação ainda: nenhum exame tem dois resultados com número em dias diferentes."
    );
  });
});
