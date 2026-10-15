// Texto dos anéis da Início e da Dieta. Mora num módulo puro, e não dentro do
// ProgressRing, para ser testado sem componente (o vitest só roda lib/).

// Só o tipo: o `import type` some na compilação, e um componente de cliente que
// use este módulo (o ProgressRing) não puxa lib/nutri.ts, que consulta o banco.
import type { PapelDasCalorias } from "@/lib/nutri";

/**
 * O rótulo do anel de calorias com o papel que a meta tem para este paciente
 * (`papelDasCalorias`, em lib/nutri.ts): "Calorias · limite" para quem está
 * acima do peso-alvo, "Calorias · meta" para quem está abaixo e "Calorias"
 * na manutenção ou sem peso/meta. Proteína e água passam sempre `null`: a
 * mesma palavra no anel de proteína diria que comer menos é o objetivo
 * (spec "Anel e macros", "Meta ou limite das calorias").
 */
export function rotuloDoAnel(label: string, papel: PapelDasCalorias): string {
  return papel ? `${label} · ${papel}` : label;
}

/**
 * "acima do limite" quando o anel passa de 100% e a meta é um teto. Em
 * "meta" (piso) passar de 100% é bom e não avisa, e por isso o aviso é uma
 * escolha de quem desenha (`avisoAcima`, só ligado quando o papel é
 * "limite"). Exatamente 100% é o limite batido, não passado: `pct > 1`, e
 * não `>=`. Sem o aviso, o excesso de um anel só sumiria no arco cheio
 * (spec "Anel e macros").
 */
export function avisoDoAnel(pct: number, avisoAcima: boolean): "acima do limite" | null {
  return avisoAcima && pct > 1 ? "acima do limite" : null;
}
