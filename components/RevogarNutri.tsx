"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function RevogarNutri({ linkId }: { linkId: string }) {
  const supabase = createClient();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function revogar() {
    if (
      !confirm(
        "Revogar o acesso deste nutricionista aos seus dados? Ele deixará de ver seus registros."
      )
    )
      return;
    setBusy(true);
    await supabase.from("patient_links").update({ status: "revoked" }).eq("id", linkId);
    setBusy(false);
    router.refresh();
  }

  return (
    <button
      onClick={revogar}
      disabled={busy}
      className="tappable min-h-[44px] shrink-0 rounded-lg px-3 text-xs font-semibold text-app-texto-2 hover:bg-app-perigo-fundo hover:text-app-perigo disabled:opacity-60"
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Revogar"}
    </button>
  );
}
