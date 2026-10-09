import Link from "next/link";
import { AlertaFila } from "@/components/clinico/AlertaFila";
import { Numeros } from "@/components/clinico/Numeros";
import { ReaplicarMetas } from "@/components/clinico/ReaplicarMetas";
import {
  textoVariacaoPeso,
  type Alerta,
  type DesvioDeMeta,
  type MetasPrescritas,
  type PatientSummary,
} from "@/lib/nutri";
import { ErroSecao } from "./ErroSecao";

// As ações moram sobre o fundo `atencao-fundo` do AlertaFila, e ali só valem
// os pares com contraste testado nesse fundo: `atencao`, `texto` e
// `atencao-texto-2` (lib/temaClinico.ts). `texto-2` e `linha` ficariam abaixo
// do mínimo, por isso a borda e o anel de foco são `atencao`. No hover a cor
// inverte (fundo `atencao`, texto `atencao-fundo`): é o mesmo par, e a razão
// de contraste não muda com a troca. `whitespace-nowrap`: na coluna estreita
// do computador o botão quebrava em "Ver / semana"; quem quebra é o texto.
const ACAO_NA_FILA =
  "min-h-[44px] shrink-0 items-center justify-center whitespace-nowrap rounded-md border border-clin-atencao px-4 text-[14px] font-semibold text-clin-atencao hover:bg-clin-atencao hover:text-clin-atencao-fundo focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clin-atencao";

/** Conversar: tela cheia no celular; de `lg` para cima, rola até a conversa. */
function Conversar({ uid }: { uid: string }) {
  return (
    <>
      <Link
        href={`/app/pacientes/${uid}?conversa=1`}
        className={`inline-flex lg:hidden ${ACAO_NA_FILA}`}
      >
        Conversar
      </Link>
      <a href="#conversa" className={`hidden lg:inline-flex ${ACAO_NA_FILA}`}>
        Conversar
      </a>
    </>
  );
}

// "Por que está na sua fila" e os três números de relance. Os dois vêm do
// mesmo resumo que a Início usa (resumirPacientes), para a fila e o detalhe
// nunca discordarem sobre o mesmo paciente. A ação de cada alerta sai do
// TIPO, nunca do texto (spec, Seção 4).
//
// Se alguma consulta do resumo falhou, a seção inteira diz que não carregou:
// sem as refeições o resumo diria "Nunca registrou nada" e "—" nos números,
// e sem os exames o alerta de exame sumiria calado.
export async function Fila({
  uid,
  resumo,
  prescricao,
  desviosDeMeta,
}: {
  uid: string;
  resumo: Promise<{ resumos: PatientSummary[]; falhou: boolean }>;
  prescricao: Promise<{ data: MetasPrescritas | null; error: unknown }>;
  desviosDeMeta: Promise<{ data: DesvioDeMeta[]; error: unknown }>;
}) {
  const [r, presc, desvios] = await Promise.all([resumo, prescricao, desviosDeMeta]);
  if (r.falhou) {
    return (
      <div className="pb-6">
        <ErroSecao secao="os alertas e os números" />
      </div>
    );
  }
  const [s] = r.resumos;

  function acoes(a: Alerta) {
    switch (a.tipo) {
      case "dose":
      case "parado":
        return <Conversar uid={uid} />;
      case "prescricao":
        // O alerta conta também os avisos do plano de treino, e Reaplicar
        // não dá baixa neles: o botão só aparece com um aviso de META aberto,
        // senão o nutricionista reaplicaria e o alerta continuaria ali. Sem
        // prescrição não há o que reaplicar. Nos dois casos sobra o Conversar.
        return (
          <>
            {presc.error || desvios.error ? (
              <ErroSecao secao="a última prescrição" />
            ) : presc.data && desvios.data.length > 0 ? (
              // As quatro metas da última prescrição, do jeito que vieram
              // (o porquê está no ReaplicarMetas).
              <ReaplicarMetas pacienteId={uid} prescricao={presc.data} />
            ) : null}
            <Conversar uid={uid} />
          </>
        );
      case "treino":
        return (
          <a href="#treino" className={`inline-flex ${ACAO_NA_FILA}`}>
            Ver semana
          </a>
        );
      case "exame":
        return (
          <a href="#clinico" className={`inline-flex ${ACAO_NA_FILA}`}>
            Ver clínico
          </a>
        );
    }
  }

  // Quem nunca registrou nada vê "—" e não "0/7": zero dias de sete é um
  // dado da semana, e de quem acabou de chegar não há semana para medir.
  const dias = s.lastActivity == null ? "—" : `${s.daysLogged7}/7`;
  const treinos = s.planPrevistas7
    ? `${s.planConfirmadas7} de ${s.planPrevistas7}`
    : "—";

  return (
    <div className="space-y-6 pb-6">
      <AlertaFila alertas={s.alertas} acoes={acoes} />
      <Numeros
        itens={[
          { valor: dias, rotulo: "dias com registro" },
          { valor: treinos, rotulo: "treinos (7 dias)" },
          { valor: textoVariacaoPeso(s.weightDelta30), rotulo: "peso em 30 dias" },
        ]}
      />
    </div>
  );
}
