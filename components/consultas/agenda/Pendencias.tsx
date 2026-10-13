"use client";

import { useState } from "react";
import { rotuloDaConsulta, situacao, type Consulta } from "@/lib/consultas";

// Linha de aviso no topo da agenda. Não é a coluna "Precisa de você" do
// protótipo: o dono do produto achou a página bagunçada, e a lista completa
// já é a fila da Início. Aqui, uma linha com a conta e cada item abrindo o
// painel da consulta. Texto `texto` sobre `atencao-fundo`: par testado.
const MOSTRAR = 3;

export function Pendencias({
  pendencias,
  nomes,
  agora,
  abrir,
}: {
  pendencias: Consulta[];
  nomes: Record<string, string>;
  agora: string;
  abrir: (id: string) => void;
}) {
  const [todas, setTodas] = useState(false);
  if (pendencias.length === 0) return null;

  const pedidos = pendencias.filter((c) => {
    const s = situacao(c, agora);
    return s === "pedido" || s === "remarcar";
  }).length;
  const semDesfecho = pendencias.length - pedidos;
  const resumo = [
    pedidos ? `${pedidos} ${pedidos === 1 ? "pedido aguardando" : "pedidos aguardando"}` : null,
    semDesfecho
      ? `${semDesfecho} ${semDesfecho === 1 ? "consulta sem desfecho" : "consultas sem desfecho"}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const texto = (c: Consulta) => {
    const s = situacao(c, agora);
    const nome = nomes[c.patient_id] ?? "Paciente";
    if (s === "pedido") return `${nome} pediu consulta para ${rotuloDaConsulta(c)}`;
    if (s === "remarcar") return `${nome} pediu para remarcar a de ${rotuloDaConsulta(c)}`;
    return `${nome}: consulta de ${rotuloDaConsulta(c)} sem desfecho`;
  };

  const visiveis = todas ? pendencias : pendencias.slice(0, MOSTRAR);
  const BOTAO =
    "min-h-[44px] text-left text-[14px] text-clin-texto underline decoration-1 underline-offset-4 hover:decoration-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clin-atencao";

  return (
    <section aria-labelledby="pendencias-agenda" className="mb-6 rounded-md bg-clin-atencao-fundo px-4 py-2">
      <h2 id="pendencias-agenda" className="pt-1 text-[15px] font-semibold text-clin-texto">
        {resumo}
      </h2>
      <ul role="list" className="flex flex-col">
        {visiveis.map((c) => (
          <li key={c.id}>
            <button type="button" onClick={() => abrir(c.id)} className={BOTAO}>
              {texto(c)}
            </button>
          </li>
        ))}
        {!todas && pendencias.length > MOSTRAR && (
          <li>
            <button type="button" onClick={() => setTodas(true)} className={`${BOTAO} font-semibold`}>
              Ver mais {pendencias.length - MOSTRAR}
            </button>
          </li>
        )}
      </ul>
    </section>
  );
}
