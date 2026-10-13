"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

// Leitura que falhou. Antes, uma consulta com erro virava lista vazia e a
// tela dizia "Nenhum exame registrado" para um paciente que tinha exames: o
// nutricionista não tinha como saber que era falha. Agora a seção diz que não
// carregou e oferece tentar de novo no lugar.
//
// "Tentar de novo" é um router.refresh(): refaz as consultas no servidor sem
// recarregar a página, então um rascunho aberto em outra seção continua lá.
// `perigo` sobre `perigo-fundo` é um par com contraste testado
// (lib/temaClinico.ts).
export function ErroSecao({ secao }: { secao: string }) {
  const router = useRouter();
  const [tentando, startTransition] = useTransition();

  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-md bg-clin-perigo-fundo px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-[14px] leading-snug text-clin-perigo">
        Não foi possível carregar {secao}.
      </p>
      <button
        type="button"
        onClick={() => startTransition(() => router.refresh())}
        disabled={tentando}
        className="inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-md border border-clin-perigo px-4 text-[14px] font-semibold text-clin-perigo focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clin-perigo disabled:cursor-wait"
      >
        {tentando && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}
        Tentar de novo
      </button>
    </div>
  );
}
