import { describe, expect, it } from "vitest";
import type { Consulta } from "./consultas";
import {
  anteriores,
  CAMPOS_EXTRAS,
  CAMPOS_MEDIDA,
  CAMPOS_PRINCIPAIS,
  comDireitoAoRegistro,
  erroDaMedida,
  errosDasMedidas,
  FAIXAS,
  imc,
  lerMedida,
  lerNumero,
  LIMITES,
  medidasValidas,
  ROTULO_REGISTRO,
  rotuloDaAnamnese,
  situacaoDoRegistro,
  temAlgumaParte,
  textoDaDiferenca,
  textoDaMedida,
  valorDaMedida,
  type CampoMedida,
} from "./registro";

function consulta(c: Partial<Consulta> = {}): Consulta {
  return {
    id: c.id ?? "c1",
    patient_id: "p1",
    nutritionist_id: "n1",
    // 14:00 em São Paulo (UTC−3) = 17:00 UTC
    starts_at: "2026-10-20T17:00:00Z",
    duration_min: 60,
    kind: "retorno",
    mode: "presencial",
    status: "agendada",
    patient_message: null,
    reschedule_requested_at: null,
    cancelled_by: null,
    ...c,
  };
}

describe("lerNumero", () => {
  it("aceita vírgula e ponto como separador decimal", () => {
    expect(lerNumero("71,8")).toEqual({ ok: true, valor: 71.8 });
    expect(lerNumero("71.8")).toEqual({ ok: true, valor: 71.8 });
  });

  it("ignora espaço nas pontas", () => {
    expect(lerNumero(" 72 ")).toEqual({ ok: true, valor: 72 });
  });

  it("campo vazio é 'sem medida', não erro", () => {
    expect(lerNumero("")).toEqual({ ok: true, valor: null });
    expect(lerNumero("  ")).toEqual({ ok: true, valor: null });
  });

  it("texto que não é só um número é erro: nada de ler '72kg' como 72", () => {
    expect(lerNumero("72kg")).toEqual({ ok: false });
    expect(lerNumero("7,1,8")).toEqual({ ok: false });
    expect(lerNumero("abc")).toEqual({ ok: false });
  });

  it("não aceita negativo, expoente nem ponto solto", () => {
    expect(lerNumero("-5")).toEqual({ ok: false });
    expect(lerNumero("1e2")).toEqual({ ok: false });
    expect(lerNumero("72,")).toEqual({ ok: false });
    expect(lerNumero(",5")).toEqual({ ok: false });
  });
});

describe("erroDaMedida", () => {
  it("escreve a mensagem do banco, com a unidade como ele a escreve", () => {
    expect(erroDaMedida("weight_kg", 718)).toBe("Peso fora da faixa (20 a 400 kg).");
    expect(erroDaMedida("body_fat_pct", 80)).toBe("% de gordura fora da faixa (2 a 75%).");
  });

  it("as bordas valem", () => {
    expect(erroDaMedida("weight_kg", 20)).toBeNull();
    expect(erroDaMedida("weight_kg", 400)).toBeNull();
    expect(erroDaMedida("weight_kg", 19.9)).not.toBeNull();
    expect(erroDaMedida("weight_kg", 400.1)).not.toBeNull();
  });

  it("repete a tabela de erro_das_medidas, campo a campo", () => {
    const esperado: Record<CampoMedida, string> = {
      weight_kg: "Peso fora da faixa (20 a 400 kg).",
      body_fat_pct: "% de gordura fora da faixa (2 a 75%).",
      waist_cm: "Cintura fora da faixa (30 a 250 cm).",
      hip_cm: "Quadril fora da faixa (30 a 250 cm).",
      chest_cm: "Tórax fora da faixa (30 a 250 cm).",
      arm_cm: "Braço fora da faixa (10 a 80 cm).",
      thigh_cm: "Coxa fora da faixa (20 a 120 cm).",
      calf_cm: "Panturrilha fora da faixa (10 a 80 cm).",
      neck_cm: "Pescoço fora da faixa (10 a 80 cm).",
    };
    for (const campo of [...CAMPOS_PRINCIPAIS, ...CAMPOS_EXTRAS]) {
      expect(erroDaMedida(campo, 0), campo).toBe(esperado[campo]);
      expect(erroDaMedida(campo, FAIXAS[campo].min), campo).toBeNull();
      expect(erroDaMedida(campo, FAIXAS[campo].max), campo).toBeNull();
    }
  });

  it("NaN e infinito não passam: com comparação simples, NaN escaparia da faixa", () => {
    expect(erroDaMedida("weight_kg", NaN)).toBe("Peso fora da faixa (20 a 400 kg).");
    expect(erroDaMedida("weight_kg", Infinity)).toBe("Peso fora da faixa (20 a 400 kg).");
  });
});

