import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { destinoDoLogin, voltaDoPedido } from "@/lib/destinoDoLogin";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthRoute =
    request.nextUrl.pathname === "/login" ||
    request.nextUrl.pathname === "/";
  const isProtected =
    request.nextUrl.pathname === "/app" ||
    request.nextUrl.pathname.startsWith("/app/");

  // Sem sessão, o /login guarda para onde a pessoa ia (`?volta=`): o toque na
  // notificação de uma refeição terminava na Início depois de entrar. A âncora
  // (#refeicao-…) o navegador leva sozinho no redirecionamento.
  if (!user && isProtected) {
    const url = new URL("/login", request.url);
    url.searchParams.set("volta", voltaDoPedido(request.nextUrl.pathname, request.nextUrl.search));
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    const destino =
      request.nextUrl.pathname === "/login" ? destinoDoLogin(request.nextUrl.searchParams.get("volta")) : "/app";
    return NextResponse.redirect(new URL(destino, request.url));
  }

  return supabaseResponse;
}
