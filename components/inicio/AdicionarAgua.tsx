"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { adicionarAgua } from "@/lib/agua";

// "+250 ml" embaixo do anel de água da Início (spec "Água em um toque"). Grava
// por `adicionarAgua` (lib/agua.ts), a mesma conta do assistente, e atualiza a
// página com `router.refresh()`: o anel é do servidor e só muda quando a
// gravação deu certo. Com erro, a tela diz "Não deu para registrar a água" e o
// anel fica como estava; o texto do erro que `adicionarAgua` devolve é
// diagnóstico, não frase para o paciente.

const COPO = 250;
const MENSAGEM_MS = 6000;

export default function AdicionarAgua({ uid }: { uid: string }) {
  const router = useRouter();
  const [gravando, setGravando] = useState(false);
  const [mensagem, setMensagem] = useState<"registrado" | "erro" | null>(null);
  // Uma gravação por vez. O `disabled` do botão só chega ao DOM quando o React
  // redesenha, e dois toques no mesmo instante passariam os dois: cada um leria
  // o mesmo total, e o segundo apagaria o primeiro. A referência barra na hora.
  const ocupado = useRef(false);
  const relogio = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (relogio.current) clearTimeout(relogio.current);
    },
    []
  );

  async function gravar(ml: number) {
    if (ocupado.current) return;
    ocupado.current = true;
    setGravando(true);
    const r = await adicionarAgua(createClient(), uid, ml);
    ocupado.current = false;
    setGravando(false);
    if (relogio.current) clearTimeout(relogio.current);
    if (!r.ok) {
      setMensagem("erro");
      return;
    }
    if (ml > 0) {
      setMensagem("registrado");
      relogio.current = setTimeout(() => setMensagem(null), MENSAGEM_MS);
    } else {
      setMensagem(null);
    }
    router.refresh();
  }

  return (
    <div className="mt-2 flex flex-col items-center">
      <button
        type="button"
        onClick={() => gravar(COPO)}
        disabled={gravando}
        className="btn-ghost min-h-[44px] px-3"
      >
        +250 ml
      </button>
      {/* A região existe desde o começo, vazia: o leitor de tela só anuncia
          mudança numa região que já estava na página. */}
      <div aria-live="polite" className="mt-1 text-center text-[13px] leading-snug">
        {mensagem === "registrado" && (
          <>
            <span className="text-app-texto-2">+250 ml registrado · </span>
            <button
              type="button"
              onClick={() => gravar(-COPO)}
              disabled={gravando}
              className="font-semibold text-app-primaria hover:underline disabled:opacity-60"
            >
              Desfazer
            </button>
          </>
        )}
        {mensagem === "erro" && <span className="text-app-perigo">Não deu para registrar a água</span>}
      </div>
    </div>
  );
}
