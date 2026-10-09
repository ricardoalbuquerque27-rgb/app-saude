"use client";

import { useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * `router.refresh()` dentro de uma transição, e quanto tempo ele leva.
 *
 * Depois de gravar, a página refaz ~33 consultas no servidor; até elas
 * voltarem, a tela mostra o dado ANTIGO. Com o botão já liberado nesse meio
 * tempo, o segundo clique gravava de novo: uma sessão a mais em workout_plan
 * (que o paciente vê), uma prescrição repetida no Reaplicar, a mesma mensagem
 * duas vezes na conversa. E o editor de metas fechava antes de a tabela
 * mudar, então parecia que não tinha salvado.
 *
 * `recarregando` fica verdadeiro até a página nova estar na tela. Quem grava
 * desabilita o botão com `ocupado || recarregando`, com o rótulo de
 * andamento, e só considera a gravação terminada quando ele volta a falso.
 */
export function useRecarregar(): [recarregando: boolean, recarregar: () => void] {
  const router = useRouter();
  const [recarregando, startTransition] = useTransition();
  const recarregar = useCallback(
    () => startTransition(() => router.refresh()),
    [router]
  );
  return [recarregando, recarregar];
}
