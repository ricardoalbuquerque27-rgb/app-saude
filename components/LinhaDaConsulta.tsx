import Link from "next/link";
import { ChevronRight } from "lucide-react";
import {
  dataCurta,
  diaDaConsulta,
  estadoDaConsulta,
  nomeCurtoDoDia,
  ROTULO_MODO,
  rotuloDaConsulta,
  type Consulta,
} from "@/lib/consultas";

// A consulta numa linha, no topo da Início (spec do visual do app do paciente,
// "A consulta, numa linha"). A data é o que o paciente procura, e ela fica à
// vista sem rolar; as ações (pedir, remarcar, cancelar) moram no
// CartaoConsulta, em "Meu plano", e a linha é o link até lá.
//
// Quem escolhe a situação é `estadoDaConsulta`, a mesma conta do cartão: se a
// linha refizesse a regra, ela poderia dizer uma coisa e o cartão, outra.
// Componente de servidor, sem estado; só para quem tem nutricionista ativo
// (a página decide).

const DESTINO = "/app/nutricionista#consulta";

// `.card` com o toque de `.card-interactive` (afunda ao tocar, borda `campo`
// no hover, contorno no foco). O `min-h` garante os 44 px de alvo de toque
// mesmo se o texto virar uma linha só.
const LINHA =
  "card card-interactive flex min-h-[44px] items-center gap-3 px-4 py-3";

export function LinhaDaConsulta({
  consultas,
  agora,
  nutriNome,
  falhou,
}: {
  /** As consultas do paciente com o nutricionista de agora, das mais recentes. */
  consultas: Consulta[];
  agora: string;
  nutriNome?: string;
  /** A leitura das consultas falhou. */
  falhou?: boolean;
}) {
  // Leitura que falha não é "não tem": sem esta mensagem, uma consulta
  // marcada sumia da Início calada, igual a "nenhuma consulta".
  if (falhou) {
    return (
      <p className="card px-4 py-3 text-[15px] text-app-atencao">
        Não deu para carregar a consulta
      </p>
    );
  }

  const { proxima, pedido, canceladaPeloNutri } = estadoDaConsulta(
    consultas,
    agora,
  );
  const primeiroNome = nutriNome?.trim().split(/\s+/)[0] ?? "";

  // O que se procura é a data: ela vem em destaque, e o rótulo ("Próxima
  // consulta", "Consulta pedida") pequeno em cima, como na maquete da Início.
  // A cancelada é uma frase só e fica como estava.
  let rotulo: string | null = null;
  let principal: string;

  if (proxima) {
    rotulo = "Próxima consulta";
    principal = `${rotuloDaConsulta(proxima)} · ${ROTULO_MODO[proxima.mode]}`;
    if (proxima.reschedule_requested_at) principal += " · remarcação pedida";
    // O nutri marcou sem responder ao pedido: os dois existem, e a linha
    // não esconde o segundo.
    if (pedido) principal += " · e um pedido aguardando";
  } else if (pedido) {
    rotulo = "Consulta pedida";
    principal = `${rotuloDaConsulta(pedido)} · aguardando ${
      primeiroNome || "o nutricionista"
    }`;
  } else if (canceladaPeloNutri) {
    const dia = diaDaConsulta(canceladaPeloNutri);
    principal = `Consulta de ${nomeCurtoDoDia(dia)}, ${dataCurta(dia)} cancelada ${
      primeiroNome ? `por ${primeiroNome}` : "pelo seu nutricionista"
    }`;
  } else {
    // Nenhuma: a linha não aparece, e "Pedir consulta" fica em "Meu plano".
    return null;
  }

  return (
    <Link href={DESTINO} className={LINHA}>
      <span className="min-w-0 flex-1">
        {rotulo ? (
          <>
            <span className="block text-[13px] text-app-texto-2">{rotulo}</span>
            <span className="block text-[15px] font-semibold text-app-texto">
              {principal}
            </span>
          </>
        ) : (
          <span className="block text-[15px] font-medium text-app-texto">
            {principal}
          </span>
        )}
      </span>
      <ChevronRight
        aria-hidden="true"
        className="h-5 w-5 shrink-0 text-app-texto-2"
      />
    </Link>
  );
}
