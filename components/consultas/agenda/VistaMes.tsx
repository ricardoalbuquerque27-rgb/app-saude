"use client";

import Link from "next/link";
import { diaDaConsulta, ehPendencia, gradeDoMes } from "@/lib/consultas";
import { FOCO } from "@/components/clinico/estilos";
import { hrefDaAgenda, type PropsDaVista } from "./tipos";

const CABECALHO = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

// O mês com a contagem por dia e a marca de pendência; tocar no dia abre o
// Dia. Os dias de fora do mês aparecem apagados e sem contagem, como no
// protótipo. Cancelada não conta.
export function VistaMes({ consultas, agora, hoje, data }: PropsDaVista) {
  const grade = gradeDoMes(data);
  const ativas = consultas.filter((c) => c.status !== "cancelada");

  return (
    <div>
      <div className="grid grid-cols-7 border-b border-clin-linha pb-1 text-center text-[13px] font-medium text-clin-texto-2">
        {CABECALHO.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <ol role="list" className="grid grid-cols-7 gap-px border border-clin-linha bg-clin-linha">
        {grade.map(({ data: d, doMes }) => {
          const lista = doMes ? ativas.filter((c) => diaDaConsulta(c) === d) : [];
          const pendente = lista.some((c) => ehPendencia(c, agora));
          const n = lista.length;
          const rotulo = `${Number(d.slice(8, 10))}${
            n ? `, ${n} ${n === 1 ? "consulta" : "consultas"}` : ""
          }${pendente ? ", com pendência" : ""}`;
          return (
            <li key={d} className="bg-clin-chao">
              {doMes ? (
                <Link
                  href={hrefDaAgenda("dia", d)}
                  aria-label={rotulo}
                  aria-current={d === hoje ? "date" : undefined}
                  className={`flex h-16 flex-col items-start p-1.5 hover:bg-clin-primaria-fundo sm:h-24 ${FOCO} ${
                    d === hoje ? "outline outline-2 -outline-offset-2 outline-clin-primaria" : ""
                  }`}
                >
                  <span
                    className={`text-[14px] tabular-nums ${
                      d === hoje ? "font-bold text-clin-primaria" : "font-medium text-clin-texto"
                    }`}
                  >
                    {Number(d.slice(8, 10))}
                  </span>
                  {n > 0 && (
                    <span className="mt-auto text-[12px] leading-tight text-clin-texto-2 sm:text-[13px]">
                      <span className="sm:hidden">{n}</span>
                      <span className="hidden sm:inline">
                        {n} {n === 1 ? "consulta" : "consultas"}
                      </span>
                    </span>
                  )}
                  {pendente && (
                    <span className="text-[12px] font-semibold leading-tight text-clin-atencao sm:text-[13px]">
                      ●<span className="hidden sm:inline"> pendência</span>
                    </span>
                  )}
                </Link>
              ) : (
                <span aria-hidden="true" className="flex h-16 p-1.5 text-[14px] text-clin-texto-2 opacity-60 sm:h-24">
                  {Number(d.slice(8, 10))}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
