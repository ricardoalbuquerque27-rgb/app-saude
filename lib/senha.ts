// A regra de senha nova é a MESMA que o dono do produto liga no Supabase Auth
// (mínimo 8, "Letters and digits"). Sem a checagem aqui, a pessoa só descobre
// depois de enviar o formulário, e com a mensagem em inglês do servidor.
//
// Vale só para senha NOVA (criar conta e redefinir). O entrar não usa isto:
// quem tem senha antiga de 6 ou 7 caracteres precisa continuar entrando.

export const SENHA_MINIMO = 8;

export const AJUDA_DA_SENHA = "Mínimo de 8 caracteres, com letras e números.";

// Letra é só a-z, A-Z, e não qualquer letra Unicode: o "Letters and digits" do
// Supabase confere ASCII. Com `\p{L}`, "ãéíõ1234" passava aqui e o servidor a
// recusava (em inglês, depois do envio). A regra do app é a do servidor, para
// nunca aceitar o que o Supabase vai recusar. "ação1234" continua valendo
// porque tem `a` e `o`; acento não atrapalha, só não conta como a letra.
const LETRA = /[A-Za-z]/;
const NUMERO = /[0-9]/;

/**
 * `null` quando a senha serve; senão a frase de ajuda, a mesma para qualquer
 * dos três defeitos (curta, sem letra, sem número), porque ela diz a regra
 * inteira e a pessoa não precisa adivinhar qual faltou.
 *
 * `length` conta unidades UTF-16, então um emoji vale 2: isto nunca aceita o
 * que o servidor (que conta bytes) recusaria por tamanho. Espaço conta como
 * caractere, mas não como letra nem como número.
 */
export function problemaDaSenha(senha: string): string | null {
  if (senha.length >= SENHA_MINIMO && LETRA.test(senha) && NUMERO.test(senha)) {
    return null;
  }
  return AJUDA_DA_SENHA;
}

/**
 * O erro do Supabase para senha fraca. O supabase-js dá `code:
 * "weak_password"` e `name: "AuthWeakPasswordError"`; a mensagem em inglês
 * ("Password should be at least 8 characters", "Password should contain at
 * least one character of each: …") é o que sobra em resposta de servidor mais
 * velha, sem `code`. Qualquer um dos três basta, e a mensagem vale também
 * quando o erro é só o texto.
 */
export function ehErroDeSenhaFraca(err: unknown): boolean {
  let mensagem: unknown = err;
  if (typeof err === "object" && err !== null) {
    const e = err as { code?: unknown; name?: unknown; message?: unknown };
    if (e.code === "weak_password") return true;
    if (e.name === "AuthWeakPasswordError") return true;
    mensagem = e.message;
  }
  // Texto puro também vale: o `traduzErro` do login aceita erro que já é a
  // mensagem, e aquela mensagem em inglês não pode escapar só por isso.
  if (typeof mensagem !== "string") return false;
  const m = mensagem.toLowerCase();
  return (
    m.includes("password should be at least") ||
    m.includes("password should contain")
  );
}
