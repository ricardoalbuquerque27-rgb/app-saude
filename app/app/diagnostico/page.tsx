"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Bot,
  Camera,
  Database,
  Bell,
  Clock,
} from "lucide-react";
import { PageHeader } from "@/components/ui";

type Diag = {
  checkedAt: string;
  groq: { present: boolean; status: string; model: string };
  gemini: { present: boolean; model: string };
  supabase: { url: boolean; anon: boolean };
  push: { publicKey: boolean; privateKey: boolean; subject: boolean };
  cron: { present: boolean };
};

type Level = "ok" | "warn" | "error";

const STYLES: Record<Level, { icon: any; cls: string; badge: string }> = {
  ok: {
    icon: CheckCircle2,
    cls: "text-brand-600 dark:text-brand-400",
    badge:
      "bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300",
  },
  warn: {
    icon: AlertTriangle,
    cls: "text-amber-600 dark:text-amber-400",
    badge:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  },
  error: {
    icon: XCircle,
    cls: "text-rose-600 dark:text-rose-400",
    badge: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  },
};

function Row({
  icon: Icon,
  title,
  desc,
  level,
  status,
  hint,
}: {
  icon: any;
  title: string;
  desc: string;
  level: Level;
  status: string;
  hint?: string;
}) {
  const s = STYLES[level];
  const StatusIcon = s.icon;
  return (
    <div className="flex items-start gap-3 border-b border-slate-100 py-3.5 last:border-0 dark:border-white/[0.06]">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-slate-900 dark:text-white">{title}</p>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.badge}`}
          >
            <StatusIcon className="h-3 w-3" /> {status}
          </span>
        </div>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{desc}</p>
        {hint && level !== "ok" && (
          <p className={`mt-1 text-xs ${s.cls}`}>{hint}</p>
        )}
      </div>
    </div>
  );
}

export default function DiagnosticoPage() {
  const [data, setData] = useState<Diag | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const check = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/diag", { cache: "no-store" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d?.error ?? "Falha ao carregar o diagnóstico.");
        return;
      }
      setData(await res.json());
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  // Deriva o estado de cada item a partir da resposta.
  function rows(d: Diag) {
    const groq: { level: Level; status: string; hint?: string } =
      d.groq.status === "ok"
        ? { level: "ok", status: "Funcionando" }
        : d.groq.status === "invalid"
          ? {
              level: "error",
              status: "Chave inválida",
              hint: "A GROQ_API_KEY existe, mas foi recusada. Gere uma nova em console.groq.com e atualize na Vercel.",
            }
          : d.groq.status === "unreachable"
            ? {
                level: "warn",
                status: "Não verificada",
                hint: "A chave está presente, mas não consegui confirmar agora. Tente novamente em instantes.",
              }
            : {
                level: "error",
                status: "Não configurada",
                hint: "Sem a GROQ_API_KEY o chat e as ações da IA não funcionam. Adicione na Vercel › Settings › Environment Variables e faça Redeploy.",
              };

    const supaOk = d.supabase.url && d.supabase.anon;
    const push =
      d.push.publicKey && d.push.privateKey
        ? { level: "ok" as Level, status: "Configurado" }
        : d.push.publicKey || d.push.privateKey
          ? {
              level: "warn" as Level,
              status: "Incompleto",
              hint: "Faltam chaves VAPID. Precisa de NEXT_PUBLIC_VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY para o push funcionar.",
            }
          : {
              level: "warn" as Level,
              status: "Opcional",
              hint: "Notificações push desativadas. Configure as chaves VAPID para ativar lembretes com o app fechado.",
            };

    return { groq, supaOk, push };
  }

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Diagnóstico"
        subtitle="Confira se o app está configurado corretamente no servidor."
        action={
          <button
            onClick={check}
            disabled={loading}
            className="btn-ghost"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Verificar
          </button>
        }
      />

      {loading && !data ? (
        <div className="flex justify-center py-16 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : error ? (
        <div className="card">
          <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
        </div>
      ) : data ? (
        (() => {
          const r = rows(data);
          return (
            <>
              <div className="card">
                <Row
                  icon={Bot}
                  title="Assistente de IA (chat e ações)"
                  desc={`Groq · modelo ${data.groq.model}. Necessário para o chat e para registrar treinos, refeições etc.`}
                  level={r.groq.level}
                  status={r.groq.status}
                  hint={r.groq.hint}
                />
                <Row
                  icon={Camera}
                  title="Análise de foto e exame (IA)"
                  desc={`Gemini · modelo ${data.gemini.model}. Usado para estimar macros pela foto do prato e ler exames.`}
                  level={data.gemini.present ? "ok" : "warn"}
                  status={data.gemini.present ? "Configurada" : "Opcional"}
                  hint={
                    data.gemini.present
                      ? undefined
                      : "Sem GEMINI_API_KEY, a análise por foto/exame fica indisponível (o resto do app funciona)."
                  }
                />
                <Row
                  icon={Database}
                  title="Banco de dados (Supabase)"
                  desc="Conexão com os dados do usuário (login, treinos, dieta, etc.)."
                  level={r.supaOk ? "ok" : "error"}
                  status={r.supaOk ? "Conectado" : "Faltando"}
                  hint={
                    r.supaOk
                      ? undefined
                      : "Faltam NEXT_PUBLIC_SUPABASE_URL e/ou NEXT_PUBLIC_SUPABASE_ANON_KEY. O app não funciona sem isso."
                  }
                />
                <Row
                  icon={Bell}
                  title="Notificações push"
                  desc="Lembretes que chegam mesmo com o app fechado."
                  level={r.push.level}
                  status={r.push.status}
                  hint={r.push.hint}
                />
                <Row
                  icon={Clock}
                  title="Agendador de lembretes"
                  desc="Chave que protege o endpoint do agendador (pg_cron)."
                  level={data.cron.present ? "ok" : "warn"}
                  status={data.cron.present ? "Configurado" : "Opcional"}
                  hint={
                    data.cron.present
                      ? undefined
                      : "Sem CRON_SECRET, o disparo automático dos lembretes fica desprotegido/desativado."
                  }
                />
              </div>

              <p className="mt-3 text-center text-xs text-slate-400 dark:text-slate-500">
                Verificado em {new Date(data.checkedAt).toLocaleString("pt-BR")}.
                Os valores das chaves nunca são exibidos — apenas se existem.
              </p>
            </>
          );
        })()
      ) : null}
    </div>
  );
}
