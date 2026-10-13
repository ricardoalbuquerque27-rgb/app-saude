import type { Consulta } from "@/lib/consultas";

/** O que as vistas da agenda recebem para desenhar e para abrir o painel. */
export type PropsDaVista = {
  consultas: Consulta[];
  nomes: Record<string, string>;
  agora: string;
  hoje: string;
  /** A data que a vista mostra (o dia, ou um dia da semana ou do mês). */
  data: string;
  abrir: (id: string) => void;
  /** "Desde a última consulta" por paciente, para a vista Dia. */
  desde?: Record<string, { titulo: string; texto: string }>;
};

export function hrefDaAgenda(vista: "dia" | "semana" | "mes", data: string): string {
  return `/app/agenda?vista=${vista}&data=${data}`;
}
