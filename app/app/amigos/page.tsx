"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Users,
  Copy,
  Check,
  UserPlus,
  Loader2,
  Trophy,
  Crown,
  Flame,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

type Rank = {
  user_id: string;
  name: string;
  xp: number;
  level: number;
  is_me: boolean;
};
type Request = {
  id: string;
  requester: string;
  name: string;
  created_at: string;
};

const MEDALS = ["🥇", "🥈", "🥉"];

export default function AmigosPage() {
  const [myCode, setMyCode] = useState<string>("");
  const [ranking, setRanking] = useState<Rank[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const [code, setCode] = useState("");
  const [adding, setAdding] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const [codeRes, rankRes, reqRes] = await Promise.all([
      supabase.rpc("ensure_friend_code"),
      supabase.rpc("friends_leaderboard"),
      supabase.rpc("friend_requests_incoming"),
    ]);
    if (codeRes.data) setMyCode(codeRes.data as string);
    setRanking((rankRes.data as Rank[]) ?? []);
    setRequests((reqRes.data as Request[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(myCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  async function addFriend(e: React.FormEvent) {
    e.preventDefault();
    const clean = code.trim().toUpperCase();
    if (!clean || adding) return;
    setAdding(true);
    setFeedback(null);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("add_friend_by_code", {
      p_code: clean,
    });
    setAdding(false);

    if (error) {
      setFeedback({ type: "err", text: "Não foi possível adicionar. Tente de novo." });
      return;
    }
    const res = data as { status: string; name?: string };
    const name = res.name ?? "";
    switch (res.status) {
      case "sent":
        setFeedback({ type: "ok", text: `Pedido enviado para ${name}! 🎉` });
        setCode("");
        break;
      case "accepted":
        setFeedback({ type: "ok", text: `Vocês agora são amigos, ${name}! 🤝` });
        setCode("");
        await load();
        break;
      case "already":
        setFeedback({ type: "err", text: `Vocês já são amigos.` });
        break;
      case "pending":
        setFeedback({ type: "err", text: "Já existe um pedido pendente com essa pessoa." });
        break;
      case "self":
        setFeedback({ type: "err", text: "Esse é o seu próprio código 🙂" });
        break;
      default:
        setFeedback({ type: "err", text: "Código não encontrado. Confira e tente de novo." });
    }
  }

  async function respond(id: string, accept: boolean) {
    const supabase = createClient();
    setRequests((prev) => prev.filter((r) => r.id !== id));
    await supabase.rpc("respond_friend_request", { p_id: id, p_accept: accept });
    if (accept) await load();
  }

  async function removeFriend(userId: string, name: string) {
    if (!confirm(`Remover ${name} dos seus amigos?`)) return;
    const supabase = createClient();
    setRanking((prev) => prev.filter((r) => r.user_id !== userId));
    await supabase.rpc("remove_friend", { p_friend: userId });
    await load();
  }

  const soloRanking = ranking.length <= 1;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Amigos"
        subtitle="Adicione amigos e dispute o ranking de XP."
      />

      {/* Meu código */}
      <div className="card">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Seu código de amigo
        </p>
        <div className="mt-2 flex items-center gap-2">
          <code className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-2xl font-bold tracking-[0.3em] text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white">
            {myCode || "······"}
          </code>
          <button
            onClick={copyCode}
            disabled={!myCode}
            className="btn-ghost h-[52px] w-[52px] shrink-0 justify-center"
            aria-label="Copiar código"
          >
            {copied ? (
              <Check className="h-5 w-5 text-brand-600" />
            ) : (
              <Copy className="h-5 w-5" />
            )}
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Compartilhe esse código com seus amigos para eles te adicionarem.
        </p>
      </div>

      {/* Adicionar amigo */}
      <div className="card">
        <div className="mb-3 flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-brand-600 dark:text-brand-400" />
          <h2 className="font-semibold text-slate-900 dark:text-white">
            Adicionar amigo
          </h2>
        </div>
        <form onSubmit={addFriend} className="flex gap-2">
          <input
            className="input flex-1 uppercase tracking-widest"
            placeholder="Código do amigo"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={6}
          />
          <button
            type="submit"
            disabled={adding || !code.trim()}
            className="btn-primary px-4"
          >
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : "Adicionar"}
          </button>
        </form>
        {feedback && (
          <p
            className={`mt-3 rounded-lg px-3 py-2 text-sm ${
              feedback.type === "ok"
                ? "bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300"
                : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
            }`}
          >
            {feedback.text}
          </p>
        )}
      </div>

      {/* Pedidos recebidos */}
      {requests.length > 0 && (
        <div className="card">
          <h2 className="mb-3 font-semibold text-slate-900 dark:text-white">
            Pedidos de amizade ({requests.length})
          </h2>
          <ul className="space-y-2">
            {requests.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 dark:border-white/[0.05] dark:bg-slate-800/40"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                  {r.name.charAt(0).toUpperCase()}
                </div>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                  {r.name}
                </span>
                <button
                  onClick={() => respond(r.id, true)}
                  className="btn-primary h-9 px-3 text-sm"
                >
                  Aceitar
                </button>
                <button
                  onClick={() => respond(r.id, false)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-700"
                  aria-label="Recusar"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Ranking */}
      <div className="card">
        <div className="mb-4 flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-500" />
          <h2 className="font-semibold text-slate-900 dark:text-white">Ranking</h2>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
          </div>
        ) : (
          <>
            <ul className="space-y-2">
              {ranking.map((r, i) => (
                <li
                  key={r.user_id}
                  className={`group flex items-center gap-3 rounded-xl border p-3 ${
                    r.is_me
                      ? "border-brand-200 bg-brand-50/70 dark:border-brand-800/60 dark:bg-brand-950/30"
                      : "border-slate-100 bg-white dark:border-white/[0.05] dark:bg-slate-900"
                  }`}
                >
                  <div className="w-7 shrink-0 text-center text-lg font-bold">
                    {MEDALS[i] ?? (
                      <span className="text-sm text-slate-400">{i + 1}</span>
                    )}
                  </div>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-sm font-bold text-white">
                    {r.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {r.name}
                      {r.is_me && (
                        <span className="rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] font-bold text-brand-700 dark:bg-brand-900/50 dark:text-brand-300">
                          você
                        </span>
                      )}
                      {i === 0 && ranking.length > 1 && (
                        <Crown className="h-3.5 w-3.5 text-amber-500" />
                      )}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Nível {r.level}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      {r.xp}
                    </p>
                    <p className="text-[11px] text-slate-400">XP</p>
                  </div>
                  {!r.is_me && (
                    <button
                      onClick={() => removeFriend(r.user_id, r.name)}
                      className="shrink-0 rounded-lg p-1.5 text-slate-300 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 dark:hover:bg-red-950/30"
                      aria-label="Remover amigo"
                      title="Remover amigo"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>

            {soloRanking && (
              <p className="mt-4 flex items-center gap-1.5 rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-500 dark:bg-slate-800/40 dark:text-slate-400">
                <Flame className="h-4 w-4 shrink-0 text-amber-500" />
                Adicione amigos pelo código para começar a competir no ranking!
              </p>
            )}
          </>
        )}
      </div>

      <p className="text-center text-[11px] text-slate-400 dark:text-slate-500">
        O ranking usa o XP de cada pessoa. Seus dados de saúde continuam privados.
      </p>
    </div>
  );
}
