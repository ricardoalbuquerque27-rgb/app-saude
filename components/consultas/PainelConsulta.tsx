"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  choques,
  diaDaConsulta,
  horaEmSaoPaulo,
  rotuloDaConsulta,
  ROTULO_MODO,
  ROTULO_SITUACAO,
  ROTULO_TIPO,
  situacao,
  sugestaoDeRetorno,
  type Consulta,
} from "@/lib/consultas";
import {
  ACAO_PRIMARIA,
  ACAO_SECUNDARIA,
  LINK,
} from "@/components/clinico/estilos";
import { ErroInline } from "@/components/clinico/ErroInline";
import { useAcaoConsulta } from "./acoes";
import { CLASSE_SELO, SELO } from "./aparencia";
import { FormConsulta } from "./FormConsulta";
import { useConsultasDoDia } from "./useConsultasDoDia";

// Uma consulta e o que dá para fazer com ela, conforme a situação (spec,
// "painel da consulta"). Serve à agenda (dentro do Dialogo) e à aba
// Consultas do paciente (solto na página).
//
// `agora` vem do servidor: com o relógio do navegador, uma consulta que
// acabou entre o servidor montar a página e o navegador hidratar mudaria de
// "Agendada" para "Sem desfecho" no meio, e o React reclamaria da diferença.
//
// Realizada e Faltou aparecem desde o INÍCIO da consulta, não só no fim
// (spec): uma consulta das 14h que acaba às 14h30 é fechada ali, e uma falta
// se marca sem esperar o horário passar. Marcar "Realizada" leva direto ao
// "Marcar retorno" (critério 4 da spec: fechar e já marcar o retorno).
export function PainelConsulta({
  consulta: c,
  nome,
  agora,
  nutriId,
  desde,
  mostrarNome = true,
  abrirPaciente = false,
  aoTerminar,
}: {
  consulta: Consulta;
  nome: string;
  agora: string;
  nutriId: string;
  desde?: { titulo: string; texto: string } | null;
  mostrarNome?: boolean;
  abrirPaciente?: boolean;
  /** Depois de uma ação que deu certo (a agenda fecha a janela). */
  aoTerminar?: () => void;
}) {
  // Depois de "Realizada", até a página nova chegar o painel já se comporta
  // como realizada (e mostra o "Marcar retorno").
  const [fechadaComo, setFechadaComo] = useState<"realizada" | null>(null);
  const s = fechadaComo ?? situacao(c, agora);
  const [editando, setEditando] = useState<null | "remarcar" | "nova">(null);
  const { executar, ocupado, erro } = useAcaoConsulta();
  // O botão que gira enquanto `ocupado`; fica até a página nova chegar.
  const [qual, setQual] = useState<string | null>(null);

  // A janela da agenda fecha quando a página nova chega (useAcaoConsulta);
  // "Realizada" não fecha: vira o formulário do retorno.
  async function fechar(rotulo: string, desfecho: "realizada" | "faltou" | "cancelada") {
    setQual(rotulo);
    const ok = await executar(
      "fechar_consulta",
      { p_id: c.id, p_desfecho: desfecho },
      desfecho === "realizada" ? undefined : aoTerminar,
    );
    if (ok && desfecho === "realizada") {
      setFechadaComo("realizada");
      setEditando("nova");
    }
  }
  async function manter(rotulo: string) {
    setQual(rotulo);
    await executar("remarcar_consulta", { p_id: c.id }, aoTerminar);
  }

  // Função, e não componente: um componente declarado aqui dentro seria
  // outro a cada render, e o botão perderia o foco do teclado ao recarregar.
  const botao = (rotulo: string, onClick: () => void, primario = false, esperando = false) => (
    <button
      key={rotulo}
      type="button"
      onClick={onClick}
      disabled={ocupado || esperando}
      className={`inline-flex ${primario ? ACAO_PRIMARIA : ACAO_SECUNDARIA} disabled:opacity-60`}
    >
      {ocupado && qual === rotulo && (
        <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
      )}
      {rotulo}
    </button>
  );

  const comecou = Date.parse(c.starts_at) <= Date.parse(agora);
  const retorno = sugestaoDeRetorno(c);

  // Pedido: o paciente não vê a agenda, então o horário pedido costuma bater
  // com outro. "Aceitar" avisa antes, como o formulário.
  const ehPedido = s === "pedido";
  const { doDia, falhou: diaFalhou } = useConsultasDoDia(
    ehPedido ? nutriId : undefined,
    ehPedido ? diaDaConsulta(c) : null,
  );
  const bate = ehPedido && doDia ? choques(doDia.lista, c.starts_at, c.duration_min, c.id) : [];

  const acoes = (() => {
    switch (s) {
      case "pedido":
        return (
          <>
            {/* Aceitar um pedido cujo horário já passou criaria uma consulta
                sem desfecho na hora; aí só "Outro horário". */}
            {/* Desligado até as consultas do dia chegarem: um toque rápido
                aceitaria sem o aviso de choque. */}
            {!comecou && botao("Aceitar", () => manter("Aceitar"), true, !doDia && !diaFalhou)}
            {botao("Outro horário", () => setEditando("remarcar"), comecou)}
            {botao("Recusar", () => {
              if (window.confirm(`Recusar o pedido de ${nome}?`)) fechar("Recusar", "cancelada");
            })}
          </>
        );
      case "remarcar":
      case "agendada":
        // Já começou: dá para fechar (realizada, falta) sem esperar o fim.
        if (comecou)
          return (
            <>
              {botao("Realizada", () => fechar("Realizada", "realizada"), true)}
              {botao("Faltou", () => fechar("Faltou", "faltou"))}
              {botao("Remarcar", () => setEditando("remarcar"))}
            </>
          );
        if (s === "remarcar")
          return (
            <>
              {botao("Remarcar", () => setEditando("remarcar"), true)}
              {botao("Manter horário", () => manter("Manter horário"))}
            </>
          );
        return (
          <>
            {botao("Remarcar", () => setEditando("remarcar"))}
            {botao("Cancelar consulta", () => {
              if (window.confirm(`Cancelar a consulta de ${nome} (${rotuloDaConsulta(c)})?`))
                fechar("Cancelar consulta", "cancelada");
            })}
          </>
        );
      case "sem-desfecho":
        return (
          <>
            {botao("Realizada", () => fechar("Realizada", "realizada"), true)}
            {botao("Faltou", () => fechar("Faltou", "faltou"))}
            {botao("Cancelada", () => fechar("Cancelada", "cancelada"))}
          </>
        );
      case "realizada":
        return botao("Marcar retorno", () => setEditando("nova"), true);
      case "faltou":
      case "cancelada":
        return botao("Marcar outra consulta", () => setEditando("nova"));
    }
  })();

  // Desfecho errado se corrige: realizada e faltou trocam entre si ou viram
  // cancelada. Cancelada não volta (o banco recusa): um pedido recusado nunca
  // foi consulta, e "corrigi-lo" para realizada mudaria o "desde a última".
  const correcoes =
    s === "realizada" || s === "faltou"
      ? (["realizada", "faltou", "cancelada"] as const).filter((d) => d !== s)
      : [];

  return (
    <div className="space-y-3">
      <div>
        {mostrarNome && (
          <p className="text-[16px] font-semibold text-clin-texto">{nome}</p>
        )}
        <p className="text-[15px] tabular-nums text-clin-texto">
          {rotuloDaConsulta(c)} · {c.duration_min} min
        </p>
        <p className="text-[14px] text-clin-texto-2">
          {ROTULO_TIPO[c.kind]} · {ROTULO_MODO[c.mode]}
        </p>
        <p className="mt-2 flex flex-wrap items-center gap-2">
          <span className={`${CLASSE_SELO} ${SELO[s]}`}>
            {ROTULO_SITUACAO[s]}
          </span>
          {s === "cancelada" && c.cancelled_by && (
            <span className="text-[14px] text-clin-texto-2">
              {c.cancelled_by === "paciente" ? "pelo paciente" : "por você"}
            </span>
          )}
        </p>
      </div>

      {(s === "pedido" || s === "remarcar") && c.patient_message && (
        <p className="rounded-md bg-clin-atencao-fundo px-3 py-2 text-[14px] text-clin-texto">
          <span className="font-semibold">Recado: </span>
          {c.patient_message}
        </p>
      )}

      {desde && (
        <p className="text-[14px] text-clin-texto-2">
          <span className="font-medium text-clin-texto">{desde.titulo}: </span>
          {desde.texto}
        </p>
      )}

      {ehPedido && !editando && (bate.length > 0 || diaFalhou) && (
        <p className="flex items-start gap-2 rounded-md bg-clin-atencao-fundo px-3 py-2 text-[14px] text-clin-texto">
          <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-clin-atencao" />
          <span>
            {diaFalhou
              ? "Não foi possível conferir as outras consultas deste dia."
              : `Bate com ${bate
                  .map((x) => `${horaEmSaoPaulo(x.starts_at)} ${doDia?.nomes[x.patient_id] ?? "outro paciente"}`)
                  .join(" e ")}. Aceitar marca as duas no mesmo horário.`}
          </span>
        </p>
      )}

      {editando ? (
        <div className="rounded-md border border-clin-linha p-4">
          <p className="mb-3 text-[15px] font-semibold text-clin-texto">
            {editando === "remarcar"
              ? s === "pedido"
                ? "Outro horário"
                : "Remarcar"
              : s === "realizada"
                ? "Marcar retorno"
                : "Marcar outra consulta"}
            {fechadaComo === "realizada" && (
              <span className="mt-0.5 block text-[14px] font-normal text-clin-texto-2">
                Consulta marcada como realizada.
              </span>
            )}
          </p>
          {editando === "remarcar" ? (
            <FormConsulta
              modo="remarcar"
              nutriId={nutriId}
              consulta={c}
              aoTerminar={() => {
                setEditando(null);
                aoTerminar?.();
              }}
              aoCancelar={() => setEditando(null)}
            />
          ) : (
            <FormConsulta
              modo="marcar"
              nutriId={nutriId}
              pacienteId={c.patient_id}
              inicial={
                s === "realizada"
                  ? {
                      data: retorno.data,
                      hora: retorno.hora,
                      tipo: "retorno",
                      modo: c.mode,
                    }
                  : { tipo: c.kind, modo: c.mode }
              }
              aoTerminar={() => {
                setEditando(null);
                aoTerminar?.();
              }}
              aoCancelar={() => setEditando(null)}
            />
          )}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">{acoes}</div>
      )}

      <ErroInline mensagem={erro} className="" />

      {!editando && correcoes.length > 0 && (
        <p className="flex flex-wrap items-center gap-x-3 text-[14px] text-clin-texto-2">
          Corrigir para:
          {correcoes.map((d) => (
            <button
              key={d}
              type="button"
              disabled={ocupado}
              onClick={() => fechar(d, d)}
              className={`inline-flex ${LINK}`}
            >
              {ROTULO_SITUACAO[d].toLowerCase()}
            </button>
          ))}
        </p>
      )}

      {abrirPaciente && (
        <Link
          href={`/app/pacientes/${c.patient_id}?aba=consultas`}
          className={`inline-flex ${LINK}`}
        >
          Abrir paciente
        </Link>
      )}
    </div>
  );
}
