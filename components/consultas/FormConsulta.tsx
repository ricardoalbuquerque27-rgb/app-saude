"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { todayISO } from "@/lib/date";
import {
  choques,
  diaDaConsulta,
  DURACOES,
  duracaoPadrao,
  horaEmSaoPaulo,
  instanteEmSaoPaulo,
  ROTULO_TIPO,
  type Consulta,
  type ModoConsulta,
  type TipoConsulta,
} from "@/lib/consultas";
import { getConsultasDoPeriodo, getNomesDosPacientes } from "@/lib/consultasDb";
import { ACAO_PRIMARIA, ACAO_SECUNDARIA } from "@/components/clinico/estilos";
import { ErroInline } from "@/components/clinico/ErroInline";
import { useAcaoConsulta } from "./acoes";
import { CAMPO, ROTULO_CAMPO } from "./aparencia";

export type ModoForm = "marcar" | "remarcar";

// Marcar e remarcar (o nutricionista), inclusive o "Outro horário" de um
// pedido e o "Marcar retorno". Data e hora são de São Paulo e viram instante
// só no envio, com o deslocamento do dia (instanteEmSaoPaulo). O pedido do
// paciente tem formulário próprio, no visual do app dele (CartaoConsulta).
//
// Embaixo, as consultas do dia escolhido e o aviso de choque. Choque avisa e
// não impede (spec): o nutri pode encaixar de propósito.
export function FormConsulta({
  modo,
  nutriId,
  pacientes,
  pacienteId,
  consulta,
  inicial,
  aoTerminar,
  aoCancelar,
}: {
  modo: ModoForm;
  /** Para buscar as consultas do dia (marcar e remarcar). */
  nutriId?: string;
  /** Escolha do paciente, quando ele ainda não foi escolhido (agenda). */
  pacientes?: { id: string; nome: string }[];
  /** Paciente já escolhido (aba Consultas, Marcar retorno). */
  pacienteId?: string;
  /** A consulta que está sendo remarcada. */
  consulta?: Consulta;
  inicial?: Partial<{
    data: string;
    hora: string;
    tipo: TipoConsulta;
    modo: ModoConsulta;
  }>;
  aoTerminar: () => void;
  aoCancelar: () => void;
}) {
  const id = useId();
  const hoje = todayISO();
  const [paciente, setPaciente] = useState(
    pacienteId ?? consulta?.patient_id ?? "",
  );
  const [data, setData] = useState(
    inicial?.data ?? (consulta ? diaDaConsulta(consulta) : hoje),
  );
  const [hora, setHora] = useState(
    inicial?.hora ?? (consulta ? horaEmSaoPaulo(consulta.starts_at) : ""),
  );
  const [tipo, setTipo] = useState<TipoConsulta>(
    inicial?.tipo ?? consulta?.kind ?? "retorno",
  );
  const [duracao, setDuracao] = useState<number>(
    consulta?.duration_min ?? duracaoPadrao(inicial?.tipo ?? "retorno"),
  );
  const [mexeuNaDuracao, setMexeuNaDuracao] = useState(!!consulta);
  const [modalidade, setModalidade] = useState<ModoConsulta>(
    inicial?.modo ?? consulta?.mode ?? "presencial",
  );
  const { executar, ocupado, erro, setErro } = useAcaoConsulta();

  // 1ª consulta ou retorno: quem já tem consulta realizada é retorno. Só na
  // escolha do paciente na agenda; nos outros casos quem chama já sabe.
  useEffect(() => {
    if (modo !== "marcar" || !paciente || inicial?.tipo) return;
    let vivo = true;
    createClient()
      .from("appointments")
      .select("id")
      .eq("patient_id", paciente)
      .eq("status", "realizada")
      .limit(1)
      .then(
        ({
          data: linhas,
          error,
        }: {
          data: unknown[] | null;
          error: unknown;
        }) => {
          if (!vivo || error) return;
          const t: TipoConsulta =
            linhas && linhas.length > 0 ? "retorno" : "primeira";
          setTipo(t);
          if (!mexeuNaDuracao) setDuracao(duracaoPadrao(t));
        },
      );
    return () => {
      vivo = false;
    };
    // mexeuNaDuracao fora de propósito: mudar a duração não refaz a busca.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo, paciente, inicial?.tipo]);

  // As consultas do dia escolhido, para a lista e o choque.
  const [doDia, setDoDia] = useState<{
    lista: Consulta[];
    nomes: Record<string, string>;
  } | null>(null);
  const [diaFalhou, setDiaFalhou] = useState(false);
  useEffect(() => {
    if (!nutriId || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return;
    let vivo = true;
    const supabase = createClient();
    (async () => {
      const r = await getConsultasDoPeriodo(supabase, nutriId, data, data);
      const ids = Array.from(new Set(r.data.map((c) => c.patient_id)));
      const n = await getNomesDosPacientes(supabase, ids);
      if (!vivo) return;
      setDiaFalhou(r.falhou);
      setDoDia({ lista: r.data, nomes: n.data });
    })();
    return () => {
      vivo = false;
    };
  }, [modo, nutriId, data]);

  const instante = useMemo(() => {
    try {
      return hora ? instanteEmSaoPaulo(data, hora) : null;
    } catch {
      return null;
    }
  }, [data, hora]);

  const bate = useMemo(
    () =>
      instante && doDia
        ? choques(doDia.lista, instante, duracao, consulta?.id)
        : [],
    [instante, doDia, duracao, consulta?.id],
  );
  const ocupadasNoDia = (doDia?.lista ?? []).filter(
    (c) => c.status === "agendada" && c.id !== consulta?.id,
  );

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (modo === "marcar" && !paciente) return setErro("Escolha o paciente.");
    if (!instante) return setErro("Escolha a data e a hora.");

    const ok =
      modo === "marcar"
        ? await executar("marcar_consulta", {
            p_patient: paciente,
            p_inicio: instante,
            p_duracao: duracao,
            p_tipo: tipo,
            p_modo: modalidade,
          })
        : await executar("remarcar_consulta", {
            p_id: consulta!.id,
            p_inicio: instante,
            p_duracao: duracao,
            p_tipo: tipo,
            p_modo: modalidade,
          });
    if (ok) aoTerminar();
  }

  const noPassado = instante != null && Date.parse(instante) < Date.now();

  return (
    <form onSubmit={enviar} noValidate className="space-y-4">
      {modo === "marcar" && pacientes && !pacienteId && (
        <div>
          <label htmlFor={`${id}-paciente`} className={ROTULO_CAMPO}>
            Paciente
          </label>
          <select
            id={`${id}-paciente`}
            value={paciente}
            onChange={(e) => setPaciente(e.target.value)}
            className={CAMPO}
            required
          >
            <option value="">Escolha…</option>
            {pacientes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor={`${id}-data`} className={ROTULO_CAMPO}>
            Data
          </label>
          <input
            id={`${id}-data`}
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            className={CAMPO}
            required
          />
        </div>
        <div>
          <label htmlFor={`${id}-hora`} className={ROTULO_CAMPO}>
            Hora
          </label>
          <input
            id={`${id}-hora`}
            type="time"
            step={900}
            value={hora}
            onChange={(e) => setHora(e.target.value)}
            className={CAMPO}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor={`${id}-tipo`} className={ROTULO_CAMPO}>
            Tipo
          </label>
          <select
            id={`${id}-tipo`}
            value={tipo}
            onChange={(e) => {
              const t = e.target.value as TipoConsulta;
              setTipo(t);
              if (!mexeuNaDuracao) setDuracao(duracaoPadrao(t));
            }}
            className={CAMPO}
          >
            <option value="primeira">{ROTULO_TIPO.primeira}</option>
            <option value="retorno">Retorno</option>
          </select>
        </div>
        <div>
          <label htmlFor={`${id}-duracao`} className={ROTULO_CAMPO}>
            Duração
          </label>
          <select
            id={`${id}-duracao`}
            value={duracao}
            onChange={(e) => {
              setDuracao(Number(e.target.value));
              setMexeuNaDuracao(true);
            }}
            className={CAMPO}
          >
            {/* Uma duração fora da lista (vinda do banco) continua escolhida. */}
            {Array.from(new Set<number>([...DURACOES, duracao]))
              .sort((a, b) => a - b)
              .map((d) => (
                <option key={d} value={d}>
                  {d} min
                </option>
              ))}
          </select>
        </div>
      </div>

      <fieldset>
        <legend className={ROTULO_CAMPO}>Modalidade</legend>
        <div className="flex gap-2">
          {(["presencial", "online"] as const).map((m) => (
            <label
              key={m}
              className={`inline-flex min-h-[44px] flex-1 cursor-pointer items-center justify-center rounded-md border px-3 text-[15px] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-clin-primaria ${
                modalidade === m
                  ? "border-clin-primaria bg-clin-primaria-fundo font-semibold text-clin-primaria"
                  : "border-clin-campo text-clin-texto"
              }`}
            >
              <input
                type="radio"
                name={`${id}-modo`}
                value={m}
                checked={modalidade === m}
                onChange={() => setModalidade(m)}
                className="sr-only"
              />
              {m === "presencial" ? "Presencial" : "Online"}
            </label>
          ))}
        </div>
      </fieldset>

      <div aria-live="polite" className="space-y-2 text-[14px]">
        {bate.length > 0 && (
          <p className="flex items-start gap-2 rounded-md bg-clin-atencao-fundo px-3 py-2 text-clin-texto">
            <AlertTriangle
              aria-hidden="true"
              className="mt-0.5 h-4 w-4 shrink-0 text-clin-atencao"
            />
            <span>
              Bate com{" "}
              {bate
                .map(
                  (c) =>
                    `${horaEmSaoPaulo(c.starts_at)} ${doDia?.nomes[c.patient_id] ?? "outro paciente"}`,
                )
                .join(" e ")}
              . Dá para salvar assim mesmo.
            </span>
          </p>
        )}
        {noPassado && (
          <p className="text-clin-texto-2">
            Horário no passado: a consulta entra sem desfecho, para você fechar.
          </p>
        )}
        {diaFalhou ? (
          <p className="text-clin-texto-2">
            Não foi possível ver as outras consultas deste dia.
          </p>
        ) : doDia ? (
          <p className="text-clin-texto-2">
            {ocupadasNoDia.length === 0
              ? "Nenhuma outra consulta neste dia."
              : `Neste dia: ${ocupadasNoDia
                  .map(
                    (c) =>
                      `${horaEmSaoPaulo(c.starts_at)} ${doDia.nomes[c.patient_id] ?? "paciente"}`,
                  )
                  .join(" · ")}`}
          </p>
        ) : null}
      </div>

      <ErroInline mensagem={erro} className="" />

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="submit"
          disabled={ocupado}
          className={`inline-flex ${ACAO_PRIMARIA} disabled:opacity-60`}
        >
          {ocupado && (
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          )}
          {ocupado
            ? "Salvando…"
            : modo === "remarcar"
              ? "Salvar horário"
              : "Marcar consulta"}
        </button>
        <button
          type="button"
          onClick={aoCancelar}
          disabled={ocupado}
          className={`inline-flex ${ACAO_SECUNDARIA}`}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
