"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getConsultasDoPeriodo, getNomesDosPacientes } from "@/lib/consultasDb";
import type { Consulta } from "@/lib/consultas";

/**
 * As consultas do nutri num dia, com os nomes, para o aviso de choque. Serve
 * ao formulário (o dia escolhido) e ao painel de um pedido (o dia pedido): o
 * paciente não vê a agenda do nutri, então o horário que ele pede bate com
 * outro com frequência, e "Aceitar" sem avisar marcava duas no mesmo horário.
 *
 * `null` enquanto carrega; `falhou` quando a leitura deu erro (aí o aviso diz
 * que não deu para conferir, em vez de calar como se não houvesse choque).
 */
export function useConsultasDoDia(nutriId: string | undefined, data: string | null) {
  const [doDia, setDoDia] = useState<{ lista: Consulta[]; nomes: Record<string, string> } | null>(null);
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    if (!nutriId || !data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return;
    let vivo = true;
    const supabase = createClient();
    (async () => {
      const r = await getConsultasDoPeriodo(supabase, nutriId, data, data);
      const ids = Array.from(new Set(r.data.map((c) => c.patient_id)));
      const n = await getNomesDosPacientes(supabase, ids);
      if (!vivo) return;
      setFalhou(r.falhou);
      setDoDia({ lista: r.data, nomes: n.data });
    })();
    return () => {
      vivo = false;
    };
  }, [nutriId, data]);

  return { doDia, falhou };
}
