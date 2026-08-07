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
