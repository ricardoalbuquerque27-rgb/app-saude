import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buscarAlimentos } from "@/lib/foods";

export const runtime = "nodejs";

// Busca na TACO. Fica numa rota de API, e não no cliente, para os 82 KB da
// tabela não entrarem no bundle de toda página que tem um campo de comida.
export async function GET(request: Request) {
  // Protegido por login: é dado público, mas não há motivo para expor um
  // endpoint de busca aberto.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const q = new URL(request.url).searchParams.get("q") ?? "";
  if (q.trim().length < 2) return NextResponse.json({ itens: [] });

  const itens = buscarAlimentos(q, 20).map((a) => ({
    id: a.i,
    nome: a.n,
    categoria: a.c,
    kcal100: a.k,
    prot100: a.p,
    carb100: a.ch,
    gord100: a.g,
  }));

  return NextResponse.json({ itens });
}
