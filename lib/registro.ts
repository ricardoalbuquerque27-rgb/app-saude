import { situacao, type Consulta } from "@/lib/consultas";

// Registro da consulta (prontuário enxuto do nutricionista): faixas das
// medidas, leitura do número digitado, IMC, a situação do registro de cada
// consulta e o "antes" que a tela mostra ao lado de cada medida. Só conta,
// sem banco; as leituras e as escritas são funções no banco
// (supabase/migrations/20261014120100_registro_da_consulta.sql).
//
// As faixas e os limites de texto são os da migração, `erro_das_medidas` e
// `erro_do_registro`: a tela avisa antes, o banco garante (a API aceita
// qualquer jsonb). Mudou um lado, mude o outro.

export type CampoMedida =
  | "weight_kg"
  | "body_fat_pct"
  | "waist_cm"
  | "hip_cm"
  | "chest_cm"
  | "arm_cm"
  | "thigh_cm"
  | "calf_cm"
  | "neck_cm";

/** Os quatro campos que a tela sempre mostra. */
export const CAMPOS_PRINCIPAIS = [
  "weight_kg",
  "body_fat_pct",
  "waist_cm",
  "hip_cm",
] as const satisfies readonly CampoMedida[];
/** Os cinco que ficam atrás de "Mais medidas". */
export const CAMPOS_EXTRAS = [
  "chest_cm",
  "arm_cm",
  "thigh_cm",
  "calf_cm",
  "neck_cm",
] as const satisfies readonly CampoMedida[];

/** Os nove campos, na ordem da tela. */
export const CAMPOS_MEDIDA: readonly CampoMedida[] = [...CAMPOS_PRINCIPAIS, ...CAMPOS_EXTRAS];

export const FAIXAS: Record<
  CampoMedida,
  { min: number; max: number; rotulo: string; unidade: "kg" | "%" | "cm" }
> = {
  weight_kg: { min: 20, max: 400, rotulo: "Peso", unidade: "kg" },
  body_fat_pct: { min: 2, max: 75, rotulo: "% de gordura", unidade: "%" },
  waist_cm: { min: 30, max: 250, rotulo: "Cintura", unidade: "cm" },
  hip_cm: { min: 30, max: 250, rotulo: "Quadril", unidade: "cm" },
  chest_cm: { min: 30, max: 250, rotulo: "Tórax", unidade: "cm" },
  arm_cm: { min: 10, max: 80, rotulo: "Braço", unidade: "cm" },
  thigh_cm: { min: 20, max: 120, rotulo: "Coxa", unidade: "cm" },
  calf_cm: { min: 10, max: 80, rotulo: "Panturrilha", unidade: "cm" },
  neck_cm: { min: 10, max: 80, rotulo: "Pescoço", unidade: "cm" },
};

export const LIMITES = {
  anamnese: 20000,
  diagnostico: 5000,
  conduta: 10000,
  observar: 2000,
  adendo: 5000,
  crn: 30,
} as const;

export type Medidas = Partial<Record<CampoMedida, number>>;

/** O que o editor manda ao banco a cada salvamento. */
export type CamposRegistro = {
  anamnese: string;
  diagnostico: string;
  conduta: string;
  observar: string;
  medidas: Medidas;
};

export type Registro = {
  id: string;
  appointment_id: string;
  nutritionist_id: string;
  patient_id: string;
  anamnese: string | null;
  diagnostico: string | null;
  conduta: string | null;
  observar: string | null;
  medidas: Medidas;
  /** A linha publicada na série do paciente (body_measurements); nula no rascunho. */
  measurement_id: string | null;
  status: "rascunho" | "concluido";
  concluded_at: string | null;
  assinatura_nome: string | null;
  assinatura_crn: string | null;
  created_at: string;
  /**
   * A trava de concorrência entre abas. Fica o texto exato que o banco
   * devolveu, nunca passa por `Date`: o timestamptz tem microssegundos, o
   * `Date` corta em milissegundos, e o banco recusaria o salvamento por
   * "mudou em outra aba" sem que nada tivesse mudado.
   */
  updated_at: string;
};

