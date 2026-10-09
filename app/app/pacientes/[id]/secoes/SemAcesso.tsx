import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { FOCO } from "./estilos";

/** Volta para a lista de pacientes. */
export function LinkPacientes() {
  return (
    <Link
      href="/app/pacientes"
      className={`inline-flex min-h-[40px] items-center gap-1 rounded-md text-[14px] text-clin-texto-2 hover:text-clin-primaria ${FOCO}`}
    >
      <ArrowLeft aria-hidden="true" className="h-4 w-4" /> Pacientes
    </Link>
  );
}

// Sem vínculo ativo com o paciente, a RLS de `profiles` devolve nulo. A
// página para aqui e não roda as seções: cada uma faria as suas consultas, a
// RLS devolveria tudo vazio, e a tela diria "nenhum treino", "nenhum exame"
// sobre alguém que pode ter tudo isso, só que não para este nutricionista.
// Serve à página do paciente e à linha do tempo.
export function SemAcesso() {
  return (
    <div className="max-w-2xl">
      <LinkPacientes />
      <p className="mt-4 rounded-md border border-clin-linha px-4 py-3 text-[14px] leading-snug text-clin-texto">
        Sem acesso a este paciente. O vínculo pode ter sido revogado ou ainda
        não foi aceito.
      </p>
    </div>
  );
}
