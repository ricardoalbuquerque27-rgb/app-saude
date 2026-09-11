"use client";

import { usePathname } from "next/navigation";

// Reproduz a animação de entrada a cada troca de rota. O truque é a `key`:
// quando o pathname muda, o React descarta o nó antigo e monta um novo, o
// que faz a animação CSS rodar de novo. Sem biblioteca de animação.
//
// Fica fora do <main> com scroll para não criar contexto de empilhamento
// que atrapalhe elementos fixos (modais, folha do menu).
export default function PageTransition({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="pf-in">
      {children}
    </div>
  );
}
