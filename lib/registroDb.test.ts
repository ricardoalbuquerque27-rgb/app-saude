import { describe, expect, it } from "vitest";
import { getMedidasDasConsultas, getMedidasDoPaciente } from "./registroDb";
import { anteriores } from "./registro";
import { addDaysISO } from "./date";

type Linha = Record<string, any>;

/**
 * Um Supabase em memória, só com o que as leituras de medidas usam: filtros,
 * ordem e o `limit`, que é onde o "antes" se perdia.
 */
function bancoFalso(linhas: Linha[]) {
  return {
    from(tabela: string) {
      if (tabela !== "body_measurements") throw new Error(`tabela fora do teste: ${tabela}`);
      const filtros: ((l: Linha) => boolean)[] = [];
      let ordem: { col: string; asc: boolean } | null = null;
      let teto: number | null = null;
      const q: any = {
        select: () => q,
        eq: (c: string, v: unknown) => (filtros.push((l) => l[c] === v), q),
        not: (c: string, _op: "is", _v: null) => (filtros.push((l) => l[c] != null), q),
        order: (c: string, o?: { ascending?: boolean }) => ((ordem = { col: c, asc: o?.ascending !== false }), q),
        limit: (n: number) => ((teto = n), q),
        then: (resolve: (r: { data: Linha[]; error: null }) => void) => {
          let out = linhas.filter((l) => filtros.every((f) => f(l)));
          if (ordem) {
            const { col, asc } = ordem;
            out = [...out].sort((a, b) => (a[col] < b[col] ? -1 : a[col] > b[col] ? 1 : 0) * (asc ? 1 : -1));
          }
          resolve({ data: teto == null ? out : out.slice(0, teto), error: null });
        },
      };
      return q;
    },
  };
}

describe("o 'antes' das medidas com muitas pesagens de casa", () => {
  // Quem se pesa todo dia em casa passa de 200 medidas em sete meses. A série
  // da coluna de contexto vem com as 200 mais recentes, e o "antes" do editor
  // saía dela: a medida da consulta de antes disso ficava de fora e o "antes"
  // sumia calado.
  const PACIENTE = "pac-1";
  const DIA = "2026-10-13";
  const emCasa = Array.from({ length: 250 }, (_, i) => ({
    user_id: PACIENTE, date: addDaysISO(DIA, -(i + 1)), weight_kg: 70,
    appointment_id: null, measured_by: null,
  }));
  const daConsulta = {
    user_id: PACIENTE, date: addDaysISO(DIA, -260), weight_kg: 72.5,
    appointment_id: "ap-1", measured_by: "nutri-1",
  };

  it("o 'antes' do peso é a medida da consulta, mesmo atrás de 250 pesagens de casa", async () => {
    const banco = bancoFalso([...emCasa, daConsulta]);
    const r = await getMedidasDasConsultas(banco, PACIENTE);
    expect(r.falhou).toBe(false);
    expect(anteriores(r.data, DIA).weight_kg).toEqual({ valor: 72.5, data: daConsulta.date });
  });

  it("a série da coluna de contexto continua com o teto de 200", async () => {
    const r = await getMedidasDoPaciente(bancoFalso([...emCasa, daConsulta]), PACIENTE);
    expect(r.data).toHaveLength(200);
  });
});
