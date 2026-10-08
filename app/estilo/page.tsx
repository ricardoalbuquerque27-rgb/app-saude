import { notFound } from "next/navigation";
import colors from "tailwindcss/colors";
import config from "@/tailwind.config";

// Guia de estilo — SÓ desenvolvimento.
//
// Existe porque o app roda num container sem acesso ao banco: as telas
// logadas não renderizam aqui, mas as CLASSES do design renderizam, porque
// não dependem de dado nenhum. Esta página mostra as peças soltas (cor,
// tipografia, componentes, densidade) nos dois temas, lado a lado.
//
// Não é maquete nem cópia: é o mesmo CSS que o app usa. Mudar um valor no
// tailwind.config.ts ou no globals.css muda aqui e muda no app junto — é
// esse o ponto.

export const dynamic = "force-static";

const brand = (config.theme?.extend?.colors as any).brand as Record<string, string>;

// ---------- contraste WCAG ----------
function rgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as any;
}
function lum(c: [number, number, number]) {
  const [r, g, b] = c.map((v) => {
    const x = v / 255;
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function razao(a: string, b: string) {
  const [la, lb] = [lum(rgb(a)), lum(rgb(b))];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
/** Superfície dos cards: branco no claro, slate-900/50 sobre o fundo escuro. */
const FUNDO_CLARO = "#ffffff";
const FUNDO_ESCURO = "#0b111e";

function Nota({ r }: { r: number }) {
  const [rotulo, cor] =
    r >= 4.5
      ? ["AA", "bg-brand-100 text-brand-800"]
      : r >= 3
        ? ["grande", "bg-amber-100 text-amber-800"]
        : ["falha", "bg-rose-100 text-rose-800"];
  return (
    <span className={`rounded px-1 py-px text-[10px] font-bold ${cor}`}>
      {r.toFixed(2)} {rotulo}
    </span>
  );
}

// ---------- blocos ----------

function Cores({ escuro }: { escuro: boolean }) {
  const fundo = escuro ? FUNDO_ESCURO : FUNDO_CLARO;
  const escalas: [string, Record<string, string>][] = [
    ["brand", brand],
    ["slate", colors.slate as any],
    ["rose", colors.rose as any],
    ["amber", colors.amber as any],
  ];
  return (
    <Secao titulo="Cores" nota="Razão de contraste do tom como TEXTO sobre a superfície do card deste tema.">
      <div className="space-y-4">
        {escalas.map(([nome, escala]) => (
          <div key={nome}>
            <p className="eyebrow mb-1.5">{nome}</p>
            <div className="grid grid-cols-6 gap-1 sm:grid-cols-11">
              {["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"].map(
                (tom) => {
                  const hex = escala[tom];
                  if (!hex) return <div key={tom} />;
                  return (
                    <div key={tom} className="text-center">
                      <div
                        className="h-9 w-full rounded-md border border-black/10 dark:border-white/10"
                        style={{ backgroundColor: hex }}
                      />
                      <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                        {tom}
                      </p>
                      <Nota r={razao(hex, fundo)} />
                    </div>
                  );
                }
              )}
            </div>
          </div>
        ))}
      </div>
    </Secao>
  );
}

function Tipografia() {
  // Os tamanhos que o app usa hoje, por frequência (levantados no código).
  const escala: [string, string, number][] = [
    ["text-[11px]", "text-[11px]", 98],
    ["text-xs", "text-xs", 242],
    ["text-sm", "text-sm", 262],
    ["text-base", "text-base", 7],
    ["text-lg", "text-lg", 23],
    ["text-xl", "text-xl", 15],
    ["text-2xl", "text-2xl", 28],
    ["text-3xl", "text-3xl", 6],
    ["text-4xl", "text-4xl", 12],
    ["text-5xl", "text-5xl", 13],
  ];
  return (
    <Secao
      titulo="Tipografia"
      nota="10 tamanhos em uso (eram 14 antes de 9px e 10px saírem). A proposta é cortar para 5 ou 6."
    >
      <div className="space-y-2">
        {escala.map(([rotulo, cls, usos]) => (
          <div key={rotulo} className="flex items-baseline gap-3 border-b border-slate-100 pb-2 dark:border-slate-800">
            <code className="w-28 shrink-0 text-[11px] text-slate-500 dark:text-slate-400">
              {rotulo}
            </code>
            <span className="w-12 shrink-0 text-[11px] text-slate-400 dark:text-slate-400">
              {usos}×
            </span>
            <span className={`${cls} truncate font-semibold text-slate-900 dark:text-white`}>
              Acompanhe cada evolução
            </span>
          </div>
        ))}
      </div>
    </Secao>
  );
}

function Componentes() {
  return (
    <Secao titulo="Componentes" nota="As classes reais de globals.css — não há cópia aqui.">
      <div className="space-y-4">
        <div>
          <p className="eyebrow mb-1.5">Botões</p>
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn-primary px-4 py-2">Salvar</button>
            <button className="btn-ghost px-4 py-2">Cancelar</button>
            <button className="btn-primary px-4 py-2" disabled>
              Desabilitado
            </button>
            <span className="chip">chip</span>
            <span className="icon-badge">
              <span className="text-xs font-bold">12</span>
            </span>
          </div>
        </div>

        <div>
          <p className="eyebrow mb-1.5">Campo</p>
          <input className="input" placeholder="voce@email.com" />
        </div>

        <div>
          <p className="eyebrow mb-1.5">Cartão comum</p>
          <div className="card">
            <h3 className="section-title mb-1">
              <span className="icon-badge">
                <span className="text-xs">★</span>
              </span>
              Título de seção
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Texto secundário, que é onde o contraste costuma quebrar.
            </p>
          </div>
        </div>

        <div>
          <p className="eyebrow mb-1.5">Cartão em destaque</p>
          <div className="card card-accent pl-6">
            <h3 className="section-title mb-1">
              <span className="icon-badge">
                <span className="text-xs">★</span>
              </span>
              Hoje
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Mesmo texto, sobre a superfície tingida.
            </p>
          </div>
        </div>
      </div>
    </Secao>
  );
}

function Densidade() {
  const opcoes: [string, string][] = [
    ["Compacto — p-3.5, rounded-xl", "rounded-xl p-3.5"],
    ["Atual — p-5, rounded-2xl", "rounded-2xl p-5"],
    ["Folgado — p-7, rounded-3xl", "rounded-3xl p-7"],
  ];
  return (
    <Secao titulo="Densidade" nota="O mesmo cartão com três espaçamentos. Escolher um e aplicar no .card.">
      <div className="space-y-3">
        {opcoes.map(([rotulo, cls]) => (
          <div key={rotulo}>
            <p className="eyebrow mb-1.5">{rotulo}</p>
            <div
              className={`border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_12px_28px_-18px_rgba(16,24,40,0.12)] dark:border-white/[0.06] dark:bg-slate-900/50 ${cls}`}
            >
              <p className="font-semibold text-slate-900 dark:text-white">
                Treino de hoje
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Treino B — Inferiores · 4 exercícios
              </p>
            </div>
          </div>
        ))}
      </div>
    </Secao>
  );
}

function Secao({
  titulo,
  nota,
  children,
}: {
  titulo: string;
  nota?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
        {titulo}
      </h2>
      {nota && (
        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">{nota}</p>
      )}
      {children}
    </section>
  );
}

function Painel({ escuro }: { escuro: boolean }) {
  return (
    <div
      className={escuro ? "dark" : ""}
      style={{ backgroundColor: escuro ? "#070b11" : "#f9fafb" }}
    >
      <div className="p-5">
        <p className="eyebrow mb-4">{escuro ? "Tema escuro" : "Tema claro"}</p>
        <Cores escuro={escuro} />
        <Tipografia />
        <Componentes />
        <Densidade />
      </div>
    </div>
  );
}

export default function GuiaDeEstilo() {
  // Nunca em produção: é ferramenta de trabalho, não tela do produto.
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="min-h-dvh bg-white">
      <div className="border-b border-slate-200 px-5 py-4">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          Guia de estilo
        </h1>
        <p className="text-sm text-slate-500">
          Só em desenvolvimento. As peças do design nos dois temas, para ajustar
          vendo o resultado.
        </p>
      </div>
      <div className="grid lg:grid-cols-2">
        <Painel escuro={false} />
        <Painel escuro={true} />
      </div>
    </main>
  );
}
