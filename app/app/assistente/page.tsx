import { redirect } from "next/navigation";

// O assistente agora é um balãozinho flutuante disponível em todas as telas.
// Mantemos esta rota redirecionando para o início para não quebrar links antigos.
export default function AssistenteRedirect() {
  redirect("/app");
}