export type Adendo = {
  id: string;
  record_id: string;
  author_id: string;
  body: string;
  assinatura_nome: string | null;
  assinatura_crn: string | null;
  created_at: string;
};

/** As colunas que as telas leem, na ordem dos tipos acima. */
export const COLUNAS_REGISTRO =
  "id, appointment_id, nutritionist_id, patient_id, anamnese, diagnostico, conduta, observar, medidas, measurement_id, status, concluded_at, assinatura_nome, assinatura_crn, created_at, updated_at";
export const COLUNAS_ADENDO = "id, record_id, author_id, body, assinatura_nome, assinatura_crn, created_at";

// ---------------------------------------------------------------------------
// Número digitado
// ---------------------------------------------------------------------------

/**
 * Lê o que o nutri digitou num campo de medida. Vazio é "sem medida" (nulo),
 * não erro; o que não é só um número é erro. `Number("72kg")` já dá NaN, mas
 * `parseFloat("72kg")` daria 72 e gravaria uma medida que ninguém digitou
 * assim; e `Number("1e2")` ou `Number("0x10")` passariam por número. Por isso
 * a forma é conferida antes: dígitos, com uma vírgula ou um ponto no meio.
 */
export function lerNumero(texto: string): { ok: true; valor: number | null } | { ok: false } {
  const limpo = texto.trim();
  if (limpo === "") return { ok: true, valor: null };
  if (!/^\d+(?:[.,]\d+)?$/.test(limpo)) return { ok: false };
  return { ok: true, valor: Number(limpo.replace(",", ".")) };
}

/**
 * A mensagem de faixa, no texto exato do banco (`erro_das_medidas`): "%" vem
 * colado ao número e "kg"/"cm" levam espaço. Nulo = a medida vale; as bordas
 * valem.
 */
export function erroDaMedida(campo: CampoMedida, valor: number): string | null {
  const f = FAIXAS[campo];
  // `valor < min || valor > max` deixa NaN passar (as duas comparações dão
  // falso), e NaN não é medida.
  if (Number.isFinite(valor) && valor >= f.min && valor <= f.max) return null;
  const unidade = f.unidade === "%" ? "%" : ` ${f.unidade}`;
  return `${f.rotulo} fora da faixa (${f.min} a ${f.max}${unidade}).`;
}

/**
 * O texto de um campo de medida, conferido de uma vez: lido como número e
 * dentro da faixa. Vazio é "sem medida" (`valor` nulo, apaga a medida); o que
 * não é número, ou está fora da faixa, vem com a mensagem que a tela mostra
 * embaixo do campo. A tela repetia essa conta em três lugares (o que vai ao
 * banco, o aviso do campo e o IMC), e quem precisa separar "vazio" de
 * "inválido" é o salvamento: vazio apaga a medida, inválido guarda a última
 * que valia (EditorRegistro).
 */
export function lerMedida(
  campo: CampoMedida,
  texto: string,
): { ok: true; valor: number | null } | { ok: false; erro: string } {
  const lido = lerNumero(texto);
  if (!lido.ok) return { ok: false, erro: "Digite só o número, como 71,8." };
  if (lido.valor == null) return { ok: true, valor: null };
  const erro = erroDaMedida(campo, lido.valor);
  return erro ? { ok: false, erro } : { ok: true, valor: lido.valor };
}

/**
 * As medidas que valem entre os textos da tela: lidas por `lerMedida`, sem as
 * vazias e sem as inválidas. É o que a tela conta como "tem medida" e o que
 * entra na conferência; um segundo jeito de ler o número daria um valor na
 * tela e outro no banco.
 */
export function medidasValidas(textos: Record<CampoMedida, string>): Medidas {
  const out: Medidas = {};
  for (const c of CAMPOS_MEDIDA) {
    const lido = lerMedida(c, textos[c]);
    if (lido.ok && lido.valor != null) out[c] = lido.valor;
  }
  return out;
}

