"use client";

import { Fragment, useId, useState } from "react";
import { Loader2 } from "lucide-react";
import { CAMPOS_MEDIDA, FAIXAS, LIMITES, medidasValidas, textoDaMedida, type CampoMedida } from "@/lib/registro";
import { ErroInline } from "@/components/clinico/ErroInline";
import { ACAO_PRIMARIA, ACAO_SECUNDARIA } from "@/components/clinico/estilos";
import { useRecarregar } from "@/components/clinico/useRecarregar";
import { Dialogo } from "@/components/consultas/Dialogo";
import { CAMPO } from "./CamposDeMedida";

// "Concluir registro" (maquete 3): diz o que muda, deixa conferir as medidas
// e, se o perfil não tem CRN, pede o número. Quem conclui de fato (gravar o
// que falta, chamar o banco) é `aoConcluir`, no editor, que é quem tem o
// rascunho: aqui só se mostra, se espera e se exibe o erro.
//
// Sucesso não fecha o diálogo: ele fica, ocupado, até a página nova chegar
// (useRecarregar) e trocar o editor pelo registro concluído. Fechar antes
// devolveria o formulário editável, com o dado antigo, por uns instantes (a
// armadilha do `depois` em components/consultas/acoes.ts).
export function ConcluirRegistro({
  aberto,
  aoFechar,
  paciente,
  medidas,
  precisaCrn,
  aoConcluir,
}: {
  aberto: boolean;
  aoFechar: () => void;
  /** Para "entram no histórico de <nome>". */
  paciente: string;
  /**
   * O texto de cada medida na tela, como o nutri digitou. Lido por
   * `medidasValidas` (o `lerMedida` do salvamento): um segundo jeito de ler
   * número daria, para o mesmo "71,8", um valor na conferência e outro no banco.
   */
  medidas: Record<CampoMedida, string>;
  /** O perfil não tem CRN: o campo aparece, e o banco grava no perfil. */
  precisaCrn: boolean;
  /** Grava o que falta e conclui. Devolve a mensagem de erro, ou nulo se concluiu. */
  aoConcluir: (crn: string | null) => Promise<string | null>;
}) {
  const idCrn = useId();
  const [crn, setCrn] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [recarregando, recarregar] = useRecarregar();
  const ocupado = enviando || recarregando;

  const validas = medidasValidas(medidas);
  const itens = CAMPOS_MEDIDA.flatMap((c) => {
    const texto = medidas[c].trim();
    if (texto === "") return [];
    const valor = validas[c];
    return [
      valor != null
        ? { campo: c, texto: textoDaMedida(c, valor), invalida: false }
        : // Não vai ao banco como está: aparece como o nutri digitou, marcada.
          { campo: c, texto: `${FAIXAS[c].rotulo} “${texto}” (corrigir)`, invalida: true },
    ];
  });

  // Ocupado, o Dialogo nem deixa fechar (Esc, fundo, X); aqui só o erro de
  // uma tentativa antiga sai, para não estar lá na próxima vez.
  function fechar() {
    setErro(null);
    aoFechar();
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (ocupado) return;
    setEnviando(true);
    setErro(null);
    const falha = await aoConcluir(precisaCrn ? crn.trim() || null : null);
    if (falha) {
      setErro(falha);
      setEnviando(false);
      return;
    }
    // `recarregando` sobe na mesma renderização em que `enviando` desce: o
    // botão não chega a ser liberado entre a resposta e a página nova.
    recarregar();
    setEnviando(false);
  }

  return (
    <Dialogo aberto={aberto} aoFechar={fechar} titulo="Concluir o registro?" ocupado={ocupado}>
      <form onSubmit={enviar} className="space-y-4">
        <ul className="list-disc space-y-2 pl-5 text-[15px] leading-snug text-clin-texto">
          <li>Depois de concluído, o registro não pode ser editado nem apagado. Correção entra como adendo, com data.</li>
          <li>
            {itens.length > 0
              ? `As medidas entram no histórico de ${paciente}, marcadas como “medida na consulta”. O paciente vê no app.`
              : `Sem medidas nesta consulta: nada entra no histórico de ${paciente}.`}
          </li>
          <li>A consulta fica marcada como realizada.</li>
        </ul>

        {itens.length > 0 && (
          <div className="rounded-md border border-clin-linha px-3.5 py-3">
            <p className="text-[13px] font-semibold text-clin-texto-2">Confira as medidas</p>
            <p className="mt-1 text-[15px] leading-relaxed tabular-nums text-clin-texto">
              {itens.map((m, i) => (
                <Fragment key={m.campo}>
                  {i > 0 && " · "}
                  {m.invalida ? (
                    <span className="rounded bg-clin-perigo-fundo px-1.5 text-clin-perigo">{m.texto}</span>
                  ) : (
                    m.texto
                  )}
                </Fragment>
              ))}
            </p>
          </div>
        )}

        {precisaCrn && (
          <div className="space-y-1.5 rounded-md bg-clin-atencao-fundo px-4 py-3.5">
            <label htmlFor={idCrn} className="block text-[15px] font-semibold text-clin-texto">
              Seu CRN
            </label>
            <p id={`${idCrn}-ajuda`} className="text-[14px] leading-snug text-clin-texto">
              O prontuário identifica o profissional. Fica salvo no seu perfil.
            </p>
            <input
              id={idCrn}
              aria-describedby={`${idCrn}-ajuda`}
              type="text"
              autoComplete="off"
              placeholder="CRN-3 12345"
              maxLength={LIMITES.crn}
              value={crn}
              disabled={ocupado}
              onChange={(e) => setCrn(e.target.value)}
              className={`${CAMPO} min-h-[44px] border-clin-campo text-[16px] sm:text-[15px]`}
            />
          </div>
        )}

        <ErroInline mensagem={erro} className="" />

        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={fechar}
            disabled={ocupado}
            className={`inline-flex ${ACAO_SECUNDARIA} disabled:opacity-60`}
          >
            Voltar
          </button>
          <button type="submit" disabled={ocupado} className={`inline-flex ${ACAO_PRIMARIA} disabled:opacity-60`}>
            {ocupado && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}
            {ocupado ? "Concluindo…" : "Concluir registro"}
          </button>
        </div>
      </form>
    </Dialogo>
  );
}
