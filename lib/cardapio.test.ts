import { describe, it, expect } from "vitest";
import { partesDaSugestao, sugestaoDeProteina, textoDaSugestao, type ItemDoPlano } from "./cardapio";

// O cardápio da Maria no mock (ferramentas/mock-supabase.cjs, meal_plan_items),
// só com as colunas que a sugestão lê.
const CAFE_0 = "2 ovos mexidos + 1 fatia de pão integral + 1 banana";
const CAFE_1 = "Iogurte natural 170 g + 30 g de aveia + 1 fruta";
const ALMOCO = "120 g de frango grelhado + 4 col. de arroz integral + feijão + salada à vontade";
const LANCHE = "1 scoop de whey + 1 maçã";
const JANTAR = "Omelete de 3 ovos com legumes + 1 batata-doce média";

const PLANO: ItemDoPlano[] = [
  { meal_type: "Café da manhã", position: 0, description: CAFE_0, protein_g: 20 },
  { meal_type: "Café da manhã", position: 1, description: CAFE_1, protein_g: 18 },
  { meal_type: "Almoço", position: 0, description: ALMOCO, protein_g: 45 },
  { meal_type: "Lanche da tarde", position: 0, description: LANCHE, protein_g: 25 },
  { meal_type: "Jantar", position: 0, description: JANTAR, protein_g: 28 },
];

/** Meta de 110 g, nada consumido, vínculo ativo, nada registrado. */
const BASE = {
  meta: 110 as number | null,
  consumido: 0,
  itens: PLANO,
  tiposRegistrados: [] as string[],
  vinculoAtivo: true,
};

