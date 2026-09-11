"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Dumbbell,
  Loader2,
  Check,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Lock,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const HIGHLIGHTS = [
  "Modo Caneta: acompanhe seu tratamento (GLP-1)",
  "IA que conecta seus exames, dieta e treino",
  "Estime calorias pela foto do prato",
];

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "signup" | "recover">("login");
  const [fullName, setFullName] = useState("");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const supabase = createClient();

    try {
      if (mode === "recover") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/redefinir-senha`,
        });
        if (error) throw error;
        setMessage(
          "Se este e-mail tiver conta, enviamos um link para redefinir a senha. Verifique sua caixa de entrada (e o spam)."
        );
        setLoading(false);
        return;
      }
      if (mode === "signup") {
        const cpfDigits = onlyDigits(cpf);
        if (!validateCPF(cpfDigits)) {
          setError("CPF inválido. Confira os números digitados.");
          setLoading(false);
          return;
        }
        const { data: disponivel, error: rpcErr } = await supabase.rpc(
          "cpf_disponivel",
          { p_cpf: cpfDigits }
        );
        if (!rpcErr && disponivel === false) {
          setError("Este CPF já está cadastrado.");
          setLoading(false);
          return;
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName, cpf: cpfDigits } },
        });
        if (error) throw error;
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          router.push("/app");
          router.refresh();
        } else {
          setMessage(
            "Cadastro criado! Verifique seu e-mail para confirmar a conta e depois faça login."
          );
          setMode("login");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push("/app");
        router.refresh();
      }
    } catch (err: any) {
      setError(traduzErro(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-dvh lg:grid lg:grid-cols-2">
      {/* Painel esquerdo — atlético/premium (somente desktop) */}
      <div className="relative hidden overflow-hidden bg-slate-950 p-12 lg:flex lg:flex-col lg:justify-between">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(600px 340px at 85% 0%, rgba(24,184,94,0.28), transparent 60%), radial-gradient(500px 300px at 0% 100%, rgba(24,184,94,0.14), transparent 55%)",
          }}
        />
        <div className="pointer-events-none absolute inset-0 opacity-[0.04] [background-image:linear-gradient(white_1px,transparent_1px),linear-gradient(90deg,white_1px,transparent_1px)] [background-size:40px_40px]" />

        <div className="relative flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-[0_8px_20px_-8px_rgba(24,184,94,0.9)]">
            <Dumbbell className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold tracking-tight text-white">
            Pace Fit
          </span>
        </div>

        <div className="relative">
          <h2 className="text-4xl font-extrabold leading-[1.05] tracking-tight text-white xl:text-5xl">
            Supere seus limites.
            <br />
            Acompanhe cada{" "}
            <span className="bg-gradient-to-r from-brand-400 to-brand-300 bg-clip-text text-transparent">
              evolução
            </span>
            .
          </h2>
          <p className="mt-4 max-w-sm text-base text-slate-300">
            Treinos, dieta, hábitos e exames — com inteligência que trabalha por
            você.
          </p>

          <ul className="mt-8 space-y-3">
            {HIGHLIGHTS.map((h) => (
              <li key={h} className="flex items-center gap-3 text-sm text-slate-200">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500/15 text-brand-300 ring-1 ring-brand-500/25">
                  <Check className="h-3.5 w-3.5" />
                </span>
                {h}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative">
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-brand-400" /> Dados isolados
              por conta
            </span>
            <span className="flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-brand-400" /> Conexão criptografada
            </span>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            © {new Date().getFullYear()} Pace Fit
          </p>
        </div>
      </div>

      {/* Painel direito — formulário limpo */}
      <div className="flex min-h-dvh items-center justify-center bg-white px-5 py-10 dark:bg-slate-950 lg:min-h-0">
        <div className="w-full max-w-sm">
          <Link
            href="/"
            className="mb-8 flex items-center justify-center gap-2.5 lg:hidden"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-[0_8px_20px_-8px_rgba(24,184,94,0.8)]">
              <Dumbbell className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              Pace Fit
            </span>
          </Link>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {mode === "login"
              ? "Bem-vindo de volta"
              : mode === "signup"
                ? "Crie sua conta"
                : "Recuperar senha"}
          </h1>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
            {mode === "login"
              ? "Entre para continuar sua evolução."
              : mode === "signup"
                ? "Comece a acompanhar sua evolução hoje."
                : "Enviaremos um link para você redefinir a senha."}
          </p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            {mode === "signup" && (
              <>
                <div>
                  <label className="label">Nome</label>
                  <input
                    className="input"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Seu nome"
                  />
                </div>
                <div>
                  <label className="label">CPF</label>
                  <input
                    className="input"
                    type="text"
                    inputMode="numeric"
                    value={cpf}
                    onChange={(e) => setCpf(formatCPF(e.target.value))}
                    placeholder="000.000.000-00"
                    maxLength={14}
                    required
                  />
                </div>
              </>
            )}
            <div>
              <label className="label">E-mail</label>
              <input
                className="input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@email.com"
              />
            </div>
            {mode !== "recover" && (
              <div>
                <div className="flex items-center justify-between">
                  <label className="label">Senha</label>
                  {mode === "login" && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode("recover");
                        setError(null);
                        setMessage(null);
                      }}
                      className="mb-1.5 text-xs font-medium text-brand-700 hover:underline dark:text-brand-400"
                    >
                      Esqueci a senha
                    </button>
                  )}
                </div>
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
                    aria-label={showPw ? "Ocultar senha" : "Mostrar senha"}
                    tabIndex={-1}
                  >
                    {showPw ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
                {error}
              </p>
            )}
            {message && (
              <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700 dark:bg-brand-950/40 dark:text-brand-300">
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 text-base"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  {mode === "login"
                    ? "Entrar"
                    : mode === "signup"
                      ? "Criar conta"
                      : "Enviar link de redefinição"}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
            {mode === "login" ? (
              <>
                Não tem conta?{" "}
                <button
                  onClick={() => {
                    setMode("signup");
                    setError(null);
                    setMessage(null);
                  }}
                  className="font-semibold text-brand-700 hover:underline dark:text-brand-400"
                >
                  Criar agora
                </button>
              </>
            ) : mode === "signup" ? (
              <>
                Já tem conta?{" "}
                <button
                  onClick={() => {
                    setMode("login");
                    setError(null);
                    setMessage(null);
                  }}
                  className="font-semibold text-brand-700 hover:underline dark:text-brand-400"
                >
                  Entrar
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  setMode("login");
                  setError(null);
                  setMessage(null);
                }}
                className="font-semibold text-brand-700 hover:underline dark:text-brand-400"
              >
                ← Voltar para o login
              </button>
            )}
          </div>

          {/* Confiança (mobile) */}
          <div className="mt-8 flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-slate-400 lg:hidden dark:text-slate-500">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" />
              Dados isolados
            </span>
            <span className="flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" />
              Criptografia
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}

function onlyDigits(s: string) {
  return s.replace(/\D/g, "");
}

function formatCPF(v: string) {
  const d = onlyDigits(v).slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function validateCPF(value: string) {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false; // todos iguais
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cpf[i]) * (10 - i);
  let d1 = (sum * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== parseInt(cpf[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cpf[i]) * (11 - i);
  let d2 = (sum * 10) % 11;
  if (d2 === 10) d2 = 0;
  return d2 === parseInt(cpf[10]);
}

const ERRO_GENERICO =
  "Não foi possível completar a ação. Tente novamente em alguns instantes.";

// Só mostramos ao usuário um texto que pareça uma frase. O Supabase às vezes
// devolve o corpo cru da resposta como mensagem (ex.: "{}" num erro 500), e
// isso não pode vazar para a tela.
function mensagemLegivel(msg: string): boolean {
  const t = msg.trim();
  if (t.length < 4) return false;
  if (/^[[{<]/.test(t)) return false; // JSON ou HTML cru
  return /[a-zA-ZÀ-ÿ]{3}/.test(t);
}

function traduzErro(err: any): string {
  const raw = typeof err === "string" ? err : (err?.message ?? "");
  const status = Number(err?.status) || 0;
  const m = String(raw).toLowerCase();

  if (m.includes("invalid login credentials"))
    return "E-mail ou senha incorretos.";
  if (m.includes("user already registered"))
    return "Este e-mail já está cadastrado.";
  if (m.includes("password should be at least"))
    return "A senha deve ter pelo menos 6 caracteres.";
  if (m.includes("email not confirmed"))
    return "Confirme seu e-mail antes de entrar.";
  if (m.includes("email rate limit") || m.includes("too many"))
    return "Muitas tentativas seguidas. Espere um minuto e tente de novo.";
  if (m.includes("failed to fetch") || m.includes("networkerror"))
    return "Sem conexão com o servidor. Verifique sua internet.";
  if (m.includes("database error"))
    return "Não foi possível criar a conta. Verifique se o CPF ou e-mail já está cadastrado.";

  // 5xx: problema do lado do servidor de autenticação, não do que foi digitado.
  if (status >= 500)
    return "O servidor de autenticação falhou (erro " + status + "). Tente novamente em instantes.";

  return mensagemLegivel(String(raw)) ? String(raw) : ERRO_GENERICO;
}
