"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { andar, tituloDoPeriodo, type Consulta, type Vista } from "@/lib/consultas";
import { ACAO_SECUNDARIA, FOCO } from "@/components/clinico/estilos";
import { ErroSecao } from "@/components/clinico/ErroSecao";
import { Dialogo } from "../Dialogo";
import { MarcarConsulta } from "../MarcarConsulta";
import { PainelConsulta } from "../PainelConsulta";
import { Pendencias } from "./Pendencias";
import { VistaDia } from "./VistaDia";
import { VistaMes } from "./VistaMes";
import { VistaSemana } from "./VistaSemana";
import { hrefDaAgenda } from "./tipos";

const VISTAS: { id: Vista; rotulo: string }[] = [
  { id: "mes", rotulo: "Mês" },
  { id: "semana", rotulo: "Semana" },
  { id: "dia", rotulo: "Dia" },
];

// A agenda do nutricionista: Mês, Semana e Dia na mesma página, com troca
// entre as três (escolha do dono do produto). Cada vista e cada data é um
// endereço (?vista=semana&data=2026-10-13): o Voltar do navegador refaz o
// caminho, e o servidor busca só o período que a vista mostra.
//
// Sem `vista` no endereço, vale a última usada, guardada no cookie
// `agenda_vista` (o servidor lê); sem cookie, Dia.
export function Agenda({
  vista,
  data,
  hoje,
  agora,
  nutriId,
  consultas,
  pendencias,
  nomes,
  pacientes,
  desde,
  falhou,
}: {
  vista: Vista;
  data: string;
  hoje: string;
  agora: string;
  nutriId: string;
  consultas: Consulta[];
  pendencias: Consulta[];
  nomes: Record<string, string>;
  pacientes: { id: string; nome: string }[];
  desde: Record<string, { titulo: string; texto: string }>;
  /** Que leitura falhou: cada uma mostra o erro no lugar do que não carregou. */
  falhou: { periodo: boolean; pendencias: boolean; pacientes: boolean };
}) {
  const [aberta, setAberta] = useState<string | null>(null);

  useEffect(() => {
    document.cookie = `agenda_vista=${vista}; path=/app/agenda; max-age=31536000; samesite=lax`;
  }, [vista]);

  const todas = new Map<string, Consulta>();
  for (const c of [...consultas, ...pendencias]) todas.set(c.id, c);
  // A consulta aberta pode sair das listas depois de uma ação: a sem desfecho
  // de outro dia, aberta pela linha de aviso, deixa de ser pendência quando é
  // marcada como realizada, e a janela fecharia no meio do "Marcar retorno".
  // Fica a última versão vista dela.
  const lembrada = useRef<Consulta | undefined>(undefined);
  const achada = aberta ? todas.get(aberta) : undefined;
  if (achada) lembrada.current = achada;
  const consulta = aberta ? achada ?? (lembrada.current?.id === aberta ? lembrada.current : undefined) : undefined;

  const props = { consultas, nomes, agora, hoje, data, abrir: setAberta, desde };

  return (
    <div>
      <header className="flex flex-col gap-4 pb-5 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold leading-tight text-clin-texto">Agenda</h1>
          <div className="mt-2 flex items-center gap-1">
            <Link
              href={hrefDaAgenda(vista, andar(vista, data, -1))}
              aria-label={vista === "mes" ? "Mês anterior" : vista === "semana" ? "Semana anterior" : "Dia anterior"}
              className={`inline-flex h-11 w-11 items-center justify-center rounded-md text-clin-texto hover:bg-clin-primaria-fundo ${FOCO}`}
            >
              <ChevronLeft aria-hidden="true" className="h-5 w-5" />
            </Link>
            <h2 className="min-w-0 text-[17px] font-semibold text-clin-texto" aria-live="polite">
              {tituloDoPeriodo(vista, data, hoje)}
            </h2>
            <Link
              href={hrefDaAgenda(vista, andar(vista, data, 1))}
              aria-label={vista === "mes" ? "Próximo mês" : vista === "semana" ? "Próxima semana" : "Próximo dia"}
              className={`inline-flex h-11 w-11 items-center justify-center rounded-md text-clin-texto hover:bg-clin-primaria-fundo ${FOCO}`}
            >
              <ChevronRight aria-hidden="true" className="h-5 w-5" />
            </Link>
            <Link href={hrefDaAgenda(vista, hoje)} className={`ml-1 inline-flex ${ACAO_SECUNDARIA}`}>
              Hoje
            </Link>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <nav aria-label="Vista da agenda" className="inline-flex rounded-md border border-clin-linha p-0.5">
            {VISTAS.map((v) => (
              <Link
                key={v.id}
                href={hrefDaAgenda(v.id, data)}
                aria-current={v.id === vista ? "page" : undefined}
                className={`inline-flex min-h-[40px] items-center rounded px-3 text-[14px] ${FOCO} ${
                  v.id === vista
                    ? "bg-clin-primaria font-semibold text-clin-sobre-primaria"
                    : "font-medium text-clin-texto hover:bg-clin-primaria-fundo"
                }`}
              >
                {v.rotulo}
              </Link>
            ))}
          </nav>
          <MarcarConsulta
            nutriId={nutriId}
            pacientes={pacientes}
            inicial={vista === "dia" && data >= hoje ? { data } : undefined}
          />
        </div>
      </header>

      {/* Cada leitura que falha mostra o erro no lugar dela: com a lista
          vazia, a vista diria "Nenhuma consulta neste dia" sem saber
          (CLAUDE.md, leitura que falha não é "não tem"). */}
      {falhou.pacientes && (
        <div className="mb-6">
          <ErroSecao secao="a lista de pacientes (para marcar consulta e os nomes)" />
        </div>
      )}
      {falhou.pendencias ? (
        <div className="mb-6">
          <ErroSecao secao="os pedidos e as consultas sem desfecho" />
        </div>
      ) : (
        <Pendencias pendencias={pendencias} nomes={nomes} agora={agora} abrir={setAberta} />
      )}

      {falhou.periodo ? (
        <ErroSecao secao="as consultas deste período" />
      ) : (
        <>
          {vista === "dia" && <VistaDia {...props} />}
          {vista === "semana" && <VistaSemana {...props} />}
          {vista === "mes" && <VistaMes {...props} />}
        </>
      )}

      <Dialogo aberto={!!consulta} aoFechar={() => setAberta(null)} titulo="Consulta">
        {consulta && (
          <PainelConsulta
            consulta={consulta}
            nome={nomes[consulta.patient_id] ?? "Paciente"}
            agora={agora}
            nutriId={nutriId}
            desde={consulta.kind === "retorno" ? desde[consulta.patient_id] : null}
            abrirPaciente
            aoTerminar={() => setAberta(null)}
          />
        )}
      </Dialogo>
    </div>
  );
}
