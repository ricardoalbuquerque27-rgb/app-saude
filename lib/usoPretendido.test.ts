import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

// O uso pretendido (docs/superpowers/specs/2026-10-27-uso-pretendido-da-ia-design.md):
// para o paciente, a IA constata e explica, e não julga exame nem orienta
// tratamento. Estes textos eram as portas do juízo: a ferramenta que dizia
// "normal" ou "alterado" ao paciente (avaliar_exame), a "interpretação" e as
// "recomendações" da leitura do laudo e a orientação a quem usa a caneta.
// Voltaram a aparecer? A IA voltou a julgar.
const PROIBIDOS = ["avaliar_exame", "interpretacao", "recomendacoes", "ORIENTE de acordo"];

function arquivos(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? arquivos(p) : [p];
  });
}

describe("a IA não julga exame nem orienta tratamento", () => {
  it("nenhuma rota de IA nem as ferramentas da Gaia têm os textos do juízo", () => {
    const achados = [...arquivos(path.join("app", "api")).filter((f) => f.endsWith(".ts")), path.join("lib", "aiActions.ts")]
      .flatMap((f) => {
        const texto = fs.readFileSync(f, "utf8");
        return PROIBIDOS.filter((p) => texto.includes(p)).map((p) => `${f}: ${p}`);
      });
    expect(achados).toEqual([]);
  });
});
