import { describe, expect, it } from "vitest";
import { AI_TOOLS, executeAction } from "./aiActions";
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

// Os exames, com o banco falso das duas tabelas que as ações de exame tocam.
function bancoDosExames({
  exames = [],
  leituraFalha = false,
  perfil = null,
}: { exames?: Linha[]; leituraFalha?: boolean; perfil?: Linha | null }) {
  const gravados: Linha[] = [];
  const from = (tabela: string) => {
    if (tabela === "exams") {
      const filtros: ((l: Linha) => boolean)[] = [];
      let ordem: { col: string; asc: boolean } | null = null;
      let teto: number | null = null;
      const resultado = () => {
        if (leituraFalha) return { data: null, error: { message: "falha de rede" } };
        let out = exames.filter((l) => filtros.every((f) => f(l)));
        if (ordem) {
          const { col, asc } = ordem;
          out = [...out].sort((a, b) => (a[col] < b[col] ? -1 : a[col] > b[col] ? 1 : 0) * (asc ? 1 : -1));
        }
        return { data: teto == null ? out : out.slice(0, teto), error: null };
      };
      const q: any = {
        select: () => q,
        eq: (col: string, v: any) => (filtros.push((l) => l[col] === v), q),
        order: (col: string, o?: { ascending?: boolean }) => ((ordem = { col, asc: o?.ascending !== false }), q),
        limit: (n: number) => ((teto = n), q),
        then: (resolve: (r: any) => void) => resolve(resultado()),
        insert: async (linha: Linha) => (gravados.push(linha), { error: null }),
      };
      return q;
    }
    if (tabela === "profiles") {
      const q: any = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: perfil, error: null }) };
      return q;
    }
    throw new Error(`tabela fora do teste: ${tabela}`);
  };
  return { banco: { from }, gravados };
}

describe("registrar_exame: grava e responde sem juízo", () => {
  it("grava a faixa do laudo, o status da regra da nutricionista e nenhuma nota automática", async () => {
    const { banco, gravados } = bancoDosExames({ perfil: { sex: "M", birth_date: "1990-01-01" } });
    const r = await executeAction(
      "registrar_exame",
      '{"titulo":"LDL-c","valor":"180","unidade":"mg/dL","referencia":"< 130"}',
      banco,
      PACIENTE
    );
    expect(gravados).toHaveLength(1);
    expect(gravados[0]).toMatchObject({
      user_id: PACIENTE, title: "LDL-c", result_value: "180", unit: "mg/dL",
      reference_range: "< 130", status: "alterado", notes: null, date: todayISO(),
    });
    expect(r).toEqual({ ok: true, resumo: 'Exame "LDL-c" registrado na aba Exames.' });
    expect(r.resumo).not.toMatch(/normal|alterado/i);
  });

  it("a data, o tipo e as observações do pedido vão para a linha", async () => {
    const { banco, gravados } = bancoDosExames({});
    await executeAction(
      "registrar_exame",
      '{"titulo":"TSH","valor":"2,1","data":"2026-09-01","tipo":"Hormonal","observacoes":"jejum de 12 h"}',
      banco,
      PACIENTE
    );
    expect(gravados[0]).toMatchObject({ date: "2026-09-01", exam_type: "Hormonal", notes: "jejum de 12 h", reference_range: null });
  });
});

