"use client";

import { useId, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronDown, Loader2 } from "lucide-react";
import {
  CAMPOS_EXTRAS,
  CAMPOS_PRINCIPAIS,
  FAIXAS,
  LIMITES,
  erroDaMedida,
  imc,
  lerNumero,
  rotuloDaAnamnese,
  type CampoMedida,
  type CamposRegistro,
  type Medidas,
  type Registro,
} from "@/lib/registro";
import {
  dataCurta,
  horaEmSaoPaulo,
  rotuloDaConsulta,
  ROTULO_MODO,
  ROTULO_TIPO,
  type Consulta,
} from "@/lib/consultas";
import { dataNoBrasil } from "@/lib/date";
import { hrefDaAba } from "@/lib/abas";
import type { Res } from "@/lib/consultasDb";
import { ErroInline } from "@/components/clinico/ErroInline";
import { ErroSecao } from "@/components/clinico/ErroSecao";
import { ACAO_SECUNDARIA, FOCO, LINK } from "@/components/clinico/estilos";
import { CLASSE_SELO } from "@/components/consultas/aparencia";
import { useSalvarRascunho } from "./useSalvarRascunho";

type Parte = "anamnese" | "diagnostico" | "conduta" | "observar";
type Antes = Partial<Record<CampoMedida, { valor: number; data: string }>>;

const TODOS: CampoMedida[] = [...CAMPOS_PRINCIPAIS, ...CAMPOS_EXTRAS];

// Campos escritos com utilitários, e não com .input: dentro do tema clínico,
// no escuro, a cópia `.dark :where(.tema-clinico) .input` vence utilitário
// sem `dark:` (CLAUDE.md). A borda é `campo` (3:1 sobre o chão) ou `perigo`.
const CAMPO = `w-full rounded-md border bg-clin-chao px-3 text-clin-texto [color-scheme:light] dark:[color-scheme:dark] disabled:opacity-60 ${FOCO}`;
const TITULO_PARTE = "block text-[17px] font-semibold leading-snug text-clin-texto";
const AJUDA = "text-[14px] leading-snug text-clin-texto-2";

const AJUDA_ANAMNESE = {
  Anamnese: "Queixa, história, rotina, hábitos alimentares, sono, intestino e objetivos.",
  Evolução: "Como foi desde a última consulta: adesão, dificuldades, sintomas, rotina.",
} as const;

/** "71,8": o número como o nutri digitaria, com vírgula. */
function numero(v: number, casas = 2): string {
  return v.toLocaleString("pt-BR", { maximumFractionDigits: casas });
}

function rotuloDoCampo(c: CampoMedida): string {
  const f = FAIXAS[c];
  return f.unidade === "%" ? f.rotulo : `${f.rotulo} (${f.unidade})`;
}

/** A mensagem embaixo de um campo de medida, ou nulo se o texto vale. */
function erroDoCampo(c: CampoMedida, texto: string): string | null {
  const lido = lerNumero(texto);
  if (!lido.ok) return "Digite só o número, como 71,8.";
  return lido.valor == null ? null : erroDaMedida(c, lido.valor);
}

/**
 * O que vai ao banco. Medida inválida (texto que não é número, ou fora da
 * faixa) não vai: o banco recusaria o salvamento inteiro pela faixa
 * (`salvar_registro` confere as medidas também), e o texto das outras partes
 * ficaria sem gravar por causa de um campo. O campo fica marcado na tela.
 */
function montar(textos: Record<Parte, string>, medidas: Record<CampoMedida, string>): CamposRegistro {
  const m: Medidas = {};
  for (const c of TODOS) {
    const lido = lerNumero(medidas[c]);
    if (lido.ok && lido.valor != null && !erroDaMedida(c, lido.valor)) m[c] = lido.valor;
  }
  return { ...textos, medidas: m };
}

