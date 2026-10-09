// Datas do app sempre no fuso do Brasil (evita o "vira o dia" às 21h com UTC).
const TZ = "America/Sao_Paulo";

// Data de hoje (YYYY-MM-DD) no fuso do Brasil — funciona no cliente e no servidor.
export function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// Soma/subtrai dias a uma data YYYY-MM-DD (usa meio-dia para evitar bordas de fuso).
export function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

// Segunda-feira da semana de uma data (ou de hoje), no fuso do Brasil.
export function weekStartISO(fromISO?: string): string {
  const base = fromISO ?? todayISO();
  const d = new Date(base + "T12:00:00");
  const day = (d.getDay() + 6) % 7; // segunda = 0
  return addDaysISO(base, -day);
}

/**
 * Formata uma data ISO (YYYY-MM-DD) como DD/MM/AAAA.
 *
 * Mora aqui, e não em components/ui.tsx, porque aquele módulo é "use client":
 * um server component que importasse esta função de lá receberia uma
 * referência de cliente no lugar da função e quebraria ao chamá-la.
 */
export function formatDate(date: string) {
  const [y, m, d] = date.split("-");
  if (!y || !m || !d) return date;
  return `${d}/${m}/${y}`;
}

/**
 * "quinta-feira, 8 de outubro" no fuso do Brasil.
 *
 * O `toLocaleDateString` sem `timeZone` usa o fuso de QUEM RODA — e o
 * dashboard é componente de servidor, que na Vercel roda em UTC. Entre 21h
 * e meia-noite no Brasil isso fazia a saudação exibir a data de AMANHÃ
 * enquanto todo o resto da tela contava hoje.
 */
export function hojeLongo(): string {
  return new Date().toLocaleDateString("pt-BR", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/**
 * Quantos dias DISTINTOS da lista caem na janela dos últimos `dias` dias,
 * contando hoje e nada do futuro.
 *
 * Existe porque a mesma conta, escrita à mão em dois lugares, errou de duas
 * formas diferentes no painel do nutricionista:
 *
 *   - `data >= addDaysISO(hoje, -7)` abrange OITO dias, não sete;
 *   - sem teto, um registro com data futura entra na conta.
 *
 * O resultado era "Adesão (7 dias): 114% — 8 de 7 dias". Os seletores de
 * data da Dieta e dos Hábitos deixam escolher um dia à frente, então a
 * segunda não é hipótese.
 */
export function diasNaJanela(
  datas: string[],
  hoje: string,
  dias: number
): number {
  const dentro = new Set<string>();
  for (const d of datas) if (naJanela(d, hoje, dias)) dentro.add(d);
  return dentro.size;
}

/** A mesma janela, para contar LINHAS em vez de dias distintos. */
export function naJanela(data: string, hoje: string, dias: number): boolean {
  return data >= addDaysISO(hoje, -(dias - 1)) && data <= hoje;
}

/**
 * Anda `dias` a partir de `iso`, sem passar de `maximo`.
 *
 * Substitui o `new Date(...).toISOString().slice(0,10)` que a navegação de
 * data usava: `toISOString` converte para UTC, e a leste de Greenwich a
 * meia-noite local cai no dia ANTERIOR — a seta andava errado.
 *
 * O limite existe porque data futura foi a causa de quatro correções de
 * "teto" espalhadas pelo app (contador de treinos, dias com registro, Score,
 * adesão). Barrar na entrada é mais barato que remendar em cada leitura.
 */
export function avancarDia(
  iso: string,
  dias: number,
  maximo?: string
): string {
  const destino = addDaysISO(iso, dias);
  if (maximo && destino > maximo) return maximo;
  return destino;
}

/**
 * Idade em anos completos na data `hoje` (YYYY-MM-DD), ou null quando a data
 * de nascimento falta, não é YYYY-MM-DD ou dá uma idade impossível.
 *
 * Substitui a conta do detalhe do paciente que dividia `Date.now()` menos o
 * nascimento por 365,25 dias: ela errava em um ano perto do aniversário e
 * usava o relógio do servidor (UTC na Vercel) em vez do dia do Brasil. Aqui
 * a comparação é só de texto ("MM-DD"), sem fuso: quem nasceu em 29/02 faz
 * aniversário em 01/03 nos anos que não são bissextos.
 */
export function idadeEm(
  nascimento: string | null | undefined,
  hoje: string
): number | null {
  if (!nascimento || !/^\d{4}-\d{2}-\d{2}/.test(nascimento)) return null;
  const anos =
    Number(hoje.slice(0, 4)) -
    Number(nascimento.slice(0, 4)) -
    (hoje.slice(5, 10) < nascimento.slice(5, 10) ? 1 : 0);
  return anos >= 0 && anos < 130 ? anos : null;
}

/**
 * O dia (YYYY-MM-DD) em que um instante caiu no Brasil.
 *
 * `created_at` vem do banco em UTC, e `created_at.slice(0, 10)` dá o dia de
 * Greenwich: uma mensagem mandada às 22h em São Paulo aparecia com a data de
 * amanhã na conversa. Uma data sem hora volta como veio; texto que não é
 * data volta como os 10 primeiros caracteres, que é o que a tela mostrava.
 */
export function dataNoBrasil(instante: string): string {
  // Só a data, sem hora, já é o dia: `new Date("2026-10-08")` leria como
  // meia-noite UTC e devolveria o dia 7.
  if (/^\d{4}-\d{2}-\d{2}$/.test(instante)) return instante;
  const d = new Date(instante);
  if (Number.isNaN(d.getTime())) return instante.slice(0, 10);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}
