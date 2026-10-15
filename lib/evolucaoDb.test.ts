import { describe, it, expect } from "vitest";
import { getEvolucaoDoCorpo, getInicioDoAcompanhamento, TETO_DO_CORPO } from "./evolucaoDb";
import { lerEmPaginas, LINHAS_POR_PAGINA } from "./paginacao";
import { bancoEmMemoria } from "./bancoEmMemoria";
import { addDaysISO } from "./date";

const PACIENTE = "pac-1";
const NUTRI = "nutri-1";
const HOJE = "2026-10-14";

/** `n` pesagens de casa, uma por linha, do dia `HOJE - n + 1` até HOJE (várias por dia quando passam de 365). */
function pesagens(n: number, extra: Record<string, unknown> = {}) {
  return Array.from({ length: n }, (_, i) => {
    const data = addDaysISO(HOJE, -(i % 365));
    return {
      id: `bm-${String(i).padStart(5, "0")}`,
      user_id: PACIENTE,
      date: data,
      weight_kg: 70,
      waist_cm: null,
      body_fat_pct: null,
      measured_by: null,
      created_at: `${data}T${String(10 + Math.floor(i / 365)).padStart(2, "0")}:00:00Z`,
      appointment_id: null,
      ...extra,
    };
  });
}

describe("lerEmPaginas", () => {
  /** Uma "consulta" que devolve os números de 0 a total-1 no intervalo pedido. */
  const numeros = (total: number, pedidos: [number, number][] = []) => (de: number, ate: number) => {
    pedidos.push([de, ate]);
    const fim = Math.min(ate + 1, total);
    return Promise.resolve({ data: Array.from({ length: Math.max(0, fim - de) }, (_, i) => de + i), error: null });
  };

  it.each([999, 1000, 1001, 2500])("%i linhas: lê todas, em páginas de 1.000", async (total) => {
    const pedidos: [number, number][] = [];
    const r = await lerEmPaginas(numeros(total, pedidos), 5000);
    expect(r.falhou).toBe(false);
    expect(r.data).toHaveLength(total);
    expect(r.data[r.data.length - 1]).toBe(total - 1);
    // Pede até vir uma página com menos de 1.000: com 1.000 exatas, a 2ª vem vazia.
    expect(pedidos).toEqual(
      Array.from({ length: Math.floor(total / LINHAS_POR_PAGINA) + 1 }, (_, i) => [i * 1000, i * 1000 + 999])
    );
  });

  it("chegar ao teto com a última página cheia é falha: pode haver mais, e o histórico viria cortado", async () => {
    const pedidos: [number, number][] = [];
    const r = await lerEmPaginas(numeros(5001, pedidos), 5000);
    expect(r.falhou).toBe(true);
    // e não pede a 6ª página
    expect(pedidos).toHaveLength(5);
    const exato = await lerEmPaginas(numeros(5000), 5000);
    expect(exato.falhou).toBe(true);
    const abaixo = await lerEmPaginas(numeros(4999), 5000);
    expect(abaixo.falhou).toBe(false);
    expect(abaixo.data).toHaveLength(4999);
  });

  it("erro numa página do meio é falha, e não as páginas que vieram", async () => {
    const r = await lerEmPaginas(
      (de, ate) =>
        de === 1000
          ? Promise.resolve({ data: null, error: { message: "caiu" } })
          : numeros(2500)(de, ate),
      5000
    );
    expect(r.falhou).toBe(true);
    expect(r.data).toEqual([]);
  });
});

