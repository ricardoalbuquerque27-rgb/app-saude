"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Check, Eye, EyeOff } from "lucide-react";
import MarcaIcone from "@/components/MarcaIcone";
import { createClient } from "@/lib/supabase/client";
import {
  AJUDA_DA_SENHA,
  SENHA_MINIMO,
  ehErroDeSenhaFraca,
  problemaDaSenha,
} from "@/lib/senha";

export default function RedefinirSenhaPage() {
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Senha recusada (pela regra do app ou pelo Supabase) não ganha uma segunda
  // caixa com a mesma frase: a ajuda fixa embaixo do campo muda de cor.
  const ajudaEmDestaque = error === AJUDA_DA_SENHA;

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY" || session) {
        setReady(true);
        setChecking(false);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (data.session) setReady(true);
      setChecking(false);
    });
    const t = setTimeout(() => {
      if (mounted) setChecking(false);
    }, 2500);
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const problema = problemaDaSenha(password);
    if (problema) {
      setError(problema);
      return;
    }
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      // Senha que o servidor recusa por fraca não é link vencido: dizer
      // "expirou" mandaria a pessoa pedir outro link sem mudar a senha.
      setError(
        ehErroDeSenhaFraca(error)
          ? AJUDA_DA_SENHA
          : "Não foi possível redefinir. O link pode ter expirado — solicite um novo."
      );
      return;
    }
    setDone(true);
    setTimeout(() => {
      // Navegação dura: a sessão mudou, nada renderizado antes vale mais.
      window.location.assign("/app");
    }, 1400);
  }

  return (
    // O chão é `pagina`, liso: o degradê verde de cima para baixo (e o dele no
    // escuro, em três tons de slate) era enfeite.
    <main className="flex min-h-dvh items-center justify-center bg-app-pagina px-5 py-10">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="tappable mb-8 flex min-h-[44px] items-center justify-center gap-2.5"
        >
          <MarcaIcone tamanho={36} />
          <span className="text-lg font-semibold text-app-texto">Pace Fit</span>
        </Link>

        <div className="card">
          {done ? (
            <div className="flex flex-col items-center py-6 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-app-primaria-fundo text-app-primaria">
                <Check className="h-6 w-6" />
              </div>
              <p className="font-semibold text-app-texto">Senha redefinida!</p>
              <p className="mt-1 text-sm text-app-texto-2">Entrando no app…</p>
            </div>
          ) : checking ? (
            <div className="flex flex-col items-center py-8 text-center">
              <Loader2 className="mb-3 h-6 w-6 animate-spin text-app-primaria" />
              <p className="text-sm text-app-texto-2">Validando o link…</p>
            </div>
          ) : ready ? (
            <>
              <h1 className="text-xl font-semibold text-app-texto">Nova senha</h1>
              <p className="mt-1 text-sm text-app-texto-2">
                Defina uma nova senha para sua conta.
              </p>
              <form onSubmit={submit} className="mt-5 space-y-4">
                <div>
                  <label className="label">Nova senha</label>
                  <div className="relative">
                    <input
                      className="input pr-11"
                      type={showPw ? "text" : "password"}
                      required
                      minLength={SENHA_MINIMO}
                      aria-describedby="ajuda-da-senha"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      className="tappable absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-app-texto-2 hover:text-app-texto"
                      tabIndex={-1}
                      aria-label={showPw ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {showPw ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {/* aria-live: a frase é a mesma antes e depois do erro, e
                      leitor de tela só anuncia o que muda; o prefixo só para
                      ele (sr-only) entra com o erro e faz a ajuda ser lida.
                      `font-medium` junto da cor: cor sozinha não basta. */}
                  <p
                    id="ajuda-da-senha"
                    aria-live="polite"
                    aria-atomic="true"
                    className={
                      ajudaEmDestaque
                        ? "mt-1.5 text-[13px] font-medium text-app-atencao"
                        : "mt-1.5 text-[13px] text-app-texto-2"
                    }
                  >
                    {ajudaEmDestaque && (
                      <span className="sr-only">Senha não aceita. </span>
                    )}
                    {AJUDA_DA_SENHA}
                  </p>
                </div>
                {error && !ajudaEmDestaque && (
                  <p className="rounded-lg bg-app-perigo-fundo px-3 py-2 text-sm text-app-perigo">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full py-2.5"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Salvar nova senha
                </button>
              </form>
            </>
          ) : (
            <div className="py-4 text-center">
              <p className="font-semibold text-app-texto">
                Link inválido ou expirado
              </p>
              <p className="mt-1 text-sm text-app-texto-2">
                Solicite um novo link de redefinição.
              </p>
              <Link href="/login" className="btn-primary mt-4 inline-flex">
                Voltar para o login
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
