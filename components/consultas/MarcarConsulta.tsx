"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import type { ModoConsulta, TipoConsulta } from "@/lib/consultas";
import { ACAO_PRIMARIA } from "@/components/clinico/estilos";
import { Dialogo } from "./Dialogo";
import { FormConsulta } from "./FormConsulta";

/** O botão "Marcar consulta" e a janela com o formulário. */
export function MarcarConsulta({
  nutriId,
  pacientes,
  pacienteId,
  inicial,
}: {
  nutriId: string;
  pacientes?: { id: string; nome: string }[];
  pacienteId?: string;
  inicial?: Partial<{ data: string; hora: string; tipo: TipoConsulta; modo: ModoConsulta }>;
}) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setAberto(true)} className={`inline-flex ${ACAO_PRIMARIA}`}>
        <Plus aria-hidden="true" className="h-4 w-4" />
        Marcar consulta
      </button>
      <Dialogo aberto={aberto} aoFechar={() => setAberto(false)} titulo="Marcar consulta">
        <FormConsulta
          modo="marcar"
          nutriId={nutriId}
          pacientes={pacientes}
          pacienteId={pacienteId}
          inicial={inicial}
          aoTerminar={() => setAberto(false)}
          aoCancelar={() => setAberto(false)}
        />
      </Dialogo>
    </>
  );
}
