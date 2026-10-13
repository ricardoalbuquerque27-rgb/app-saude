import type { Situacao } from "@/lib/consultas";
import type { SituacaoRegistro } from "@/lib/registro";

// Classes das telas de consulta (agenda e aba Consultas do paciente). Valem
// só dentro de .tema-clinico, onde as variáveis --clin-* existem. Cada par de
// texto e fundo aqui está em PARES_TEXTO de lib/temaClinico.ts (contraste
// testado nos dois temas).
//
// Campos sem as classes .input/.label do app: dentro do tema clínico elas são
// refeitas sob :where(.tema-clinico) e, no escuro, a cópia com `.dark` vence
// qualquer utilitário sem `dark:` (CLAUDE.md). Escrever o campo inteiro com
// utilitários evita a armadilha.

export const CAMPO =
  "min-h-[44px] w-full rounded-md border border-clin-campo bg-clin-chao px-3 text-[15px] text-clin-texto [color-scheme:light] dark:[color-scheme:dark] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clin-primaria";

export const ROTULO_CAMPO =
  "mb-1 block text-[14px] font-medium text-clin-texto";

/** Selo da situação. Pendência em âmbar; agendada em verde; falta em vermelho. */
export const SELO: Record<Situacao, string> = {
  pedido: "bg-clin-atencao-fundo text-clin-atencao",
  remarcar: "bg-clin-atencao-fundo text-clin-atencao",
  "sem-desfecho": "bg-clin-atencao-fundo text-clin-atencao",
  agendada: "bg-clin-primaria-fundo text-clin-primaria",
  realizada: "bg-clin-primaria-fundo text-clin-texto-2",
  faltou: "bg-clin-perigo-fundo text-clin-perigo",
  cancelada: "text-clin-texto-2 line-through",
};

/**
 * Selo do registro da consulta, ao lado do da situação. O que falta fazer
 * ("Sem registro", "Rascunho") em âmbar, como as pendências; o que está feito
 * ("Registrada") só com a borda `linha` e o texto na cor da marca, para não
 * competir com o selo da situação. Os dois primeiros levam uma borda
 * transparente para os três terem a mesma altura.
 */
export const SELO_REGISTRO: Record<Exclude<SituacaoRegistro, "sem-direito">, string> = {
  "sem-registro": "border border-transparent bg-clin-atencao-fundo text-clin-atencao",
  rascunho: "border border-transparent bg-clin-atencao-fundo text-clin-atencao",
  registrada: "border border-clin-linha text-clin-primaria",
};

export const CLASSE_SELO =
  "inline-flex items-center rounded px-1.5 py-0.5 text-[13px] font-semibold";

const BLOCO_PENDENTE = "border border-dashed border-clin-atencao bg-clin-chao text-clin-atencao";
const BLOCO_PASSADO = "border border-clin-linha bg-clin-chao text-clin-texto-2";

/**
 * Bloco da consulta na grade da Semana e no dia do Mês. Pendência
 * (pedido, remarcação, sem desfecho) é tracejada, como no protótipo aprovado.
 */
export const BLOCO: Record<Situacao, string> = {
  pedido: BLOCO_PENDENTE,
  remarcar: BLOCO_PENDENTE,
  "sem-desfecho": BLOCO_PENDENTE,
  agendada: "border border-transparent bg-clin-primaria-fundo text-clin-primaria",
  faltou: "border border-transparent bg-clin-perigo-fundo text-clin-perigo",
  realizada: BLOCO_PASSADO,
  cancelada: BLOCO_PASSADO,
};
