import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { dataCurta, horaEmSaoPaulo, rotuloDaConsulta, type Consulta } from "@/lib/consultas";
import { dataNoBrasil } from "@/lib/date";
import { hrefDaAba } from "@/lib/abas";
import type { Registro } from "@/lib/registro";
import { FOCO } from "@/components/clinico/estilos";

// MARCADOR PROVISÓRIO. A leitura do registro concluído (as cinco partes só
// para leitura, as medidas com a diferença e os adendos) é a Task 7 do plano
// (docs/superpowers/plans/2026-10-14-registro-da-consulta.md), que troca este
// arquivo inteiro. Até lá, a página só não pode abrir o editor num registro
// travado: o banco recusaria cada tecla com "O registro já foi concluído".
export function RegistroConcluido({
  uid,
  nome,
  consulta,
  registro,
}: {
  uid: string;
  nome: string;
  consulta: Consulta;
  registro: Registro;
}) {
  const quando = registro.concluded_at;
  return (
    <div className="max-w-2xl">
      <Link
        href={hrefDaAba(uid, "consultas")}
        className={`inline-flex min-h-[40px] items-center gap-1 rounded-md text-[14px] text-clin-texto-2 hover:text-clin-primaria ${FOCO}`}
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" /> {nome} · Consultas
      </Link>
      <h1 className="mt-1 text-2xl font-semibold leading-tight text-clin-texto">
        Consulta de {rotuloDaConsulta(consulta)}
      </h1>
      <p className="mt-2 text-[15px] text-clin-texto-2">
        Concluído
        {quando && ` em ${dataCurta(dataNoBrasil(quando))} às ${horaEmSaoPaulo(quando)}`}
        {registro.assinatura_nome && ` por ${registro.assinatura_nome}`}
        {registro.assinatura_crn && ` · ${registro.assinatura_crn}`}
      </p>
      <p className="mt-4 rounded-md border border-dashed border-clin-linha px-4 py-3 text-[14px] text-clin-texto-2">
        A leitura do registro concluído ainda está sendo feita.
      </p>
    </div>
  );
}
