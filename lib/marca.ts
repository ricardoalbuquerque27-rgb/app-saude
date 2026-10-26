// O nome do produto e os textos fixos da marca, num lugar só. O nome
// definitivo ainda não existe (o atual vai mudar), e ele chegou a estar
// escrito à mão em 23 arquivos: trocar o nome é trocar o `NOME`. A guarda de
// `lib/marca.test.ts` acusa o nome escrito em outro arquivo do app. À mão ficam
// só o `public/sw.js`, que é estático e não lê código, e os títulos que o
// `ferramentas/tirar-prints-nutri.cjs` confere.

export const NOME = "Pace Fit";
export const SLOGAN = "Quem precisa de você, antes do retorno.";
export const TITULO = `${NOME}: acompanhamento entre consultas`;
export const DESCRICAO =
  "O acompanhamento entre uma consulta e outra, da nutricionista ao paciente.";

const MENSAGEM_DA_VAGA = [
  `Oi! Quero uma vaga de implantação do ${NOME}.`,
  "Meu nome:",
  "CRN:",
  "Atendo online: sim / não",
].join("\n");

/**
 * O link do WhatsApp do fundador para pedir uma vaga de implantação, com a
 * mensagem pronta, a partir do número de `NEXT_PUBLIC_WHATSAPP_VAGAS`. Aceita o
 * número escrito de qualquer jeito (espaço, traço, parênteses, "+"): com DDD e
 * número (10 ou 11 dígitos) ganha o 55 do país; com o 55 (12 ou 13) fica como
 * está. A regra é pelo tamanho, e não por "começa com 55", porque 55 também é
 * DDD (Santa Maria, RS). O resto dá nulo, e a página diz que as vagas abrem em
 * breve: o 0 de tronco ("011 9…") faria o link abrir uma conversa com um número
 * que não existe.
 */
export function linkDaVaga(numero: string | undefined): string | null {
  const digitos = (numero ?? "").replace(/\D/g, "");
  let completo: string | null = null;
  if (digitos.length === 10 || digitos.length === 11) completo = `55${digitos}`;
  else if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith("55"))
    completo = digitos;
  if (!completo) return null;
  return `https://wa.me/${completo}?text=${encodeURIComponent(MENSAGEM_DA_VAGA)}`;
}

/**
 * O convite que a nutricionista cola no WhatsApp do paciente. O antigo ("Você
 * foi convidado(a) para acompanhar sua saúde comigo…") não dizia o que ele ia
 * fazer nem que era de graça.
 */
export function textoDoConvite(codigo: string, link: string): string {
  return `Oi! Vou acompanhar você entre as consultas pelo ${NOME}, um app de graça. Abra o link, crie sua conta e registre o que comer, a água e o peso; eu acompanho daqui. Se pedir um código, é este: ${codigo}. ${link}`;
}
