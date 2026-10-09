// Refeições do cardápio, na ordem do dia. Mora aqui, e não só no
// MealPlanEditor, porque aquele módulo é "use client": um componente de
// servidor que importasse a lista de lá receberia uma referência de cliente
// no lugar do array (a mesma armadilha de formatDate, em lib/date.ts). A
// leitura do cardápio no detalhe do paciente é de servidor e precisa da
// mesma ordem que o editor mostra.
export const MEAL_TYPES = [
  "Café da manhã",
  "Lanche da manhã",
  "Almoço",
  "Lanche da tarde",
  "Jantar",
  "Ceia",
];
