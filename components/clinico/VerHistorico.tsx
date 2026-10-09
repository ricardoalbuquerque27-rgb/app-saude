import { ChevronDown } from "lucide-react";

// As listas longas da tela antiga (refeições recentes, treinos de 30 dias,
// medidas registradas) ficam atrás de "Ver histórico", dentro da própria
// seção: a página única já é comprida, e o que se lê de relance na consulta
// é o resumo, não a lista. É um <details> nativo, sem JavaScript: abre com
// teclado e leitor de tela de graça, e a lista vem renderizada no servidor.
//
// O rótulo troca para "Esconder histórico" quando aberto (`group-open:`), e o
// alvo de toque tem 40 px, o piso das ações secundárias.
export function VerHistorico({ children }: { children: React.ReactNode }) {
  return (
    <details className="group mt-6">
      <summary className="inline-flex min-h-[40px] cursor-pointer list-none items-center gap-1.5 rounded-md text-[14px] font-medium text-clin-primaria focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clin-primaria [&::-webkit-details-marker]:hidden">
        <span className="group-open:hidden">Ver histórico</span>
        <span className="hidden group-open:inline">Esconder histórico</span>
        <ChevronDown
          aria-hidden="true"
          className="h-4 w-4 transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}
