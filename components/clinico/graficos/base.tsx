"use client";

import { useEffect, useRef, useState, type PointerEvent as EventoDoPonteiro, type ReactNode } from "react";
import { dataCurta } from "@/lib/consultas";
import { marcasDeMes } from "@/lib/evolucao";

// As peças comuns dos gráficos da aba Corpo (GraficoPeso e GraficoMedida): as
// cores, a geometria, medir a largura, a dica e as marcas do eixo X. Moravam
// dentro do GraficoPeso, e o GraficoMedida importava os internos dele.
//
// Só variáveis do tema clínico (`var(--clin-*)`): o escuro funciona sem uma
// segunda lista de cores, e os pares têm contraste testado em
// lib/temaClinico.ts (PARES_GRAFICO).

export const COR = {
  texto: "var(--clin-texto)",
  texto2: "var(--clin-texto-2)",
  chao: "var(--clin-chao)",
  linha: "var(--clin-linha)",
  campo: "var(--clin-campo)",
  primaria: "var(--clin-primaria)",
  fundoDaPrimaria: "var(--clin-primaria-fundo)",
};

export const TICK = { fontSize: 11, fill: COR.texto2 };

export const MARGEM = { top: 12, right: 10, bottom: 0, left: 0 };
export const LARGURA_Y = 34;
export const ALTURA_X = 24;
/** Folga do eixo X, em px, nas duas pontas: o ponto do dia 0 não encosta nos números do eixo Y. */
export const FOLGA = 10;
/** Abaixo disto o gráfico é de celular: menos marcas, menos altura. */
export const LARGURA_COMPACTA = 520;

/** Onde o gráfico desenha, em px dentro da caixa: o recharts usa a mesma conta. */
export function geometria(largura: number, altura: number) {
  return {
    esq: MARGEM.left + LARGURA_Y + FOLGA,
    dir: largura - MARGEM.right - FOLGA,
    topo: MARGEM.top,
    base: altura - MARGEM.bottom - ALTURA_X,
  };
}

/**
 * Marcas do eixo X: o dia 1 de cada mês. Com menos de duas (período curto), as
 * duas pontas em dd/mm: um eixo sem rótulo não diz de quando é o gráfico.
 */
export function marcasDoEixoX(inicio: string, fim: string, total: number): { dia: number; rotulo: string }[] {
  const meses = marcasDeMes(inicio, fim);
  return meses.length >= 2
    ? meses
    : [
        { dia: 0, rotulo: dataCurta(inicio) },
        { dia: total, rotulo: dataCurta(fim) },
      ];
}

/**
 * A caixa do gráfico: mede a largura (o recharts desenha em px) e guarda onde
 * o ponteiro está, em dias. Mouse: segue o cursor e some ao sair. Toque: um
 * toque mostra a dica e ela fica até outro toque fora do gráfico (o dedo
 * levantado dispara `pointerleave`, e apagar ali tiraria a dica na hora).
 * `touch-action: pan-y` deixa a página rolar na vertical e arrastar na
 * horizontal passa o dedo pelas semanas.
 */
export function useGrafico(total: number, alturaDe: (compacto: boolean) => number) {
  const ref = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(0);
  const [ponteiro, setPonteiro] = useState<{ dia: number; x: number } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => setLargura(Math.floor(el.getBoundingClientRect().width));
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  const aberta = ponteiro !== null;
  useEffect(() => {
    if (!aberta) return;
    const fora = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setPonteiro(null);
    };
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
  }, [aberta]);

  const compacto = largura > 0 && largura < LARGURA_COMPACTA;
  const altura = alturaDe(compacto);
  const g = geometria(largura, altura);

  function ler(e: EventoDoPonteiro<HTMLDivElement>) {
    const caixa = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - caixa.left;
    const y = e.clientY - caixa.top;
    if (x < g.esq - FOLGA || x > g.dir + FOLGA || y < 0 || y > g.base) return null;
    const dia = Math.round(((x - g.esq) / (g.dir - g.esq)) * total);
    return { dia: Math.min(total, Math.max(0, dia)), x };
  }
  const aoPonteiro = (e: EventoDoPonteiro<HTMLDivElement>) => {
    const p = ler(e);
    if (p) setPonteiro(p);
    else if (e.pointerType === "mouse") setPonteiro(null);
  };
  const aoSair = (e: EventoDoPonteiro<HTMLDivElement>) => {
    if (e.pointerType === "mouse") setPonteiro(null);
  };

  return {
    ref,
    largura,
    altura,
    compacto,
    g,
    ponteiro,
    /** x de um dia, em px dentro da caixa. */
    xDe: (dia: number) => g.esq + (dia / total) * (g.dir - g.esq),
    eventos: { onPointerMove: aoPonteiro, onPointerDown: aoPonteiro, onPointerLeave: aoSair },
  };
}

const LARGURA_DA_DICA = 224;

/** A caixa da dica, ao lado do ponteiro e sempre dentro do gráfico. */
export function CaixaDaDica({ x, largura, children }: { x: number; largura: number; children: ReactNode }) {
  let esquerda = x + 16;
  if (esquerda + LARGURA_DA_DICA > largura) esquerda = x - 16 - LARGURA_DA_DICA;
  esquerda = Math.max(0, Math.min(esquerda, largura - LARGURA_DA_DICA));
  return (
    <div
      role="tooltip"
      style={{ left: esquerda, top: 4, width: LARGURA_DA_DICA }}
      className="pointer-events-none absolute z-10 rounded-md border border-clin-linha bg-clin-chao px-3 py-2 text-[13px] leading-snug tabular-nums text-clin-texto shadow-md"
    >
      {children}
    </div>
  );
}