// O registro em rascunho (spec, "Página do registro"; maquetes 1 e 5): o topo
// com a situação do salvamento, as cinco partes e o contexto ao lado.
//
// Tudo salva sozinho (useSalvarRascunho); não há botão "Salvar". Sair de um
// campo grava na hora, e o "Salvando…"/"Salvo às" no topo diz onde está.
export function EditorRegistro({
  uid,
  nome,
  consulta,
  registro,
  anteriores,
  alturaCm,
  metas,
  contexto,
  hoje,
}: {
  uid: string;
  nome: string;
  consulta: Consulta;
  /** O rascunho desta consulta, ou nulo (o rascunho nasce na primeira tecla). */
  registro: Registro | null;
  /** O "antes" de cada medida (`anteriores` de lib/registro.ts); `falhou` se as medidas não carregaram. */
  anteriores: Res<Antes>;
  alturaCm: number | null;
  /** As metas em vigor já em texto ("1.800 kcal · …"); nulo = nenhuma definida. */
  metas: Res<string | null>;
  /** A coluna "Para esta consulta" (ContextoDaConsulta), montada pela página. */
  contexto: React.ReactNode;
  /** Hoje em São Paulo, do servidor: "Salvo às" (hoje) ou "Salvo em" (outro dia). */
  hoje: string;
}) {
  const router = useRouter();
  const ids = useId();
  const rascunho = useSalvarRascunho(consulta.id, { updatedAt: registro?.updated_at ?? null });
  const rotuloAnamnese = rotuloDaAnamnese(consulta.kind);

  const [textos, setTextos] = useState<Record<Parte, string>>({
    anamnese: registro?.anamnese ?? "",
    diagnostico: registro?.diagnostico ?? "",
    conduta: registro?.conduta ?? "",
    observar: registro?.observar ?? "",
  });
  const [medidas, setMedidas] = useState<Record<CampoMedida, string>>(() => {
    const m = {} as Record<CampoMedida, string>;
    for (const c of TODOS) {
      const v = registro?.medidas?.[c];
      m[c] = typeof v === "number" ? String(v).replace(".", ",") : "";
    }
    return m;
  });
  // O erro do campo aparece depois de sair dele: "7" a caminho de "71,8"
  // está fora da faixa, e o aviso piscaria a cada tecla.
  const [tocado, setTocado] = useState<Partial<Record<CampoMedida, boolean>>>({});
  const [maisMedidas, setMaisMedidas] = useState(() =>
    CAMPOS_EXTRAS.some((c) => typeof registro?.medidas?.[c] === "number")
  );
  const [descartando, setDescartando] = useState(false);
  const [erroDescarte, setErroDescarte] = useState<string | null>(null);
  const [, iniciar] = useTransition();

  // O formulário inteiro de agora, para cada tecla mandar tudo (o banco
  // grava as partes juntas) sem esperar o estado do React assentar.
  const atual = useRef({ textos, medidas });

  function mudarTexto(parte: Parte, valor: string) {
    const novo = { ...atual.current.textos, [parte]: valor };
    atual.current = { ...atual.current, textos: novo };
    setTextos(novo);
    rascunho.salvar(montar(novo, atual.current.medidas));
  }
  function mudarMedida(c: CampoMedida, valor: string) {
    const novo = { ...atual.current.medidas, [c]: valor };
    atual.current = { ...atual.current, medidas: novo };
    setMedidas(novo);
    rascunho.salvar(montar(atual.current.textos, novo));
  }
  const sair = () => void rascunho.agora();

  async function descartar() {
    if (
      !window.confirm(
        "Descartar o rascunho? O que foi escrito e medido nesta consulta será apagado."
      )
    )
      return;
    setDescartando(true);
    setErroDescarte(null);
    const erro = await rascunho.descartar();
    if (erro) {
      setErroDescarte(erro);
      setDescartando(false);
      return;
    }
    // O refresh depois do push: a aba Consultas pode estar no cache do
    // roteador (30 s para página dinâmica no Next 14) com o rascunho que
    // acabou de sair. `descartando` fica até esta página sair da tela.
    iniciar(() => {
      router.push(hrefDaAba(uid, "consultas"));
      router.refresh();
    });
  }

  const temRascunho = rascunho.updatedAt !== null || rascunho.pendente;
  const pesoLido = lerNumero(medidas.weight_kg);
  const peso =
    pesoLido.ok && pesoLido.valor != null && !erroDaMedida("weight_kg", pesoLido.valor) ? pesoLido.valor : null;
  const valorImc = imc(peso, alturaCm);

  const situacao = (() => {
    if (rascunho.estado === "salvando") return "Salvando…";
    if (rascunho.estado === "erro") return null;
    if (!rascunho.salvoEm) return temRascunho ? null : "Salva sozinho enquanto você escreve.";
    const dia = dataNoBrasil(rascunho.salvoEm);
    const hora = horaEmSaoPaulo(rascunho.salvoEm);
    return dia === hoje ? `Salvo às ${hora}` : `Salvo em ${dataCurta(dia)} às ${hora}`;
  })();

  // Função, e não componente: um componente declarado aqui seria outro a
  // cada render, e o botão perderia o foco do teclado.
  const acoes = (classe: string) =>
    temRascunho && (
      <div className={classe}>
        <button
          type="button"
          onClick={descartar}
          disabled={descartando}
          className={`inline-flex ${ACAO_SECUNDARIA} disabled:opacity-60`}
        >
          {descartando && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}
          Descartar rascunho
        </button>
      </div>
    );

  const textoArea = (parte: Parte, rotulo: string, linhas: number, ajuda?: string) => {
    const id = `${ids}-${parte}`;
    return (
      <section className="space-y-2">
        <label htmlFor={id} className={TITULO_PARTE}>
          {rotulo}
        </label>
        {ajuda && (
          <p id={`${id}-ajuda`} className={AJUDA}>
            {ajuda}
          </p>
        )}
        <textarea
          id={id}
          rows={linhas}
          value={textos[parte]}
          maxLength={LIMITES[parte]}
          aria-describedby={ajuda ? `${id}-ajuda` : undefined}
          onChange={(e) => mudarTexto(parte, e.target.value)}
          onBlur={sair}
          className={`${CAMPO} resize-y border-clin-campo py-2.5 text-[16px] leading-relaxed sm:text-[15px]`}
        />
      </section>
    );
  };

  const campoMedida = (c: CampoMedida) => {
    const id = `${ids}-${c}`;
    const erro = tocado[c] ? erroDoCampo(c, medidas[c]) : null;
    const antes = anteriores.data[c];
    return (
      <div key={c} className="flex min-w-0 flex-col gap-1.5">
        <label htmlFor={id} className="text-[14px] font-medium text-clin-texto">
          {rotuloDoCampo(c)}
        </label>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={medidas[c]}
          aria-invalid={erro ? true : undefined}
          aria-describedby={[antes && `${id}-antes`, erro && `${id}-erro`].filter(Boolean).join(" ") || undefined}
          onChange={(e) => mudarMedida(c, e.target.value)}
          onBlur={() => {
            setTocado((t) => (t[c] ? t : { ...t, [c]: true }));
            sair();
          }}
          className={`${CAMPO} min-h-[48px] text-[16px] tabular-nums sm:min-h-[44px] sm:text-[15px] ${
            erro ? "border-clin-perigo" : "border-clin-campo"
          }`}
        />
        {antes && (
          <p id={`${id}-antes`} className="text-[13px] tabular-nums text-clin-texto-2">
            antes {numero(antes.valor)} em {dataCurta(antes.data)}
          </p>
        )}
        {erro && (
          <p id={`${id}-erro`} className="rounded bg-clin-perigo-fundo px-2 py-1 text-[13px] text-clin-perigo">
            {erro}
          </p>
        )}
      </div>
    );
  };

  return (
    <div>
      <header className="border-b border-clin-linha pb-5">
        <Link
          href={hrefDaAba(uid, "consultas")}
          className={`inline-flex min-h-[40px] items-center gap-1 rounded-md text-[14px] text-clin-texto-2 hover:text-clin-primaria ${FOCO}`}
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" /> {nome} · Consultas
        </Link>
        <div className="mt-1 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h1 className="break-words text-[21px] font-semibold leading-tight text-clin-texto sm:text-2xl">
              Consulta de {rotuloDaConsulta(consulta)}
            </h1>
            <p className="mt-1 text-[15px] text-clin-texto-2">
              {ROTULO_TIPO[consulta.kind].charAt(0).toUpperCase() + ROTULO_TIPO[consulta.kind].slice(1)} ·{" "}
              {ROTULO_MODO[consulta.mode]} · {consulta.duration_min} min
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-[14px] text-clin-texto-2">
              {temRascunho && (
                <span className={`${CLASSE_SELO} bg-clin-atencao-fundo text-clin-atencao`}>Rascunho</span>
              )}
              <span data-status-rascunho aria-live="polite" className="tabular-nums">
                {situacao}
              </span>
              {rascunho.estado === "erro" && (
                <span role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="rounded bg-clin-perigo-fundo px-2 py-1 text-clin-perigo">{rascunho.erro}</span>
                  <button type="button" onClick={sair} className={`inline-flex ${LINK}`}>
                    Tentar de novo
                  </button>
                </span>
              )}
            </div>
          </div>
          {acoes("hidden shrink-0 flex-wrap gap-2 lg:flex")}
        </div>
        <ErroInline mensagem={erroDescarte} />
      </header>

      <div className="mt-6 xl:grid xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start xl:gap-8">
        {/* O contexto vem antes no HTML: no celular ele fica no topo (com o
            "observar" à vista); a partir de `xl` o grid o põe à direita. */}
        <div className="xl:sticky xl:top-6 xl:order-2">{contexto}</div>

        {/* fieldset só pelo `disabled`: descartando, nenhuma tecla agenda uma
            gravação que recriaria o rascunho depois do descarte. */}
        <fieldset disabled={descartando} className="mt-8 min-w-0 space-y-8 xl:order-1 xl:mt-0">
          {textoArea("anamnese", rotuloAnamnese, 6, AJUDA_ANAMNESE[rotuloAnamnese])}

          <section aria-labelledby={`${ids}-medidas`} className="space-y-3">
            <h2 id={`${ids}-medidas`} className={TITULO_PARTE}>
              Medidas
            </h2>
            {anteriores.falhou && <ErroSecao secao="as medidas anteriores" />}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">{CAMPOS_PRINCIPAIS.map(campoMedida)}</div>
            <div className="flex flex-col gap-1 text-[14px] text-clin-texto-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4">
              <p data-imc className="tabular-nums">
                {alturaCm == null || alturaCm <= 0 ? (
                  "IMC: altura não informada no perfil"
                ) : valorImc == null ? (
                  `IMC: preencha o peso · altura do perfil ${numero(alturaCm, 1)} cm`
                ) : (
                  <>
                    <strong className="font-semibold text-clin-texto">
                      IMC {valorImc.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                    </strong>{" "}
                    · calculado com a altura do perfil ({numero(alturaCm, 1)} cm)
                  </>
                )}
              </p>
              <button
                type="button"
                aria-expanded={maisMedidas}
                aria-controls={`${ids}-extras`}
                onClick={() => setMaisMedidas((a) => !a)}
                className={`inline-flex self-start text-left ${LINK}`}
              >
                Mais medidas: tórax, braço, coxa, panturrilha, pescoço
                <ChevronDown
                  aria-hidden="true"
                  className={`h-4 w-4 shrink-0 transition-transform ${maisMedidas ? "rotate-180" : ""}`}
                />
              </button>
            </div>
            <div
              id={`${ids}-extras`}
              className={`${maisMedidas ? "grid" : "hidden"} grid-cols-2 gap-4 sm:grid-cols-4`}
            >
              {CAMPOS_EXTRAS.map(campoMedida)}
            </div>
          </section>

          {textoArea("diagnostico", "Diagnóstico nutricional", 3)}

          <div className="space-y-2">
            {textoArea("conduta", "Conduta", 4)}
            {metas.falhou ? (
              <ErroSecao secao="as metas em vigor" />
            ) : (
              <p className="flex flex-wrap items-center gap-x-3 text-[14px] text-clin-texto-2">
                <span>Metas em vigor: {metas.data ?? "nenhuma definida"}</span>
                <Link href={hrefDaAba(uid, "alimentacao")} className={`inline-flex ${LINK}`}>
                  Ajustar na aba Alimentação
                </Link>
              </p>
            )}
          </div>

          {textoArea("observar", "Observar no retorno", 2, "Aparece no topo do próximo registro.")}
        </fieldset>
      </div>

      {/* Celular: as ações presas no rodapé (maquete 5), logo acima da barra
          de navegação do AppShell, que é fixa e tem 61,5 px: com 61 a barra
          daqui entra meio pixel embaixo dela, em vez de deixar uma fresta por
          onde o texto aparece rolando. No computador as ações ficam no topo. */}
      {acoes(
        "sticky bottom-[61px] z-10 -mx-4 mt-8 flex gap-2 border-t border-clin-linha bg-clin-chao px-4 py-3 lg:hidden [&>button]:flex-1"
      )}
    </div>
  );
}
