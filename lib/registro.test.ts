import { describe, expect, it } from "vitest";
import type { Consulta } from "./consultas";
import {
  anteriores,
  CAMPOS_EXTRAS,
  CAMPOS_PRINCIPAIS,
  erroDaMedida,
  FAIXAS,
  imc,
  lerNumero,
  LIMITES,
  ROTULO_REGISTRO,
  rotuloDaAnamnese,
  situacaoDoRegistro,
  temAlgumaParte,
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
