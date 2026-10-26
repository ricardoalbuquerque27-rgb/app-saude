import fs from "node:fs";
import { describe, it, expect } from "vitest";
import { ICON_SVG, ICON_MASKABLE_SVG } from "./appIcon";
import { TEMA_APP } from "./temaApp";

describe("ícone do app", () => {
  it("fundo na principal do app, com cantos de 112", () => {
    expect(ICON_SVG).toContain(
      `<rect width="512" height="512" rx="112" fill="${TEMA_APP.claro.primaria}"/>`
    );
  });

  it("é a lista com um marcado, não o haltere", () => {
    expect(ICON_SVG).toContain('<circle cx="154" cy="256" r="30"/>');
    expect(ICON_SVG).not.toContain("M150 200");
  });

  it("o maskable ocupa o quadrado inteiro e guarda a margem de hoje", () => {
    expect(ICON_MASKABLE_SVG).not.toContain('rx="112"');
    expect(ICON_MASKABLE_SVG).toContain("translate(256 256) scale(0.72) translate(-256 -256)");
    expect(ICON_MASKABLE_SVG).toContain('<circle cx="154" cy="256" r="30"/>');
  });

  it("o public/icon.svg é o mesmo desenho", () => {
    expect(fs.readFileSync("public/icon.svg", "utf8").trim()).toBe(ICON_SVG.trim());
  });
});
