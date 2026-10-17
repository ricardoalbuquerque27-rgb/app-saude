import { describe, it, expect, vi } from "vitest";
import { adicionarAgua } from "./agua";
import { executeAction } from "./aiActions";
import { todayISO } from "./date";

const UID = "pac-a";
const HOJE = "2026-10-08";

type Upsert = { linha: Record<string, unknown>; opcoes: unknown };

/**
 * Um Supabase mínimo, só com o que `adicionarAgua` usa:
 * `from().select().eq().eq().maybeSingle()` e `from().upsert(linha, opções)`.
 * Guarda cada `upsert` (e cada filtro da leitura) para o teste conferir o que
 * foi mandado, e aceita um erro injetado na leitura ou na escrita.
 */
function bancoFalso(opcoes: {
  linha?: Record<string, unknown> | null;
  erroNaLeitura?: string;
  erroNaGravacao?: string;
} = {}) {
  const upserts: Upsert[] = [];
  const filtros: [string, unknown][] = [];
  const tabelas: string[] = [];
  return {
    upserts,
    filtros,
    tabelas,
    from(tabela: string) {
      tabelas.push(tabela);
      return {
        select: (colunas: string) => {
          expect(colunas).toBe("water_ml");
          const leitura = {
            eq(coluna: string, valor: unknown) {
              filtros.push([coluna, valor]);
              return leitura;
            },
            maybeSingle: async () =>
              opcoes.erroNaLeitura
                ? { data: null, error: { message: opcoes.erroNaLeitura } }
                : { data: opcoes.linha ?? null, error: null },
          };
          return leitura;
        },
        upsert: async (linha: Record<string, unknown>, o: unknown) => {
          upserts.push({ linha, opcoes: o });
          return opcoes.erroNaGravacao
            ? { error: { message: opcoes.erroNaGravacao } }
            : { error: null };
        },
      };
    },
  };
}

describe("adicionarAgua", () => {
  it("sem linha no dia, cria com o que veio", async () => {
    const banco = bancoFalso({ linha: null });
    const r = await adicionarAgua(banco, UID, 250, HOJE);
    expect(r).toEqual({ ok: true, total: 250 });
    expect(banco.upserts).toHaveLength(1);
    expect(banco.upserts[0].linha.water_ml).toBe(250);
  });

  it("soma ao que o dia já tem", async () => {
    const banco = bancoFalso({ linha: { water_ml: 1000 } });
    const r = await adicionarAgua(banco, UID, 250, HOJE);
    expect(r).toEqual({ ok: true, total: 1250 });
    expect(banco.upserts[0].linha.water_ml).toBe(1250);
  });

  it("o numeric do PostgREST pode chegar como texto", async () => {
    const banco = bancoFalso({ linha: { water_ml: "1000" } });
    const r = await adicionarAgua(banco, UID, 250, HOJE);
    expect(r).toEqual({ ok: true, total: 1250 });
  });

  it("linha do dia com a água vazia conta como zero", async () => {
    // O dia pode existir só com sono ou humor: `water_ml` vem nulo.
    const banco = bancoFalso({ linha: { water_ml: null } });
    const r = await adicionarAgua(banco, UID, 250, HOJE);
    expect(r).toEqual({ ok: true, total: 250 });
  });

  it("desfazer abaixo de zero para em zero", async () => {
    const banco = bancoFalso({ linha: { water_ml: 100 } });
    const r = await adicionarAgua(banco, UID, -250, HOJE);
    expect(r).toEqual({ ok: true, total: 0 });
    expect(banco.upserts[0].linha.water_ml).toBe(0);
  });

  it("lê e grava o dia e o usuário pedidos", async () => {
    const banco = bancoFalso({ linha: { water_ml: 500 } });
    await adicionarAgua(banco, UID, 250, HOJE);
    expect(banco.tabelas).toEqual(["daily_logs", "daily_logs"]);
    expect(banco.filtros).toEqual([
      ["user_id", UID],
      ["date", HOJE],
    ]);
  });

  // O registrar_agua antigo ignorava o erro da leitura: com ela falhando, o
  // total do dia virava 0 e o upsert gravava só o `ml` por cima do que o
  // paciente já tinha bebido ("+250" apagava 1,5 L).
  it("erro na leitura: devolve o erro e não grava nada", async () => {
    const banco = bancoFalso({ erroNaLeitura: "permission denied" });
    const r = await adicionarAgua(banco, UID, 250, HOJE);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toContain("permission denied");
    expect(banco.upserts).toHaveLength(0);
  });

  it("erro na gravação: devolve o erro", async () => {
    const banco = bancoFalso({ linha: { water_ml: 500 }, erroNaGravacao: "boom" });
    const r = await adicionarAgua(banco, UID, 250, HOJE);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toContain("boom");
  });

  // O upsert do PostgREST atualiza só as colunas enviadas: mandar a linha
  // inteira do dia (sono, humor…) a partir de uma leitura velha apagaria o
  // que mudou fora daqui. Por isso vão só estas três.
  it("o upsert leva só user_id, date e water_ml, com onConflict", async () => {
    const banco = bancoFalso({ linha: { water_ml: 500, sleep_hours: 7, mood: 4 } });
    await adicionarAgua(banco, UID, 250, HOJE);
    expect(banco.upserts).toEqual([
      {
        linha: { user_id: UID, date: HOJE, water_ml: 750 },
        opcoes: { onConflict: "user_id,date" },
      },
    ]);
  });

  it("quantidade que não é número não grava (viraria null no JSON e apagaria o dia)", async () => {
    const banco = bancoFalso({ linha: { water_ml: 500 } });
    const r = await adicionarAgua(banco, UID, Number.NaN, HOJE);
    expect(r.ok).toBe(false);
    expect(banco.upserts).toHaveLength(0);
  });
});

