// Classificação de exames laboratoriais com base em faixas de referência.
//
// Estratégia (em ordem):
//   1. Tabela curada de exames comuns (adulto), com faixas ajustadas por
//      sexo e idade quando isso muda a referência.
//   2. Se o exame não estiver na tabela, tenta interpretar a faixa de
//      referência informada (ex.: a que vem impressa no laudo).
//
// Este módulo é PURO (sem dependências de servidor) para poder ser usado
// tanto no back-end (chat/IA) quanto no front-end (formulário).
//
// AVISO: as faixas são referências gerais para adultos e servem apenas para
// orientação. Não substituem a avaliação de um profissional de saúde.

export type Sex = "M" | "F" | null | undefined;
export type ExamLevel = "normal" | "atencao" | "alterado";
export type ExamDirection = "baixo" | "normal" | "alto";

export type ExamContext = { sex?: Sex; age?: number | null };

export type ExamClassification = {
  matched: boolean; // conseguimos classificar?
  status: ExamLevel;
  direction: ExamDirection;
  faixa: string; // texto da faixa de referência usada
  explicacao: string; // explicação amigável em pt-BR
  source: "tabela" | "referencia" | "nenhuma";
  needs?: ("sexo" | "idade")[]; // dados que faltam para classificar bem
};

// Extrai o primeiro número de um texto (aceita vírgula decimal).
export function parseExamNumber(input: unknown): number | null {
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  if (typeof input !== "string") return null;
  const m = input.replace(/\s/g, "").match(/-?\d+(?:[.,]\d+)?/);
  if (!m) return null;
  const n = Number(m[0].replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

// Interpreta uma faixa de referência textual comum do laudo.
// Ex.: "< 200", "70-99", "70 a 99", "> 40", "até 150", "≥ 30".
export function parseReferenceRange(
  ref: unknown
): { min?: number; max?: number } | null {
  if (typeof ref !== "string") return null;
  const s = ref.toLowerCase().replace(",", ".");

  // intervalo: 70-99 / 70 a 99 / 70 até 99
  const range = s.match(/(-?\d+(?:\.\d+)?)\s*(?:-|–|a|até|ate)\s*(-?\d+(?:\.\d+)?)/);
  if (range) {
    const a = Number(range[1]);
    const b = Number(range[2]);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      return { min: Math.min(a, b), max: Math.max(a, b) };
    }
  }
  // só máximo: < 200 / <= 200 / ≤ 200 / menor que 200 / até 200
  const maxOnly = s.match(/(?:<|≤|<=|menor que|abaixo de|até|ate)\s*(-?\d+(?:\.\d+)?)/);
  if (maxOnly) {
    const b = Number(maxOnly[1]);
    if (Number.isFinite(b)) return { max: b };
  }
  // só mínimo: > 40 / >= 40 / ≥ 40 / maior que 40 / acima de 40
  const minOnly = s.match(/(?:>|≥|>=|maior que|acima de)\s*(-?\d+(?:\.\d+)?)/);
  if (minOnly) {
    const a = Number(minOnly[1]);
    if (Number.isFinite(a)) return { min: a };
  }
  return null;
}

// Normaliza o nome do exame para casar com a tabela.
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // tira acentos
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type RangeDef = {
  keys: string[]; // termos que identificam o exame (sem acento)
  unit: string;
  sexDependent?: boolean; // faixa muda muito entre homens e mulheres
  // devolve status/direção/faixa a partir do valor e do contexto
  classify: (v: number, ctx: ExamContext) => {
    status: ExamLevel;
    direction: ExamDirection;
    faixa: string;
  };
};

// Ajuda: exame em que apenas valores ALTOS preocupam (colesterol, glicose…).
// bordas: [desejavelMax, alteradoMin] → normal < desejavelMax ≤ atenção < alteradoMin ≤ alterado
function highConcern(
  desirableMax: number,
  alteredMin: number,
  faixa: string,
  lowFloor?: number // abaixo disso também é alterado (ex.: hipoglicemia)
) {
  return (v: number): { status: ExamLevel; direction: ExamDirection; faixa: string } => {
    if (lowFloor != null && v < lowFloor)
      return { status: "alterado", direction: "baixo", faixa };
    if (v >= alteredMin) return { status: "alterado", direction: "alto", faixa };
    if (v >= desirableMax) return { status: "atencao", direction: "alto", faixa };
    return { status: "normal", direction: "normal", faixa };
  };
}

// Ajuda: exame com faixa fechada [min, max]; fora dela é alterado, com uma
// pequena margem de "atenção" nas bordas.
function windowConcern(min: number, max: number, faixa: string) {
  const margin = (max - min) * 0.08;
  return (v: number): { status: ExamLevel; direction: ExamDirection; faixa: string } => {
    if (v < min)
      return {
        status: v < min - margin ? "alterado" : "atencao",
        direction: "baixo",
        faixa,
      };
    if (v > max)
      return {
        status: v > max + margin ? "alterado" : "atencao",
        direction: "alto",
        faixa,
      };
    return { status: "normal", direction: "normal", faixa };
  };
}

// Ajuda: exame em que valores BAIXOS preocupam (HDL, vitamina D, hemoglobina).
function lowConcern(normalMin: number, alteredMax: number, faixa: string) {
  // normal ≥ normalMin ; atenção entre alteredMax e normalMin ; alterado < alteredMax
  return (v: number): { status: ExamLevel; direction: ExamDirection; faixa: string } => {
    if (v >= normalMin) return { status: "normal", direction: "normal", faixa };
    if (v >= alteredMax) return { status: "atencao", direction: "baixo", faixa };
    return { status: "alterado", direction: "baixo", faixa };
  };
}

const isFemale = (ctx: ExamContext) => ctx.sex === "F";

const TABLE: RangeDef[] = [
  {
    keys: ["glicose", "glicemia", "glicose jejum", "glicose em jejum", "glicemia de jejum"],
    unit: "mg/dL",
    classify: (v) =>
      highConcern(100, 126, "70–99 mg/dL (jejum)", 70)(v),
  },
  {
    keys: ["hemoglobina glicada", "hba1c", "a1c", "glicada"],
    unit: "%",
    classify: (v) => highConcern(5.7, 6.5, "< 5,7%")(v),
  },
  {
    keys: ["colesterol total", "colesterol"],
    unit: "mg/dL",
    classify: (v) => highConcern(190, 240, "< 190 mg/dL")(v),
  },
  {
    keys: ["ldl", "colesterol ldl", "ldl colesterol"],
    unit: "mg/dL",
    classify: (v) => highConcern(130, 160, "< 130 mg/dL (ideal < 100)")(v),
  },
  {
    keys: ["hdl", "colesterol hdl", "hdl colesterol"],
    unit: "mg/dL",
    sexDependent: true,
    classify: (v, ctx) =>
      isFemale(ctx)
        ? lowConcern(50, 45, "≥ 50 mg/dL (mulheres)")(v)
        : lowConcern(40, 35, "≥ 40 mg/dL (homens)")(v),
  },
  {
    keys: ["triglicerideos", "triglicerides", "triglicerides", "tg"],
    unit: "mg/dL",
    classify: (v) => highConcern(150, 200, "< 150 mg/dL")(v),
  },
  {
    keys: ["vitamina d", "25 oh vitamina d", "25 hidroxivitamina d", "vitamina d 25"],
    unit: "ng/mL",
    classify: (v) => {
      if (v > 100) return { status: "atencao", direction: "alto", faixa: "30–100 ng/mL" };
      return lowConcern(30, 20, "30–100 ng/mL")(v);
    },
  },
  {
    keys: ["tsh", "hormonio tireoestimulante"],
    unit: "µUI/mL",
    classify: (v) => windowConcern(0.4, 4.0, "0,4–4,0 µUI/mL")(v),
  },
  {
    keys: ["t4 livre", "tiroxina livre", "ft4"],
    unit: "ng/dL",
    classify: (v) => windowConcern(0.9, 1.7, "0,9–1,7 ng/dL")(v),
  },
  {
    keys: ["creatinina"],
    unit: "mg/dL",
    sexDependent: true,
    classify: (v, ctx) =>
      isFemale(ctx)
        ? windowConcern(0.6, 1.1, "0,6–1,1 mg/dL (mulheres)")(v)
        : windowConcern(0.7, 1.3, "0,7–1,3 mg/dL (homens)")(v),
  },
  {
    keys: ["ureia"],
    unit: "mg/dL",
    classify: (v) => windowConcern(15, 45, "15–45 mg/dL")(v),
  },
  {
    keys: ["acido urico", "urico"],
    unit: "mg/dL",
    sexDependent: true,
    classify: (v, ctx) =>
      isFemale(ctx)
        ? windowConcern(2.4, 6.0, "2,4–6,0 mg/dL (mulheres)")(v)
        : windowConcern(3.4, 7.0, "3,4–7,0 mg/dL (homens)")(v),
  },
  {
    keys: ["hemoglobina", "hb"],
    unit: "g/dL",
    sexDependent: true,
    classify: (v, ctx) =>
      isFemale(ctx)
        ? lowConcern(12, 11, "12–16 g/dL (mulheres)")(v)
        : lowConcern(13, 12, "13–17 g/dL (homens)")(v),
  },
  {
    keys: ["hematocrito", "ht"],
    unit: "%",
    sexDependent: true,
    classify: (v, ctx) =>
      isFemale(ctx)
        ? windowConcern(36, 46, "36–46% (mulheres)")(v)
        : windowConcern(40, 52, "40–52% (homens)")(v),
  },
  {
    keys: ["ferritina"],
    unit: "ng/mL",
    sexDependent: true,
    classify: (v, ctx) =>
      isFemale(ctx)
        ? windowConcern(15, 150, "15–150 ng/mL (mulheres)")(v)
        : windowConcern(30, 400, "30–400 ng/mL (homens)")(v),
  },
  {
    keys: ["testosterona total", "testosterona"],
    unit: "ng/dL",
    sexDependent: true,
    classify: (v, ctx) => {
      if (isFemale(ctx)) return windowConcern(15, 70, "15–70 ng/dL (mulheres)")(v);
      const faixa = "264–916 ng/dL (homens)";
      if (v < 264) return { status: "alterado", direction: "baixo", faixa };
      if (v > 916) return { status: "alterado", direction: "alto", faixa };
      if (v < 350) return { status: "atencao", direction: "baixo", faixa };
      return { status: "normal", direction: "normal", faixa };
    },
  },
  {
    keys: ["vitamina b12", "b12", "cobalamina"],
    unit: "pg/mL",
    classify: (v) => {
      if (v < 200) return { status: "alterado", direction: "baixo", faixa: "200–900 pg/mL" };
      if (v < 300) return { status: "atencao", direction: "baixo", faixa: "200–900 pg/mL" };
      if (v > 900) return { status: "atencao", direction: "alto", faixa: "200–900 pg/mL" };
      return { status: "normal", direction: "normal", faixa: "200–900 pg/mL" };
    },
  },
  {
    keys: ["ferro", "ferro serico"],
    unit: "µg/dL",
    classify: (v) => windowConcern(60, 160, "60–160 µg/dL")(v),
  },
  {
    keys: ["tgo", "ast", "aspartato aminotransferase"],
    unit: "U/L",
    sexDependent: true,
    classify: (v, ctx) =>
      isFemale(ctx)
        ? highConcern(32, 48, "até 32 U/L (mulheres)")(v)
        : highConcern(40, 60, "até 40 U/L (homens)")(v),
  },
  {
    keys: ["tgp", "alt", "alanina aminotransferase"],
    unit: "U/L",
    sexDependent: true,
    classify: (v, ctx) =>
      isFemale(ctx)
        ? highConcern(33, 50, "até 33 U/L (mulheres)")(v)
        : highConcern(41, 62, "até 41 U/L (homens)")(v),
  },
  {
    keys: ["pcr", "proteina c reativa", "proteina c-reativa"],
    unit: "mg/L",
    classify: (v) => highConcern(3, 10, "< 3 mg/L")(v),
  },
  {
    keys: ["tsh ultrassensivel"],
    unit: "µUI/mL",
    classify: (v) => windowConcern(0.4, 4.0, "0,4–4,0 µUI/mL")(v),
  },
  {
    keys: ["potassio", "k"],
    unit: "mEq/L",
    classify: (v) => windowConcern(3.5, 5.1, "3,5–5,1 mEq/L")(v),
  },
  {
    keys: ["sodio", "na"],
    unit: "mEq/L",
    classify: (v) => windowConcern(135, 145, "135–145 mEq/L")(v),
  },
];

function findDef(name: string): RangeDef | null {
  const n = norm(name);
  const nPadded = ` ${n} `;
  // Pontua cada chave: correspondência exata vence; senão, a chave que aparece
  // como PALAVRA/EXPRESSÃO inteira no nome (evita "hemoglobina" casar com
  // "hemoglobina glicada", ou "na" casar dentro de "creatinina").
  let best: { def: RangeDef; score: number } | null = null;
  for (const def of TABLE) {
    for (const k of def.keys) {
      const nk = norm(k);
      let score = 0;
      if (n === nk) score = 1000 + nk.length;
      else if (nPadded.includes(` ${nk} `)) score = nk.length;
      if (score > 0 && (!best || score > best.score)) {
        best = { def, score };
      }
    }
  }
  return best?.def ?? null;
}

const STATUS_LABEL: Record<ExamLevel, string> = {
  normal: "Normal",
  atencao: "Atenção",
  alterado: "Alterado",
};

function explain(
  status: ExamLevel,
  direction: ExamDirection,
  faixa: string,
  ctx: ExamContext,
  sexUsed: boolean
): string {
  const dirTxt = direction === "alto" ? "acima" : direction === "baixo" ? "abaixo" : "dentro";
  const base =
    status === "normal"
      ? `Resultado dentro da faixa de referência (${faixa}).`
      : status === "atencao"
        ? `Resultado no limite, ${dirTxt} da faixa (${faixa}). Vale acompanhar.`
        : `Resultado ${dirTxt} da faixa de referência (${faixa}).`;
  const parts = [base];
  if (status !== "normal") {
    parts.push("Isto é uma orientação geral — confirme com um médico para avaliação.");
  }
  if (sexUsed && !ctx.sex) {
    parts.push("Dica: informe seu sexo no perfil para uma faixa mais precisa.");
  }
  if (ctx.age != null && ctx.age < 18) {
    parts.push("Atenção: faixas de adulto; para menores de 18, siga a referência do pediatra.");
  }
  return parts.join(" ");
}

// Classifica um exame. `reference` (opcional) é a faixa impressa no laudo,
// usada como segunda opção quando o exame não está na tabela curada.
export function classifyExam(params: {
  name: string;
  value: unknown;
  unit?: string | null;
  reference?: string | null;
  ctx?: ExamContext;
}): ExamClassification {
  const { name, value, reference } = params;
  const ctx: ExamContext = params.ctx ?? {};
  const v = parseExamNumber(value);

  if (v == null || !name?.trim()) {
    return {
      matched: false,
      status: "normal",
      direction: "normal",
      faixa: "",
      explicacao: "",
      source: "nenhuma",
    };
  }

  // 1) Tabela curada (personalizada por sexo/idade)
  const def = findDef(name);
  // Exame que depende de sexo, mas não sabemos o sexo: não chutamos.
  // Tentamos a faixa do laudo; se não houver, pedimos o sexo.
  const faltaSexo = !!def?.sexDependent && !ctx.sex;
  if (def && !faltaSexo) {
    const r = def.classify(v, ctx);
    return {
      matched: true,
      status: r.status,
      direction: r.direction,
      faixa: r.faixa,
      explicacao: explain(r.status, r.direction, r.faixa, ctx, !!def.sexDependent),
      source: "tabela",
    };
  }

  // 2) Faixa de referência do laudo
  const parsed = parseReferenceRange(reference);
  if (parsed && (parsed.min != null || parsed.max != null)) {
    let status: ExamLevel = "normal";
    let direction: ExamDirection = "normal";
    if (parsed.max != null && v > parsed.max) {
      status = "alterado";
      direction = "alto";
    } else if (parsed.min != null && v < parsed.min) {
      status = "alterado";
      direction = "baixo";
    }
    const faixa = (reference ?? "").trim();
    const dirTxt = direction === "alto" ? "acima" : direction === "baixo" ? "abaixo" : "dentro";
    const explicacao =
      status === "normal"
        ? `Resultado dentro da referência informada (${faixa}).`
        : `Resultado ${dirTxt} da referência informada (${faixa}). Confirme com um médico.`;
    return { matched: true, status, direction, faixa, explicacao, source: "referencia" };
  }

  // 3) Não foi possível classificar
  if (faltaSexo) {
    return {
      matched: false,
      status: "normal",
      direction: "normal",
      faixa: "",
      explicacao: `Para avaliar ${name.trim()} eu preciso saber o sexo — as faixas de referência mudam bastante entre homens e mulheres.`,
      source: "nenhuma",
      needs: ["sexo"],
    };
  }
  return {
    matched: false,
    status: "normal",
    direction: "normal",
    faixa: reference?.trim() || "",
    explicacao: "",
    source: "nenhuma",
  };
}

export { STATUS_LABEL as EXAM_STATUS_LABEL };
