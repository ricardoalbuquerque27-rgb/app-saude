"use client";

import {
  diaDaConsulta,
  fimDa,
  horaEmSaoPaulo,
  ROTULO_MODO,
  ROTULO_SITUACAO,
  ROTULO_TIPO,
  situacao,
} from "@/lib/consultas";
import { FOCO } from "@/components/clinico/estilos";
import { CLASSE_SELO, SELO } from "../aparencia";
import type { PropsDaVista } from "./tipos";

// O dia em lista, por horário. A linha "desde a última consulta" aparece só
// no retorno: na 1ª consulta não há "última". Pendência (pedido, remarcação,
// sem desfecho) tem a borda tracejada, como na Semana.
export function VistaDia({ consultas, nomes, agora, data, abrir, desde }: PropsDaVista) {
  const doDia = consultas
    .filter((c) => diaDaConsulta(c) === data)
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));

  if (doDia.length === 0) {
    return <p className="py-8 text-center text-[15px] text-clin-texto-2">Nenhuma consulta neste dia.</p>;
  }

  return (
    <ul role="list" className="divide-y divide-clin-linha border-y border-clin-linha">
      {doDia.map((c) => {
        const s = situacao(c, agora);
        const d = c.kind === "retorno" && s !== "cancelada" ? desde?.[c.patient_id] : undefined;
        const pendente = s === "pedido" || s === "remarcar" || s === "sem-desfecho";
        return (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => abrir(c.id)}
              className={`flex w-full gap-4 py-3 text-left hover:bg-clin-primaria-fundo ${FOCO} ${
                pendente ? "border-l-2 border-dashed border-clin-atencao pl-3" : ""
              }`}
            >
              <span className="w-16 shrink-0 tabular-nums">
                <span className="block text-[15px] font-semibold text-clin-texto">
                  {horaEmSaoPaulo(c.starts_at)}
                </span>
                <span className="block text-[13px] text-clin-texto-2">
                  até {horaEmSaoPaulo(new Date(fimDa(c)).toISOString())}
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span
                    className={`text-[15px] font-semibold ${
                      s === "cancelada" ? "text-clin-texto-2 line-through" : "text-clin-texto"
                    }`}
                  >
                    {nomes[c.patient_id] ?? "Paciente"}
                  </span>
                  <span className="text-[14px] text-clin-texto-2">
                    {ROTULO_TIPO[c.kind]} · {ROTULO_MODO[c.mode]}
                  </span>
                  {s !== "agendada" && (
                    <span className={`${CLASSE_SELO} ${SELO[s]}`}>{ROTULO_SITUACAO[s]}</span>
                  )}
                </span>
                {d && (
                  <span className="mt-1 block text-[14px] leading-snug text-clin-texto-2">
                    {d.titulo}: {d.texto}
                  </span>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
