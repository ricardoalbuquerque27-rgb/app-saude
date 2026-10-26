import type { MetadataRoute } from "next";
import { NOME, TITULO, DESCRICAO } from "@/lib/marca";
import { TEMA_APP } from "@/lib/temaApp";

// O manifesto lê o nome de lib/marca.ts (era um .webmanifest estático, com o
// nome e o "Treinos, Dieta e Saúde" de consumidor escritos à mão). O Next o
// serve no mesmo endereço, /manifest.webmanifest, que o layout e o sw.js usam.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: TITULO,
    short_name: NOME,
    description: DESCRICAO,
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: TEMA_APP.claro.pagina,
    theme_color: TEMA_APP.claro.primaria,
    categories: ["health", "medical"],
    lang: "pt-BR",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
