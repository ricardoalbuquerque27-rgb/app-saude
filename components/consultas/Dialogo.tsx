"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { FOCO } from "@/components/clinico/estilos";

// Janela por cima da página, com o <dialog> do navegador: showModal() já
// prende o foco dentro, fecha no Esc e devolve o foco a quem abriu. O
// conteúdo continua dentro do .tema-clinico na árvore do DOM, então herda as
// variáveis --clin-* mesmo desenhado na camada de cima.
export function Dialogo({
  aberto,
  aoFechar,
  titulo,
  children,
}: {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (aberto && !d.open) d.showModal();
    if (!aberto && d.open) d.close();
  }, [aberto]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={idTitulo}
      onClose={aoFechar}
      // Clique no fundo escuro (fora da caixa) fecha; dentro, não.
      onClick={(e) => {
        if (e.target === ref.current) aoFechar();
      }}
      className="m-auto max-h-[90dvh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto rounded-lg border border-clin-linha bg-clin-chao p-0 text-clin-texto backdrop:bg-black/50"
    >
      {aberto && (
        <div className="p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <h2 id={idTitulo} className="text-lg font-semibold leading-snug">
              {titulo}
            </h2>
            <button
              type="button"
              onClick={aoFechar}
              aria-label="Fechar"
              className={`-mr-2 -mt-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-clin-texto-2 hover:text-clin-texto ${FOCO}`}
            >
              <X aria-hidden="true" className="h-5 w-5" />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