describe("sugestaoDeProteina", () => {
  describe("quando não sugere", () => {
    it("sem meta", () => {
      expect(sugestaoDeProteina({ ...BASE, meta: null })).toBeNull();
    });
    it("sem plano", () => {
      expect(sugestaoDeProteina({ ...BASE, itens: [] })).toBeNull();
    });
    it("com o vínculo revogado: o app não sugere comida por conta própria", () => {
      expect(sugestaoDeProteina({ ...BASE, vinculoAtivo: false })).toBeNull();
    });
    it("faltando menos de 10 g: lembrar de 9 g é chatice", () => {
      expect(sugestaoDeProteina({ ...BASE, consumido: 101 })).toBeNull();
    });
    it("faltando exatamente 10 g já sugere", () => {
      const r = sugestaoDeProteina({ ...BASE, consumido: 100 });
      expect(r?.faltam).toBe(10);
    });
    it("a conta de 10 g usa o valor arredondado, como a frase", () => {
      // 9,6 arredonda para 10 e aparece como "Faltam 10 g"; 9,4 vira 9 e some.
      expect(sugestaoDeProteina({ ...BASE, consumido: 100.4 })?.faltam).toBe(10);
      expect(sugestaoDeProteina({ ...BASE, consumido: 100.6 })).toBeNull();
    });
    it("meta ou consumido que não é número: null, nunca 'Faltam NaN g'", () => {
      expect(sugestaoDeProteina({ ...BASE, meta: NaN })).toBeNull();
      expect(sugestaoDeProteina({ ...BASE, consumido: NaN })).toBeNull();
    });
    it("meta batida ou passada", () => {
      expect(sugestaoDeProteina({ ...BASE, consumido: 110 })).toBeNull();
      expect(sugestaoDeProteina({ ...BASE, consumido: 150 })).toBeNull();
    });
  });

  describe("qual refeição", () => {
    it("a primeira na ordem de MEAL_TYPES que ainda não foi registrada", () => {
      expect(
        sugestaoDeProteina({ ...BASE, consumido: 20, tiposRegistrados: ["Café da manhã"] })
      ).toEqual({ faltam: 90, refeicao: "Almoço", descricao: ALMOCO, proteina: 45 });
    });

    it("sem nada registrado, é o café da manhã, com a opção de mais proteína", () => {
      expect(sugestaoDeProteina(BASE)).toEqual({
        faltam: 110,
        refeicao: "Café da manhã",
        descricao: CAFE_0,
        proteina: 20,
      });
    });

    it("a refeição já registrada é pulada", () => {
      const r = sugestaoDeProteina({
        ...BASE,
        consumido: 65,
        tiposRegistrados: ["Café da manhã", "Almoço"],
      });
      expect(r).toEqual({ faltam: 45, refeicao: "Lanche da tarde", descricao: LANCHE, proteina: 25 });
    });

    it("a ordem é a de MEAL_TYPES, não a do plano", () => {
      const embaralhado = [...PLANO].reverse();
      expect(sugestaoDeProteina({ ...BASE, itens: embaralhado })?.refeicao).toBe("Café da manhã");
    });

    it("refeição que o plano não tem é pulada sem barulho", () => {
      // O plano da Maria não tem lanche da manhã: Café registrado cai no Almoço.
      expect(
        sugestaoDeProteina({ ...BASE, tiposRegistrados: ["Café da manhã"] })?.refeicao
      ).toBe("Almoço");
    });

    it("todas as refeições do plano registradas: null", () => {
      expect(
        sugestaoDeProteina({
          ...BASE,
          tiposRegistrados: ["Café da manhã", "Almoço", "Lanche da tarde", "Jantar"],
        })
      ).toBeNull();
    });

    it("tipo desconhecido só aparece depois de todas as conhecidas registradas", () => {
      const itens: ItemDoPlano[] = [
        { meal_type: "Pré-treino", position: 0, description: "Shake de whey", protein_g: 30 },
        ...PLANO,
      ];
      const todasMenosJantar = ["Café da manhã", "Almoço", "Lanche da tarde"];
      expect(sugestaoDeProteina({ ...BASE, itens, tiposRegistrados: todasMenosJantar })?.refeicao).toBe(
        "Jantar"
      );
      expect(
        sugestaoDeProteina({ ...BASE, itens, tiposRegistrados: [...todasMenosJantar, "Jantar"] })
      ).toEqual({ faltam: 110, refeicao: "Pré-treino", descricao: "Shake de whey", proteina: 30 });
    });

    it("entre tipos desconhecidos, vale a menor position e, no empate, a ordem do plano", () => {
      const itens: ItemDoPlano[] = [
        { meal_type: "Pós-treino", position: 1, description: "Pós", protein_g: 20 },
        { meal_type: "Pré-treino", position: 0, description: "Pré", protein_g: 30 },
        { meal_type: "Colação", position: 0, description: "Colação", protein_g: 10 },
      ];
      expect(sugestaoDeProteina({ ...BASE, itens })?.refeicao).toBe("Pré-treino");
      expect(
        sugestaoDeProteina({ ...BASE, itens, tiposRegistrados: ["Pré-treino"] })?.refeicao
      ).toBe("Colação");
    });
  });

  describe("qual opção", () => {
    it("a de mais proteína", () => {
      const r = sugestaoDeProteina({ ...BASE, itens: [PLANO[1], PLANO[0]] });
      expect(r).toMatchObject({ descricao: CAFE_0, proteina: 20 });
    });

    it("no empate, a de menor position, seja qual for a ordem em que vieram", () => {
      const itens: ItemDoPlano[] = [
        { meal_type: "Lanche da tarde", position: 2, description: "Segunda opção", protein_g: 25 },
        { meal_type: "Lanche da tarde", position: 0, description: LANCHE, protein_g: 25 },
        { meal_type: "Lanche da tarde", position: 1, description: "Meio", protein_g: 24 },
      ];
      expect(sugestaoDeProteina({ ...BASE, itens })).toMatchObject({
        refeicao: "Lanche da tarde",
        descricao: LANCHE,
      });
    });

    it("opção sem proteína informada não entra na disputa", () => {
      const itens: ItemDoPlano[] = [
        { meal_type: "Almoço", position: 0, description: "Sem dado", protein_g: null },
        { meal_type: "Almoço", position: 1, description: ALMOCO, protein_g: 45 },
      ];
      expect(sugestaoDeProteina({ ...BASE, itens })).toMatchObject({ descricao: ALMOCO });
    });

    it("refeição com todas as opções sem proteína é pulada", () => {
      const itens: ItemDoPlano[] = [
        { meal_type: "Café da manhã", position: 0, description: "Sem dado", protein_g: null },
        { meal_type: "Café da manhã", position: 1, description: "Sem dado 2", protein_g: null },
        ...PLANO.slice(2),
      ];
      expect(sugestaoDeProteina({ ...BASE, itens })?.refeicao).toBe("Almoço");
    });

    // O nutricionista lança 0 g para fruta: "lanche da tarde, 0 g (1 maçã)"
    // não cobre parte de nada do que falta, então vale como sem proteína.
    it.each([0, -5])("opção com %s g vale como sem proteína: a refeição é pulada", (zero) => {
      const itens: ItemDoPlano[] = [
        { meal_type: "Café da manhã", position: 0, description: "1 fruta", protein_g: zero },
        ...PLANO.slice(2),
      ];
      expect(sugestaoDeProteina({ ...BASE, itens })).toMatchObject({
        refeicao: "Almoço",
        descricao: ALMOCO,
      });
    });

    it("refeição com opções de 0 g e de 12 g sugere a de 12 g", () => {
      const itens: ItemDoPlano[] = [
        { meal_type: "Lanche da tarde", position: 0, description: "1 maçã", protein_g: 0 },
        { meal_type: "Lanche da tarde", position: 1, description: "Iogurte", protein_g: 12 },
      ];
      expect(sugestaoDeProteina({ ...BASE, itens })).toEqual({
        faltam: 110,
        refeicao: "Lanche da tarde",
        descricao: "Iogurte",
        proteina: 12,
      });
    });

    it("plano inteiro de 0 g: null", () => {
      const itens = PLANO.map((i) => ({ ...i, protein_g: 0 }));
      expect(sugestaoDeProteina({ ...BASE, itens })).toBeNull();
    });

    it("plano inteiro sem proteína informada: null", () => {
      const itens = PLANO.map((i) => ({ ...i, protein_g: null }));
      expect(sugestaoDeProteina({ ...BASE, itens })).toBeNull();
    });
  });

  it("arredonda o que falta e a proteína da opção", () => {
    const itens: ItemDoPlano[] = [
      { meal_type: "Lanche da tarde", position: 0, description: LANCHE, protein_g: 24.6 },
    ];
    // 110 − 69,6 = 40,4 → 40; 24,6 → 25.
    expect(sugestaoDeProteina({ ...BASE, consumido: 69.6, itens })).toEqual({
      faltam: 40,
      refeicao: "Lanche da tarde",
      descricao: LANCHE,
      proteina: 25,
    });
  });
});

