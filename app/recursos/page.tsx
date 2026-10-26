import { permanentRedirect } from "next/navigation";

// A página de recursos falava com o consumidor e saiu com a página de
// entrada antiga (26/10): quem guardou o link cai na página nova.
export default function Recursos() {
  permanentRedirect("/");
}
