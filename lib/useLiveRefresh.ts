"use client";

import { useEffect } from "react";

// Recarrega os dados da página quando alguma área do app é alterada
// (por exemplo, quando o assistente de IA registra um treino/refeição).
//
// Dispare a atualização em qualquer lugar com:
//   window.dispatchEvent(
//     new CustomEvent("pf-data-changed", { detail: { areas: ["treinos"] } })
//   );
// Use areas: ["all"] para recarregar todas as telas.
export function useLiveRefresh(area: string, reload: () => void) {
  useEffect(() => {
    const handler = (e: Event) => {
      const areas = (e as CustomEvent).detail?.areas as string[] | undefined;
      if (!areas || areas.includes(area) || areas.includes("all")) {
        reload();
      }
    };
    window.addEventListener("pf-data-changed", handler);
    return () => window.removeEventListener("pf-data-changed", handler);
  }, [area, reload]);
}