describe("textoDaSugestao", () => {
  it("a frase da spec, com a refeição em minúscula e sem artigo", () => {
    expect(
      textoDaSugestao({
        faltam: 40,
        refeicao: "Lanche da tarde",
        descricao: "1 scoop de whey + 1 maçã",
        proteina: 25,
      })
    ).toBe(
      "Faltam 40 g de proteína para a meta de hoje. Próxima refeição do seu plano: lanche da tarde, 25 g (1 scoop de whey + 1 maçã)."
    );
  });

  it("só a primeira letra desce: o resto do nome fica como está", () => {
    expect(
      textoDaSugestao({ faltam: 12, refeicao: "Pré-treino TP", descricao: "Shake", proteina: 30 })
    ).toContain("pré-treino TP, 30 g (Shake)");
  });
});

describe("partesDaSugestao", () => {
  // A tela corta a descrição da opção em duas linhas (spec "Sugestão para
  // fechar a meta"), então precisa da frase e da descrição em separado. O texto
  // inteiro continua sendo o de `textoDaSugestao`, que sai daqui.
  const s = { faltam: 40, refeicao: "Lanche da tarde", descricao: "1 scoop de whey + 1 maçã", proteina: 25 };

  it("separa a frase da descrição, sem os parênteses nem o ponto final", () => {
    expect(partesDaSugestao(s)).toEqual({
      frase: "Faltam 40 g de proteína para a meta de hoje. Próxima refeição do seu plano: lanche da tarde, 25 g",
      descricao: "1 scoop de whey + 1 maçã",
    });
  });

  it("frase, espaço e descrição entre parênteses dão exatamente o textoDaSugestao", () => {
    for (const x of [s, { faltam: 12, refeicao: "Pré-treino TP", descricao: "Shake", proteina: 30 }]) {
      const { frase, descricao } = partesDaSugestao(x);
      expect(`${frase} (${descricao}).`).toBe(textoDaSugestao(x));
    }
  });
});
