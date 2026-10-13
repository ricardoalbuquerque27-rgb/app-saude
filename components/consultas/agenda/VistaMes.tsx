"use client";

import Link from "next/link";
import {
  diaDaConsulta,
  ehPendencia,
  gradeDoMes,
  horaEmSaoPaulo,
  noDiaDoMes,
  ROTULO_SITUACAO,
  situacao,
} from "@/lib/consultas";
import { FOCO } from "@/components/clinico/estilos";
import { BLOCO } from "../aparencia";
import { hrefDaAgenda, type PropsDaVista } from "./tipos";

const CABECALHO = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

// O mês; tocar no dia abre o Dia. Os dias de fora do mês aparecem apagados e
// sem consultas, como no protótipo. Cancelada não entra.
//
// No computador, cada dia mostra as consultas com hora e primeiro nome, no
// visual dos blocos da Semana (pendência tracejada), até duas e depois "+N".
// Antes era só "1 consulta" em cinza, embaixo da célula, e o dono do produto
// não a via. No celular, a célula tem ~50 px: fica a contagem, num círculo
// cheio, e o ponto âmbar da pendência.
export function VistaMes({ consultas, nomes, agora, hoje, data }: PropsDaVista) {
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
          const { mostrar, resto, pendenciaNoResto } = noDiaDoMes(lista, agora);
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
                  className={`flex h-16 flex-col items-start p-1.5 hover:bg-clin-primaria-fundo sm:h-28 ${FOCO} ${
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

                  {/* Celular */}
                  {n > 0 && (
                    <span className="mt-auto flex items-center gap-1 sm:hidden">
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-clin-primaria px-1 text-[12px] font-semibold tabular-nums text-clin-sobre-primaria">
                        {n}
                      </span>
                      {pendente && <span className="text-[12px] font-semibold text-clin-atencao">●</span>}
                    </span>
                  )}

                  {/* Computador */}
                  {n > 0 && (
                    <span className="mt-1 hidden w-full flex-col gap-0.5 sm:flex">
                      {mostrar.map((c) => {
                        const s = situacao(c, agora);
                        const nome = (nomes[c.patient_id] ?? "Paciente").split(" ")[0];
                        return (
                          <span
                            key={c.id}
                            title={`${horaEmSaoPaulo(c.starts_at)} ${nomes[c.patient_id] ?? "Paciente"} · ${ROTULO_SITUACAO[s]}`}
                            className={`block w-full truncate rounded px-1 text-[13px] leading-5 ${BLOCO[s]}`}
                          >
                            <span className="font-semibold tabular-nums">{horaEmSaoPaulo(c.starts_at)}</span> {nome}
                          </span>
                        );
                      })}
                      {resto > 0 && (
                        <span
                          className={`text-[13px] leading-5 ${
                            pendenciaNoResto ? "font-semibold text-clin-atencao" : "text-clin-texto-2"
                          }`}
                        >
                          +{resto} {pendenciaNoResto ? "· pendência" : resto === 1 ? "consulta" : "consultas"}
                        </span>
                      )}
                    </span>
                  )}
                </Link>
              ) : (
                <span aria-hidden="true" className="flex h-16 p-1.5 text-[14px] text-clin-texto-2 opacity-60 sm:h-28">
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