/**
 * O que está errado nas medidas da tela, numa frase só ("Peso fora da faixa
 * (20 a 400 kg)." ou "Cintura: Digite só o número, como 71,8."), ou "" se está
 * tudo certo. Serve ao diálogo de concluir, que não mostra os campos: a
 * mensagem da faixa já abre com o nome do campo, a de "não é número" não, e
 * sem o nome não se saberia qual campo corrigir.
 */
export function errosDasMedidas(textos: Record<CampoMedida, string>): string {
  const frases: string[] = [];
  for (const c of CAMPOS_MEDIDA) {
    const lido = lerMedida(c, textos[c]);
    if (lido.ok) continue;
    const rotulo = FAIXAS[c].rotulo;
    frases.push(lido.erro.startsWith(rotulo) ? lido.erro : `${rotulo}: ${lido.erro}`);
  }
  return frases.join(" ");
}

/** Peso em kg e altura em cm; uma casa decimal. Sem um dos dois, ou com altura zero, não calcula. */
export function imc(pesoKg?: number | null, alturaCm?: number | null): number | null {
  if (pesoKg == null || alturaCm == null) return null;
  if (!Number.isFinite(pesoKg) || !Number.isFinite(alturaCm)) return null;
  if (pesoKg <= 0 || alturaCm <= 0) return null;
  const m = alturaCm / 100;
  return Math.round((pesoKg / (m * m)) * 10) / 10;
}

// ---------------------------------------------------------------------------
// Medida em texto
// ---------------------------------------------------------------------------

/** "71,8 kg", "84 cm", "31,5%": o valor como o nutri o lê, o % colado ao número. */
export function valorDaMedida(campo: CampoMedida, valor: number): string {
  const v = valor.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  const { unidade } = FAIXAS[campo];
  return unidade === "%" ? `${v}%` : `${v} ${unidade}`;
}

/** "Peso 71,8 kg", "Gordura 31,5%": com o nome, para uma linha de medidas. */
export function textoDaMedida(campo: CampoMedida, valor: number): string {
  // "% de gordura 31,5%" repetiria o símbolo.
  const nome = campo === "body_fat_pct" ? "Gordura" : FAIXAS[campo].rotulo;
  return `${nome} ${valorDaMedida(campo, valor)}`;
}

/**
 * A diferença para o "antes": "−0,8" (o sinal de menos de verdade, não o
 * hífen), "+2" ou "sem mudança". 65,6 − 66,4 dá −0,8000000000000114 em ponto
 * flutuante; arredondar em duas casas antes de escrever é o que evita mostrar
 * isso, e também faz uma diferença que some no arredondamento valer "sem
 * mudança", e não "−0".
 */
export function textoDaDiferenca(atual: number, antes: number): string {
  const d = Math.round((atual - antes) * 100) / 100;
  if (d === 0) return "sem mudança";
  const v = Math.abs(d).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  return `${d < 0 ? "−" : "+"}${v}`;
}

// ---------------------------------------------------------------------------
// Situação do registro
// ---------------------------------------------------------------------------

export type SituacaoRegistro = "sem-direito" | "sem-registro" | "rascunho" | "registrada";

export const ROTULO_REGISTRO: Record<Exclude<SituacaoRegistro, "sem-direito">, string> = {
  "sem-registro": "Sem registro",
  rascunho: "Rascunho",
  registrada: "Registrada",
};

/**
 * A consulta tem direito a registro quando já começou e não foi pedido, falta
 * nem cancelamento: é a mesma regra do banco (`salvar_registro` recusa
 * "ainda não começou" e "falta ou cancelada"). Em andamento conta, e a "sem
 * desfecho" também: o nutri escreve antes de decidir se houve consulta. O
 * pedido de remarcação (`remarcar`) não tira o direito depois que o horário
 * começou. Sem direito, a tela nem mostra o botão.
 */
