"use client";

import { useId, useState } from "react";
import { Loader2 } from "lucide-react";
import { todayISO } from "@/lib/date";
import {
  estadoDaConsulta,
  instanteEmSaoPaulo,
  rotuloDaConsulta,
  ROTULO_MODO,
  type Consulta,
  type ModoConsulta,
} from "@/lib/consultas";
import { useAcaoConsulta } from "@/components/consultas/acoes";

// A consulta do lado do paciente, em "Meu plano" (spec de consultas, "Lado do
// paciente"). A Início só tem a linha (LinhaDaConsulta), que leva a este cartão
// (#consulta); as ações moram aqui. O paciente vê a próxima, cancela, pede
// para remarcar e pede uma consulta nova. Não há aviso fora do app (falta
// Web Push), então o que o nutricionista fez aparece aqui: pedido aceito
// vira a próxima consulta; recusado ou cancelado, uma linha dizendo isso.
//
// Visual do app do paciente (.card, .input, .btn-*), não o tema clínico.
export function CartaoConsulta({
  consultas,
  agora,
  nutriNome,
  falhou,
}: {
  /** As consultas do paciente, quaisquer, das mais recentes. */
  consultas: Consulta[];
  agora: string;
  nutriNome?: string;
  falhou?: boolean;
}) {
  const id = useId();
  const { executar, ocupado, erro, setErro } = useAcaoConsulta();
  const [formulario, setFormulario] = useState<null | "pedir" | "remarcar">(
    null,
  );
  const [data, setData] = useState("");
  const [hora, setHora] = useState("");
  const [modo, setModo] = useState<ModoConsulta>("presencial");
  const [recado, setRecado] = useState("");

  const quem = nutriNome ? nutriNome.split(" ")[0] : "o nutricionista";
  const t = Date.parse(agora);
  // A escolha é de lib/consultas.ts, a mesma da linha da Início.
  const { proxima, pedido, canceladaPeloNutri } = estadoDaConsulta(consultas, t);

  function abrir(qual: "pedir" | "remarcar") {
    setErro(null);
    setRecado("");
    setFormulario(qual);
  }

  async function enviarPedido(e: React.FormEvent) {
    e.preventDefault();
    let inicio: string;
    try {
      inicio = instanteEmSaoPaulo(data, hora);
    } catch {
      return setErro("Escolha a data e a hora.");
    }
    if (Date.parse(inicio) <= Date.now())
      return setErro("Escolha um horário no futuro.");
    // O formulário fecha quando a página nova chega: fechando antes, o
    // "Pedir consulta" reaparecia por um instante e convidava a pedir de novo.
    await executar(
      "pedir_consulta",
      { p_inicio: inicio, p_modo: modo, p_mensagem: recado.trim() || null },
      () => setFormulario(null),
    );
  }

  async function enviarRemarcacao(e: React.FormEvent) {
    e.preventDefault();
    if (!recado.trim()) return setErro("Diga qual horário fica melhor.");
    await executar(
      "pedir_remarcacao",
      { p_id: proxima!.id, p_mensagem: recado.trim() },
      () => setFormulario(null),
    );
  }

  async function cancelar(c: Consulta, pergunta: string) {
    if (!window.confirm(pergunta)) return;
    await executar("cancelar_consulta", { p_id: c.id });
  }

  const titulo = (
    <h2 className="section-title mb-3">Consulta</h2>
  );

  if (falhou) {
    return (
      <section className="card" aria-label="Consulta">
        {titulo}
        <p className="text-sm text-app-texto-2">
          Não foi possível carregar suas consultas. Atualize a página para
          tentar de novo.
        </p>
      </section>
    );
  }

  const mensagemDeErro = erro && (
    <p
      role="alert"
      className="mt-3 rounded-lg bg-app-perigo-fundo px-3 py-2 text-sm text-app-perigo"
    >
      {erro}
    </p>
  );
  const girando = ocupado && (
    <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
  );

  return (
    <section className="card" aria-label="Consulta">
      {titulo}

      {/* A próxima consulta e um pedido aberto podem existir juntos (o nutri
          marcou uma consulta sem responder ao pedido): os dois aparecem. */}
      {proxima && (
        <div>
          <p className="text-sm text-app-texto-2">
            Próxima consulta
          </p>
          <p className="tabular text-base font-semibold text-app-texto">
            {rotuloDaConsulta(proxima)} · {ROTULO_MODO[proxima.mode]}
          </p>
          {proxima.reschedule_requested_at ? (
            <p className="mt-1 text-sm text-app-texto-2">
              Pedido de remarcação enviado. Aguardando {quem}.
            </p>
          ) : formulario === "remarcar" ? null : (
            Date.parse(proxima.starts_at) > t && (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => abrir("remarcar")}
                  className="btn-ghost min-h-[44px]"
                >
                  Pedir para remarcar
                </button>
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() =>
                    cancelar(
                      proxima,
                      `Cancelar a consulta de ${rotuloDaConsulta(proxima)}?`,
                    )
                  }
                  className="btn-ghost min-h-[44px]"
                >
                  {girando}
                  Cancelar
                </button>
              </div>
            )
          )}
          {formulario === "remarcar" && (
            <form
              onSubmit={enviarRemarcacao}
              noValidate
              className="mt-3 space-y-3"
            >
              <div>
                <label htmlFor={`${id}-remarcar`} className="label">
                  Qual horário fica melhor?
                </label>
                <textarea
                  id={`${id}-remarcar`}
                  value={recado}
                  onChange={(e) => setRecado(e.target.value)}
                  maxLength={500}
                  rows={2}
                  className="input"
                  placeholder="Ex.: pode ser quinta de manhã?"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={ocupado}
                  className="btn-primary"
                >
                  {girando}
                  Enviar pedido
                </button>
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => setFormulario(null)}
                  className="btn-ghost min-h-[44px]"
                >
                  Voltar
                </button>
              </div>
            </form>
          )}
        </div>
      )}
      {pedido && (
        <div
          className={
            proxima
              ? "mt-4 border-t border-app-linha pt-4"
              : ""
          }
        >
          <div>
            <p className="text-sm text-app-texto">
              Pedido enviado para{" "}
              <strong className="font-semibold">
                {rotuloDaConsulta(pedido)}
              </strong>{" "}
              · {ROTULO_MODO[pedido.mode]}
            </p>
            <p className="mt-0.5 text-sm text-app-texto-2">
              Aguardando resposta de {quem}.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={ocupado}
                onClick={() =>
                  cancelar(pedido, "Cancelar o pedido de consulta?")
                }
                className="btn-ghost min-h-[44px]"
              >
                {girando}
                Cancelar pedido
              </button>
            </div>
          </div>
        </div>
      )}
      {!proxima &&
        !pedido &&
        (formulario === "pedir" ? (
          <form onSubmit={enviarPedido} noValidate className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor={`${id}-data`} className="label">
                  Data
                </label>
                <input
                  id={`${id}-data`}
                  type="date"
                  min={todayISO()}
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  className="input"
                  required
                />
              </div>
              <div>
                <label htmlFor={`${id}-hora`} className="label">
                  Hora
                </label>
                <input
                  id={`${id}-hora`}
                  type="time"
                  step={900}
                  value={hora}
                  onChange={(e) => setHora(e.target.value)}
                  className="input"
                  required
                />
              </div>
            </div>
            <fieldset>
              <legend className="label">Como prefere</legend>
              <div className="flex gap-2">
                {(["presencial", "online"] as const).map((m) => (
                  <label
                    key={m}
                    className={`flex min-h-[44px] flex-1 cursor-pointer items-center justify-center rounded-xl border px-3 text-sm has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-app-primaria ${
                      modo === m
                        ? "border-app-primaria bg-app-primaria-fundo font-semibold text-app-primaria"
                        : "border-app-campo text-app-texto"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`${id}-modo`}
                      value={m}
                      checked={modo === m}
                      onChange={() => setModo(m)}
                      className="sr-only"
                    />
                    {m === "presencial" ? "Presencial" : "Online"}
                  </label>
                ))}
              </div>
            </fieldset>
            <div>
              <label htmlFor={`${id}-recado`} className="label">
                Recado (opcional)
              </label>
              <textarea
                id={`${id}-recado`}
                value={recado}
                onChange={(e) => setRecado(e.target.value)}
                maxLength={500}
                rows={2}
                className="input"
                placeholder="Ex.: prefiro de manhã"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={ocupado} className="btn-primary">
                {girando}
                Enviar pedido
              </button>
              <button
                type="button"
                disabled={ocupado}
                onClick={() => setFormulario(null)}
                className="btn-ghost min-h-[44px]"
              >
                Voltar
              </button>
            </div>
          </form>
        ) : (
          <div>
            {canceladaPeloNutri ? (
              <p className="text-sm text-app-texto-2">
                {nutriNome ? quem : "Seu nutricionista"} cancelou a consulta de{" "}
                {rotuloDaConsulta(canceladaPeloNutri)}. Peça outro horário ou
                mande uma mensagem pela conversa.
              </p>
            ) : (
              <p className="text-sm text-app-texto-2">
                Nenhuma consulta marcada.
              </p>
            )}
            <div className="mt-3">
              <button
                type="button"
                onClick={() => abrir("pedir")}
                className="btn-primary"
              >
                Pedir consulta
              </button>
            </div>
          </div>
        ))}

      {mensagemDeErro}
    </section>
  );
}