describe("lerEmPaginas: a contagem da primeira página", () => {
  // O PostgREST corta a resposta no `max-rows` do projeto SEM erro. Se o
  // projeto baixar o teto de 1.000 para 500, a 1ª página chega com 500 linhas,
  // parece "curta" e a leitura parava ali como se fosse o fim: o histórico
  // cortado desenhado como inteiro. O `count: "exact"` da 1ª página diz o
  // total, e a soma das páginas tem de bater com ele.
  const comContagem =
    (total: number, contagem: number | null | undefined = total, pedidos: boolean[] = [], teto = LINHAS_POR_PAGINA) =>
    (de: number, ate: number, contar: boolean) => {
      pedidos.push(contar);
      const fim = Math.min(ate + 1, total, de + teto);
      return Promise.resolve({
        data: Array.from({ length: Math.max(0, fim - de) }, (_, i) => de + i),
        error: null,
        count: contar ? contagem : null,
      });
    };

  it("pede a contagem na primeira página e só nela", async () => {
    const pedidos: boolean[] = [];
    const r = await lerEmPaginas(comContagem(2500, 2500, pedidos), 5000);
    expect(r.falhou).toBe(false);
    expect(r.data).toHaveLength(2500);
    expect(pedidos).toEqual([true, false, false]);
  });

  it.each([0, 999, 1000, 1001, 2500])("%i linhas, e a contagem diz %i: leitura inteira", async (total) => {
    const r = await lerEmPaginas(comContagem(total), 5000);
    expect(r.falhou).toBe(false);
    expect(r.data).toHaveLength(total);
  });

  it("a soma abaixo da contagem é falha: o PostgREST cortou a página abaixo de 1.000", async () => {
    // 1.200 linhas no banco, mas o projeto só devolve 500 por resposta.
    const r = await lerEmPaginas(comContagem(1200, 1200, [], 500), 5000);
    expect(r.falhou).toBe(true);
    expect(r.data).toEqual([]);
  });

  it("a soma acima da contagem também é falha: algo mudou no meio da leitura", async () => {
    const r = await lerEmPaginas(comContagem(1500, 1499), 5000);
    expect(r.falhou).toBe(true);
    expect(r.data).toEqual([]);
  });

  it.each([null, undefined])("resposta sem contagem (%s): não há o que conferir, vale o que veio", async (contagem) => {
    const r = await lerEmPaginas(comContagem(1500, contagem), 5000);
    expect(r.falhou).toBe(false);
    expect(r.data).toHaveLength(1500);
  });

  it("o teto continua sendo falha, com ou sem contagem", async () => {
    expect((await lerEmPaginas(comContagem(5001), 5000)).falhou).toBe(true);
    expect((await lerEmPaginas(comContagem(5000), 5000)).falhou).toBe(true);
  });
});

describe("getEvolucaoDoCorpo", () => {
  const DESDE = addDaysISO(HOJE, -364);

  it("pede a contagem na primeira página e só nela", async () => {
    const banco = bancoEmMemoria({ body_measurements: pesagens(2500) });
    const r = await getEvolucaoDoCorpo(banco, PACIENTE, DESDE, HOJE);
    expect(r.falhou).toBe(false);
    expect(banco.chamadas.map((c) => c.contagem)).toEqual(["exact", null, null]);
  });

  it("projeto com max-rows menor que a página (500): é falha, e não o período cortado como se fosse inteiro", async () => {
    const banco = bancoEmMemoria({ body_measurements: pesagens(1200) }, { maxRows: 500 });
    const r = await getEvolucaoDoCorpo(banco, PACIENTE, DESDE, HOJE);
    expect(r.falhou).toBe(true);
    expect(r.data).toEqual([]);
  });

  it("com o max-rows padrão de 1.000, um período maior que ele é lido inteiro", async () => {
    const banco = bancoEmMemoria({ body_measurements: pesagens(2500) }, { maxRows: 1000 });
    const r = await getEvolucaoDoCorpo(banco, PACIENTE, DESDE, HOJE);
    expect(r.falhou).toBe(false);
    expect(r.data).toHaveLength(2500);
  });

  it.each([999, 1000, 1001])("%i medidas no período: todas, e não é falha", async (n) => {
    const banco = bancoEmMemoria({ body_measurements: pesagens(n) });
    const r = await getEvolucaoDoCorpo(banco, PACIENTE, DESDE, HOJE);
    expect(r.falhou).toBe(false);
    expect(r.data).toHaveLength(n);
    // Antes, `.limit(1000)` e "vir 1.000 é falha": a pesagem de três vezes por
    // dia passava disso em um ano e a aba Corpo morria de vez.
    expect(banco.chamadas.every((c) => c.range != null)).toBe(true);
  });

  it(`passar do teto (${TETO_DO_CORPO}) é falha`, async () => {
    const r = await getEvolucaoDoCorpo(bancoEmMemoria({ body_measurements: pesagens(TETO_DO_CORPO + 1) }), PACIENTE, DESDE, HOJE);
    expect(TETO_DO_CORPO).toBe(5000);
    expect(r.falhou).toBe(true);
  });

  it("erro numa página é falha", async () => {
    const banco = bancoEmMemoria({ body_measurements: pesagens(1500) }, { falhar: (_c, i) => i === 1 });
    const r = await getEvolucaoDoCorpo(banco, PACIENTE, DESDE, HOJE);
    expect(r.falhou).toBe(true);
  });

  it("piso e teto de data (gte e lte): nem antes do período nem data futura", async () => {
    const dentro = pesagens(3);
    const linhas = [
      ...dentro,
      { ...dentro[0], id: "antes", date: addDaysISO(DESDE, -1) },
      { ...dentro[0], id: "amanha", date: addDaysISO(HOJE, 1) },
      { ...dentro[0], id: "outro", user_id: "pac-2" },
    ];
    const banco = bancoEmMemoria({ body_measurements: linhas });
    const r = await getEvolucaoDoCorpo(banco, PACIENTE, DESDE, HOJE);
    expect(r.data.map((l: any) => l.date).sort()).toEqual(dentro.map((l) => l.date).sort());
    expect(banco.chamadas[0].filtros).toEqual(
      expect.arrayContaining([
        ["eq", "user_id", PACIENTE],
        ["gte", "date", DESDE],
        ["lte", "date", HOJE],
      ])
    );
  });

  it("da mais antiga para a mais nova; no mesmo dia, pela gravação; com as colunas dos gráficos", async () => {
    const linhas = [
      { ...pesagens(1)[0], id: "b", date: "2026-10-10", created_at: "2026-10-10T20:00:00Z", weight_kg: 69.9 },
      { ...pesagens(1)[0], id: "a", date: "2026-10-10", created_at: "2026-10-10T08:00:00Z", weight_kg: 70.3 },
      { ...pesagens(1)[0], id: "c", date: "2026-10-02", created_at: "2026-10-02T09:00:00Z", weight_kg: 71, measured_by: NUTRI },
    ];
    const r = await getEvolucaoDoCorpo(bancoEmMemoria({ body_measurements: linhas }), PACIENTE, DESDE, HOJE);
    expect(r.data.map((l: any) => l.weight_kg)).toEqual([71, 70.3, 69.9]);
    expect(Object.keys(r.data[0]).sort()).toEqual(
      ["body_fat_pct", "created_at", "date", "measured_by", "waist_cm", "weight_kg"].sort()
    );
    expect(r.data[0].measured_by).toBe(NUTRI);
  });
});

