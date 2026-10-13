import { describe, expect, it } from "vitest";
import { resumoDesdeUltima, textoDesdeUltima, tituloDesde, type DadosDesde } from "./desdeConsulta";

function dados(d: Partial<DadosDesde> = {}): DadosDesde {
  return {
    desde: "2026-09-29",
    hoje: "2026-10-13",
    diasComRegistro: [],
    pesos: [],
    plano: [],
    checks: [],
    desvios: [],
    ...d,
  };
}

describe("resumoDesdeUltima", () => {
  it("conta os dias DEPOIS da consulta até hoje, sem o dia da consulta nem o futuro", () => {
    const r = resumoDesdeUltima(
      dados({ diasComRegistro: ["2026-09-29", "2026-09-30", "2026-10-13", "2026-10-13", "2026-10-14"] })
    )!;
    expect(r.dias).toBe(14);
    expect(r.diasComRegistro).toBe(2);
    expect(r.limitado).toBe(false);
  });

  it("consulta de hoje não tem 'desde'", () => {
    expect(resumoDesdeUltima(dados({ desde: "2026-10-13" }))).toBeNull();
  });

  it("peso: da última medida até o dia da consulta para a mais recente depois", () => {
    const r = resumoDesdeUltima(
      dados({
        pesos: [
          { date: "2026-10-10", weight_kg: 67.4 },
          { date: "2026-09-20", weight_kg: 69 },
          { date: "2026-09-29", weight_kg: 68.6 },
          { date: "2026-10-20", weight_kg: 60 }, // futuro: fora
        ],
      })
    )!;
    expect(r.deltaPeso).toBe(-1.2);
  });

  it("a medida do dia seguinte à consulta já é 'depois', não a base", () => {
    const r = resumoDesdeUltima(
      dados({
        pesos: [
          { date: "2026-09-29", weight_kg: 68.6 },
          { date: "2026-09-30", weight_kg: 68.0 },
        ],
      })
    )!;
    expect(r.deltaPeso).toBe(-0.6);
  });

  it("sem medida antes ou sem medida depois, sem variação", () => {
    expect(resumoDesdeUltima(dados({ pesos: [{ date: "2026-10-10", weight_kg: 67 }] }))!.deltaPeso).toBeNull();
    expect(resumoDesdeUltima(dados({ pesos: [{ date: "2026-09-01", weight_kg: 67 }] }))!.deltaPeso).toBeNull();
  });

  it("treinos do plano no período, sem descanso, com a conta de computeAdherence", () => {
    const r = resumoDesdeUltima(
      dados({
        plano: [
          { id: "seg", day_of_week: 0, sport: "Musculação" },
          { id: "dom", day_of_week: 6, sport: "Descanso" },
        ],
        // segundas no período: 05/10 e 12/10
        checks: [{ plan_id: "seg", date: "2026-10-05", status: "done" } as any],
      })
    )!;
    expect(r.treinos).toEqual({ confirmadas: 1, previstas: 2 });
  });

  it("sem plano, sem linha de treinos", () => {
    expect(resumoDesdeUltima(dados())!.treinos).toBeNull();
  });

  it("mudanças na prescrição no período, pelo dia de São Paulo", () => {
    const r = resumoDesdeUltima(
      dados({
        desvios: [
          { created_at: "2026-10-01T15:00:00Z" },
          // 22h de 29/09 em SP (dia da consulta): fora
          { created_at: "2026-09-30T01:00:00Z" },
        ],
      })
    )!;
    expect(r.mudancas).toBe(1);
  });

  it("mais de 90 dias: olha só os últimos 90 e avisa", () => {
    const r = resumoDesdeUltima(
      dados({
        desde: "2026-05-01",
        diasComRegistro: ["2026-06-01", "2026-10-01"],
        pesos: [
          { date: "2026-05-01", weight_kg: 80 },
          { date: "2026-07-10", weight_kg: 76 },
          { date: "2026-10-01", weight_kg: 75 },
        ],
      })
    )!;
    expect(r.limitado).toBe(true);
    expect(r.janela).toBe(90);
    expect(r.diasComRegistro).toBe(1);
    // A base é a última medida ANTES da janela (10/07), não a da consulta.
    expect(r.deltaPeso).toBe(-1);
  });
});

describe("textoDesdeUltima e tituloDesde", () => {
  it("junta as partes que existem", () => {
    const r = resumoDesdeUltima(
      dados({
        diasComRegistro: ["2026-10-01", "2026-10-02"],
        pesos: [
          { date: "2026-09-29", weight_kg: 68.6 },
          { date: "2026-10-10", weight_kg: 67.4 },
        ],
        plano: [{ id: "seg", day_of_week: 0 }],
        checks: [{ plan_id: "seg", date: "2026-10-05", status: "done" } as any],
        desvios: [{ created_at: "2026-10-01T15:00:00Z" }, { created_at: "2026-10-02T15:00:00Z" }],
      })
    )!;
    expect(textoDesdeUltima(r)).toBe(
      "2 de 14 dias com registro · −1,2 kg · treinos 1 de 2 · 2 mudanças na prescrição"
    );
    expect(tituloDesde(r)).toBe("Desde a última consulta (29/09)");
  });

  it("sem registro diz isso, e uma mudança fica no singular", () => {
    const r = resumoDesdeUltima(dados({ desvios: [{ created_at: "2026-10-01T15:00:00Z" }] }))!;
    expect(textoDesdeUltima(r)).toBe("Nenhum registro desde então · 1 mudança na prescrição");
  });

  it("limitado a 90 dias muda o título e o 'desde então'", () => {
    const r = resumoDesdeUltima(dados({ desde: "2026-05-01" }))!;
    expect(tituloDesde(r)).toBe("Nos últimos 90 dias (última consulta em 01/05)");
    expect(textoDesdeUltima(r)).toBe("Nenhum registro nos últimos 90 dias");
  });
});
