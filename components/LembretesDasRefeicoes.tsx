"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { meuPerfil } from "@/lib/perfil";
import { tiposDoCardapio } from "@/lib/cardapio";
import { pushConfigurado } from "@/lib/vapidPublicKey";
import { ensurePushSubscription, pushSupported } from "@/lib/pushClient";
import {
  horariosDoPaciente,
  horariosParaGravar,
  situacaoDosLembretes,
  type SituacaoDosLembretes,
} from "@/lib/lembretesDasRefeicoes";
import { PassosDoIphone, abertoNaTelaDeInicio, ehIphone } from "@/components/PassosDoIphone";

// Os lembretes das refeições, no Perfil do paciente (spec dos lembretes das
// refeições, "Os horários, no Perfil"): a chave e um horário por refeição do
// cardápio, já com o sugerido. O que aparece vem de `situacaoDosLembretes`.
//
// Desligar só grava a coluna: a inscrição de push serve também ao lembrete
// diário e ao da caneta.

type Lido = {
  ligado: boolean;
  salvos: Record<string, unknown>;
  tipos: string[];
  temCardapio: boolean;
  falhou: boolean;
};

const ERRO_AO_SALVAR = "Não foi possível salvar. Tente de novo.";

const FRASE: Partial<Record<SituacaoDosLembretes, string>> = {
  em_breve: "Os lembretes das refeições chegam em breve.",
  falhou: "Não deu para carregar os lembretes das refeições.",
  sem_cardapio: "Os lembretes das refeições seguem o cardápio da sua nutricionista.",
  iphone_fora: "No iPhone, os lembretes só chegam com o app na Tela de Início.",
  sem_suporte: "Este navegador não mostra notificações.",
};

