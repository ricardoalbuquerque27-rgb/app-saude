"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import {
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

// Uma consulta e o que dá para fazer com ela, conforme a situação (spec,
// "painel da consulta"). Serve à agenda (dentro do Dialogo) e à aba
// Consultas do paciente (solto na página).
//
// `agora` vem do servidor: com o relógio do navegador, uma consulta que
// acabou entre o servidor montar a página e o navegador hidratar mudaria de
// "Agendada" para "Sem desfecho" no meio, e o React reclamaria da diferença.
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
  const s = situacao(c, agora);
  const [editando, setEditando] = useState<null | "remarcar" | "nova">(null);
  const { executar, ocupado, erro } = useAcaoConsulta();
  const [qual, setQual] = useState<string | null>(null);

  async function acao(rotulo: string, f: () => Promise<boolean>) {
    setQual(rotulo);
    const ok = await f();
    setQual(null);
    if (ok) aoTerminar?.();
  }
  const fechar = (desfecho: "realizada" | "faltou" | "cancelada") =>
    executar("fechar_consulta", { p_id: c.id, p_desfecho: desfecho });
  const manter = () => executar("remarcar_consulta", { p_id: c.id });

  // Função, e não componente: um componente declarado aqui dentro seria
  // outro a cada render, e o botão perderia o foco do teclado ao recarregar.
  const botao = (rotulo: string, onClick: () => void, primario = false) => (
    <button
      key={rotulo}
      type="button"
      onClick={onClick}
      disabled={ocupado}
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

  const acoes = (() => {
    switch (s) {
      case "pedido":
        return (
          <>
            {/* Aceitar um pedido cujo horário já passou criaria uma consulta
                sem desfecho na hora; aí só "Outro horário". */}
            {!comecou && botao("Aceitar", () => acao("Aceitar", manter), true)}
            {botao("Outro horário", () => setEditando("remarcar"), comecou)}
            {botao("Recusar", () => {
              if (window.confirm(`Recusar o pedido de ${nome}?`))
                acao("Recusar", () => fechar("cancelada"));
            })}
          </>
        );
      case "remarcar":
        return (
          <>
            {botao("Remarcar", () => setEditando("remarcar"), true)}
            {botao("Manter horário", () => acao("Manter horário", manter))}
          </>
        );
      case "agendada":
        return (
          <>
            {botao("Remarcar", () => setEditando("remarcar"))}
            {botao("Cancelar consulta", () => {
              if (
                window.confirm(
                  `Cancelar a consulta de ${nome} (${rotuloDaConsulta(c)})?`,
                )
              )
                acao("Cancelar consulta", () => fechar("cancelada"));
            })}
          </>
        );
      case "sem-desfecho":
        return (
          <>
            {botao(
              "Realizada",
              () => acao("Realizada", () => fechar("realizada")),
              true,
            )}
            {botao("Faltou", () => acao("Faltou", () => fechar("faltou")))}
            {botao("Cancelada", () =>
              acao("Cancelada", () => fechar("cancelada")),
            )}
          </>
        );
      case "realizada":
        return botao("Marcar retorno", () => setEditando("nova"), true);
      case "faltou":
      case "cancelada":
        return botao("Marcar outra consulta", () => setEditando("nova"));
    }
  })();

  // Desfecho errado se corrige (spec): realizada e faltou trocam entre si e
  // com cancelada; realizada e faltou só depois do início.
  const correcoes =
    s === "realizada" || s === "faltou" || (s === "cancelada" && comecou)
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
              onClick={() => acao(d, () => fechar(d))}
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
