import { addDaysISO, dataNoBrasil, weekStartISO } from "@/lib/date";

// Consultas do nutricionista com o paciente: a situação de cada uma, o
// calendário das três vistas da agenda e os textos. Só conta, sem banco; as
// leituras moram em lib/consultasDb.ts e as escritas são funções no banco
// (supabase/migrations/20261013120000_consultas_e_agenda.sql).
//
// Tudo em America/Sao_Paulo e sem depender do fuso de quem roda: o servidor
// da Vercel roda em UTC, e uma consulta às 22h em São Paulo é 01h UTC do dia
// seguinte. Com `starts_at.slice(0, 10)` ela cairia no dia errado do mês.

const TZ = "America/Sao_Paulo";

export type StatusConsulta = "pedido" | "agendada" | "realizada" | "faltou" | "cancelada";
export type TipoConsulta = "primeira" | "retorno";
export type ModoConsulta = "presencial" | "online";

export type Consulta = {
  id: string;
  patient_id: string;
  nutritionist_id: string;
  /** Instante do início (timestamptz). No pedido, o horário que o paciente quer. */
  starts_at: string;
  duration_min: number;
  kind: TipoConsulta;
  mode: ModoConsulta;
  status: StatusConsulta;
  patient_message: string | null;
  /** Não nulo: o paciente pediu para remarcar esta agendada. */
  reschedule_requested_at: string | null;
  cancelled_by: "nutri" | "paciente" | null;
};

/** As colunas que as telas leem, na ordem do tipo acima. */
export const COLUNAS_CONSULTA =
  "id, patient_id, nutritionist_id, starts_at, duration_min, kind, mode, status, patient_message, reschedule_requested_at, cancelled_by";

/**
 * O que a tela mostra. Difere do status gravado em dois casos: "remarcar"
 * (agendada com pedido de remarcação) e "sem-desfecho" (agendada cujo fim já
 * passou). Este último não é gravado porque pediria um cron, e o plano Hobby
 * da Vercel só aceita cron diário.
 */
export type Situacao =
  | "pedido"
  | "remarcar"
  | "agendada"
  | "sem-desfecho"
  | "realizada"
  | "faltou"
  | "cancelada";

export const ROTULO_SITUACAO: Record<Situacao, string> = {
  pedido: "Pedido do paciente",
  remarcar: "Pediu para remarcar",
  agendada: "Agendada",
  "sem-desfecho": "Sem desfecho",
  realizada: "Realizada",
  faltou: "Faltou",
  cancelada: "Cancelada",
};
export const ROTULO_TIPO: Record<TipoConsulta, string> = {
  primeira: "1ª consulta",
  retorno: "retorno",
};
export const ROTULO_MODO: Record<ModoConsulta, string> = {
  presencial: "presencial",
  online: "online",
};
export const DURACOES = [30, 45, 60, 90] as const;

function ms(agora: number | string): number {
  return typeof agora === "string" ? Date.parse(agora) : agora;
}

export function fimDa(c: Pick<Consulta, "starts_at" | "duration_min">): number {
  return Date.parse(c.starts_at) + c.duration_min * 60_000;
}

export function situacao(c: Consulta, agora: number | string): Situacao {
  if (c.status !== "agendada") return c.status;
  // O horário que passou vence o pedido de remarcação: o nutri não remarcou
  // a tempo, e agora a consulta precisa de desfecho (talvez tenha havido).
  if (fimDa(c) <= ms(agora)) return "sem-desfecho";
  if (c.reschedule_requested_at) return "remarcar";
  return "agendada";
}

/** Precisa do nutricionista: pedido, pedido de remarcação ou sem desfecho. */
export function ehPendencia(c: Consulta, agora: number | string): boolean {
  const s = situacao(c, agora);
  return s === "pedido" || s === "remarcar" || s === "sem-desfecho";
}

// ---------------------------------------------------------------------------
// Fuso de São Paulo
// ---------------------------------------------------------------------------

const FORMATO_PARTES = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  // Sem isto, algumas versões do ICU escrevem a meia-noite como "24".
  hourCycle: "h23",
});

function partesEmSaoPaulo(instante: number) {
  const p: Record<string, string> = {};
  for (const x of FORMATO_PARTES.formatToParts(new Date(instante))) p[x.type] = x.value;
  return {
    ano: Number(p.year),
    mes: Number(p.month),
    dia: Number(p.day),
    hora: Number(p.hour),
    minuto: Number(p.minute),
    segundo: Number(p.second),
  };
}

