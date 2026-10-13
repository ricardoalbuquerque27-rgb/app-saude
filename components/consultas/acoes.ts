"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRecarregar } from "@/components/clinico/useRecarregar";
import type { Database } from "@/lib/types";

// As escritas de consulta: todas são funções no banco que devolvem
// { ok, error } (supabase/migrations/20261013120000_consultas_e_agenda.sql),
// porque a tabela não tem política de escrita.

export type FuncaoConsulta =
  | "marcar_consulta"
  | "remarcar_consulta"
  | "fechar_consulta"
  | "pedir_consulta"
  | "pedir_remarcacao"
  | "cancelar_consulta";

type Args<F extends FuncaoConsulta> =
  Database["public"]["Functions"][F]["Args"];

/** Chama a função e devolve a mensagem de erro, ou null se deu certo. */
export async function chamarConsulta<F extends FuncaoConsulta>(
  funcao: F,
  args: Args<F>,
): Promise<string | null> {
  const supabase = createClient();
  // O supabase-js não estreita a união de funções por F; o tipo de `args` já
  // foi conferido na assinatura acima.
  const { data, error } = await supabase.rpc(funcao, args as never);
  const r = data as { ok?: boolean; error?: string } | null;
  if (error)
    return "Não foi possível salvar. Confira a conexão e tente de novo.";
  if (r?.ok === false) return r.error ?? "Não foi possível salvar.";
  return null;
}

/**
 * Uma ação de consulta com o estado da tela: `ocupado` do clique até a
 * página nova chegar (router.refresh), para um segundo toque não gravar de
 * novo (useRecarregar), e o erro para mostrar ao lado do botão.
 */
export function useAcaoConsulta() {
  const [gravando, setGravando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [recarregando, recarregar] = useRecarregar();

  async function executar<F extends FuncaoConsulta>(
    funcao: F,
    args: Args<F>,
  ): Promise<boolean> {
    setGravando(true);
    setErro(null);
    const e = await chamarConsulta(funcao, args);
    if (e) {
      setGravando(false);
      setErro(e);
      return false;
    }
    recarregar();
    setGravando(false);
    return true;
  }

  return { executar, ocupado: gravando || recarregando, erro, setErro };
}
