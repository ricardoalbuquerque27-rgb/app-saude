import { describe, it, expect } from "vitest";
import { caminhoDoApp, destinoDoLogin, voltaDoPedido } from "./destinoDoLogin";

describe("destinoDoLogin", () => {
  it("aceita o caminho do app e a âncora", () => {
    expect(destinoDoLogin("/app/dieta?data=2026-10-28", "#refeicao-almoco")).toBe(
      "/app/dieta?data=2026-10-28#refeicao-almoco"
    );
    expect(destinoDoLogin("/app", "")).toBe("/app");
    expect(destinoDoLogin("/app/nutricionista?aba=cardapio")).toBe("/app/nutricionista?aba=cardapio");
  });

  it("âncora com outra coisa que letra, número, - e _ sai", () => {
    expect(destinoDoLogin("/app/dieta", "#<script>")).toBe("/app/dieta");
    expect(destinoDoLogin("/app/dieta", "refeicao-almoco")).toBe("/app/dieta");
    expect(destinoDoLogin("/app/dieta", "#" + "a".repeat(81))).toBe("/app/dieta");
  });

  it.each([
    null,
    "",
    "https://outro.site/app",
    "//outro.site",
    "/login",
    "/app\\outro",
    "/applications",
    "/app/../login",
    "/app/ x",
    "/app//outro",
    "/app/" + "x".repeat(300),
  ])("destinoDoLogin(%s) vai para /app", (v) => {
    expect(destinoDoLogin(v as string | null)).toBe("/app");
  });
});

describe("caminhoDoApp", () => {
  it("o caminho do app com busca e âncora", () => {
    expect(caminhoDoApp("/app/dieta?data=2026-10-28#refeicao-almoco")).toBe("/app/dieta?data=2026-10-28#refeicao-almoco");
    expect(caminhoDoApp("/app#x")).toBe("/app#x");
  });
  it("o resto é nulo", () => {
    for (const c of [undefined, 5, "https://outro.site", "/login", "/app\nx", "javascript:alert(1)"]) expect(caminhoDoApp(c)).toBeNull();
  });
});

describe("voltaDoPedido", () => {
  it("tira o _rsc do Next e mantém o resto", () => {
    expect(voltaDoPedido("/app/dieta", "?data=2026-10-28&_rsc=abc")).toBe("/app/dieta?data=2026-10-28");
    expect(voltaDoPedido("/app/dieta", "?_rsc=abc")).toBe("/app/dieta");
    expect(voltaDoPedido("/app", "")).toBe("/app");
  });
});