describe("lerMedida", () => {
  it("número dentro da faixa vale, com vírgula ou ponto e espaço nas pontas", () => {
    expect(lerMedida("weight_kg", "71,8")).toEqual({ ok: true, valor: 71.8 });
    expect(lerMedida("weight_kg", " 72.5 ")).toEqual({ ok: true, valor: 72.5 });
    expect(lerMedida("weight_kg", "20")).toEqual({ ok: true, valor: 20 });
    expect(lerMedida("weight_kg", "400")).toEqual({ ok: true, valor: 400 });
  });

  it("vazio é 'sem medida' (nulo), não erro: é o que apaga a medida", () => {
    expect(lerMedida("waist_cm", "")).toEqual({ ok: true, valor: null });
    expect(lerMedida("waist_cm", "   ")).toEqual({ ok: true, valor: null });
  });

  it("o que não é número pede o número", () => {
    expect(lerMedida("weight_kg", "72kg")).toEqual({ ok: false, erro: "Digite só o número, como 71,8." });
    expect(lerMedida("weight_kg", "6x")).toEqual({ ok: false, erro: "Digite só o número, como 71,8." });
    expect(lerMedida("weight_kg", "71,")).toEqual({ ok: false, erro: "Digite só o número, como 71,8." });
  });

  it("fora da faixa traz a mensagem do banco", () => {
    expect(lerMedida("weight_kg", "718")).toEqual({ ok: false, erro: "Peso fora da faixa (20 a 400 kg)." });
    expect(lerMedida("body_fat_pct", "1,5")).toEqual({ ok: false, erro: "% de gordura fora da faixa (2 a 75%)." });
    expect(lerMedida("weight_kg", "19,9")).toEqual({ ok: false, erro: "Peso fora da faixa (20 a 400 kg)." });
  });
});

describe("campos e limites", () => {
  it("separa os quatro campos da tela dos cinco extras, sem repetir nem faltar", () => {
    expect(CAMPOS_PRINCIPAIS).toEqual(["weight_kg", "body_fat_pct", "waist_cm", "hip_cm"]);
    expect(CAMPOS_EXTRAS).toEqual(["chest_cm", "arm_cm", "thigh_cm", "calf_cm", "neck_cm"]);
    expect(Object.keys(FAIXAS).sort()).toEqual([...CAMPOS_PRINCIPAIS, ...CAMPOS_EXTRAS].sort());
  });

  it("limites de texto iguais aos do banco", () => {
    expect(LIMITES).toEqual({
      anamnese: 20000,
      diagnostico: 5000,
      conduta: 10000,
      observar: 2000,
      adendo: 5000,
      crn: 30,
    });
  });
});

describe("imc", () => {
  it("peso / altura² com uma casa", () => {
    expect(imc(71.8, 165)).toBe(26.4);
  });

  it("sem peso, sem altura ou com altura zero não calcula", () => {
    expect(imc(71.8, null)).toBeNull();
    expect(imc(71.8, undefined)).toBeNull();
    expect(imc(71.8, 0)).toBeNull();
    expect(imc(null, 165)).toBeNull();
    expect(imc(undefined, 165)).toBeNull();
  });
});

