import { todayISO } from "@/lib/date";

// Pendências do usuário — coisas que faltam preencher/fazer. Usado para
// sinalizar na navegação (pontinho) e num card de pendências no dashboard.

export type PendingItem = {
  key: string;
  label: string;
  description: string;
  href: string;
  urgent?: boolean;
};

export type Pending = { items: PendingItem[]; hrefs: string[] };

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

  const perfilIncompleto = !p?.sex || !p?.birth_date || !p?.height_cm;
  if (perfilIncompleto) {
    items.push({
      key: "perfil",
      label: "Complete seu perfil",
      description:
        "Informe sexo, altura e data de nascimento — ajuda a IA a acertar suas metas e a leitura dos exames.",
      href: "/app/perfil",
    });
  }

  const metasFaltando =
    p?.daily_calorie_goal == null ||
    p?.protein_goal_g == null ||
    p?.weight_goal_kg == null;
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
    const { data: doseHoje } = await supabase
      .from("dose_logs")
      .select("id")
      .eq("user_id", uid)
      .eq("treatment_id", treat.id)
      .eq("date", today)
      .limit(1);
    if ((doseHoje ?? []).length === 0) {
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
  return { items, hrefs };
}
