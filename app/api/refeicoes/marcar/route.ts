import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ERRO_AO_MARCAR, lerPedido, marcarRefeicao } from "@/lib/refeicoesDoPlano";

export const dynamic = "force-dynamic";

// O "Comi" e o "Não comi" da notificação das refeições. Quem chama é o service
// worker (public/sw.js), com o cookie da sessão, sem abrir o app; os botões do
// app chamam `marcarRefeicao` direto, então a regra é a mesma. Resposta fora de
// 2xx faz o celular mostrar "Não deu para marcar sua resposta".
//
// Só JSON: um formulário de outro site não manda `application/json` sem o
// navegador pedir permissão antes, e sem isto um link bastaria para marcar
// "não comi" por alguém logado.
export async function POST(req: Request) {
  if (!(req.headers.get("content-type") ?? "").includes("application/json")) {
    return NextResponse.json({ error: "Envie JSON." }, { status: 415 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const pedido = lerPedido(await req.json().catch(() => null));
  if (!pedido) {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  // A notificação é de uma conta e o aparelho pode estar com outra logada (o
  // tablet da família): marcar ali gravaria o almoço de quem estiver logado.
  if (pedido.usuario && pedido.usuario !== user.id) {
    return NextResponse.json({ error: "Esta notificação é de outra conta." }, { status: 403 });
  }

  const r = await marcarRefeicao(supabase, user.id, pedido);
  if (r.ok) return NextResponse.json({ ok: true });
  return NextResponse.json({ error: r.erro || ERRO_AO_MARCAR }, { status: r.invalido ? 400 : 500 });
}
