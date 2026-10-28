import { describe, it, expect, vi, afterEach } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

// A chave pública de push vem só da variável: a que estava escrita no código
// não tinha a privada em lugar nenhum, e o app inteiro se inscrevia com ela.
// É a variável que liga o push (spec dos lembretes das refeições, "Envio").
describe("a chave pública de push", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("sem a variável, o push está desligado", async () => {
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "");
    vi.resetModules();
    const m = await import("./vapidPublicKey");
    expect(m.VAPID_PUBLIC_KEY).toBe("");
    expect(m.pushConfigurado()).toBe(false);
  });

  it("com a variável, ligado", async () => {
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "BAbcDef");
    vi.resetModules();
    const m = await import("./vapidPublicKey");
    expect(m.VAPID_PUBLIC_KEY).toBe("BAbcDef");
    expect(m.pushConfigurado()).toBe(true);
  });

  it("a chave embutida antiga não está em lugar nenhum de app/, components/ e lib/", () => {
    const antiga = ["BNwiOJi8", "Vb7tuHSA"].join("");
    const este = path.resolve("lib/vapidPublicKey.test.ts");
    const achados: string[] = [];
    const varrer = (dir: string) => {
      for (const nome of readdirSync(dir)) {
        const p = path.join(dir, nome);
        if (statSync(p).isDirectory()) varrer(p);
        else if (/\.(tsx?|js|cjs|mjs)$/.test(nome) && path.resolve(p) !== este && readFileSync(p, "utf8").includes(antiga))
          achados.push(p);
      }
    };
    for (const d of ["app", "components", "lib"]) varrer(d);
    expect(achados).toEqual([]);
  });
});
