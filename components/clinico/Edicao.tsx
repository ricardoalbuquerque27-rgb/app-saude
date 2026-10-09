"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import {
  podeAbrir,
  reduzirEdicao,
  type EstadoEdicao,
  type SecaoEditavel,
} from "@/lib/edicao";

// Um único estado de edição para a página inteira do paciente: é ele que
// garante que só uma seção fique aberta e que uma seção com alteração não
// salva bloqueie as outras. A regra em si está em lib/edicao.ts (testada);
// aqui só se liga o reducer ao React.

const ROTULOS: Record<SecaoEditavel, string> = {
  metas: "Metas",
  cardapio: "Cardápio",
  treino: "Treino",
};

type Contexto = {
  estado: EstadoEdicao;
  abrir(secao: SecaoEditavel): void;
  fechar(secao?: SecaoEditavel): void;
  marcarSuja(secao?: SecaoEditavel): void;
};

const EdicaoContext = createContext<Contexto | null>(null);

export function EdicaoProvider({ children }: { children: ReactNode }) {
  const [estado, dispatch] = useReducer(reduzirEdicao, {
    aberta: null,
    suja: false,
  } as EstadoEdicao);

  const abrir = useCallback(
    (secao: SecaoEditavel) => dispatch({ tipo: "abrir", secao }),
    []
  );
  const fechar = useCallback(
    (secao?: SecaoEditavel) => dispatch({ tipo: "fechar", secao }),
    []
  );
  const marcarSuja = useCallback(
    (secao?: SecaoEditavel) => dispatch({ tipo: "sujar", secao }),
    []
  );

  const valor = useMemo(
    () => ({ estado, abrir, fechar, marcarSuja }),
    [estado, abrir, fechar, marcarSuja]
  );

  return <EdicaoContext.Provider value={valor}>{children}</EdicaoContext.Provider>;
}

export function useEdicao(secao: SecaoEditavel): {
  editando: boolean;
  /** Rótulo da OUTRA seção que impede esta de abrir, ou null. */
  bloqueadaPor: string | null;
  abrir(): void;
  fechar(): void;
  marcarSuja(): void;
} {
  const ctx = useContext(EdicaoContext);
  if (!ctx) {
    throw new Error(
      "useEdicao precisa estar dentro de <EdicaoProvider>. Envolva a página do paciente com ele."
    );
  }
  const { estado, abrir, fechar, marcarSuja } = ctx;

  const editando = estado.aberta === secao;
  const bloqueadaPor =
    !podeAbrir(estado, secao) && estado.aberta ? ROTULOS[estado.aberta] : null;

  // A liberação da trava ao desmontar NÃO mora aqui, e sim no <Editavel>.
  // Os editores (EditorMetas, EditorTreino) usam este hook mas só montam
  // depois de abrir(); no StrictMode do dev o React monta, desmonta e monta
  // de novo, e uma limpeza aqui rodaria fechar(secao) com a seção JÁ aberta,
  // fechando o formulário na hora em que ele aparece. O <Editavel> fica
  // montado nos dois modos (leitura e edição), então a dupla montagem dele
  // acontece com nada aberto, e o reducer ignora o fechar.

  // Quem chama vai identificado (`secao`) e o reducer decide. Uma guarda aqui
  // com `editando` não serviria: ele vem do último render e está velho dentro
  // do mesmo evento (`abrir()` seguido de `marcarSuja()` perderia o segundo).
  return {
    editando,
    bloqueadaPor,
    abrir: () => abrir(secao),
    fechar: () => fechar(secao),
    marcarSuja: () => marcarSuja(secao),
  };
}
