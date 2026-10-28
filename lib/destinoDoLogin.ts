// Para onde o login leva. Com a sessão vencida, o toque numa notificação de
// refeição caía no /login e, depois de entrar, na Início: a refeição se
// perdia. Agora o middleware manda o caminho em `?volta=`, e o login vai a ele
// (spec dos lembretes das refeições, "O login volta para onde a pessoa ia").
//
// Só caminho de dentro do app: sem esta regra, `?volta=https://outro.site`
// faria do login uma porta para qualquer lugar. Sem import de Node nem de
// navegador, porque o middleware também a usa.

const LIMITE = 300;

/**
 * O caminho, se for do app (`/app`, `/app/…`, `/app?…`, `/app#…`); senão nulo.
 * Recusa `//` (vira outro site), `\` (alguns navegadores leem como `/`), o
 * segmento `..` (sairia do app), espaço e caractere de controle.
 */
export function caminhoDoApp(c: unknown): string | null {
  if (typeof c !== "string" || c.length > LIMITE) return null;
  if (!/^\/app(?:[/?#]|$)/.test(c)) return null;
  if (c.includes("//") || c.includes("\\") || /[\s\u0000-\u001f\u007f]/.test(c)) return null;
  const caminho = c.split(/[?#]/)[0];
  if (caminho.split("/").includes("..")) return null;
  return c;
}

/**
 * O destino depois de entrar: o `volta` do app, com a âncora (`#refeicao-…`)
 * se ela for só letra, número, `-` e `_`. O navegador leva a âncora junto no
 * redirecionamento para o /login, e é de lá que ela vem.
 */
export function destinoDoLogin(volta: string | null, ancora: string = ""): string {
  const caminho = caminhoDoApp(volta);
  if (!caminho) return "/app";
  if (caminho.includes("#") || !/^#[A-Za-z0-9_-]{1,80}$/.test(ancora)) return caminho;
  return caminho + ancora;
}

/**
 * O `volta` que o middleware põe no /login: o caminho com a busca, sem o
 * `_rsc` que o Next põe na navegação do lado do cliente (levado ao login,
 * a página voltaria com a resposta do roteador no lugar da tela).
 */
export function voltaDoPedido(pathname: string, search: string): string {
  const busca = new URLSearchParams(search);
  busca.delete("_rsc");
  const resto = busca.toString();
  return resto ? `${pathname}?${resto}` : pathname;
}
