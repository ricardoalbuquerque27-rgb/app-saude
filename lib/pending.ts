import { todayISO } from "@/lib/date";

// Pendências do usuário — coisas que faltam preencher/fazer. Usado para
// sinalizar na navegação (pontinho) e nas linhas do "Para hoje" da Início.

export type PendingItem = {
  key: string;
  label: string;
  description: string;
  href: string;
  urgent?: boolean;
};

/**
 * `falhou`: alguma leitura daqui falhou. O supabase-js devolve
 * `{ data: null, error }` sem lançar, e com o perfil nulo as duas primeiras
 * pendências ("Complete seu perfil", "Defina suas metas") apareciam para quem
 * já tinha preenchido tudo; com o tratamento nulo, a dose sumia calada. Agora
 * a leitura que falha não gera pendência nenhuma (nem "tem", nem "não tem") e
 * o "Para hoje" da Início diz "Não deu para carregar tudo" em vez de "em dia"
 * (CLAUDE.md, "Leitura que falha não é 'não tem'").
 */
export type Pending = { items: PendingItem[]; hrefs: string[]; falhou: boolean };

export async function getPending(supabase: any, uid: string): Promise<Pending> {
  const today = todayISO();

  const [profRes, treatRes] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "sex, birth_date, height_cm, weight_goal_kg, daily_calorie_goal, protein_goal_g"
      )
      .eq("id", uid)
      .maybeSingle(),
    supabase
      .from("treatments")
      .select("id, next_dose_date")
      .eq("user_id", uid)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const p = profRes.data;
  const items: PendingItem[] = [];
  let falhou = !!profRes.error || !!treatRes.error;

  const perfilIncompleto = !profRes.error && (!p?.sex || !p?.birth_date || !p?.height_cm);
  if (perfilIncompleto) {
    items.push({
      key: "perfil",
      label: "Complete seu perfil",
      description:
        "Informe sexo, altura e data de nascimento — ajuda a IA a acertar suas metas.",
      href: "/app/perfil",
    });
  }

  const metasFaltando =
    !profRes.error &&
    (p?.daily_calorie_goal == null ||
      p?.protein_goal_g == null ||
      p?.weight_goal_kg == null);
  if (metasFaltando) {
    items.push({
      key: "metas",
      label: "Defina suas metas",
      description: "Calorias, proteína e peso alvo para acompanhar seu progresso.",
      href: "/app/perfil",
    });
  }

  // Dose da caneta prevista para hoje (ou atrasada) e ainda não aplicada.
  const treat = treatRes.data;
  if (treat?.next_dose_date && treat.next_dose_date <= today) {
    const { data: doseHoje, error: erroDaDose } = await supabase
      .from("dose_logs")
      .select("id")
      .eq("user_id", uid)
      .eq("treatment_id", treat.id)
      .eq("date", today)
      .limit(1);
    if (erroDaDose) falhou = true;
    else if ((doseHoje ?? []).length === 0) {
      const atrasada = treat.next_dose_date < today;
      items.push({
        key: "dose",
        label: atrasada ? "Aplicação da caneta atrasada" : "Aplique sua caneta hoje",
        description: atrasada
          ? "Sua dose estava prevista e ainda não foi registrada."
          : "Sua dose está prevista para hoje. Toque para registrar.",
        href: "/app/tratamento",
        urgent: true,
      });
    }
  }

  const hrefs = Array.from(new Set(items.map((i) => i.href)));
  return { items, hrefs, falhou };
}
