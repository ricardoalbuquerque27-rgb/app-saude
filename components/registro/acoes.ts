"use client";

import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/types";

// As escritas do registro da consulta: todas são funções no banco que devolvem
// { ok, error, id?, updated_at? }
// (supabase/migrations/20261014120100_registro_da_consulta.sql), porque as
// tabelas não têm política de escrita. Como em components/consultas/acoes.ts.

export type FuncaoRegistro =
  | "salvar_registro"
  | "concluir_registro"
  | "descartar_rascunho"
  | "adicionar_adendo";

type Args<F extends FuncaoRegistro> =
  Database["public"]["Functions"][F]["Args"];

/**
 * Chama a função e devolve a mensagem de erro (ou null se deu certo) junto do
 * que o banco respondeu. `updated_at` é a trava de concorrência de
 * `salvar_registro` e segue como o TEXTO que o banco mandou: passar por `Date`
 * corta os microssegundos, e o salvamento seguinte seria recusado como "mudou
 * em outra aba" sem que nada tivesse mudado.
 */
export async function chamarRegistro<F extends FuncaoRegistro>(
  funcao: F,
  args: Args<F>,
): Promise<{
  erro: string | null;
  dados: { id?: string; updated_at?: string } | null;
}> {
  const supabase = createClient();
  // O supabase-js não estreita a união de funções por F; o tipo de `args` já
  // foi conferido na assinatura acima.
  const { data, error } = await supabase.rpc(funcao, args as never);
  const r = data as {
    ok?: boolean;
    error?: string;
    id?: unknown;
    updated_at?: unknown;
  } | null;
  if (error)
    return {
      erro: "Não foi possível salvar. Confira a conexão e tente de novo.",
      dados: null,
    };
  if (r?.ok === false)
    return { erro: r.error ?? "Não foi possível salvar.", dados: null };
  return {
    erro: null,
    dados: {
      id: typeof r?.id === "string" ? r.id : undefined,
      updated_at: typeof r?.updated_at === "string" ? r.updated_at : undefined,
    },
  };
}