describe("situacaoDoRegistro", () => {
  const agora = Date.parse("2026-10-20T17:10:00Z");

  it("consulta que ainda não começou não tem direito a registro", () => {
    const futura = consulta({ starts_at: "2026-10-20T18:00:00Z" });
    expect(situacaoDoRegistro(futura, null, agora)).toBe("sem-direito");
  });

  it("começou há 10 minutos e não tem registro: sem registro", () => {
    expect(situacaoDoRegistro(consulta(), null, agora)).toBe("sem-registro");
    expect(situacaoDoRegistro(consulta(), undefined, agora)).toBe("sem-registro");
  });

  it("sem desfecho com rascunho: rascunho", () => {
    const passada = consulta({ starts_at: "2026-10-19T17:00:00Z" });
    expect(situacaoDoRegistro(passada, { status: "rascunho" }, agora)).toBe("rascunho");
  });

  it("realizada com registro concluído: registrada", () => {
    const realizada = consulta({ status: "realizada" });
    expect(situacaoDoRegistro(realizada, { status: "concluido" }, agora)).toBe("registrada");
  });

  it("falta, cancelamento e pedido não têm registro", () => {
    expect(situacaoDoRegistro(consulta({ status: "faltou" }), null, agora)).toBe("sem-direito");
    expect(situacaoDoRegistro(consulta({ status: "cancelada" }), null, agora)).toBe("sem-direito");
    expect(situacaoDoRegistro(consulta({ status: "pedido" }), null, agora)).toBe("sem-direito");
  });

  it("pedido de remarcação só vale depois que o horário começou", () => {
    const pediu = { reschedule_requested_at: "2026-10-18T10:00:00Z" };
    expect(situacaoDoRegistro(consulta(pediu), null, agora)).toBe("sem-registro");
    const antes = consulta({ ...pediu, starts_at: "2026-10-20T18:00:00Z" });
    expect(situacaoDoRegistro(antes, null, agora)).toBe("sem-direito");
  });

  it("falta com registro antigo continua sem direito: o banco recusa", () => {
    expect(situacaoDoRegistro(consulta({ status: "faltou" }), { status: "rascunho" }, agora)).toBe(
      "sem-direito",
    );
  });

  it("o instante exato do início já conta, como no banco (starts_at > now() recusa)", () => {
    const noInicio = Date.parse("2026-10-20T17:00:00Z");
    expect(situacaoDoRegistro(consulta(), null, noInicio)).toBe("sem-registro");
    expect(situacaoDoRegistro(consulta(), null, noInicio - 1)).toBe("sem-direito");
  });

  it("aceita o instante como texto ISO, como situacao()", () => {
    expect(situacaoDoRegistro(consulta(), null, "2026-10-20T17:10:00Z")).toBe("sem-registro");
  });

  it("rotula as três situações que têm registro", () => {
    expect(ROTULO_REGISTRO).toEqual({
      "sem-registro": "Sem registro",
      rascunho: "Rascunho",
      registrada: "Registrada",
    });
  });
});

describe("comDireitoAoRegistro", () => {
  const agora = Date.parse("2026-10-20T17:10:00Z");

  it("fica com as que já começaram e não são pedido, falta nem cancelamento", () => {
    const lista = [
      consulta({ id: "em-andamento" }),
      consulta({ id: "sem-desfecho", starts_at: "2026-10-19T17:00:00Z" }),
      consulta({ id: "realizada", status: "realizada", starts_at: "2026-10-06T17:00:00Z" }),
      consulta({ id: "futura", starts_at: "2026-10-21T17:00:00Z" }),
      consulta({ id: "faltou", status: "faltou", starts_at: "2026-10-13T17:00:00Z" }),
      consulta({ id: "cancelada", status: "cancelada", starts_at: "2026-10-13T17:00:00Z" }),
      consulta({ id: "pedido", status: "pedido", starts_at: "2026-10-22T17:00:00Z" }),
    ];
    expect(comDireitoAoRegistro(lista, agora).map((c) => c.id)).toEqual([
      "em-andamento",
      "sem-desfecho",
      "realizada",
    ]);
  });

  it("lista vazia dá lista vazia", () => {
    expect(comDireitoAoRegistro([], agora)).toEqual([]);
  });
});

