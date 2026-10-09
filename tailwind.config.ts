import type { Config } from "tailwindcss";
// Import RELATIVO de propósito: o carregador de config do Tailwind não
// resolve o alias "@/". Por isso lib/temaClinico.ts também não importa nada.
import { NOMES_COR } from "./lib/temaClinico";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eefdf3",
          100: "#d6fae1",
          200: "#aff3c6",
          300: "#79e7a3",
          400: "#3fd27b",
          500: "#18b85e",
          600: "#0c964b",
          700: "#0c763e",
          800: "#0e5d34",
          900: "#0d4c2d",
          950: "#062e1a",
        },
        // Paleta do visual clínico (piloto na página do paciente). As
        // variáveis --clin-* só existem dentro de .tema-clinico, definidas
        // por cssDoTemaClinico(); a lista de nomes tem fonte única em
        // lib/temaClinico.ts, a mesma que os testes de contraste usam.
        clin: Object.fromEntries(
          NOMES_COR.map((nome) => [nome, `var(--clin-${nome})`])
        ),
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: [
          "var(--font-display)",
          "var(--font-inter)",
          "system-ui",
          "sans-serif",
        ],
        clinico: ["var(--font-clinico)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
