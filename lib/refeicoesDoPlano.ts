import { naJanela, todayISO } from "@/lib/date";

// A resposta a uma refeição do cardápio ("comi" / "não comi"), numa regra só:
// os botões da Dieta e de Meu plano chamam `marcarRefeicao` direto, com o
// cliente do navegador, e o botão da notificação chama a rota
// /api/refeicoes/marcar, que chama a mesma função com a sessão do cookie
// (spec dos lembretes das refeições, "O que os botões gravam").
//
// A resposta mora em meal_checks, uma por refeição e por dia; "done" é comi,
// "skipped" é não comi, e nenhuma linha é sem resposta. Quando o "Comi" grava
// a refeição (opção única, ou "Foi esta"), a resposta aponta para ela em
// meal_id, e trocar ou desfazer a resposta apaga essa refeição, e só ela: é a
// regra do "Fui" do treino (setPlanCheck).
//
// A ordem das escritas é de propósito: a refeição antiga sai PRIMEIRO, depois
// vem a nova e a resposta. Se a segunda escrita falha, tentar de novo chega ao
// mesmo fim (sem a refeição, a resposta aponta para nada e o meal_id vira
// nulo); na ordem inversa, sobraria uma refeição que nenhuma resposta aponta,
// contada no dia e invisível ao "Desfazer". E o "Comi" sem dizer a opção, numa
// refeição já registrada à mão (pelo formulário, depois que a notificação
// chegou), grava só a resposta: gravar a opção lançaria o almoço duas vezes.

export const ERRO_AO_MARCAR = "Não foi possível salvar. Tente de novo.";
export const ERRO_DATA_FORA = "Essa refeição é de mais de 7 dias.";
export const ERRO_REFEICAO_FORA = "Essa refeição não está no seu cardápio.";

export type RespostaDaRefeicao = "comi" | "nao_comi" | "desfazer";
const RESPOSTAS: RespostaDaRefeicao[] = ["comi", "nao_comi", "desfazer"];

export type PedidoDeMarcacao = {
  data: string;
  refeicao: string;
  resposta: RespostaDaRefeicao;
  /** A opção do cardápio ("Comi isso", "Foi esta"); sem ela, o "Comi" decide. */
  itemId?: string | null;
};

export type ResultadoDaMarcacao = { ok: true } | { ok: false; erro: string; invalido: boolean };

const falha = (): ResultadoDaMarcacao => ({ ok: false, erro: ERRO_AO_MARCAR, invalido: false });
const recusa = (erro: string): ResultadoDaMarcacao => ({ ok: false, erro, invalido: true });

/** "AAAA-MM-DD" que existe no calendário ("2026-02-30" não). */
function ehDataISO(s: unknown): s is string {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [a, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d));
  return dt.getUTCFullYear() === a && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/**
 * Hoje e os 6 dias antes, em São Paulo: uma notificação velha, tocada uma
 * semana depois, não grava num dia de que a pessoa já não lembra.
 */
export function podeMarcar(data: string, hoje: string): boolean {
  return ehDataISO(data) && naJanela(data, hoje, 7);
}

/** O corpo do POST da rota, validado; nulo se não é um pedido. */
export function lerPedido(corpo: unknown): PedidoDeMarcacao | null {
  if (!corpo || typeof corpo !== "object") return null;
  const c = corpo as Record<string, unknown>;
  if (!ehDataISO(c.data)) return null;
  if (typeof c.refeicao !== "string") return null;
  const refeicao = c.refeicao.trim();
  if (refeicao.length < 1 || refeicao.length > 200) return null;
  if (!RESPOSTAS.includes(c.resposta as RespostaDaRefeicao)) return null;
  if (c.itemId != null && typeof c.itemId !== "string") return null;
  return { data: c.data, refeicao, resposta: c.resposta as RespostaDaRefeicao, itemId: (c.itemId as string | null) ?? null };
}

type Opcao = {
  id: string;
  description: string;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
};

/**
 * Grava (ou desfaz) a resposta de uma refeição do cardápio num dia. Tudo ou
 * nada: se a refeição não grava, a resposta também não fica.
 */
