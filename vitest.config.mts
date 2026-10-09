import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    // Só lógica pura por enquanto: nada de componente nem de banco. O que
    // depende de navegador já é coberto por ferramentas/conferir-inicio.cjs.
    include: ["lib/**/*.test.ts"],
    environment: "node",
    // O app calcula datas no fuso do Brasil. Rodar os testes em UTC esconde
    // exatamente a classe de bug que eles existem para pegar.
    env: { TZ: "America/Sao_Paulo" },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
