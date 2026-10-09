"use client";

import type { ComponentProps } from "react";
import MealPlanEditor from "@/components/MealPlanEditor";
import { useEdicao } from "./Edicao";
import { useGravacaoNaSecao } from "./Editavel";

// O MealPlanEditor dentro da regra de uma edição por vez, do mesmo jeito que
// o EditorTreino: o rascunho dele (nome e orientação ainda não salvos, a
// opção nova de uma refeição) marca o cardápio como alterado, e as outras
// seções ficam com "Salve ou cancele a edição de Cardápio". Antes o cardápio
// não avisava nada, e "Editar metas" ou "Editar plano" abria o outro editor
// por cima e o texto digitado sumia.
//
// O editor só avisa quando o rascunho muda de vazio para não vazio e de volta
// (uma vez, não a cada tecla), e os dois avisos vêm de handlers dele, nunca
// de um efeito. A Alimentação é componente de servidor e não usa hooks; por
// isso este invólucro.
export function EditorCardapio(
  props: Omit<ComponentProps<typeof MealPlanEditor>, "aoAlterar" | "aoLimpar" | "gravacao">
) {
  const { marcarSuja, marcarLimpa } = useEdicao("cardapio");
  const gravacao = useGravacaoNaSecao();
  return (
    <MealPlanEditor
      {...props}
      aoAlterar={marcarSuja}
      aoLimpar={marcarLimpa}
      gravacao={gravacao}
    />
  );
}
