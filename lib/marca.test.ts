import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { NOME, SLOGAN, TITULO, DESCRICAO, linkDaVaga, textoDoConvite } from "./marca";

const MENSAGEM = `Oi! Quero uma vaga de implantação do ${NOME}.\nMeu nome:\nCRN:\nAtendo online: sim / não`;

describe("textos da marca", () => {
  it("título, slogan e descrição", () => {
    expect(SLOGAN).toBe("Quem precisa de você, antes do retorno.");
    expect(TITULO).toBe(`${NOME}: acompanhamento entre consultas`);
    expect(DESCRICAO).toBe(
      "O acompanhamento entre uma consulta e outra, da nutricionista ao paciente."
    );
  });
});

describe("linkDaVaga", () => {
  it.each([
    ["(11) 91234-5678", "5511912345678"], // celular com DDD: ganha o 55
    ["11 3456-7890", "551134567890"], // fixo de 10 dígitos
    ["5511912345678", "5511912345678"], // já tem o 55: como está
    ["+55 (11) 91234-5678", "5511912345678"],
    ["55 99123-4567", "5555991234567"], // DDD 55 (Santa Maria) com 11 dígitos
  ])("%s vira wa.me/%s", (numero, digitos) => {
    expect(linkDaVaga(numero)?.startsWith(`https://wa.me/${digitos}?text=`)).toBe(true);
  });

  it.each([[""], [undefined], ["912345678"], ["55119123456789"], ["011 91234-5678"]])(
    "%s não serve: null",
    (numero) => expect(linkDaVaga(numero)).toBeNull()
  );

  it("a mensagem pede nome, CRN e se atende online", () => {
    const link = linkDaVaga("11912345678")!;
    expect(new URL(link).searchParams.get("text")).toBe(MENSAGEM);
  });
});

describe("textoDoConvite", () => {
  it("diz o que o paciente faz, que é de graça, o código e o link", () => {
    const link = "https://exemplo.com/app/nutricionista?code=AB12CD";
    const texto = textoDoConvite("AB12CD", link);
    expect(texto).toBe(
      `Oi! Vou acompanhar você entre as consultas pelo ${NOME}, um app de graça. Abra o link, crie sua conta e registre o que comer, a água e o peso; eu acompanho daqui. Se pedir um código, é este: AB12CD. ${link}`
    );
    expect(texto).not.toContain("convidado(a)");
  });
});

function arquivos(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? arquivos(p) : [p];
  });
}

describe("o nome num lugar só", () => {
  // O nome chegou a estar escrito à mão em 23 arquivos, e o definitivo ainda
  // não existe: escrito fora daqui, ele ficaria velho na próxima troca.
  it("o nome só está escrito em lib/marca.ts", () => {
    const achados = ["app", "components", "lib"]
      .flatMap(arquivos)
      .filter((f) => /\.(ts|tsx|webmanifest)$/.test(f))
      .filter((f) => !f.endsWith(".test.ts") && f !== path.join("lib", "marca.ts"))
      .filter((f) => fs.readFileSync(f, "utf8").includes(NOME));
    expect(achados).toEqual([]);
  });
});
