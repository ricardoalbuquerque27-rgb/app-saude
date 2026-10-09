"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { SecaoEditavel } from "@/lib/edicao";
import { useEdicao } from "./Edicao";

/** Envolve uma gravação do editor: a seção fica "gravando" até ela voltar. */
export type Gravacao = <T>(acao: () => PromiseLike<T>) => Promise<T>;

// Fora de um <Editavel> (não acontece na página, mas o editor não quebra)
// a gravação só roda, sem avisar ninguém.
const GravacaoContext = createContext<Gravacao>(async (acao) => acao());

/**
 * Para o editor de dentro de um <Editavel> envolver cada gravação:
 * `gravacao(() => salvar())`. Enquanto alguma estiver em voo, o "Fechar
 * edição" da seção fica desabilitado.
 */
export function useGravacaoNaSecao(): Gravacao {
  return useContext(GravacaoContext);
}

// Alterna uma seção entre leitura e edição no mesmo lugar da página. A leitura
// (`children`) vem renderizada no servidor; o `editor` só monta quando a seção
// abre. O botão fica sempre no mesmo canto, no alto: o "Editar" vira "Fechar
// edição" sem o conteúdo pular de lugar.
//
// O MealPlanEditor e o EditorTreino gravam a cada ação e não têm Cancelar
// próprio, então "Fechar edição" é a saída deles. O EditorMetas tem formulário
// com Aplicar/Cancelar e usa o mesmo fechar() por conta própria.
//
// `titulo` (opcional) é o subtítulo do bloco, na mesma linha do botão: na
// Alimentação, "Metas" e "Cardápio" são dois blocos editáveis dentro da mesma
// seção, e com o título numa linha e o botão em outra cada bloco gastava uma
// linha vazia. Fica nos dois modos, para o leitor saber o que está editando.
export function Editavel({
  secao,
  rotuloBotao,
  titulo,
  children,
  editor,
}: {
  secao: SecaoEditavel;
  rotuloBotao: string;
  titulo?: React.ReactNode;
  children: React.ReactNode;
  editor: React.ReactNode;
}) {
  const { editando, bloqueadaPor, abrir, fechar } = useEdicao(secao);

  // Gravações do editor ainda em voo. "Fechar edição" no meio de uma delas
  // desmontava o formulário: se ela falhasse, o erro ia para um componente
  // que não existe mais, e o nutricionista via a seção fechar como se tivesse
  // salvado. Contador, e não sim/não: no treino dá para remover uma sessão
  // enquanto outra gravação ainda não voltou. O estado mora aqui, que fica
  // montado nos dois modos, então a gravação que termina depois de a seção
  // ceder o lugar ainda acha quem descontar.
  const [gravacoes, setGravacoes] = useState(0);
  const gravacao = useCallback<Gravacao>(async (acao) => {
    setGravacoes((n) => n + 1);
    try {
      return await acao();
    } finally {
      setGravacoes((n) => n - 1);
    }
  }, []);

  // Solta a trava quando a seção sai da tela. Uma seção suja que desmonta sem
  // chamar fechar() deixaria as outras bloqueadas por algo que ninguém vê.
  // Mora aqui, e não em useEdicao, porque o <Editavel> fica montado nos dois
  // modos: o editor (filho) só monta depois de abrir(), e no StrictMode do dev
  // o mount→unmount→mount dele rodaria esta limpeza com a seção aberta e a
  // fecharia na hora. A dupla montagem do <Editavel> acontece com nada aberto,
  // e o reducer ignora fechar de quem não é a seção aberta.
  //
  // `fechar` do hook é uma função nova a cada render; pela ref a limpeza
  // chama a mais recente sem depender dela (dependência instável rodaria a
  // limpeza em todo render).
  const fecharRef = useRef(fechar);
  useEffect(() => {
    fecharRef.current = fechar;
  });
  useEffect(() => () => fecharRef.current(), []);

  // flex-wrap + ml-auto: o aviso de bloqueio é longo e, sem espaço ao lado
  // do título, desce para a linha de baixo em vez de espremer o título.
  const linha = "mb-3 flex min-h-[40px] flex-wrap items-center gap-x-3 gap-y-2";

  if (editando) {
    return (
      <div>
        <div className={linha}>
          {titulo}
          <button
            type="button"
            onClick={fechar}
            disabled={gravacoes > 0}
            className="btn-ghost ml-auto min-h-[40px] px-4 disabled:cursor-wait"
          >
            Fechar edição
          </button>
        </div>
        <GravacaoContext.Provider value={gravacao}>{editor}</GravacaoContext.Provider>
      </div>
    );
  }

  return (
    <div>
      <div className={linha}>
        {titulo}
        {bloqueadaPor ? (
          // O aviso é o próprio texto do botão, visível, e não um tooltip:
          // botão desativado não recebe foco nem hover, e quem usa toque ou
          // leitor de tela nunca descobriria por que não abre. Sem a opacidade
          // do estado desativado, que levaria o texto abaixo de 4,5:1. A cor
          // vai também com `dark:`: no escuro a cópia `.dark :where(...)
          // .btn-ghost` do globals.css tem duas classes e venceria um
          // utilitário de uma só, e o aviso sairia na cor do botão normal.
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="btn-ghost ml-auto min-h-[40px] border-dashed px-4 text-left text-clin-texto-2 disabled:opacity-100 dark:text-clin-texto-2"
          >
            Salve ou cancele a edição de {bloqueadaPor}
          </button>
        ) : (
          <button
            type="button"
            onClick={abrir}
            className="btn-ghost ml-auto min-h-[40px] px-4"
          >
            {rotuloBotao}
          </button>
        )}
      </div>
      {children}
    </div>
  );
}