export default function LembretesDasRefeicoes() {
  const [lido, setLido] = useState<Lido | null>(null);
  const [ambiente, setAmbiente] = useState<{ ios: boolean; standalone: boolean; suportado: boolean } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLido({ ligado: false, salvos: {}, tipos: [], temCardapio: false, falhou: true });
      return;
    }
    const [perfil, vinculo, plano] = await Promise.all([
      meuPerfil<{ meal_reminders_enabled: boolean | null; meal_reminder_times: Record<string, unknown> | null }>(
        supabase,
        "meal_reminders_enabled, meal_reminder_times"
      ),
      supabase.from("patient_links").select("id").eq("patient_id", user.id).eq("status", "active").limit(1).maybeSingle(),
      supabase
        .from("meal_plans")
        .select("id")
        .eq("patient_id", user.id)
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    const itens = plano.data
      ? await supabase.from("meal_plan_items").select("meal_type").eq("meal_plan_id", plano.data.id)
      : { data: [], error: null };
    // O perfil do próprio paciente sempre existe: nulo é a leitura que falhou.
    const falhou = !perfil || !!vinculo.error || !!plano.error || !!itens.error;
    const tipos = tiposDoCardapio((itens.data ?? []) as { meal_type: string }[]);
    setLido({
      ligado: !!perfil?.meal_reminders_enabled,
      salvos: (perfil?.meal_reminder_times ?? {}) as Record<string, unknown>,
      tipos,
      temCardapio: !!vinculo.data && tipos.length > 0,
      falhou,
    });
  }, []);

  useEffect(() => {
    setAmbiente({ ios: ehIphone(), standalone: abertoNaTelaDeInicio(), suportado: pushSupported() });
    if (pushConfigurado()) carregar();
  }, [carregar]);

  const situacao: SituacaoDosLembretes | null = !pushConfigurado()
    ? "em_breve"
    : !lido || !ambiente
      ? null
      : situacaoDosLembretes({ pushConfigurado: true, falhou: lido.falhou, temCardapio: lido.temCardapio, ...ambiente });

  async function gravar(mudanca: { meal_reminders_enabled?: boolean; meal_reminder_times?: Record<string, string> }) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    const { error } = await supabase.from("profiles").update(mudanca).eq("id", user.id);
    return !error;
  }

  async function alternar() {
    if (!lido || ocupado) return;
    setOcupado(true);
    setErro(null);
    try {
      if (lido.ligado) {
        if (await gravar({ meal_reminders_enabled: false })) setLido({ ...lido, ligado: false });
        else setErro(ERRO_AO_SALVAR);
        return;
      }
      const r = await ensurePushSubscription();
      if (r === "denied") {
        setErro("As notificações estão bloqueadas neste celular. Libere nos ajustes do navegador.");
        return;
      }
      if (r !== "ok") {
        setErro("Não foi possível ligar os lembretes. Tente de novo.");
        return;
      }
      if (await gravar({ meal_reminders_enabled: true })) setLido({ ...lido, ligado: true });
      else setErro(ERRO_AO_SALVAR);
    } finally {
      setOcupado(false);
    }
  }

  async function mudarHorario(refeicao: string, valor: string) {
    if (!lido) return;
    const novos = horariosParaGravar(lido.salvos, refeicao, valor);
    const antes = lido;
    setErro(null);
    setLido({ ...lido, salvos: novos });
    if (!(await gravar({ meal_reminder_times: novos }))) {
      setLido(antes);
      setErro(ERRO_AO_SALVAR);
    }
  }

  return (
    <section aria-labelledby="lembretes-refeicoes-titulo" className="card mt-6">
      <h2 id="lembretes-refeicoes-titulo" className="section-title">
        Lembretes das refeições
      </h2>

      {situacao == null ? (
        <p className="mt-2 flex items-center gap-2 text-sm text-app-texto-2">
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> Carregando…
        </p>
      ) : situacao !== "pronto" ? (
        <>
          <p className={`mt-1 text-sm ${situacao === "falhou" ? "text-app-atencao" : "text-app-texto-2"}`}>
            {FRASE[situacao]}
          </p>
          {situacao === "iphone_fora" && <PassosDoIphone />}
        </>
      ) : (
        <>
          <div className="mt-1 flex items-center justify-between gap-3">
            <p className="text-sm text-app-texto-2">
              No horário de cada refeição do seu cardápio, uma notificação pergunta se você comeu.
            </p>
            {/* 44×44 px de toque, a trilha de 44×24 no meio, como o lembrete diário. */}
            <button
              onClick={alternar}
              disabled={ocupado}
              role="switch"
              aria-checked={lido!.ligado}
              aria-label="Lembretes das refeições"
              className="tappable -my-2 flex h-11 w-11 shrink-0 items-center rounded-full disabled:opacity-50"
            >
              <span className={`relative h-6 w-11 rounded-full transition ${lido!.ligado ? "bg-app-primaria" : "bg-app-campo"}`}>
                {ocupado ? (
                  <Loader2 className="absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 animate-spin text-app-texto" />
                ) : (
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-app-cartao transition ${
                      lido!.ligado ? "left-[22px]" : "left-0.5"
                    }`}
                  />
                )}
              </span>
            </button>
          </div>

          <ul className="mt-3 divide-y divide-app-linha border-t border-app-linha">
            {horariosDoPaciente(lido!.tipos, lido!.salvos).map((h) => (
              <li key={h.refeicao} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2">
                <label htmlFor={`horario-${h.refeicao}`} className="min-w-0 text-[15px] text-app-texto">
                  {h.refeicao}
                </label>
                <div className="flex items-center gap-2">
                  {h.horario == null && <span className="text-[13px] text-app-texto-2">sem lembrete</span>}
                  {/* O input muda a cada tecla e grava ao sair do campo. */}
                  <input
                    id={`horario-${h.refeicao}`}
                    type="time"
                    defaultValue={h.horario ?? ""}
                    key={`${h.refeicao}-${h.horario ?? ""}`}
                    onBlur={(e) => {
                      if (e.target.value !== (h.horario ?? "")) mudarHorario(h.refeicao, e.target.value);
                    }}
                    className="input tabular min-h-[44px] w-auto"
                  />
                  {h.mudado && (
                    <button
                      onClick={() => mudarHorario(h.refeicao, h.sugerido ?? "")}
                      className="tappable inline-flex min-h-[44px] items-center text-[13px] font-medium text-app-primaria hover:underline"
                    >
                      Voltar ao sugerido
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {erro && (
        <p role="alert" className="mt-2 text-sm text-app-perigo">
          {erro}
        </p>
      )}
    </section>
  );
}
