import { FORMAS_DA_MARCA } from "@/lib/appIcon";

// O símbolo de marca das telas: o mesmo desenho do ícone do app
// (FORMAS_DA_MARCA), com o fundo incluído. Ficou no lugar do haltere, que
// dizia academia; o haltere segue só onde quer dizer treino (o menu Treinos).
// As cores são classes do tema e não hex, para o símbolo seguir o escuro. É
// decorativo: o nome do produto vem sempre ao lado, em texto.
export default function MarcaIcone({
  tamanho = 36,
  className = "",
}: {
  tamanho?: number;
  className?: string;
}) {
  const { cantos, barras, ponto } = FORMAS_DA_MARCA;
  return (
    <svg
      data-marca=""
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 512 512"
      width={tamanho}
      height={tamanho}
      className={`shrink-0 ${className}`}
    >
      <rect width="512" height="512" rx={cantos} className="fill-app-primaria" />
      <g className="fill-app-sobre-primaria">
        {barras.map((b) => (
          <rect
            key={b.y}
            x={b.x}
            y={b.y}
            width={b.width}
            height={b.height}
            rx={b.height / 2}
            opacity={b.opacity}
          />
        ))}
        <circle cx={ponto.cx} cy={ponto.cy} r={ponto.r} />
      </g>
    </svg>
  );
}
