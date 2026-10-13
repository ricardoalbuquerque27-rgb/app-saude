"use client";

import Link from "next/link";
import {
  diaDaConsulta,
  diasDaSemana,
  emFaixas,
  horaEmSaoPaulo,
  nomeCurtoDoDia,
  ROTULO_SITUACAO,
  ROTULO_TIPO,
  situacao,
  type Consulta,
} from "@/lib/consultas";
import { FOCO } from "@/components/clinico/estilos";
import { CLASSE_SELO, SELO } from "../aparencia";
import { hrefDaAgenda, type PropsDaVista } from "./tipos";

const ALTURA_HORA = 56; // px por hora na grade

/** Minutos desde a meia-noite de São Paulo. */
function minutoDoDia(instante: string): number {
  const [h, m] = horaEmSaoPaulo(instante).split(":").map(Number);
  return h * 60 + m;
}

// A semana em grade por horário no computador; no celular, sete colunas não
// cabem, e a semana vira a lista dos sete dias. Cancelada não ocupa a grade.
// Pendência (pedido, remarcação, sem desfecho) é tracejada, como no
// protótipo aprovado.
export function VistaSemana({ consultas, nomes, agora, hoje, data, abrir }: PropsDaVista) {
  const dias = diasDaSemana(data);
  const ativas = consultas.filter((c) => c.status !== "cancelada");
  const porDia = (d: string) => ativas.filter((c) => diaDaConsulta(c) === d);

  // Das 7h às 21h, esticando se houver consulta fora disso.
  let ini = 7 * 60;
  let fim = 21 * 60;
  for (const c of ativas) {
    const m = minutoDoDia(c.starts_at);
    ini = Math.min(ini, Math.floor(m / 60) * 60);
    fim = Math.max(fim, Math.min(24 * 60, Math.ceil((m + c.duration_min) / 60) * 60));
  }
  const horas: number[] = [];
  for (let h = ini; h < fim; h += 60) horas.push(h);

  const cabecalhoDoDia = (d: string) => (
    <Link
      href={hrefDaAgenda("dia", d)}
      aria-current={d === hoje ? "date" : undefined}
      className={`inline-flex min-h-[40px] items-center rounded-md px-1 text-[14px] ${
        d === hoje ? "font-bold text-clin-primaria" : "font-medium text-clin-texto"
      } underline-offset-4 hover:underline ${FOCO}`}
    >
      {nomeCurtoDoDia(d).replace(".", "")} {Number(d.slice(8, 10))}
    </Link>
  );

  const bloco = (c: Consulta, faixa: number, faixas: number) => {
    const s = situacao(c, agora);
    const topo = ((minutoDoDia(c.starts_at) - ini) / 60) * ALTURA_HORA;
    const altura = Math.max(26, (c.duration_min / 60) * ALTURA_HORA - 2);
    const pendente = s === "pedido" || s === "remarcar" || s === "sem-desfecho";
    const estilo = pendente
      ? "border border-dashed border-clin-atencao bg-clin-chao text-clin-atencao"
      : s === "agendada"
        ? "border border-transparent bg-clin-primaria-fundo text-clin-primaria"
        : s === "faltou"
          ? "border border-transparent bg-clin-perigo-fundo text-clin-perigo"
          : "border border-clin-linha bg-clin-chao text-clin-texto-2";
    return (
      <button
        key={c.id}
        type="button"
        onClick={() => abrir(c.id)}
        title={`${horaEmSaoPaulo(c.starts_at)} ${nomes[c.patient_id] ?? "Paciente"} · ${ROTULO_SITUACAO[s]}`}
        style={{
          top: topo,
          height: altura,
          left: `calc(${(faixa / faixas) * 100}% + 2px)`,
          width: `calc(${100 / faixas}% - 4px)`,
        }}
        className={`absolute overflow-hidden rounded px-1.5 py-0.5 text-left text-[13px] leading-tight ${estilo} ${FOCO}`}
      >
        <span className="font-semibold tabular-nums">{horaEmSaoPaulo(c.starts_at)}</span>{" "}
        <span className="font-medium">{(nomes[c.patient_id] ?? "Paciente").split(" ")[0]}</span>
        {altura > 40 && (
          <span className="block truncate">
            {pendente || s !== "agendada" ? ROTULO_SITUACAO[s] : ROTULO_TIPO[c.kind]}
          </span>
        )}
      </button>
    );
  };

  return (
    <>
      {/* Computador */}
      <div className="hidden md:block">
        <div className="grid grid-cols-[3.25rem_repeat(7,minmax(0,1fr))] border-b border-clin-linha pb-1">
          <span />
          {dias.map((d) => (
            <div key={d} className="text-center">
              {cabecalhoDoDia(d)}
            </div>
          ))}
        </div>
        <div
          className="relative grid grid-cols-[3.25rem_repeat(7,minmax(0,1fr))]"
          style={{ height: horas.length * ALTURA_HORA }}
        >
          {/* Linhas das horas, por trás das colunas. */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            {horas.map((h, i) => (
              <div
                key={h}
                className="absolute inset-x-0 border-t border-clin-linha"
                style={{ top: i * ALTURA_HORA }}
              >
                <span className="absolute -top-2.5 left-0 bg-clin-chao pr-1 text-[12px] tabular-nums text-clin-texto-2">
                  {String(h / 60).padStart(2, "0")}:00
                </span>
              </div>
            ))}
          </div>
          <span />
          {dias.map((d) => (
            <div
              key={d}
              className="relative border-l border-clin-linha"
            >
              {emFaixas(porDia(d)).map(({ consulta, faixa, faixas }) => bloco(consulta, faixa, faixas))}
            </div>
          ))}
        </div>
      </div>

      {/* Celular */}
      <ol role="list" className="divide-y divide-clin-linha border-y border-clin-linha md:hidden">
        {dias.map((d) => {
          const lista = [...porDia(d)].sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
          return (
            <li key={d} className="py-2">
              {cabecalhoDoDia(d)}
              {lista.length === 0 ? (
                <p className="px-1 pb-1 text-[14px] text-clin-texto-2">Sem consultas</p>
              ) : (
                <ul role="list">
                  {lista.map((c) => {
                    const s = situacao(c, agora);
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => abrir(c.id)}
                          className={`flex min-h-[44px] w-full items-center gap-3 px-1 text-left ${FOCO}`}
                        >
                          <span className="w-12 shrink-0 text-[15px] font-semibold tabular-nums text-clin-texto">
                            {horaEmSaoPaulo(c.starts_at)}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-[15px] text-clin-texto">
                            {nomes[c.patient_id] ?? "Paciente"}
                          </span>
                          {s !== "agendada" && (
                            <span className={`${CLASSE_SELO} ${SELO[s]} shrink-0`}>{ROTULO_SITUACAO[s]}</span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
      <p className="mt-3 hidden text-[13px] text-clin-texto-2 md:block">
        Tracejado: pedido, pedido de remarcação ou consulta sem desfecho.
      </p>
    </>
  );
}
