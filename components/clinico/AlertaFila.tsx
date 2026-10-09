import type { Alerta } from "@/lib/nutri";

// "Por que está na sua fila": os alertas do resumo do paciente, cada um com
// as ações que cabem a ele (quem chama decide quais; este componente só
// organiza). Sem alerta não renderiza nada: a seção vazia diria "tudo bem"
// com a mesma cara de um problema, e o nutricionista aprenderia a ignorá-la.
//
// Texto do alerta em `texto` e título em `atencao`, os dois pares com
// contraste testado sobre `atencao-fundo` (lib/temaClinico.ts). A cor do
// fundo sozinha não diz "atenção"; quem diz é o título.
export function AlertaFila({
  alertas,
  acoes,
}: {
  alertas: Alerta[];
  acoes: (a: Alerta) => React.ReactNode;
}) {
  if (alertas.length === 0) return null;

  return (
    <section
      aria-labelledby="fila-titulo"
      className="rounded-md bg-clin-atencao-fundo px-4 py-4"
    >
      <h2
        id="fila-titulo"
        className="text-[15px] font-semibold leading-snug text-clin-atencao"
      >
        Por que está na sua fila
      </h2>
      <ul className="mt-2">
        {alertas.map((a, i) => (
          <li
            key={`${a.tipo}-${i}`}
            className="flex flex-col gap-2 border-t border-clin-linha py-3 first:border-t-0 first:pt-1 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
          >
            <p className="text-[15px] leading-snug text-clin-texto">{a.texto}</p>
            <div className="flex flex-wrap items-center gap-2">{acoes(a)}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}
