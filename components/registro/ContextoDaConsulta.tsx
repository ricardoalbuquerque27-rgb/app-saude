"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { ErroSecao } from "@/components/clinico/ErroSecao";
import { FOCO, LINK } from "@/components/clinico/estilos";

const ROTULO = "text-[13px] font-semibold text-clin-texto-2";

// "Para esta consulta": o que o nutri lê antes de escrever. O "observar no
// retorno" que ele mesmo deixou na consulta anterior, o "desde a última
// consulta" (o mesmo texto da agenda), a última medida que o paciente lançou
// em casa e os registros anteriores.
//
// A partir de `xl` é a coluna da direita, inteira. Abaixo disso fica no topo,
// recolhida, mas o "observar" continua à vista: é a única parte que pede uma
// ação nesta consulta, e escondida atrás de um toque ela seria esquecida.
// O botão de abrir só existe abaixo de `xl` (o resto aparece pelo CSS ali),
// então um rascunho recolhido no celular não esconde nada no computador.
export function ContextoDaConsulta({
  observar,
  desde,
  emCasa,
  registros,
  falhou,
}: {
  /** O "observar no retorno" do último registro concluído antes desta consulta; `data` em DD/MM. */
  observar: { texto: string; data: string } | null;
  desde: { titulo: string; texto: string } | null;
  /** A última medida que o paciente anotou (sem `measured_by`), já em texto. */
  emCasa: string | null;
  registros: { href: string; rotulo: string }[];
  falhou: { registros: boolean; desde: boolean; medidas: boolean };
}) {
  const [aberto, setAberto] = useState(false);
  const idResto = useId();
  const vazio =
    !falhou.registros && !falhou.desde && !falhou.medidas && !observar && !desde && !emCasa && registros.length === 0;

  return (
    <aside
      aria-label="Para esta consulta"
      className="space-y-3 xl:space-y-5 xl:rounded-lg xl:border xl:border-clin-linha xl:p-5"
    >
      <h2 className="hidden text-[16px] font-semibold text-clin-texto xl:block">Para esta consulta</h2>

      {/* Registros que não carregaram não são "nada a observar". */}
      {falhou.registros ? (
        <ErroSecao secao="o registro anterior" />
      ) : (
        observar && (
          <div className="rounded-md bg-clin-atencao-fundo px-4 py-3">
            <p className="text-[13px] font-semibold text-clin-atencao">
              Observar no retorno (registro de {observar.data})
            </p>
            <p className="mt-1 whitespace-pre-line text-[15px] leading-relaxed text-clin-texto">{observar.texto}</p>
          </div>
        )
      )}

      <div className="rounded-md border border-clin-linha xl:rounded-none xl:border-0">
        <button
          type="button"
          aria-expanded={aberto}
          aria-controls={idResto}
          onClick={() => setAberto((a) => !a)}
          className={`flex min-h-[48px] w-full items-center justify-between gap-3 rounded-md px-4 text-left text-[15px] font-semibold text-clin-texto xl:hidden ${FOCO}`}
        >
          Para esta consulta: desde a última, medidas e registros
          <ChevronDown
            aria-hidden="true"
            className={`h-4 w-4 shrink-0 transition-transform ${aberto ? "rotate-180" : ""}`}
          />
        </button>
        <div
          id={idResto}
          className={`${aberto ? "block" : "hidden"} space-y-5 px-4 pb-4 xl:block xl:px-0 xl:pb-0`}
        >
          {vazio && (
            <p className="text-[15px] text-clin-texto-2">Nenhuma consulta anterior registrada.</p>
          )}

          {falhou.desde ? (
            <ErroSecao secao="o “desde a última consulta”" />
          ) : (
            desde && (
              <div>
                <p className={ROTULO}>{desde.titulo}</p>
                <p className="mt-1 text-[15px] leading-relaxed text-clin-texto">{desde.texto}</p>
              </div>
            )
          )}

          {falhou.medidas ? (
            <ErroSecao secao="as medidas" />
          ) : (
            emCasa && (
              <div>
                <p className={ROTULO}>Lançado em casa</p>
                <p className="mt-1 text-[15px] leading-relaxed text-clin-texto">{emCasa}</p>
              </div>
            )
          )}

          {!falhou.registros && registros.length > 0 && (
            <div>
              <p className={ROTULO}>Registros anteriores</p>
              <ul role="list" className="mt-1">
                {registros.map((r) => (
                  <li key={r.href}>
                    <Link href={r.href} className={`inline-flex ${LINK}`}>
                      {r.rotulo}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
