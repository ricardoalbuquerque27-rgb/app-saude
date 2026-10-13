"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import {
  CAMPOS_EXTRAS,
  CAMPOS_PRINCIPAIS,
  FAIXAS,
  LIMITES,
  lerMedida,
  rotuloDaAnamnese,
  type CampoMedida,
  type CamposRegistro,
  type Medidas,
  type Registro,
} from "@/lib/registro";
import { dataCurta, horaEmSaoPaulo, rotuloDaConsulta, ROTULO_MODO, ROTULO_TIPO, type Consulta } from "@/lib/consultas";
import { dataNoBrasil } from "@/lib/date";
import { hrefDaAba } from "@/lib/abas";
import type { Res } from "@/lib/consultasDb";
import { ErroInline } from "@/components/clinico/ErroInline";
import { ErroSecao } from "@/components/clinico/ErroSecao";
import { ACAO_SECUNDARIA, FOCO, LINK } from "@/components/clinico/estilos";
import { CLASSE_SELO } from "@/components/consultas/aparencia";
import { CAMPO, CamposDeMedida, type Antes } from "./CamposDeMedida";
import { useSalvarRascunho } from "./useSalvarRascunho";

type Parte = "anamnese" | "diagnostico" | "conduta" | "observar";

const TODOS: CampoMedida[] = [...CAMPOS_PRINCIPAIS, ...CAMPOS_EXTRAS];
const TITULO_PARTE = "block text-[17px] font-semibold leading-snug text-clin-texto";
const AJUDA = "text-[14px] leading-snug text-clin-texto-2";
/** Parou de digitar numa medida por este tempo: o erro dela aparece (como o salvamento, 1,5 s). */
const TOQUE_MS = 1500;

const AJUDA_ANAMNESE = {
  Anamnese: "Queixa, história, rotina, hábitos alimentares, sono, intestino e objetivos.",
  Evolução: "Como foi desde a última consulta: adesão, dificuldades, sintomas, rotina.",
} as const;

/**
 * O formulário que um registro abre: os textos, as medidas como o nutri as
 * digitaria ("66,4") e as que valem em número. Serve à primeira montagem e a
 * quando o banco tem outro rascunho que o da página (useSalvarRascunho,
 * `aoConferir`): o mesmo caminho nos dois, para não divergirem.
 */
function formularioDe(r: Registro | null) {
  const medidas = {} as Record<CampoMedida, string>;
  const validas: Medidas = {};
  for (const c of TODOS) {
    const v = r?.medidas?.[c];
    medidas[c] = typeof v === "number" ? String(v).replace(".", ",") : "";
    if (typeof v === "number") validas[c] = v;
  }
  return {
    textos: {
      anamnese: r?.anamnese ?? "",
      diagnostico: r?.diagnostico ?? "",
      conduta: r?.conduta ?? "",
      observar: r?.observar ?? "",
    } as Record<Parte, string>,
    medidas,
    validas,
    maisMedidas: CAMPOS_EXTRAS.some((c) => typeof r?.medidas?.[c] === "number"),
  };
}

/**
 * O que vai ao banco. Medida vazia sai (apaga). Medida inválida (texto que não
 * é número, ou fora da faixa) vai com o último valor que valia: o banco grava
 * as medidas inteiras a cada salvamento, e omitir o campo apagava a medida
 * que já estava salva, com o topo dizendo "Salvo". Mandar o inválido também
 * não serve: o banco recusa o salvamento inteiro pela faixa, e o texto das
 * outras partes ficaria sem gravar por causa de um campo.
 */
function montar(textos: Record<Parte, string>, medidas: Record<CampoMedida, string>, validas: Medidas): CamposRegistro {
  const m: Medidas = {};
  for (const c of TODOS) {
    const lido = lerMedida(c, medidas[c]);
    const v = lido.ok ? lido.valor : validas[c];
    if (v != null) m[c] = v;
  }
  return { ...textos, medidas: m };
}

