/**
 * O histórico da IA que o paciente lê de novo (as análises da Saúde e os
 * Relatórios guardados). Os de antes do uso pretendido têm cartões das áreas
 * "Exames" e "Tratamento", que julgavam exame ("ligar um exame alterado a um
 * padrão da dieta") e orientavam o tratamento: o app não gera mais esses
 * cartões, e os antigos não aparecem. O texto livre (resumo, prioridades) não
 * tem área e fica como estava (CLAUDE.md, "Em aberto").
 */
const FORA = ["exame", "tratament"];

const semAcento = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

export function semExameNemTratamento<T extends { area?: unknown }>(itens: T[] | null | undefined): T[] {
  return (itens ?? []).filter((i) => {
    const area = typeof i?.area === "string" ? semAcento(i.area) : "";
    return !FORA.some((f) => area.startsWith(f));
  });
}