/** Quanto São Paulo está à frente (negativo: atrás) de UTC naquele instante, em ms. */
function deslocamento(instante: number): number {
  const p = partesEmSaoPaulo(instante);
  const comoSeFosseUtc = Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.minuto, p.segundo);
  return comoSeFosseUtc - Math.floor(instante / 1000) * 1000;
}

function dataValida(data: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data);
  if (!m) return false;
  const [a, me, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = new Date(Date.UTC(a, me - 1, d));
  return t.getUTCFullYear() === a && t.getUTCMonth() === me - 1 && t.getUTCDate() === d;
}

/**
 * O instante (ISO, em UTC) de uma data e hora de São Paulo, com o
 * deslocamento DAQUELE dia. Um "-03:00" fixo erraria em uma hora se o
 * horário de verão voltar, e já errou até 2019.
 */
export function instanteEmSaoPaulo(data: string, hora: string): string {
  if (!dataValida(data)) throw new Error(`Data inválida: ${data}`);
  const h = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hora);
  if (!h) throw new Error(`Hora inválida: ${hora}`);
  const [a, m, d] = data.split("-").map(Number);
  const ingenuo = Date.UTC(a, m - 1, d, Number(h[1]), Number(h[2]));
  let instante = ingenuo - deslocamento(ingenuo);
  // Perto da troca de horário o deslocamento do palpite e o do resultado
  // diferem; o do resultado é o que vale.
  const ajuste = deslocamento(instante);
  if (ajuste !== deslocamento(ingenuo)) instante = ingenuo - ajuste;
  return new Date(instante).toISOString();
}

/** "HH:MM" de um instante, em São Paulo. */
export function horaEmSaoPaulo(instante: string): string {
  const p = partesEmSaoPaulo(Date.parse(instante));
  return `${String(p.hora).padStart(2, "0")}:${String(p.minuto).padStart(2, "0")}`;
}

/** O dia (YYYY-MM-DD) em que a consulta cai em São Paulo. */
export function diaDaConsulta(c: Pick<Consulta, "starts_at">): string {
  return dataNoBrasil(c.starts_at);
}

// ---------------------------------------------------------------------------
// Choque de horário
// ---------------------------------------------------------------------------

/**
 * As agendadas que se sobrepõem a um horário. Pedido e cancelada não ocupam
 * a agenda; `ignorarId` tira a própria consulta quando ela é remarcada.
 * Encostar (uma acaba às 15h, a outra começa às 15h) não é choque.
 */
export function choques(
  lista: Consulta[],
  inicio: string,
  duracao: number,
  ignorarId?: string
): Consulta[] {
  const a = Date.parse(inicio);
  const b = a + duracao * 60_000;
  return lista
    .filter(
      (c) =>
        c.status === "agendada" &&
        c.id !== ignorarId &&
        Date.parse(c.starts_at) < b &&
        a < fimDa(c)
    )
    .sort((x, y) => Date.parse(x.starts_at) - Date.parse(y.starts_at));
}

// ---------------------------------------------------------------------------
// Calendário
// ---------------------------------------------------------------------------

export type Vista = "dia" | "semana" | "mes";
const VISTAS: Vista[] = ["dia", "semana", "mes"];

function primeiro<T>(v: T | T[] | undefined): T | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** A vista do endereço; sem ela, a última usada (cookie); sem as duas, Dia. */
export function vistaDaUrl(
  valor: string | string[] | undefined,
  cookie: string | undefined
): Vista {
  const v = primeiro(valor);
  if (v && (VISTAS as string[]).includes(v)) return v as Vista;
  if (cookie && (VISTAS as string[]).includes(cookie)) return cookie as Vista;
  return "dia";
}

/** A data do endereço, se for uma data de verdade; senão, hoje. */
export function dataDaUrl(valor: string | string[] | undefined, hoje: string): string {
  const v = primeiro(valor);
  return v && dataValida(v) ? v : hoje;
}

/** Segunda a domingo da semana da data. */
export function diasDaSemana(data: string): string[] {
  const seg = weekStartISO(data);
  return Array.from({ length: 7 }, (_, i) => addDaysISO(seg, i));
}

function ultimoDiaDoMes(data: string): string {
  const [a, m] = data.split("-").map(Number);
  const dia = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return `${data.slice(0, 7)}-${String(dia).padStart(2, "0")}`;
}

/** As semanas inteiras (segunda a domingo) que cobrem o mês da data. */
export function gradeDoMes(data: string): { data: string; doMes: boolean }[] {
  const mes = data.slice(0, 7);
  const inicio = weekStartISO(`${mes}-01`);
  const fim = addDaysISO(weekStartISO(ultimoDiaDoMes(data)), 6);
  const out: { data: string; doMes: boolean }[] = [];
  for (let d = inicio; d <= fim; d = addDaysISO(d, 1)) {
    out.push({ data: d, doMes: d.slice(0, 7) === mes });
  }
  return out;
}