export async function marcarRefeicao(
  supabase: any,
  uid: string,
  pedido: PedidoDeMarcacao,
  hoje: string = todayISO()
): Promise<ResultadoDaMarcacao> {
  const { data, refeicao, resposta } = pedido;
  const itemId = pedido.itemId ?? null;
  if (!podeMarcar(data, hoje)) return recusa(ERRO_DATA_FORA);

  // O cardápio que vale é o ativo mais novo, o mesmo que a Dieta mostra.
  const plano = await supabase
    .from("meal_plans")
    .select("id")
    .eq("patient_id", uid)
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (plano.error) return falha();
  if (!plano.data) return recusa(ERRO_REFEICAO_FORA);

  const itens = await supabase
    .from("meal_plan_items")
    .select("id, description, calories, protein_g, carbs_g, fat_g")
    .eq("meal_plan_id", plano.data.id)
    .eq("meal_type", refeicao)
    .order("position", { ascending: true });
  if (itens.error) return falha();
  const opcoes = (itens.data ?? []) as Opcao[];
  if (opcoes.length === 0) return recusa(ERRO_REFEICAO_FORA);
  const escolhida = itemId == null ? null : opcoes.find((o) => o.id === itemId) ?? null;
  if (itemId != null && !escolhida) return recusa(ERRO_REFEICAO_FORA);

  const atualRes = await supabase
    .from("meal_checks")
    .select("id, status, meal_id")
    .eq("user_id", uid)
    .eq("date", data)
    .eq("meal_type", refeicao)
    .maybeSingle();
  if (atualRes.error) return falha();
  const atual = atualRes.data as { id: string; status: string; meal_id: string | null } | null;

  const apagarRefeicao = async (id: string) =>
    !(await supabase.from("meals").delete().eq("id", id).eq("user_id", uid)).error;
  const gravarResposta = async (status: "done" | "skipped", mealId: string | null) =>
    !(
      await supabase
        .from("meal_checks")
        .upsert(
          { user_id: uid, date: data, meal_type: refeicao, status, meal_id: mealId },
          { onConflict: "user_id,date,meal_type" }
        )
    ).error;

  if (resposta === "desfazer") {
    if (!atual) return { ok: true };
    if (atual.meal_id && !(await apagarRefeicao(atual.meal_id))) return falha();
    const { error } = await supabase.from("meal_checks").delete().eq("id", atual.id).eq("user_id", uid);
    return error ? falha() : { ok: true };
  }

  if (resposta === "nao_comi") {
    if (atual?.status === "skipped") return { ok: true };
    if (atual?.meal_id && !(await apagarRefeicao(atual.meal_id))) return falha();
    return (await gravarResposta("skipped", null)) ? { ok: true } : falha();
  }

  // "comi"
  let opcao = escolhida;
  if (!opcao) {
    if (atual?.status === "done") return { ok: true };
    if (opcoes.length === 1) {
      const mesmas = await supabase
        .from("meals")
        .select("id")
        .eq("user_id", uid)
        .eq("date", data)
        .eq("meal_type", refeicao)
        .limit(1);
      if (mesmas.error) return falha();
      if ((mesmas.data ?? []).length === 0) opcao = opcoes[0];
    }
    if (!opcao) return (await gravarResposta("done", null)) ? { ok: true } : falha();
  }

  if (atual?.meal_id && !(await apagarRefeicao(atual.meal_id))) return falha();
  const nova = await supabase
    .from("meals")
    .insert({
      user_id: uid,
      date: data,
      meal_type: refeicao,
      description: opcao.description,
      calories: opcao.calories,
      protein_g: opcao.protein_g,
      carbs_g: opcao.carbs_g,
      fat_g: opcao.fat_g,
    })
    .select("id")
    .single();
  const novaId = (nova.data as { id: string } | null)?.id ?? null;
  if (nova.error || !novaId) return falha();
  if (await gravarResposta("done", novaId)) return { ok: true };
  await apagarRefeicao(novaId);
  return falha();
}

// ---------------------------------------------------------------------------
// O que a tela mostra em cada refeição do plano

export type RespostaGravada = { meal_type: string; status: "done" | "skipped"; meal_id: string | null };

export type EstadoDaRefeicao =
  | { tipo: "sem_resposta" }
  /** Registrada (à mão, ou por um "Comi isso" de antes das respostas) e sem resposta. */
  | { tipo: "registrada"; opcaoId: string | null }
  | { tipo: "comi"; opcaoId: string | null }
  /** "Comi" pela notificação, numa refeição com mais de uma opção. */
  | { tipo: "qual_opcao" }
  | { tipo: "nao_comi" };

const mesma = (a: string, b: string) => a.trim() === b.trim();

/**
 * O estado de uma refeição do plano num dia. `registradas` são as refeições
 * do dia DESSE tipo. Qual opção foi vem da descrição: a da refeição ligada à
 * resposta, quando há, senão a de qualquer refeição do tipo (as de antes das
 * respostas). Se o nutricionista editou a opção, a refeição continua "comi",
 * só sem dizer qual.
 */
export function estadoDaRefeicao(e: {
  opcoes: { id: string; description: string }[];
  resposta: RespostaGravada | null;
  registradas: { id: string; description: string }[];
}): EstadoDaRefeicao {
  const opcaoDe = (descricoes: string[]) =>
    e.opcoes.find((o) => descricoes.some((d) => mesma(d, o.description)))?.id ?? null;

  if (e.resposta?.status === "skipped") return { tipo: "nao_comi" };
  if (e.resposta?.status === "done") {
    const ligada = e.resposta.meal_id ? e.registradas.find((r) => r.id === e.resposta!.meal_id) : undefined;
    if (ligada) return { tipo: "comi", opcaoId: opcaoDe([ligada.description]) };
    // Sem a ligada, mas com o registro à mão: "Qual opção?" convidaria a lançar de novo.
    if (e.registradas.length > 0) return { tipo: "comi", opcaoId: opcaoDe(e.registradas.map((r) => r.description)) };
    return { tipo: "qual_opcao" };
  }
  if (e.registradas.length > 0) return { tipo: "registrada", opcaoId: opcaoDe(e.registradas.map((r) => r.description)) };
  return { tipo: "sem_resposta" };
}

/** A data que a Dieta abre pelo `?data=` (da notificação): até hoje; o resto é hoje. */
export function dataDaDieta(param: string | null, hoje: string): string {
  return ehDataISO(param) && param <= hoje ? param : hoje;
}
