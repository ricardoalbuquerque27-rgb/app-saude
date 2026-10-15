import { describe, it, expect } from "vitest";
import {
  SENHA_MINIMO,
  AJUDA_DA_SENHA,
  problemaDaSenha,
  ehErroDeSenhaFraca,
} from "./senha";

describe("problemaDaSenha", () => {
  it("o mínimo e a frase de ajuda são os combinados", () => {
    expect(SENHA_MINIMO).toBe(8);
    expect(AJUDA_DA_SENHA).toBe("Mínimo de 8 caracteres, com letras e números.");
  });

  it("aceita 8 ou mais caracteres com letra e número", () => {
    expect(problemaDaSenha("abc12345")).toBeNull();
    expect(problemaDaSenha("12345678a")).toBeNull();
    expect(problemaDaSenha("Senha123")).toBeNull();
  });

  it("recusa 7 caracteres, mesmo com letra e número", () => {
    expect(problemaDaSenha("abc1234")).toBe(AJUDA_DA_SENHA);
  });

  it("recusa a que não tem número", () => {
    expect(problemaDaSenha("abcdefgh")).toBe(AJUDA_DA_SENHA);
  });

  it("recusa a que não tem letra", () => {
    expect(problemaDaSenha("12345678")).toBe(AJUDA_DA_SENHA);
  });

  it("acento não atrapalha, mas só a-z e A-Z contam como letra", () => {
    // tem `a` e `o` (ASCII) no meio das acentuadas
    expect(problemaDaSenha("ação1234")).toBeNull();
    // só letras acentuadas: o "Letters and digits" do Supabase recusaria
    expect(problemaDaSenha("ãéíõ1234")).toBe(AJUDA_DA_SENHA);
  });

  it("espaço conta como caractere, mas não como letra nem número", () => {
    expect(problemaDaSenha("        ")).toBe(AJUDA_DA_SENHA);
    // com letra e número de verdade, o espaço ajuda a chegar nos 8
    expect(problemaDaSenha("a1      ")).toBeNull();
  });

  it("recusa a vazia", () => {
    expect(problemaDaSenha("")).toBe(AJUDA_DA_SENHA);
  });
});

describe("ehErroDeSenhaFraca", () => {
  it("reconhece o code weak_password", () => {
    expect(ehErroDeSenhaFraca({ code: "weak_password", message: "x" })).toBe(true);
  });

  it("reconhece o name AuthWeakPasswordError", () => {
    expect(ehErroDeSenhaFraca({ name: "AuthWeakPasswordError" })).toBe(true);
  });

  it("reconhece a mensagem de tamanho, sem diferenciar maiúscula", () => {
    expect(
      ehErroDeSenhaFraca({ message: "Password should be at least 8 characters." })
    ).toBe(true);
    expect(
      ehErroDeSenhaFraca({ message: "PASSWORD SHOULD BE AT LEAST 8 characters" })
    ).toBe(true);
  });

  it("reconhece a mensagem de letras e números", () => {
    expect(
      ehErroDeSenhaFraca({
        message:
          "Password should contain at least one character of each: abcdefghijklmnopqrstuvwxyz, 0123456789",
      })
    ).toBe(true);
  });

  it("reconhece a mensagem quando o erro é só o texto", () => {
    expect(ehErroDeSenhaFraca("Password should be at least 8 characters.")).toBe(true);
    expect(
      ehErroDeSenhaFraca("Password should contain at least one character of each: 0123456789")
    ).toBe(true);
  });

  it("não confunde com outros erros", () => {
    expect(ehErroDeSenhaFraca({ message: "Invalid login credentials" })).toBe(false);
    expect(ehErroDeSenhaFraca(null)).toBe(false);
    expect(ehErroDeSenhaFraca(undefined)).toBe(false);
    expect(ehErroDeSenhaFraca("texto")).toBe(false);
    expect(ehErroDeSenhaFraca("Invalid login credentials")).toBe(false);
    expect(ehErroDeSenhaFraca({})).toBe(false);
    expect(ehErroDeSenhaFraca({ message: 42 })).toBe(false);
  });
});