/** "Valor não salvo em Peso: corrija o campo." */
function avisoDasRetidas(campos: CampoMedida[]): string {
  const nomes = campos.map((c) => FAIXAS[c].rotulo);
  if (nomes.length === 1) return `Valor não salvo em ${nomes[0]}: corrija o campo.`;
  const lista = `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
  return `Valores não salvos em ${lista}: corrija os campos.`;
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
  const rotuloAnamnese = rotuloDaAnamnese(consulta.kind);

  const [inicio] = useState(() => formularioDe(registro));
  const [textos, setTextos] = useState(inicio.textos);
  const [medidas, setMedidas] = useState(inicio.medidas);
  const [maisMedidas, setMaisMedidas] = useState(inicio.maisMedidas);
  // O erro de uma medida aparece depois de sair dela ou de parar de digitar.
  const [tocado, setTocado] = useState<Partial<Record<CampoMedida, boolean>>>({});
  const [descartando, setDescartando] = useState(false);
  const [erroDescarte, setErroDescarte] = useState<string | null>(null);
  const [, iniciar] = useTransition();

  // O formulário inteiro de agora, para cada tecla mandar tudo (o banco
  // grava as partes juntas) sem esperar o estado do React assentar; e a
  // última medida que valia de cada campo (ver `montar`).
  const atual = useRef({ textos: inicio.textos, medidas: inicio.medidas });
  const validas = useRef<Medidas>(inicio.validas);
  const relogioToque = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (relogioToque.current) clearTimeout(relogioToque.current);
  }, []);

  const retidas = TODOS.filter((c) => !lerMedida(c, medidas[c]).ok);
  const rascunho = useSalvarRascunho(
    consulta.id,
    { updatedAt: registro?.updated_at ?? null },
    { retido: retidas.length > 0, aoConferir }
  );

  /** O banco tem outro rascunho que o desta página (veio do cache do roteador). */
  function aoConferir(noBanco: Registro | null) {
    if (noBanco?.status === "concluido") {
      router.refresh();
      return;
    }
    const f = formularioDe(noBanco);
    atual.current = { textos: f.textos, medidas: f.medidas };
    validas.current = f.validas;
    setTextos(f.textos);
    setMedidas(f.medidas);
    setMaisMedidas(f.maisMedidas);
    setTocado({});
  }

  function mudarTexto(parte: Parte, valor: string) {
    const novo = { ...atual.current.textos, [parte]: valor };
    atual.current = { ...atual.current, textos: novo };
    setTextos(novo);
    rascunho.salvar(montar(novo, atual.current.medidas, validas.current));
  }
  function mudarMedida(c: CampoMedida, valor: string) {
    const novo = { ...atual.current.medidas, [c]: valor };
    atual.current = { ...atual.current, medidas: novo };
    const lido = lerMedida(c, valor);
    if (lido.ok) {
      const v = { ...validas.current };
      if (lido.valor == null) delete v[c];
      else v[c] = lido.valor;
      validas.current = v;
    }
    setMedidas(novo);
    rascunho.salvar(montar(atual.current.textos, novo, validas.current));
    if (relogioToque.current) clearTimeout(relogioToque.current);
    relogioToque.current = setTimeout(() => tocar(c), TOQUE_MS);
  }
  function tocar(c: CampoMedida) {
    setTocado((t) => (t[c] ? t : { ...t, [c]: true }));
  }
  const sair = () => void rascunho.agora();

  async function descartar() {
    if (!window.confirm("Descartar o rascunho? O que foi escrito e medido nesta consulta será apagado.")) return;
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
  const avisadas = retidas.filter((c) => tocado[c]);
  const desligado = descartando || rascunho.conferindo;

  const situacao = (() => {
    if (rascunho.conferindo) return "Conferindo o rascunho…";
    if (rascunho.estado === "erro") return null;
    if (rascunho.estado === "salvando") return "Salvando…";
    // Medida inválida na tela não está no banco: "Salvo às" seria mentira.
    if (avisadas.length) return avisoDasRetidas(avisadas);
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
          disabled={desligado}
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

        {/* fieldset só pelo `disabled`. Conferindo o banco ao abrir, uma tecla
            iria com o rascunho que veio da página, talvez velho; descartando,
            ela agendaria uma gravação que recriaria o rascunho. */}
        <fieldset disabled={desligado} aria-busy={rascunho.conferindo} className="mt-8 min-w-0 space-y-8 xl:order-1 xl:mt-0">
          {textoArea("anamnese", rotuloAnamnese, 6, AJUDA_ANAMNESE[rotuloAnamnese])}

          <CamposDeMedida
            idBase={ids}
            valores={medidas}
            tocado={tocado}
            anteriores={anteriores}
            alturaCm={alturaCm}
            aberto={maisMedidas}
            aoAlternar={() => setMaisMedidas((a) => !a)}
            aoMudar={mudarMedida}
            aoSair={(c) => {
              tocar(c);
              sair();
            }}
          />

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
