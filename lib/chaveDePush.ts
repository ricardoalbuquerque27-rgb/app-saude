// A chave VAPID em bytes, e a comparação com a da inscrição que o navegador
// já tem. Mora num módulo puro para o teste rodar sem navegador.

/** Base64url (sem "=") em bytes, como o `applicationServerKey` pede (num ArrayBuffer, não num SharedArrayBuffer). */
export function chaveDaBase64(b64url: string): Uint8Array<ArrayBuffer> {
  const preenchimento = "=".repeat((4 - (b64url.length % 4)) % 4);
  const b64 = (b64url + preenchimento).replace(/-/g, "+").replace(/_/g, "/");
  const bruto = atob(b64);
  const bytes = new Uint8Array(bruto.length);
  for (let i = 0; i < bruto.length; i++) bytes[i] = bruto.charCodeAt(i);
  return bytes;
}

/**
 * A inscrição foi feita com esta chave? Uma inscrição feita com outra (a que
 * estava escrita no código, ou uma chave trocada) nunca recebe nada: o
 * serviço de push recusa o envio assinado com a chave nova.
 */
export function mesmaChave(daInscricao: ArrayBuffer | null | undefined, atual: Uint8Array): boolean {
  if (!daInscricao) return false;
  const a = new Uint8Array(daInscricao);
  if (a.length !== atual.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== atual[i]) return false;
  return true;
}
