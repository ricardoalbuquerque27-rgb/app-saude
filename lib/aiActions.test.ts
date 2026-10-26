import { describe, expect, it } from "vitest";
import { executeAction } from "./aiActions";
import { todayISO } from "./date";

// O assistente grava com o cliente do próprio paciente, e desde a migração
// 20261014120000 a RLS de body_measurements só deixa o paciente alterar ou
// apagar a linha com `measured_by` nulo. A medida que o nutricionista tira na
// consulta tem `measured_by` preenchido, e o banco a recusa SEM erro: o
// supabase-js devolve zero linhas afetadas. Mirando nela, o assistente diria
// "peso atualizado" sem ter mudado nada. Este supabase falso guarda as linhas
// em memória e se comporta assim, para o teste pegar o assistente que mira na
// linha do nutricionista em vez de contar com um erro que nunca vem.

type Linha = Record<string, any>;

const PACIENTE = "paciente-1";
const NUTRI = "nutri-1";

function bancoFalso(linhas: Linha[]) {
  let seq = 0;
  const from = (tabela: string) => {
    if (tabela !== "body_measurements") throw new Error(`tabela fora do teste: ${tabela}`);
    const filtros: ((l: Linha) => boolean)[] = [];
    let ordem: { col: string; asc: boolean } | null = null;
    let teto: number | null = null;
    let modo: "select" | "update" | "delete" = "select";
    let alteracao: Linha = {};

    // A RLS do paciente: só enxerga para alterar/apagar o que não é do prontuário.
    const alvos = () => linhas.filter((l) => filtros.every((f) => f(l)) && l.measured_by == null);
    const lidas = () => {
      let out = linhas.filter((l) => filtros.every((f) => f(l)));
      if (ordem) {
        const { col, asc } = ordem;
        out = [...out].sort((a, b) => (a[col] < b[col] ? -1 : a[col] > b[col] ? 1 : 0) * (asc ? 1 : -1));
      }
      return teto == null ? out : out.slice(0, teto);
    };

    const q: any = {
      select: () => q,
      eq: (col: string, v: any) => (filtros.push((l) => l[col] === v), q),
      is: (col: string, v: null) => (filtros.push((l) => (v === null ? l[col] == null : l[col] === v)), q),
      order: (col: string, o?: { ascending?: boolean }) => ((ordem = { col, asc: o?.ascending !== false }), q),
      limit: (n: number) => ((teto = n), q),
      maybeSingle: async () => ({ data: lidas()[0] ?? null, error: null }),
      update: (patch: Linha) => ((modo = "update"), (alteracao = patch), q),
      delete: () => ((modo = "delete"), q),
      insert: async (linha: Linha) => {
        linhas.push({
          id: `novo-${++seq}`, measured_by: null, appointment_id: null,
          created_at: new Date().toISOString(), ...linha,
        });
        return { error: null };
      },
      // update e delete terminam no await: zero linhas afetadas não é erro.
      then: (resolve: (r: { error: null }) => void) => {
        if (modo === "update") alvos().forEach((l) => Object.assign(l, alteracao));
        if (modo === "delete") for (const l of alvos()) linhas.splice(linhas.indexOf(l), 1);
        resolve({ error: null });
      },
    };
    return q;
  };
  return { from };
}

const hoje = () => todayISO();
const doNutri = (extra: Linha = {}): Linha => ({
  id: "bm-nutri", user_id: PACIENTE, date: hoje(), weight_kg: 66.4,
  measured_by: NUTRI, appointment_id: "ap-1", created_at: "2026-10-13T17:00:00.000Z", ...extra,
});
const doPaciente = (extra: Linha = {}): Linha => ({
  id: "bm-pac", user_id: PACIENTE, date: hoje(), weight_kg: 65.8,
  measured_by: null, appointment_id: null, created_at: "2026-10-13T11:00:00.000Z", ...extra,
});

