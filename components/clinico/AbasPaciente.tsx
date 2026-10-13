"use client";

import Link from "next/link";
import { ABAS, hrefDaAba, type AbaPaciente } from "@/lib/abas";
import { useTrocaDeAba } from "./Edicao";

// A barra de abas da página do paciente. São links, não um tablist: cada aba
// é um endereço (?aba=treino), o Voltar do navegador volta para a anterior e
// só a aba aberta consulta o banco.
//
// No celular as cinco não cabem em 390 px: a barra rola de lado em vez de
// quebrar em duas linhas, que empurrariam o conteúdo para baixo.
export function AbasPaciente({ uid, ativa }: { uid: string; ativa: AbaPaciente }) {
  const podeTrocar = useTrocaDeAba();
  return (
    <nav aria-label="Assuntos do paciente" className="-mx-1 overflow-x-auto">
      <ul role="list" className="flex min-w-max gap-1 border-b border-clin-linha px-1">
        {ABAS.map((a) => {
          const atual = a.id === ativa;
          return (
            <li key={a.id}>
              <Link
                href={hrefDaAba(uid, a.id)}
                aria-current={atual ? "page" : undefined}
                onClick={(e) => {
                  if (!atual && !podeTrocar()) e.preventDefault();
                }}
                className={`-mb-px inline-flex min-h-[44px] items-center whitespace-nowrap border-b-[3px] px-3 text-[15px] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-clin-primaria ${
                  atual
                    ? "border-clin-primaria font-semibold text-clin-primaria"
                    : "border-transparent font-medium text-clin-texto-2 hover:text-clin-texto"
                }`}
              >
                {a.rotulo}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
