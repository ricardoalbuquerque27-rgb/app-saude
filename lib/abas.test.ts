import { describe, it, expect } from "vitest";
import { abaDaUrl, hrefDaAba } from "./abas";

describe("abaDaUrl", () => {
  // A aba vem do endereço (?aba=treino) para o Voltar do navegador e um link
  // mandado a alguém abrirem a mesma aba. Qualquer coisa que não seja uma aba
  // conhecida cai no Resumo, nunca numa tela vazia.
  it("sem parâmetro abre o Resumo", () => {
    expect(abaDaUrl(undefined)).toBe("resumo");
  });

  it("aceita as abas conhecidas", () => {
    expect(abaDaUrl("alimentacao")).toBe("alimentacao");
    expect(abaDaUrl("treino")).toBe("treino");
    expect(abaDaUrl("corpo")).toBe("corpo");
    expect(abaDaUrl("clinico")).toBe("clinico");
  });

  it("valor desconhecido ou vazio cai no Resumo", () => {
    expect(abaDaUrl("prescricao")).toBe("resumo");
    expect(abaDaUrl("")).toBe("resumo");
    expect(abaDaUrl("Treino")).toBe("resumo");
  });

  it("parâmetro repetido (?aba=x&aba=y) usa o primeiro", () => {
    expect(abaDaUrl(["clinico", "treino"])).toBe("clinico");
    expect(abaDaUrl(["nada", "treino"])).toBe("resumo");
  });
});

describe("hrefDaAba", () => {
  it("o Resumo é o endereço do paciente sem parâmetro", () => {
    expect(hrefDaAba("abc", "resumo")).toBe("/app/pacientes/abc");
  });

  it("as outras abas levam ?aba=", () => {
    expect(hrefDaAba("abc", "treino")).toBe("/app/pacientes/abc?aba=treino");
    expect(hrefDaAba("abc", "clinico")).toBe("/app/pacientes/abc?aba=clinico");
  });

  // No celular, Mensagem e Nota abrem em tela cheia (?conversa=1, ?notas=1).
  // Sem a aba junto, o Voltar caía no Resumo, e quem estava editando metas em
  // Alimentação perdia a aba e o rascunho.
  it("o modo de tela cheia leva a aba junto", () => {
    expect(hrefDaAba("abc", "resumo", "conversa")).toBe("/app/pacientes/abc?conversa=1");
    expect(hrefDaAba("abc", "alimentacao", "conversa")).toBe(
      "/app/pacientes/abc?aba=alimentacao&conversa=1"
    );
    expect(hrefDaAba("abc", "treino", "notas")).toBe("/app/pacientes/abc?aba=treino&notas=1");
  });
});