describe("rotuloDaAnamnese", () => {
  it("primeira consulta tem anamnese; retorno tem evolução", () => {
    expect(rotuloDaAnamnese("primeira")).toBe("Anamnese");
    expect(rotuloDaAnamnese("retorno")).toBe("Evolução");
  });
});

describe("anteriores", () => {
  const dia = "2026-10-20";

  it("ignora a linha de casa (sem consulta), a do próprio dia e as posteriores", () => {
    const serie = [
      { date: "2026-10-10", appointment_id: null, weight_kg: 90 },
      { date: dia, appointment_id: "a2", weight_kg: 80 },
      { date: "2026-10-27", appointment_id: "a3", weight_kg: 70 },
      { date: "2026-10-06", appointment_id: "a1", weight_kg: 75 },
    ];
    expect(anteriores(serie, dia)).toEqual({ weight_kg: { valor: 75, data: "2026-10-06" } });
  });

  it("pega a mais recente por campo, mesmo que venha de consultas diferentes", () => {
    const serie = [
      { date: "2026-09-01", appointment_id: "a1", weight_kg: 74, waist_cm: 88 },
      { date: "2026-09-29", appointment_id: "a2", weight_kg: 72.5 },
    ];
    expect(anteriores(serie, dia)).toEqual({
      weight_kg: { valor: 72.5, data: "2026-09-29" },
      waist_cm: { valor: 88, data: "2026-09-01" },
    });
  });

  it("não depende da ordem da série", () => {
    const serie = [
      { date: "2026-09-29", appointment_id: "a2", weight_kg: 72.5 },
      { date: "2026-09-01", appointment_id: "a1", weight_kg: 74 },
    ];
    expect(anteriores(serie, dia).weight_kg).toEqual({ valor: 72.5, data: "2026-09-29" });
  });

  it("medida nula (do banco) não conta: o peso vem da consulta anterior que tem peso", () => {
    const serie = [
      { date: "2026-10-06", appointment_id: "a2", weight_kg: null, waist_cm: 86 },
      { date: "2026-09-01", appointment_id: "a1", weight_kg: 74, waist_cm: null },
    ];
    expect(anteriores(serie, dia)).toEqual({
      weight_kg: { valor: 74, data: "2026-09-01" },
      waist_cm: { valor: 86, data: "2026-10-06" },
    });
  });

  it("sem linha anterior devolve vazio", () => {
    expect(anteriores([], dia)).toEqual({});
    expect(anteriores([{ date: "2026-10-01", appointment_id: null, weight_kg: 70 }], dia)).toEqual(
      {},
    );
  });
});

describe("temAlgumaParte", () => {
  it("espaço não é parte", () => {
    expect(temAlgumaParte({ anamnese: "  " })).toBe(false);
    expect(temAlgumaParte({})).toBe(false);
    expect(temAlgumaParte({ medidas: {} })).toBe(false);
  });

  it("um texto, ou uma medida, basta", () => {
    expect(temAlgumaParte({ conduta: "Reduzir sódio" })).toBe(true);
    expect(temAlgumaParte({ anamnese: "  ", medidas: { weight_kg: 71.8 } })).toBe(true);
  });
});

describe("valorDaMedida e textoDaMedida", () => {
  it("escreve o valor com a unidade, em português", () => {
    expect(valorDaMedida("weight_kg", 71.8)).toBe("71,8 kg");
    expect(valorDaMedida("waist_cm", 84)).toBe("84 cm");
    // o % cola no número
    expect(valorDaMedida("body_fat_pct", 31.5)).toBe("31,5%");
  });

  it("corta em duas casas, sem a sobra da conta em ponto flutuante", () => {
    expect(valorDaMedida("weight_kg", 65.60000000000001)).toBe("65,6 kg");
  });

  it("põe o nome na frente, e a gordura se chama Gordura", () => {
    expect(textoDaMedida("weight_kg", 65.6)).toBe("Peso 65,6 kg");
    expect(textoDaMedida("hip_cm", 102)).toBe("Quadril 102 cm");
    // "% de gordura 22,2%" repetiria o símbolo
    expect(textoDaMedida("body_fat_pct", 22.2)).toBe("Gordura 22,2%");
  });
});

