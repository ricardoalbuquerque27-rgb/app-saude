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