export function situacaoDoRegistro(
  c: Consulta,
  r: { status: "rascunho" | "concluido" } | null | undefined,
  agora: number | string,
): SituacaoRegistro {
  const s = situacao(c, agora);
  if (s === "pedido" || s === "faltou" || s === "cancelada") return "sem-direito";
  const instante = typeof agora === "string" ? Date.parse(agora) : agora;
  if (Date.parse(c.starts_at) > instante) return "sem-direito";
  if (!r) return "sem-registro";
  return r.status === "concluido" ? "registrada" : "rascunho";
}

/**
 * As consultas da lista que têm direito a registro: as únicas cujo registro a
 * agenda e a aba Consultas precisam ler. Perguntar ao banco pelas outras seria
 * ler o que ele já recusa por regra, e o `in (...)` com todas as consultas de
 * um acompanhamento de anos vira um endereço comprido à toa.
 */
export function comDireitoAoRegistro(lista: Consulta[], agora: number | string): Consulta[] {
  return lista.filter((c) => situacaoDoRegistro(c, null, agora) !== "sem-direito");
}

/** A primeira consulta abre com a anamnese; as seguintes registram a evolução. */
export function rotuloDaAnamnese(kind: Consulta["kind"]): "Anamnese" | "Evolução" {
  return kind === "primeira" ? "Anamnese" : "Evolução";
}

// ---------------------------------------------------------------------------
// O "antes" de cada medida
// ---------------------------------------------------------------------------

/**
 * A última medida anterior à consulta, por campo, para a tela mostrar "antes:
 * 72,5 kg (29/09)" ao lado do que o nutri digita. Só entram as medidas feitas
 * em consulta (`appointment_id`): a que o paciente anotou em casa, de balança
 * e fita diferentes, não é o ponto de comparação do consultório. O dia da
 * própria consulta fica de fora (é o que se está escrevendo, ou o que já foi
 * publicado) e os posteriores também. Campo a campo, porque uma consulta pode
 * ter peso e não ter cintura: a cintura vem da consulta de antes.
 *
 * `diaDaConsulta` é o dia em São Paulo (`diaDaConsulta()` de lib/consultas.ts,
 * nunca `starts_at.slice(0, 10)`); as datas são "AAAA-MM-DD", que ordenam
 * como texto.
 */
export function anteriores(
  // `number | null` por campo: a linha vem do banco, onde a medida não tirada
  // é nula. Nula já era pulada (`typeof valor !== "number"`); o tipo só passa
  // a dizer isso, para a tela não precisar descartar os nulos antes.
  serie: ({ date: string; appointment_id: string | null } & Partial<
    Record<CampoMedida, number | null>
  >)[],
  diaDaConsulta: string,
): Partial<Record<CampoMedida, { valor: number; data: string }>> {
  const out: Partial<Record<CampoMedida, { valor: number; data: string }>> = {};
  for (const linha of serie) {
    if (linha.appointment_id == null || linha.date >= diaDaConsulta) continue;
    for (const campo of Object.keys(FAIXAS) as CampoMedida[]) {
      const valor = linha[campo];
      if (typeof valor !== "number") continue;
      const atual = out[campo];
      if (!atual || linha.date > atual.data) out[campo] = { valor, data: linha.date };
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Concluir
// ---------------------------------------------------------------------------

/**
 * Tem algo escrito ou medido? Concluir um registro em branco é recusado no
 * banco ("Preencha ao menos uma parte do registro."); a tela usa isto para
 * desabilitar o botão antes. Espaço não é parte.
 */
export function temAlgumaParte(campos: Partial<CamposRegistro>): boolean {
  const { anamnese, diagnostico, conduta, observar, medidas } = campos;
  if ([anamnese, diagnostico, conduta, observar].some((t) => (t ?? "").trim() !== "")) return true;
  return Object.values(medidas ?? {}).some((v) => typeof v === "number");
}
