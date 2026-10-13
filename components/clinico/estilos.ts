// Classes dos links e ações que as seções do paciente repetem. Ficam num
// lugar só para os alvos de toque não divergirem de uma seção para outra:
// ação principal com 44 px de altura, secundária com 40 px.
//
// Sem a classe de display (`inline-flex`) de propósito: vários destes links
// existem em par, um só no celular (`inline-flex lg:hidden`) e outro só no
// computador (`hidden lg:inline-flex`), e um `inline-flex` aqui brigaria com
// o `hidden` do segundo sem ordem garantida no CSS.

/** Anel de foco do teclado, na cor primária do tema clínico. */
export const FOCO =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clin-primaria";

/** Ação principal sobre o fundo `chao`. */
export const ACAO_PRIMARIA = `min-h-[44px] items-center justify-center gap-2 rounded-md bg-clin-primaria px-4 text-[14px] font-semibold text-clin-sobre-primaria hover:brightness-95 ${FOCO}`;

/** Ação secundária sobre o fundo `chao`. */
export const ACAO_SECUNDARIA = `min-h-[44px] items-center justify-center gap-2 rounded-md border border-clin-linha bg-clin-chao px-4 text-[14px] font-medium text-clin-texto hover:bg-clin-primaria-fundo ${FOCO}`;

/** Link de texto (Linha do tempo, editar nas metas, Voltar). */
export const LINK = `min-h-[40px] items-center gap-1 rounded-md text-[14px] font-medium text-clin-primaria underline decoration-1 underline-offset-4 hover:decoration-2 ${FOCO}`;