describe("atualizar_peso", () => {
  it("com hoje só a medida do nutricionista: não mexe nela e registra uma nova", async () => {
    const linhas = [doNutri()];
    const r = await executeAction("atualizar_peso", '{"peso_kg":70}', bancoFalso(linhas), PACIENTE);

    expect(linhas.find((l) => l.id === "bm-nutri")?.weight_kg).toBe(66.4);
    expect(linhas).toHaveLength(2);
    expect(linhas.find((l) => l.id !== "bm-nutri")).toMatchObject({
      user_id: PACIENTE, date: hoje(), weight_kg: 70, measured_by: null,
    });
    expect(r).toMatchObject({ ok: true, resumo: "Peso de 70 kg registrado (hoje)." });
  });

  it("com hoje a do nutricionista e a do paciente: atualiza a do paciente", async () => {
    // A do nutricionista é a mais recente: sem o filtro ela seria a achada.
    const linhas = [doPaciente(), doNutri()];
    const r = await executeAction("atualizar_peso", '{"peso_kg":70}', bancoFalso(linhas), PACIENTE);

    expect(linhas).toHaveLength(2);
    expect(linhas.find((l) => l.id === "bm-pac")?.weight_kg).toBe(70);
    expect(linhas.find((l) => l.id === "bm-nutri")?.weight_kg).toBe(66.4);
    expect(r).toMatchObject({ ok: true, resumo: "Peso de hoje atualizado para 70 kg." });
  });
});

describe("remover_ultimo (peso)", () => {
  it("com a do nutricionista mais recente: apaga a mais recente do paciente", async () => {
    const linhas = [
      doPaciente({ id: "bm-pac-velha", created_at: "2026-10-01T11:00:00.000Z", date: "2026-10-01" }),
      doPaciente({ id: "bm-pac" }),
      doNutri(),
    ];
    const r = await executeAction("remover_ultimo", '{"tipo":"peso"}', bancoFalso(linhas), PACIENTE);

    expect(linhas.map((l) => l.id).sort()).toEqual(["bm-nutri", "bm-pac-velha"]);
    expect(r).toMatchObject({ ok: true, area: "medidas" });
  });

  it("só com a do nutricionista: diz que não há registro e não apaga nada", async () => {
    const linhas = [doNutri()];
    const r = await executeAction("remover_ultimo", '{"tipo":"peso"}', bancoFalso(linhas), PACIENTE);

    expect(linhas).toHaveLength(1);
    expect(r).toEqual({ ok: true, resumo: "Não há registro de peso para apagar." });
  });
});

// O definir_metas não pode gravar por cima das metas que o nutricionista
// prescreveu. A guarda lê `prescriptions`, e o supabase-js devolve
// `{ data: null, error }` sem lançar quando a leitura falha: tomada por "não
// tem prescrição", a falha deixava o assistente gravar as metas dele por cima
// das do nutricionista. Este banco falso só tem as duas tabelas da ação.
function bancoDasMetas({ prescricao, leituraFalha }: { prescricao: Linha | null; leituraFalha?: boolean }) {
  const gravados: Linha[] = [];
  const from = (tabela: string) => {
    if (tabela === "prescriptions") {
      const q: any = {
        select: () => q,
        eq: () => q,
        limit: () => q,
        maybeSingle: async () =>
          leituraFalha
            ? { data: null, error: { message: "falha de rede" } }
            : { data: prescricao, error: null },
      };
      return q;
    }
    if (tabela === "profiles") {
      return { upsert: async (patch: Linha) => (gravados.push(patch), { error: null }) };
    }
    throw new Error(`tabela fora do teste: ${tabela}`);
  };
  return { banco: { from }, gravados };
}

describe("definir_metas", () => {
  const metas = '{"calorias_dia":1800,"proteina_dia_g":120}';

  it("com a leitura da prescrição falhando: não grava e diz que não conferiu", async () => {
    const { banco, gravados } = bancoDasMetas({ prescricao: null, leituraFalha: true });
    const r = await executeAction("definir_metas", metas, banco, PACIENTE);

    expect(gravados).toEqual([]);
    expect(r).toEqual({
      ok: false,
      resumo: "Não consegui conferir as metas do seu nutricionista. Tente de novo.",
    });
  });

  it("com prescrição: não grava", async () => {
    const { banco, gravados } = bancoDasMetas({ prescricao: { id: "presc-1" } });
    const r = await executeAction("definir_metas", metas, banco, PACIENTE);

    expect(gravados).toEqual([]);
    expect(r.ok).toBe(false);
  });

  it("sem prescrição (a leitura deu certo e não achou): grava as metas", async () => {
    const { banco, gravados } = bancoDasMetas({ prescricao: null });
    const r = await executeAction("definir_metas", metas, banco, PACIENTE);

    expect(gravados).toHaveLength(1);
    expect(gravados[0]).toMatchObject({ id: PACIENTE, daily_calorie_goal: 1800, protein_goal_g: 120 });
    expect(r.ok).toBe(true);
  });
});
