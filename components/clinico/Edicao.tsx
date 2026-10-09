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
  fechar(): void;
  marcarSuja(): void;
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
  const fechar = useCallback(() => dispatch({ tipo: "fechar" }), []);
  const marcarSuja = useCallback(() => dispatch({ tipo: "sujar" }), []);

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

  // Sem guarda de "só quem está editando": `editando` vem do último render,
  // então `abrir()` seguido de `marcarSuja()` no mesmo evento teria o segundo
  // descartado. As seções só mostram o formulário (e seus botões) quando
  // `editando` é verdadeiro, então a guarda também não faria falta.
  return {
    editando,
    bloqueadaPor,
    abrir: () => abrir(secao),
    fechar,
    marcarSuja,
  };
}