describe("ler_exame: constata pelo laudo, sem salvar", () => {
  it("com valor digitado, responde sobre ele e não grava", async () => {
    const { banco, gravados } = bancoDosExames({});
    const r = await executeAction("ler_exame", '{"nome":"Glicose","valor":"150","referencia":"70 a 99"}', banco, PACIENTE);
    expect(r.ok).toBe(true);
    expect(r.resumo).toContain("acima da faixa do laudo (70 a 99)");
    expect(gravados).toEqual([]);
    const sem = await executeAction("ler_exame", '{"nome":"Glicose","valor":"150"}', banco, PACIENTE);
    expect(sem.resumo).toContain("sem faixa do laudo");
  });

  it("sem valor, lê os registros e junta as grafias do mesmo exame", async () => {
    const { banco } = bancoDosExames({
      exames: [
        { user_id: PACIENTE, title: "Colesterol LDL", result_value: "130", unit: "mg/dL", reference_range: "< 130", date: "2026-09-01" },
        { user_id: PACIENTE, title: "LDL-c", result_value: "180", unit: "mg/dL", reference_range: "< 130", date: "2026-10-12" },
        { user_id: PACIENTE, title: "HDL-c", result_value: "50", unit: "mg/dL", reference_range: "> 40", date: "2026-10-12" },
        { user_id: PACIENTE, title: "VLDL-colesterol", result_value: "35", unit: "mg/dL", reference_range: "< 30", date: "2026-10-12" },
      ],
    });
    const r = await executeAction("ler_exame", '{"nome":"LDL"}', banco, PACIENTE);
    expect(r.resumo).toContain("LDL-c: 180 mg/dL em 12/10/2026, acima da faixa do laudo (< 130)");
    expect(r.resumo).toContain("Colesterol LDL: 130 mg/dL em 01/09/2026, acima da faixa do laudo (< 130)");
    expect(r.resumo).not.toContain("HDL");
    expect(r.resumo).not.toContain("VLDL");
    expect(r.resumo.indexOf("LDL-c")).toBeLessThan(r.resumo.indexOf("Colesterol LDL"));
  });

  it("o texto da tabela no lugar do laudo sai 'sem faixa do laudo', nunca a tabela", async () => {
    const { banco } = bancoDosExames({
      exames: [{ user_id: PACIENTE, title: "Colesterol total", result_value: "210", unit: "mg/dL", reference_range: "< 190 mg/dL", date: "2026-09-02", status: "alterado" }],
    });
    const r = await executeAction("ler_exame", '{"nome":"Colesterol total"}', banco, PACIENTE);
    expect(r.resumo).toContain("Colesterol total: 210 mg/dL em 02/09/2026, sem faixa do laudo");
    expect(r.resumo).not.toMatch(/alterado|normal/i);
  });

  it("no máximo os 3 mais recentes", async () => {
    const exames = ["2026-01-10", "2026-03-10", "2026-05-10", "2026-07-10"].map((date, i) => ({
      user_id: PACIENTE, title: "TSH", result_value: String(i + 1), unit: "mUI/L", reference_range: "0,4 a 4,0", date,
    }));
    const r = await executeAction("ler_exame", '{"nome":"TSH"}', bancoDosExames({ exames }).banco, PACIENTE);
    expect(r.resumo.split("\n")).toHaveLength(3);
    expect(r.resumo).not.toContain("10/01/2026");
  });

  it("o exame fora da tabela casa pela palavra do nome", async () => {
    const { banco } = bancoDosExames({
      exames: [{ user_id: PACIENTE, title: "Marcador Zeta", result_value: "1,5", unit: null, reference_range: "0,9 a 1,7", date: "2026-10-01" }],
    });
    const r = await executeAction("ler_exame", '{"nome":"zeta"}', banco, PACIENTE);
    expect(r.resumo).toBe("Marcador Zeta: 1,5 em 01/10/2026, dentro da faixa do laudo (0,9 a 1,7)");
  });

  it("sem exame com esse nome", async () => {
    const r = await executeAction("ler_exame", '{"nome":"Ferritina"}', bancoDosExames({}).banco, PACIENTE);
    expect(r).toEqual({ ok: true, resumo: "Não achei esse exame nos seus registros." });
  });

  it("com a leitura falhando, diz que não conseguiu ler", async () => {
    const r = await executeAction("ler_exame", '{"nome":"LDL"}', bancoDosExames({ leituraFalha: true }).banco, PACIENTE);
    expect(r).toEqual({ ok: false, resumo: "Não consegui ler seus exames agora. Tente de novo." });
  });

  it("sem nome, pede o nome", async () => {
    const r = await executeAction("ler_exame", '{"valor":"150"}', bancoDosExames({}).banco, PACIENTE);
    expect(r).toEqual({ ok: false, resumo: "Preciso do nome do exame." });
  });
});

describe("as ferramentas de exame", () => {
  it("o avaliar_exame não existe mais", async () => {
    const r = await executeAction("avaliar_exame", '{"titulo":"Glicose","valor":"150"}', bancoDosExames({}).banco, PACIENTE);
    expect(r).toEqual({ ok: false, resumo: "Ação desconhecida." });
  });

  it("o AI_TOOLS tem ler_exame, não tem avaliar_exame, e o registrar_exame não pede sexo nem idade", () => {
    const nomes = AI_TOOLS.map((t) => t.function.name);
    expect(nomes).toContain("ler_exame");
    expect(nomes).not.toContain("avaliar_exame");
    const registrar = AI_TOOLS.find((t) => t.function.name === "registrar_exame")!;
    const props = Object.keys((registrar.function.parameters as any).properties);
    expect(props).not.toContain("sexo");
    expect(props).not.toContain("idade");
    const ler = AI_TOOLS.find((t) => t.function.name === "ler_exame")!;
    expect((ler.function.parameters as any).required).toEqual(["nome"]);
  });
});