describe("getInicioDoAcompanhamento", () => {
  const vinculo = (extra: Record<string, unknown>) => ({
    id: "lk",
    nutritionist_id: NUTRI,
    patient_id: PACIENTE,
    status: "active",
    created_at: "2026-05-12T12:00:00Z",
    accepted_at: "2026-05-12T12:30:00Z",
    ...extra,
  });

  it("o vínculo ativo do nutri logado: filtra pelo id dele, sem confiar só na RLS", async () => {
    // Um vínculo ativo de outro nutricionista, mais recente: a RLS já o
    // esconderia, mas sem o filtro uma política mais larga (ou uma leitura com
    // outra chave) daria o início do acompanhamento de outra pessoa.
    const banco = bancoEmMemoria({
      patient_links: [
        vinculo({ id: "meu" }),
        vinculo({ id: "outro", nutritionist_id: "nutri-2", created_at: "2026-09-01T12:00:00Z", accepted_at: "2026-09-01T12:30:00Z" }),
      ],
    });
    const r = await getInicioDoAcompanhamento(banco, PACIENTE, NUTRI);
    expect(r).toEqual({ data: { accepted_at: "2026-05-12T12:30:00Z", created_at: "2026-05-12T12:00:00Z" }, falhou: false });
    expect(banco.chamadas[0].filtros).toEqual(
      expect.arrayContaining([
        ["eq", "patient_id", PACIENTE],
        ["eq", "nutritionist_id", NUTRI],
        ["eq", "status", "active"],
      ])
    );
  });

  it("o mais recente dos ativos dele", async () => {
    const banco = bancoEmMemoria({
      patient_links: [
        vinculo({ id: "velho" }),
        vinculo({ id: "novo", created_at: "2026-08-01T12:00:00Z", accepted_at: null }),
        vinculo({ id: "revogado", status: "revoked", created_at: "2026-09-01T12:00:00Z" }),
      ],
    });
    const r = await getInicioDoAcompanhamento(banco, PACIENTE, NUTRI);
    expect(r.data).toEqual({ accepted_at: null, created_at: "2026-08-01T12:00:00Z" });
  });

  it("sem vínculo ativo: nulo, sem falha (quem chama decide)", async () => {
    const r = await getInicioDoAcompanhamento(bancoEmMemoria({ patient_links: [] }), PACIENTE, NUTRI);
    expect(r).toEqual({ data: null, falhou: false });
  });

  it("leitura que falha é falha, e não 'sem vínculo'", async () => {
    const banco = bancoEmMemoria({ patient_links: [vinculo({})] }, { falhar: () => true });
    const r = await getInicioDoAcompanhamento(banco, PACIENTE, NUTRI);
    expect(r).toEqual({ data: null, falhou: true });
  });
});
