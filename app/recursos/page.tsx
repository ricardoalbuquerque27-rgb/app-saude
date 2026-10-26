import { permanentRedirect } from "next/navigation";

// A página de recursos falava com o consumidor e saiu com a página de
// entrada antiga (26/10): quem guardou o link cai na página nova.
//
// Dinâmica de propósito: estática, o build a pré-renderiza e guarda o 308 sem
// o cabeçalho Location. O navegador só chegava a / depois de carregar o
// JavaScript, e quem não roda JavaScript (busca, prévia de link do WhatsApp,
// curl) ficava num redirecionamento quebrado. O dev não mostra isso, porque
// renderiza a cada pedido.
export const dynamic = "force-dynamic";

export default function Recursos() {
  permanentRedirect("/");
}