/**
 * O que cabe num dia do Mês: as primeiras consultas em ordem de hora e
 * quantas ficam de fora. `pendenciaNoResto` existe porque, sem ele, o "+N"
 * de um dia cheio esconderia um pedido marcado depois das que cabem.
 */
export function noDiaDoMes(
  lista: Consulta[],
  agora: number | string,
  max = 2
): { mostrar: Consulta[]; resto: number; pendenciaNoResto: boolean } {
  const ordem = [...lista].sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
  const fora = ordem.slice(max);
  return {
    mostrar: ordem.slice(0, max),
    resto: fora.length,
    pendenciaNoResto: fora.some((c) => ehPendencia(c, agora)),
  };
}

/** O primeiro e o último dia que a vista mostra, para a consulta ao banco. */
export function periodoDaVista(vista: Vista, data: string): { desde: string; ate: string } {
  if (vista === "dia") return { desde: data, ate: data };
  if (vista === "semana") {
    const d = diasDaSemana(data);
    return { desde: d[0], ate: d[6] };
  }
  const g = gradeDoMes(data);
  return { desde: g[0].data, ate: g[g.length - 1].data };
}

/** Um passo para trás ou para frente: um dia, uma semana ou o dia 1 do mês vizinho. */
export function andar(vista: Vista, data: string, passo: 1 | -1): string {
  if (vista === "dia") return addDaysISO(data, passo);
  if (vista === "semana") return addDaysISO(data, 7 * passo);
  const [a, m] = data.split("-").map(Number);
  const alvo = new Date(Date.UTC(a, m - 1 + passo, 1));
  return `${alvo.getUTCFullYear()}-${String(alvo.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

// ---------------------------------------------------------------------------
// Textos
// ---------------------------------------------------------------------------

const DIAS_CURTOS = ["seg.", "ter.", "qua.", "qui.", "sex.", "sáb.", "dom."];
const MESES_CURTOS = ["jan.", "fev.", "mar.", "abr.", "mai.", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."];
const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** 0 = segunda. Pela data, sem fuso. */
export function diaDaSemana(data: string): number {
  return (new Date(data + "T12:00:00Z").getUTCDay() + 6) % 7;
}

export function nomeCurtoDoDia(data: string): string {
  return DIAS_CURTOS[diaDaSemana(data)];
}

function maiuscula(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "20/10" */
export function dataCurta(data: string): string {
  return `${data.slice(8, 10)}/${data.slice(5, 7)}`;
}

/** "ter., 20/10 às 14:00", no fuso de São Paulo. */
export function rotuloDoInstante(instante: string): string {
  const dia = dataNoBrasil(instante);
  return `${nomeCurtoDoDia(dia)}, ${dataCurta(dia)} às ${horaEmSaoPaulo(instante)}`;
}

export function rotuloDaConsulta(c: Pick<Consulta, "starts_at">): string {
  return rotuloDoInstante(c.starts_at);
}

function diaEMes(data: string): { dia: number; mes: string; ano: number } {
  return {
    dia: Number(data.slice(8, 10)),
    mes: MESES_CURTOS[Number(data.slice(5, 7)) - 1],
    ano: Number(data.slice(0, 4)),
  };
}

export function tituloDoPeriodo(vista: Vista, data: string, hoje: string): string {
  if (vista === "dia") {
    const { dia, mes } = diaEMes(data);
    return `${maiuscula(nomeCurtoDoDia(data))}, ${dia} de ${mes}${data === hoje ? " · hoje" : ""}`;
  }
  if (vista === "semana") {
    const d = diasDaSemana(data);
    const a = diaEMes(d[0]);
    const b = diaEMes(d[6]);
    if (a.ano !== b.ano) return `${a.dia} de ${a.mes} de ${a.ano} a ${b.dia} de ${b.mes} de ${b.ano}`;
    if (a.mes !== b.mes) return `${a.dia} de ${a.mes} a ${b.dia} de ${b.mes}`;
    return `${a.dia} a ${b.dia} de ${b.mes}`;
  }
  return `${maiuscula(MESES[Number(data.slice(5, 7)) - 1])} de ${data.slice(0, 4)}`;
}

// ---------------------------------------------------------------------------
// Próxima, última e retorno
// ---------------------------------------------------------------------------

/** A agendada que ainda não acabou, a mais cedo (inclui a que está acontecendo). */
export function proximaConsulta(lista: Consulta[], agora: number | string): Consulta | null {
  const t = ms(agora);
  return (
    lista
      .filter((c) => c.status === "agendada" && fimDa(c) > t)
      .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))[0] ?? null
  );
}

/** A realizada mais recente que já começou. */
export function ultimaRealizada(lista: Consulta[], agora: number | string): Consulta | null {
  const t = ms(agora);
  return (
    lista
      .filter((c) => c.status === "realizada" && Date.parse(c.starts_at) <= t)
      .sort((a, b) => Date.parse(b.starts_at) - Date.parse(a.starts_at))[0] ?? null
  );
}

/** Retorno se já houve consulta realizada; senão, 1ª consulta. */
export function tipoSugerido(lista: Consulta[]): TipoConsulta {
  return lista.some((c) => c.status === "realizada") ? "retorno" : "primeira";
}

/** Palpite do dono do produto, não regra clínica: 60 min na 1ª, 45 no retorno. */
export function duracaoPadrao(tipo: TipoConsulta): number {
  return tipo === "primeira" ? 60 : 45;
}

/** 30 dias depois, no mesmo horário de São Paulo. É palpite; o nutri muda. */
export function sugestaoDeRetorno(c: Pick<Consulta, "starts_at">): { data: string; hora: string } {
  return { data: addDaysISO(dataNoBrasil(c.starts_at), 30), hora: horaEmSaoPaulo(c.starts_at) };
}

// ---------------------------------------------------------------------------
// Alertas da fila
// ---------------------------------------------------------------------------

/**
 * Os alertas de consulta de um paciente, para a fila da Início e do Resumo.
 * O dono do produto escolheu só estes dois motivos: pedido aguardando (tem
 * alguém esperando resposta) e consulta sem desfecho (sem isso a agenda
 * apodrece e o "desde a última consulta" erra). Um alerta de cada, para não
 * encher a fila.
 */
export function alertasDeConsulta(
  lista: Consulta[],
  agora: number | string
): { tipo: "consulta"; nivel: number; texto: string }[] {
  const out: { tipo: "consulta"; nivel: number; texto: string }[] = [];
  if (lista.some((c) => c.status === "pedido"))
    out.push({ tipo: "consulta", nivel: 2, texto: "Pediu uma consulta" });
  if (lista.some((c) => situacao(c, agora) === "remarcar"))
    out.push({ tipo: "consulta", nivel: 2, texto: "Pediu para remarcar a consulta" });
  const semDesfecho = lista
    .filter((c) => situacao(c, agora) === "sem-desfecho")
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
  if (semDesfecho.length === 1)
    out.push({
      tipo: "consulta",
      nivel: 4,
      texto: `Consulta de ${dataCurta(diaDaConsulta(semDesfecho[0]))} sem desfecho`,
    });
  else if (semDesfecho.length > 1)
    out.push({ tipo: "consulta", nivel: 4, texto: `${semDesfecho.length} consultas sem desfecho` });
  return out;
}

// ---------------------------------------------------------------------------
// Grade da semana
// ---------------------------------------------------------------------------

/**
 * Faixa de cada consulta na coluna de um dia: as que se sobrepõem dividem a
 * largura, lado a lado. Um grupo de sobrepostas (encadeadas: a com b, b com
 * c) usa o mesmo número de faixas, para os blocos do grupo terem a mesma
 * largura. Sai na ordem de início.
 */
export function emFaixas(
  lista: Consulta[]
): { consulta: Consulta; faixa: number; faixas: number }[] {
  const ordem = [...lista].sort(
    (a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at) || fimDa(a) - fimDa(b)
  );
  const out: { consulta: Consulta; faixa: number; faixas: number }[] = [];
  let grupo: typeof out = [];
  let fimDoGrupo = -Infinity;
  let fimDaFaixa: number[] = [];

  const fecharGrupo = () => {
    for (const x of grupo) x.faixas = fimDaFaixa.length;
    out.push(...grupo);
    grupo = [];
    fimDaFaixa = [];
  };

  for (const c of ordem) {
    const ini = Date.parse(c.starts_at);
    if (ini >= fimDoGrupo && grupo.length) fecharGrupo();
    let faixa = fimDaFaixa.findIndex((fim) => fim <= ini);
    if (faixa === -1) {
      faixa = fimDaFaixa.length;
      fimDaFaixa.push(0);
    }
    fimDaFaixa[faixa] = fimDa(c);
    grupo.push({ consulta: c, faixa, faixas: 0 });
    fimDoGrupo = Math.max(grupo.length > 1 ? fimDoGrupo : -Infinity, fimDa(c));
  }
  if (grupo.length) fecharGrupo();
  return out;
}
