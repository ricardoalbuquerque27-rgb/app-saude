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
import {
  AJUDA_DA_SENHA,
  SENHA_MINIMO,
  ehErroDeSenhaFraca,
  problemaDaSenha,
} from "@/lib/senha";

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

  // Senha recusada (pela regra do app ou pelo Supabase) não ganha uma segunda
  // caixa com a mesma frase: a ajuda fixa embaixo do campo muda de cor, e a
  // frase não aparece duas vezes na tela. Só no cadastro, único modo em que
  // essa ajuda existe; fora dele, o erro segue na caixa de sempre.
  const ajudaEmDestaque = mode === "signup" && error === AJUDA_DA_SENHA;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const supabase = createClient();

    // E-mail colado traz espaço no fim com frequência, e o servidor de
    // autenticação então NÃO ENCONTRA a conta — devolvendo "credenciais
    // inválidas", que manda a pessoa procurar erro na senha. Normalizar aqui
    // (minúsculas é como o e-mail fica guardado) evita esse beco sem saída.
    // A SENHA não é tocada: espaço nela pode ser proposital.
    const emailLimpo = email.trim().toLowerCase();

    try {
      if (mode === "recover") {
        const { error } = await supabase.auth.resetPasswordForEmail(emailLimpo, {
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
        // Antes da consulta do CPF e do signUp: senha que a regra recusa não
        // gasta ida ao servidor, e o erro de lá viria em inglês.
        const problemaSenha = problemaDaSenha(password);
        if (problemaSenha) {
          setError(problemaSenha);
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
          email: emailLimpo,
          password,
          options: { data: { full_name: fullName, cpf: cpfDigits } },
        });
        if (error) throw error;
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          // Mesmo motivo do login: navegação dura ao trocar de sessão.
          window.location.assign("/app");
        } else {
          setMessage(
            "Cadastro criado! Verifique seu e-mail para confirmar a conta e depois faça login."
          );
          setMode("login");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: emailLimpo,
          password,
        });
        if (error) throw error;
        // Navegação DURA de propósito. router.push usa o Router Cache do
        // Next, que ainda guarda a renderização da sessão anterior — foi
        // assim que um login de paciente caiu no painel do nutricionista.
        // Trocar de conta tem que descartar tudo que foi renderizado para a
        // conta antiga, e só um carregamento completo garante isso.
        window.location.assign("/app");
      }
    } catch (err: any) {
      setError(traduzErro(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-dvh lg:grid lg:grid-cols-2">
      {/* Painel esquerdo (somente desktop): uma superfície lisa em
          `primaria-fundo`. Antes era um bloco escuro com dois brilhos verdes
          de canto, uma grade de linhas, a marca com degradê e sombra verde e a
          palavra "evolução" com degradê no texto: tudo enfeite (a spec tira
          degradê e brilho). Os pares de texto são os da
          paleta, todos com 4,5:1 ou mais sobre `primaria-fundo`, nos dois temas
          (lib/temaApp.ts, PARES_TEXTO_APP). */}
      <div className="hidden bg-app-primaria-fundo p-12 lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-app-primaria text-app-sobre-primaria">
            <Dumbbell className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold text-app-texto">Pace Fit</span>
        </div>

        <div>
          <h2 className="text-4xl font-semibold leading-[1.1] text-app-texto xl:text-5xl">
            Supere seus limites.
            <br />
            Acompanhe cada <span className="text-app-primaria">evolução</span>.
          </h2>
          <p className="mt-4 max-w-sm text-base text-app-texto-2">
            Treinos, dieta, hábitos e exames — com inteligência que trabalha por
            você.
          </p>

          <ul className="mt-8 space-y-3">
            {HIGHLIGHTS.map((h) => (
              <li key={h} className="flex items-center gap-3 text-sm text-app-texto">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-app-cartao text-app-primaria">
                  <Check className="h-3.5 w-3.5" />
                </span>
                {h}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-app-texto-2">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-app-primaria" /> Dados isolados
              por conta
            </span>
            <span className="flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-app-primaria" /> Conexão criptografada
            </span>
          </div>
          <p className="mt-3 text-[13px] text-app-texto-2">
            © {new Date().getFullYear()} Pace Fit
          </p>
        </div>
      </div>

      {/* Painel direito — formulário limpo */}
      <div className="flex min-h-dvh items-center justify-center bg-app-pagina px-5 py-10 lg:min-h-0">
        <div className="w-full max-w-sm">
          <Link
            href="/"
            className="tappable mb-8 flex min-h-[44px] items-center justify-center gap-2.5 lg:hidden"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-app-primaria text-app-sobre-primaria">
              <Dumbbell className="h-5 w-5" />
            </div>
            <span className="text-lg font-semibold text-app-texto">Pace Fit</span>
          </Link>

          <h1 className="text-2xl font-semibold text-app-texto">
            {mode === "login"
              ? "Bem-vindo de volta"
              : mode === "signup"
                ? "Crie sua conta"
                : "Recuperar senha"}
          </h1>
          <p className="mt-1.5 text-sm text-app-texto-2">
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
                onBlur={() => setEmail((v) => v.trim().toLowerCase())}
                placeholder="voce@email.com"
              />
            </div>
            {mode !== "recover" && (
              <div>
                {/* No entrar, a linha do rótulo tem 44 px para o "Esqueci a senha" ter o
                    alvo inteiro, sem sobrepor nenhum vizinho: o `-mt-4` come o vão de
                    16 px do `space-y-4` (a linha encosta no campo de e-mail), o
                    rótulo e o link ficam colados ao campo da senha (`items-end`) e a
                    linha cresce só ~4 px. A linha tem 45 px e o link 44, com 1 px de
                    folga embaixo: o botão do olho do campo da senha tem 44 px sobre
                    um campo de 42 e invade 1 px para cima, e sem a folga ele comia o
                    último pixel do link. Antes eram margens negativas, e os 6 px do
                    botão sobre o campo da senha ficavam por baixo dele: só uns 38 px
                    respondiam ao toque. */}
                <div
                  className={
                    mode === "login"
                      ? "-mt-4 flex min-h-[45px] items-end justify-between"
                      : "flex items-center justify-between"
                  }
                >
                  <label className="label">Senha</label>
                  {mode === "login" && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode("recover");
                        setError(null);
                        setMessage(null);
                      }}
                      className="tappable mb-px flex h-11 items-end rounded-lg px-1 pb-[5px] text-[13px] font-medium text-app-primaria hover:underline"
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
                    // A regra nova vale só ao CRIAR a senha. No entrar o
                    // mínimo segue 6 (o de antes): quem tem senha antiga de 6
                    // ou 7 caracteres não pode ficar de fora de casa.
                    minLength={mode === "signup" ? SENHA_MINIMO : 6}
                    aria-describedby={
                      mode === "signup" ? "ajuda-da-senha" : undefined
                    }
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="tappable absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-app-texto-2 hover:text-app-texto"
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
                {mode === "signup" && (
                  // aria-live: a frase é a mesma antes e depois do erro, e
                  // leitor de tela só anuncia o que muda; o prefixo só para
                  // ele (sr-only) entra com o erro e faz a ajuda ser lida.
                  // `font-medium` junto da cor: cor sozinha não basta.
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
                )}
              </div>
            )}

            {error && !ajudaEmDestaque && (
              <p className="rounded-lg bg-app-perigo-fundo px-3 py-2 text-sm text-app-perigo">
                {error}
              </p>
            )}
            {message && (
              <p className="rounded-lg bg-app-primaria-fundo px-3 py-2 text-sm text-app-primaria">
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

          <div className="mt-6 text-center text-sm text-app-texto-2">
            {mode === "login" ? (
              <>
                Não tem conta?{" "}
                <button
                  onClick={() => {
                    setMode("signup");
                    setError(null);
                    setMessage(null);
                  }}
                  className="tappable inline-flex min-h-[44px] items-center rounded-lg px-1 font-semibold text-app-primaria hover:underline"
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
                  className="tappable inline-flex min-h-[44px] items-center rounded-lg px-1 font-semibold text-app-primaria hover:underline"
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
                className="tappable inline-flex min-h-[44px] items-center rounded-lg px-1 font-semibold text-app-primaria hover:underline"
              >
                ← Voltar para o login
              </button>
            )}
          </div>

          {/* Confiança (mobile) */}
          <div className="mt-8 flex flex-wrap justify-center gap-x-4 gap-y-2 text-[13px] text-app-texto-2 lg:hidden">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-app-primaria" />
              Dados isolados
            </span>
            <span className="flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-app-primaria" />
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
  // A regra é a de lib/senha.ts, a mesma do Supabase: o texto do servidor
  // (em inglês, e com o número dele) não serve para a tela.
  if (ehErroDeSenhaFraca(err)) return AJUDA_DA_SENHA;
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