// O assistente passa por adicionarAgua e mantém o contrato de antes: o texto do
// resumo é o mesmo e a falha vira exceção, que o catch de executeAction traduz
// em "Não consegui salvar agora" (nunca "água registrada").
describe("registrar_agua (assistente)", () => {
  it("soma ao dia e responde com o total, no texto de sempre", async () => {
    const banco = bancoFalso({ linha: { water_ml: 1000 } });
    const r = await executeAction("registrar_agua", JSON.stringify({ ml: 250 }), banco, UID);
    expect(r).toEqual({
      ok: true,
      resumo: "+250 ml de água. Total de hoje: 1250 ml (1,25 L).",
    });
    expect(banco.upserts[0].linha).toEqual({ user_id: UID, date: todayISO(), water_ml: 1250 });
  });

  it("quantidade negativa mostra o sinal e não passa de zero", async () => {
    const banco = bancoFalso({ linha: { water_ml: 100 } });
    const r = await executeAction("registrar_agua", JSON.stringify({ ml: -250 }), banco, UID);
    expect(r).toEqual({
      ok: true,
      resumo: "-250 ml de água. Total de hoje: 0 ml (0 L).",
    });
  });

  it("zero e texto são quantidade inválida, sem tocar no banco", async () => {
    for (const ml of [0, "muita", null]) {
      const banco = bancoFalso({ linha: { water_ml: 100 } });
      const r = await executeAction("registrar_agua", JSON.stringify({ ml }), banco, UID);
      expect(r).toEqual({ ok: false, resumo: "Quantidade de água inválida." });
      expect(banco.tabelas).toEqual([]);
    }
  });

  it("leitura que falha não grava e responde que não salvou", async () => {
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    const banco = bancoFalso({ erroNaLeitura: "permission denied" });
    const r = await executeAction("registrar_agua", JSON.stringify({ ml: 250 }), banco, UID);
    expect(r.ok).toBe(false);
    expect(r.resumo).toBe("Não consegui salvar agora. Tente novamente em instantes.");
    expect(banco.upserts).toHaveLength(0);
    erro.mockRestore();
  });

  it("gravação que falha responde que não salvou", async () => {
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    const banco = bancoFalso({ linha: { water_ml: 500 }, erroNaGravacao: "boom" });
    const r = await executeAction("registrar_agua", JSON.stringify({ ml: 250 }), banco, UID);
    expect(r).toEqual({ ok: false, resumo: "Não consegui salvar agora. Tente novamente em instantes." });
    erro.mockRestore();
  });
});
