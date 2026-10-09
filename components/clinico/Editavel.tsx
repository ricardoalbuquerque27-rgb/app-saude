"use client";

import { useEffect, useRef } from "react";
import type { SecaoEditavel } from "@/lib/edicao";
import { useEdicao } from "./Edicao";

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
            className="btn-ghost ml-auto min-h-[40px] px-4"
          >
            Fechar edição
          </button>
        </div>
        {editor}
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
          // do estado desativado, que levaria o texto abaixo de 4,5:1.
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="btn-ghost ml-auto min-h-[40px] border-dashed px-4 text-left text-clin-texto-2 disabled:opacity-100"
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