describe("textoDaDiferenca", () => {
  it("usa o sinal de menos de verdade (−, não o hífen) e o de mais", () => {
    expect(textoDaDiferenca(65.6, 66.4)).toBe("\u22120,8");
    expect(textoDaDiferenca(84, 82)).toBe("+2");
    expect(textoDaDiferenca(31.5, 32.4)).toBe("\u22120,9");
  });

  it("não deixa a conta em ponto flutuante aparecer (65,6 − 66,4 dá −0,8000000000000114)", () => {
    expect(textoDaDiferenca(65.6, 66.4)).not.toMatch(/\d{3,}/);
  });

  it("igual ao de antes é \"sem mudança\", e não \"+0\" nem \"−0\"", () => {
    expect(textoDaDiferenca(70, 70)).toBe("sem mudança");
    // uma diferença que some no arredondamento também não muda nada
    expect(textoDaDiferenca(70.001, 70)).toBe("sem mudança");
  });
});

/** Os nove campos em texto, como a tela os guarda; o que não vem é vazio. */
function textos(t: Partial<Record<CampoMedida, string>>): Record<CampoMedida, string> {
  return Object.fromEntries(CAMPOS_MEDIDA.map((c) => [c, t[c] ?? ""])) as Record<CampoMedida, string>;
}

describe("CAMPOS_MEDIDA", () => {
  it("são os nove, os quatro da frente primeiro", () => {
    expect(CAMPOS_MEDIDA).toEqual([...CAMPOS_PRINCIPAIS, ...CAMPOS_EXTRAS]);
    expect(CAMPOS_MEDIDA).toHaveLength(9);
  });
});

describe("medidasValidas", () => {
  it("lê com vírgula ou ponto e deixa de fora o vazio e o inválido", () => {
    expect(
      medidasValidas(
        textos({ weight_kg: "71,8", waist_cm: " 84.5 ", body_fat_pct: "", hip_cm: "6x", chest_cm: "718" })
      )
    ).toEqual({ weight_kg: 71.8, waist_cm: 84.5 });
  });

  it("sem nada preenchido, nada", () => {
    expect(medidasValidas(textos({}))).toEqual({});
  });

  it("as bordas da faixa valem; fora dela não", () => {
    expect(medidasValidas(textos({ weight_kg: "20", neck_cm: "80" }))).toEqual({ weight_kg: 20, neck_cm: 80 });
    expect(medidasValidas(textos({ weight_kg: "19,9", neck_cm: "80,1" }))).toEqual({});
  });
});

describe("errosDasMedidas", () => {
  it("tudo certo, ou nada preenchido, é vazio", () => {
    expect(errosDasMedidas(textos({}))).toBe("");
    expect(errosDasMedidas(textos({ weight_kg: "71,8", hip_cm: "" }))).toBe("");
  });

  it("a faixa já traz o nome do campo e não ganha outro na frente", () => {
    expect(errosDasMedidas(textos({ weight_kg: "718" }))).toBe("Peso fora da faixa (20 a 400 kg).");
    expect(errosDasMedidas(textos({ body_fat_pct: "80" }))).toBe("% de gordura fora da faixa (2 a 75%).");
  });

  it("o que não é número ganha o nome do campo, senão não se saberia qual corrigir", () => {
    expect(errosDasMedidas(textos({ waist_cm: "8x" }))).toBe("Cintura: Digite só o número, como 71,8.");
  });

  it("vários campos viram uma frase só, na ordem da tela", () => {
    expect(errosDasMedidas(textos({ neck_cm: "5", weight_kg: "718", hip_cm: "abc" }))).toBe(
      "Peso fora da faixa (20 a 400 kg). Quadril: Digite só o número, como 71,8. Pescoço fora da faixa (10 a 80 cm)."
    );
  });
});
