import { describe, it, expect } from "vitest";
import manifest from "@/app/manifest";
import { NOME, TITULO, DESCRICAO } from "./marca";
import { TEMA_APP } from "./temaApp";

describe("manifesto do app", () => {
  const m = manifest();

  it("o nome e a descrição vêm de lib/marca.ts", () => {
    expect(m.name).toBe(TITULO);
    expect(m.short_name).toBe(NOME);
    expect(m.description).toBe(DESCRICAO);
  });

  it("saúde, sem fitness nem lifestyle", () => {
    expect(m.categories).toEqual(["health", "medical"]);
  });

  it("o resto fica como estava", () => {
    expect(m.start_url).toBe("/app");
    expect(m.scope).toBe("/");
    expect(m.display).toBe("standalone");
    expect(m.orientation).toBe("portrait");
    expect(m.lang).toBe("pt-BR");
    expect(m.background_color).toBe(TEMA_APP.claro.pagina);
    expect(m.theme_color).toBe(TEMA_APP.claro.primaria);
    expect(m.icons).toEqual([
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ]);
  });
});
