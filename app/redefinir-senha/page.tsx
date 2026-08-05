"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Dumbbell, Loader2, Check, Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function RedefinirSenhaPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

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
    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(
        "Não foi possível redefinir. O link pode ter expirado — solicite um novo."
      );
      return;
    }
    setDone(true);
    setTimeout(() => {
      router.push("/app");
      router.refresh();
    }, 1400);
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-brand-50/60 via-white to-white px-5 py-10 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-[0_8px_20px_-8px_rgba(24,184,94,0.8)]">
            <Dumbbell className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
            Pace Fit
          </span>
        </Link>

        <div className="card">
          {done ? (
            <div className="flex flex-col items-center py-6 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                <Check className="h-6 w-6" />
              </div>
              <p className="font-semibold text-slate-900 dark:text-white">
                Senha redefinida!
              </p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Entrando no app…
              </p>
            </div>
          ) : checking ? (
            <div className="flex flex-col items-center py-8 text-center">
              <Loader2 className="mb-3 h-6 w-6 animate-spin text-brand-500" />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Validando o link…
              </p>
            </div>
          ) : ready ? (
            <>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                Nova senha
              </h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
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
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
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
                </div>
                {error && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
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
              <p className="font-semibold text-slate-900 dark:text-white">
                Link inválido ou expirado
              </p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
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
