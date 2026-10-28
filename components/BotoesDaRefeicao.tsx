"use client";

import { Loader2, X } from "lucide-react";
import { ESTILO_DO_CHECKIN as E } from "@/components/PlanCheckIn";
import type { EstadoDaRefeicao, RespostaDaRefeicao } from "@/lib/refeicoesDoPlano";

// A linha de botões embaixo das opções de uma refeição do plano, numa regra
// só para a Dieta e Meu plano (spec dos lembretes das refeições, "No app"), com
// a cara do check-in do treino:
//
//   sem resposta, uma opção     "Comi" sólido e "Não comi" secundário
//   sem resposta, várias        só "Não comi" (cada opção tem o "Comi isso")
//   comi, ou qual opção?        "Desfazer"
//   não comi                    "Comi" secundário e "Não comi" no aviso
//   registrada sem resposta     nada (o "Comi" lançaria a refeição de novo)
//
// Tocar no "Não comi" marcado desfaz, como no check-in.
export default function BotoesDaRefeicao({
  estado,
  umaOpcao,
  ocupado,
  erro,
  onMarcar,
}: {
  estado: EstadoDaRefeicao;
  umaOpcao: boolean;
  /** A resposta que está sendo gravada nesta refeição (desliga os botões). */
  ocupado: RespostaDaRefeicao | null;
  erro: string | null;
  onMarcar: (resposta: RespostaDaRefeicao) => void;
}) {
  const girando = <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />;
  const forma = "gap-1.5 px-4";
  const desligado = ocupado !== null;

  let botoes: React.ReactNode = null;
  if (estado.tipo === "sem_resposta") {
    botoes = (
      <>
        {umaOpcao && (
          <button type="button" onClick={() => onMarcar("comi")} disabled={desligado} className={`${E.botao} ${forma} ${E.primario}`}>
            {ocupado === "comi" && girando}
            Comi
          </button>
        )}
        <button type="button" onClick={() => onMarcar("nao_comi")} disabled={desligado} className={`${E.botao} ${forma} ${E.secundario}`}>
          {ocupado === "nao_comi" && girando}
          Não comi
        </button>
      </>
    );
  } else if (estado.tipo === "comi" || estado.tipo === "qual_opcao") {
    botoes = (
      <button type="button" onClick={() => onMarcar("desfazer")} disabled={desligado} className={`${E.botao} ${forma} ${E.secundario}`}>
        {ocupado === "desfazer" && girando}
        Desfazer
      </button>
    );
  } else if (estado.tipo === "nao_comi") {
    botoes = (
      <>
        <button type="button" onClick={() => onMarcar("comi")} disabled={desligado} className={`${E.botao} ${forma} ${E.secundario}`}>
          {ocupado === "comi" && girando}
          Comi
        </button>
        <button
          type="button"
          onClick={() => onMarcar("desfazer")}
          disabled={desligado}
          aria-pressed={true}
          className={`${E.botao} ${forma} ${E.aviso}`}
        >
          {ocupado === "desfazer" ? girando : <X className="h-4 w-4" aria-hidden="true" />}
          Não comi
        </button>
      </>
    );
  }

  if (!botoes && !erro) return null;
  return (
    <div className="px-4 pb-3 pt-1">
      {botoes && <div className="flex flex-wrap gap-2">{botoes}</div>}
      {erro && (
        <p role="alert" className="mt-2 text-[15px] text-app-perigo">
          {erro}
        </p>
      )}
    </div>
  );
}
