"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ABAS, hrefDaAba, type AbaPaciente } from "@/lib/abas";
import { useTrocaDeAba } from "./Edicao";

// A barra de abas da página do paciente. São links, não um tablist: cada aba
// é um endereço (?aba=treino), o Voltar do navegador volta para a anterior e
// só a aba aberta consulta o banco.
//
// No celular, 14 px e menos folga: com o tamanho do computador as cinco
// passavam de 390 px e o Clínico (tratamento, dose, exames) ficava fora da
// tela, sem sinal de que a barra rolava. A rolagem fica de reserva para
// fonte maior ou zoom, e a aba aberta é trazida para a vista ao montar.
//
// A troca muda a marca na hora do toque e espera o servidor numa transição:
// a aba nova só chega depois das consultas dela, e sem isso o toque parecia
// ignorado no celular.
export function AbasPaciente({ uid, ativa }: { uid: string; ativa: AbaPaciente }) {
  const router = useRouter();
  const podeTrocar = useTrocaDeAba();
  const [indo, setIndo] = useState<AbaPaciente | null>(null);
  const [carregando, iniciar] = useTransition();
  const marcada = carregando && indo ? indo : ativa;

  const daAtiva = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    daAtiva.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [ativa]);

  return (
    <nav aria-label="Assuntos do paciente" aria-busy={carregando} className="-mx-1 overflow-x-auto">
      <ul role="list" className="flex min-w-max border-b border-clin-linha px-1 sm:gap-1">
        {ABAS.map((a) => {
          const atual = a.id === marcada;
          const href = hrefDaAba(uid, a.id);
          return (
            <li key={a.id}>
              <Link
                ref={a.id === ativa ? daAtiva : undefined}
                href={href}
                aria-current={atual ? "page" : undefined}
                onClick={(e) => {
                  // Ctrl/Cmd/Shift-clique e o botão do meio abrem noutra
                  // janela: nada desmonta aqui, então não há o que perguntar.
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                  e.preventDefault();
                  if (a.id === ativa || !podeTrocar()) return;
                  setIndo(a.id);
                  iniciar(() => router.push(href));
                }}
                className={`-mb-px inline-flex min-h-[44px] items-center whitespace-nowrap border-b-[3px] px-2 text-[14px] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-clin-primaria sm:px-3 sm:text-[15px] ${
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
