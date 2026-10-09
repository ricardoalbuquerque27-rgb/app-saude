import type { EstadoDia } from "@/lib/planCheckIn";

const ROTULOS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const NOMES = [
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
  "Domingo",
];

// Posição do dia na semana que começa na segunda (0 = Seg). Lê a data ao
// meio-dia, como weekStartISO em lib/date.ts: à meia-noite, um fuso atrás de
// UTC puxaria a data para o dia anterior e a célula ganharia o rótulo errado.
function posicaoNaSemana(data: string): number {
  const d = new Date(`${data}T12:00:00`);
  if (Number.isNaN(d.getTime())) return -1;
  return (d.getDay() + 6) % 7;
}

// Cada estado tem texto além da cor (✓ ✕ ? hoje • desc.): quem não distingue
// verde de vermelho lê o mesmo que os outros. `fala` é a frase do leitor de
// tela ("Quarta: faltou"). As cores são pares com contraste testado em
// lib/temaClinico.ts.
const ESTADOS: Record<
  EstadoDia,
  { glifo: string; fala: string; caixa: string }
> = {
  feito: {
    glifo: "✓",
    fala: "treino feito",
    caixa: "bg-clin-primaria-fundo text-clin-primaria text-[16px] font-semibold",
  },
  falta: {
    glifo: "✕",
    fala: "faltou",
    caixa: "bg-clin-perigo-fundo text-clin-perigo text-[16px] font-semibold",
  },
  "sem-resposta": {
    glifo: "?",
    fala: "sem resposta",
    caixa:
      "bg-clin-atencao-fundo text-clin-atencao text-[16px] font-semibold",
  },
  hoje: {
    glifo: "hoje",
    fala: "hoje",
    caixa: "border border-clin-primaria text-clin-primaria text-xs font-semibold",
  },
  previsto: {
    glifo: "•",
    fala: "treino previsto",
    caixa: "border border-clin-linha text-clin-texto-2 text-[16px]",
  },
  descanso: {
    glifo: "desc.",
    fala: "descanso",
    caixa: "text-clin-texto-2 text-xs",
  },
  livre: {
    glifo: "",
    fala: "sem treino previsto",
    caixa: "",
  },
};

// A semana de treino em sete células. Cada célula é uma imagem com rótulo
// próprio (`role="img"`), e não texto solto: lida pelo glifo, a leitura seria
// "Qua ✕", e "Quarta: faltou" diz o que o desenho quer dizer.
export function SemanaTreino({
  dias,
}: {
  dias: { data: string; estado: EstadoDia }[];
}) {
  return (
    <ol aria-label="Treinos da semana" className="grid grid-cols-7 gap-1.5">
      {dias.map((d, i) => {
        const pos = posicaoNaSemana(d.data);
        const e = ESTADOS[d.estado];
        return (
          <li key={`${d.data}-${i}`}>
            <div
              role="img"
              aria-label={`${pos >= 0 ? NOMES[pos] : d.data}: ${e.fala}`}
              className="flex flex-col items-center gap-1.5"
            >
              <span
                className={`text-[13px] ${
                  d.estado === "hoje"
                    ? "font-semibold text-clin-texto"
                    : "text-clin-texto-2"
                }`}
              >
                {pos >= 0 ? ROTULOS[pos] : ""}
              </span>
              <span
                className={`flex h-10 w-full items-center justify-center rounded-md tabular-nums ${e.caixa}`}
              >
                {e.glifo}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
