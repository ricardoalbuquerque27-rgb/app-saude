"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { LIMITES } from "@/lib/registro";
import { ErroInline } from "@/components/clinico/ErroInline";
import { ACAO_PRIMARIA } from "@/components/clinico/estilos";
import { useRecarregar } from "@/components/clinico/useRecarregar";
import { chamarRegistro } from "./acoes";
import { CAMPO } from "./CamposDeMedida";

// O "Novo adendo" do registro concluído (maquete 2). O adendo é a única forma
// de corrigir um prontuário fechado: nada se edita nem se apaga. Quem assina,
// com que nome e CRN, é o banco (adicionar_adendo), com o perfil de agora.
export function NovoAdendo({ registroId }: { registroId: string }) {
  const id = useId();
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [recarregando, recarregar] = useRecarregar();
  const ocupado = enviando || recarregando;
  // Espaço e quebra de linha não são adendo; o banco também recusa.
  const vazio = texto.trim() === "";

  // O campo só esvazia quando a lista nova, com o adendo, já está na tela.
  // Esvaziar na resposta do banco deixaria o campo vazio por um instante sobre
  // a lista antiga, como se o adendo tivesse se perdido (mesma armadilha do
  // `depois` em components/consultas/acoes.ts).
  const esvaziarDepois = useRef(false);
  useEffect(() => {
    if (recarregando || !esvaziarDepois.current) return;
    esvaziarDepois.current = false;
    setTexto("");
  }, [recarregando]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (ocupado || vazio) return;
    setEnviando(true);
    setErro(null);
    const r = await chamarRegistro(
      "adicionar_adendo",
      { p_registro: registroId, p_texto: texto },
      "salvar o adendo"
    ).catch(() => ({ erro: "Não foi possível salvar o adendo. Confira a conexão e tente de novo.", dados: null }));
    if (r.erro) {
      setErro(r.erro);
      setEnviando(false);
      return;
    }
    esvaziarDepois.current = true;
    recarregar();
    setEnviando(false);
  }

  return (
    <form onSubmit={salvar} className="space-y-2">
      <label htmlFor={id} className="block text-[15px] font-semibold text-clin-texto">
        Novo adendo
      </label>
      <textarea
        id={id}
        rows={3}
        value={texto}
        maxLength={LIMITES.adendo}
        disabled={ocupado}
        placeholder="Correção ou complemento. Leva a data e a hora de agora."
        onChange={(e) => setTexto(e.target.value)}
        className={`${CAMPO} resize-y border-clin-campo py-2.5 text-[16px] leading-relaxed sm:text-[15px]`}
      />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <button type="submit" disabled={vazio || ocupado} className={`inline-flex ${ACAO_PRIMARIA} disabled:opacity-60`}>
          {ocupado && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}
          Salvar adendo
        </button>
        <span className="text-[14px] text-clin-texto-2">O adendo também fica no prontuário e não se apaga.</span>
      </div>
      <ErroInline mensagem={erro} className="" />
    </form>
  );
}
