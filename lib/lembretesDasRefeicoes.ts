// Os lembretes das refeições (spec: docs/superpowers/specs/2026-10-27-lembretes-das-refeicoes-design.md):
// os horários, o texto da notificação e o que o bloco do Perfil mostra. Módulo
// puro: a rota do agendador, o Perfil e a Dieta leem daqui, e a regra se testa.
//
// A notificação leva os dois corpos, com e sem botões, porque quem sabe se há
// botão é o celular, na hora de mostrar (o service worker escolhe). E leva o
// texto da falha (`falha`): o public/sw.js é estático e não importa nada
// daqui, então a frase viaja pronta em vez de ganhar uma cópia lá.

/**
 * Os horários sugeridos. Estão também na migração
 * 20261027120000_lembretes_das_refeicoes (refeicoes_devidas_em): mudou um,
 * mude o outro. O teste lê a migração e confere.
 */
export const HORARIOS_SUGERIDOS: Readonly<Record<string, string>> = Object.freeze({
  "Café da manhã": "08:00",
  "Lanche da manhã": "10:00",
  Almoço: "12:30",
  "Lanche da tarde": "16:00",
  Jantar: "20:00",
  Ceia: "22:00",
});

/** O formato do horário, o mesmo texto da expressão da migração. */
export const FORMATO_DO_HORARIO = "^([01][0-9]|2[0-3]):[0-5][0-9]$";
const FORMATO = new RegExp(FORMATO_DO_HORARIO);

export function horarioValido(h: unknown): h is string {
  return typeof h === "string" && FORMATO.test(h);
}

/** Os horários que o paciente mudou, só os válidos. O resto do JSON não conta. */
function salvosValidos(salvos: unknown): Record<string, string> {
  if (!salvos || typeof salvos !== "object" || Array.isArray(salvos)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(salvos)) if (horarioValido(v)) out[k] = v;
  return out;
}

export type HorarioDaRefeicao = {
  refeicao: string;
  /** O que vale: o salvo, senão o sugerido; nulo é "sem lembrete". */
  horario: string | null;
  sugerido: string | null;
  /** Há um horário salvo diferente do sugerido ("Voltar ao sugerido"). */
  mudado: boolean;
};

/**
 * O horário de cada refeição do cardápio, na ordem de `tipos`. O salvo
 * inválido vale como o sugerido, como na função de envio; refeição fora da
 * lista sem horário salvo fica sem lembrete.
 */
export function horariosDoPaciente(tipos: string[], salvos: unknown): HorarioDaRefeicao[] {
  const meus = salvosValidos(salvos);
  return tipos.map((refeicao) => {
    const sugerido = HORARIOS_SUGERIDOS[refeicao] ?? null;
    const salvo = meus[refeicao] ?? null;
    return { refeicao, horario: salvo ?? sugerido, sugerido, mudado: salvo != null && salvo !== sugerido };
  });
}

/**
 * O `meal_reminder_times` depois de mudar o horário de uma refeição. Guarda
 * só o que difere do sugerido: voltar ao sugerido, ou limpar o campo, tira a
 * refeição da lista (e uma mudança futura do sugerido vale para ela).
 */
export function horariosParaGravar(salvos: unknown, refeicao: string, valor: string): Record<string, string> {
  const out = salvosValidos(salvos);
  delete out[refeicao];
  if (horarioValido(valor) && valor !== HORARIOS_SUGERIDOS[refeicao]) out[refeicao] = valor;
  return out;
}

// ---------------------------------------------------------------------------
// O endereço da refeição na Dieta

/**
 * "Café da manhã" → "cafe-da-manha". Pelo nome, e não pela posição em
 * MEAL_TYPES: o cardápio pode ter uma refeição fora da lista.
 */
export function slugDaRefeicao(tipo: string): string {
  // Sem a flag `u`: o tsc do projeto (alvo antigo) recusa.
  const s = tipo
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "outra";
}

