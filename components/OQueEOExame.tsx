"use client";

import { useId, useState } from "react";

type Estado =
  | { tipo: "fechado" }
  | { tipo: "carregando" }
  | { tipo: "pronto"; texto: string }
  | { tipo: "falhou" };

/**
 * O "O que é?" de um exame: pede à rota `explicar-exame` uma explicação geral
 * do que ele mede, só com o nome. Nada é gravado: cada abertura pede de novo
 * (guardar pediria tabela e migração). A nutricionista não vê este componente.
 */
export default function OQueEOExame({ nome }: { nome: string }) {
  const [estado, setEstado] = useState<Estado>({ tipo: "fechado" });
  const id = useId();
  const aberto = estado.tipo !== "fechado";

  async function tocar() {
    if (estado.tipo === "carregando") return;
    if (estado.tipo === "pronto") {
      setEstado({ tipo: "fechado" });
      return;
    }
    setEstado({ tipo: "carregando" });
    try {
      const res = await fetch("/api/explicar-exame", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome }),
      });
      const json = res.ok ? await res.json().catch(() => null) : null;
      if (!json || typeof json.texto !== "string") {
        setEstado({ tipo: "falhou" });
        return;
      }
      setEstado({ tipo: "pronto", texto: json.texto });
    } catch {
      setEstado({ tipo: "falhou" });
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={tocar}
        aria-expanded={aberto}
        aria-controls={id}
        className="btn-ghost min-h-[44px] px-3 text-sm"
      >
        O que é?
      </button>
      <div id={id} aria-live="polite" className={aberto ? "mt-2 text-sm" : "hidden"}>
        {estado.tipo === "carregando" && <p className="text-app-texto-2">Carregando…</p>}
        {estado.tipo === "falhou" && <p className="text-app-texto-2">Não deu para carregar a explicação.</p>}
        {estado.tipo === "pronto" && (
          <>
            <p className="text-app-texto">{estado.texto}</p>
            <p className="mt-1 text-xs text-app-texto-2">Explicação geral, escrita por IA. Não fala do seu resultado.</p>
          </>
        )}
      </div>
    </div>
  );
}
