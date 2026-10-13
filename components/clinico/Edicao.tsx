"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from "react";
import {
  oQueSeguraATroca,
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
  /** Gravações em voo em toda a página (o <Editavel> de cada seção conta as suas). */
  gravando: number;
  contarGravacao(delta: 1 | -1): void;
  abrir(secao: SecaoEditavel): void;
  fechar(secao?: SecaoEditavel): void;
  marcarSuja(secao?: SecaoEditavel): void;
  marcarLimpa(secao?: SecaoEditavel): void;
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

  const marcarLimpa = useCallback(
    (secao?: SecaoEditavel) => dispatch({ tipo: "limpar", secao }),
    []
  );

  const [gravando, setGravando] = useState(0);
  const contarGravacao = useCallback(
    (delta: 1 | -1) => setGravando((n) => Math.max(0, n + delta)),
    []
  );

  useAvisarAoSair(estado, gravando);

  const valor = useMemo(
    () => ({ estado, gravando, contarGravacao, abrir, fechar, marcarSuja, marcarLimpa }),
    [estado, gravando, contarGravacao, abrir, fechar, marcarSuja, marcarLimpa]
  );

  return <EdicaoContext.Provider value={valor}>{children}</EdicaoContext.Provider>;
}

/**
 * Pergunta (ou avisa) antes de uma troca que desmontaria o editor aberto, e
 * devolve se pode trocar. Quem confirma descarta: a seção fecha aqui mesmo,
 * em vez de esperar a limpeza do <Editavel> que desmonta, que só roda depois
 * de a aba nova pintar e mostraria por um quadro "Salve ou cancele…" nela.
 */
function perguntarAntesDeTrocar(
  estado: EstadoEdicao,
  gravando: number,
  fechar: (secao?: SecaoEditavel) => void
): boolean {
  const motivo = oQueSeguraATroca(estado, gravando);
  if (motivo === null) return true;
  if (motivo === "gravando") {
    window.alert("Ainda salvando. Espere terminar para trocar de aba.");
    return false;
  }
  if (!estado.aberta) return true;
  const descartar = window.confirm(`Descartar as alterações em ${ROTULOS[estado.aberta]}?`);
  if (descartar) fechar(estado.aberta);
  return descartar;
}

/**
 * Recarregar ou fechar a página com alteração não salva (ou gravação em voo)
 * cai no aviso do próprio navegador.
 *
 * O Voltar e o Avançar do navegador NÃO perguntam: cada aba é uma entrada do
 * histórico, e eles trocam de aba desmontando o editor. Tentou-se segurar com
 * um ouvinte de `popstate` em captura, mas na `window` o navegador chama os
 * ouvintes na ordem de registro, e o do Next (registrado antes) já tinha
 * trocado a aba quando a pergunta aparecia: cancelar deixava o endereço da
 * Alimentação com o conteúdo do Resumo. Guardar o rascunho na página, para
 * ele sobreviver à troca, é o conserto que falta.
 */
function useAvisarAoSair(estado: EstadoEdicao, gravando: number) {
  const emRisco = oQueSeguraATroca(estado, gravando) !== null;
  useEffect(() => {
    if (!emRisco) return;
    function aoSair(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", aoSair);
    return () => window.removeEventListener("beforeunload", aoSair);
  }, [emRisco]);
}

/** Para a barra de abas: devolve se pode trocar agora (pergunta, se preciso). */
export function useTrocaDeAba(): () => boolean {
  const ctx = useContext(EdicaoContext);
  if (!ctx) {
    throw new Error(
      "useTrocaDeAba precisa estar dentro de <EdicaoProvider>. Envolva a página do paciente com ele."
    );
  }
  const { estado, gravando, fechar } = ctx;
  return () => perguntarAntesDeTrocar(estado, gravando, fechar);
}

/** Para o <Editavel> contar as gravações da seção dele na página toda. */
export function useContarGravacao(): (delta: 1 | -1) => void {
  const ctx = useContext(EdicaoContext);
  // Fora do provider (não acontece na página) a contagem só não é feita.
  return ctx?.contarGravacao ?? (() => {});
}

export function useEdicao(secao: SecaoEditavel): {
  editando: boolean;
  /** Rótulo da OUTRA seção que impede esta de abrir, ou null. */
  bloqueadaPor: string | null;
  abrir(): void;
  fechar(): void;
  marcarSuja(): void;
  /** Tira a marca de alteração não salva, mantendo a seção aberta. */
  marcarLimpa(): void;
} {
  const ctx = useContext(EdicaoContext);
  if (!ctx) {
    throw new Error(
      "useEdicao precisa estar dentro de <EdicaoProvider>. Envolva a página do paciente com ele."
    );
  }
  const { estado, abrir, fechar, marcarSuja, marcarLimpa } = ctx;

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
    marcarLimpa: () => marcarLimpa(secao),
  };
}