/** O id do bloco da refeição na Dieta e em Meu plano. */
export function idDaRefeicao(tipo: string): string {
  return `refeicao-${slugDaRefeicao(tipo)}`;
}

export function urlDaRefeicao(data: string, tipo: string): string {
  return `/app/dieta?data=${data}#${idDaRefeicao(tipo)}`;
}

// ---------------------------------------------------------------------------
// A notificação

export type NotificacaoDaRefeicao = {
  title: string;
  /** Para o celular que mostra os botões. */
  body: string;
  /** Para o que não mostra (o iPhone): o pedido vem antes, porque a tela corta o fim. */
  bodySemBotoes: string;
  tag: string;
  url: string;
  actions: { action: "comi" | "nao_comi"; title: string }[];
  /**
   * O que o botão manda à rota /api/refeicoes/marcar. `usuario` é de quem é a
   * notificação: com outra conta logada no aparelho (o tablet da família), a
   * rota recusa, em vez de marcar o almoço de quem estiver logado.
   */
  refeicao: { data: string; refeicao: string; usuario: string };
  /** A notificação que aparece quando o botão não consegue marcar. */
  falha: string;
};

const LIMITE_DO_CARDAPIO = 110;

/** A descrição numa linha, cortada numa palavra inteira, com "…". */
function cortar(texto: string): string {
  const t = texto.replace(/\s+/g, " ").trim();
  if (t.length <= LIMITE_DO_CARDAPIO) return t;
  let corte = t.slice(0, LIMITE_DO_CARDAPIO - 1);
  const espaco = corte.lastIndexOf(" ");
  if (espaco > 0) corte = corte.slice(0, espaco);
  // "arroz, feijão," viraria "arroz, feijão,…".
  corte = corte.replace(/[\s,;:.·-]+$/, "");
  return `${corte}…`;
}

export function notificacaoDaRefeicao(r: {
  user_id: string;
  data: string;
  refeicao: string;
  itens: { description: string }[];
}): NotificacaoDaRefeicao {
  const mais = r.itens.length - 1;
  const extra = mais === 1 ? " · ou mais 1 opção" : mais > 1 ? ` · ou mais ${mais} opções` : "";
  const body = cortar(r.itens[0]?.description ?? "") + extra;
  return {
    title: `${r.refeicao}: você comeu?`,
    body,
    bodySemBotoes: `Toque para marcar. ${body}`,
    tag: `refeicao-${r.data}-${slugDaRefeicao(r.refeicao)}`,
    url: urlDaRefeicao(r.data, r.refeicao),
    actions: [
      { action: "comi", title: "Comi" },
      { action: "nao_comi", title: "Não comi" },
    ],
    refeicao: { data: r.data, refeicao: r.refeicao, usuario: r.user_id },
    falha: `Não deu para marcar sua resposta (${r.refeicao}). Toque para abrir o app.`,
  };
}

// ---------------------------------------------------------------------------
// O bloco do Perfil

export type SituacaoDosLembretes = "em_breve" | "falhou" | "sem_cardapio" | "iphone_fora" | "sem_suporte" | "pronto";

/**
 * O que o bloco "Lembretes das refeições" mostra, nesta ordem: sem a chave
 * pública o push está desligado no app inteiro, e nada mais importa; leitura
 * que falha não vira "sem cardápio"; o iPhone fora da Tela de Início não tem
 * push nenhum, e a saída é instalar, não "este navegador não mostra".
 */
export function situacaoDosLembretes(e: {
  pushConfigurado: boolean;
  falhou: boolean;
  temCardapio: boolean;
  ios: boolean;
  standalone: boolean;
  suportado: boolean;
}): SituacaoDosLembretes {
  if (!e.pushConfigurado) return "em_breve";
  if (e.falhou) return "falhou";
  if (!e.temCardapio) return "sem_cardapio";
  if (e.ios && !e.standalone) return "iphone_fora";
  if (!e.suportado) return "sem_suporte";
  return "pronto";
}
