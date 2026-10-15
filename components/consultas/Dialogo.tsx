"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { FOCO } from "@/components/clinico/estilos";

// Janela por cima da página, com o <dialog> do navegador: showModal() já
// prende o foco dentro, fecha no Esc e devolve o foco a quem abriu. O
// conteúdo continua dentro do .tema-clinico na árvore do DOM, então herda as
// variáveis --clin-* mesmo desenhado na camada de cima.
//
// `ocupado` segura a janela aberta enquanto algo que não se desfaz está
// correndo (concluir o registro): Esc, clique no fundo e o X não fecham. Sem
// isso o diálogo parecia cancelável enquanto a ação seguia, e uma recusa que
// chegasse depois de fechado ficava invisível. Sem a prop (a agenda), nada muda.
export function Dialogo({
  aberto,
  aoFechar,
  titulo,
  ocupado = false,
  children,
}: {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  ocupado?: boolean;
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
      // Esc: com `ocupado`, o cancel é impedido.
      onCancel={(e) => {
        if (ocupado) e.preventDefault();
      }}
      onClose={() => {
        // O Chrome nem sempre respeita o preventDefault do cancel (Esc repetido,
        // sem gesto do usuário no meio: a verificação 17 fecha o diálogo sem
        // isto). Se ainda está ocupado, abre de novo, em vez de deixar `aberto`
        // verdadeiro com a janela fechada.
        if (ocupado && aberto) ref.current?.showModal();
        else aoFechar();
      }}
      // Clique no fundo escuro (fora da caixa) fecha; dentro, não.
      onClick={(e) => {
        if (!ocupado && e.target === ref.current) aoFechar();
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
              disabled={ocupado}
              aria-label="Fechar"
              className={`-mr-2 -mt-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-clin-texto-2 hover:text-clin-texto disabled:opacity-60 ${FOCO}`}
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
