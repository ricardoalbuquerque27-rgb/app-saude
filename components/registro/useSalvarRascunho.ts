"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CamposRegistro, Registro } from "@/lib/registro";
import { getRegistroDaConsulta } from "@/lib/registroDb";
import { chamarRegistro } from "./acoes";

export type EstadoRascunho = "ocioso" | "salvando" | "salvo" | "erro";

/** Quanto esperar depois da última tecla para gravar. */
const ESPERA_MS = 1500;

function parar(relogio: { current: ReturnType<typeof setTimeout> | null }) {
  if (relogio.current) clearTimeout(relogio.current);
  relogio.current = null;
}

/**
 * A última gravação de cada consulta, de qualquer editor desta aba do
 * navegador. Sair por um link manda o que esperava os 1,5 s (ver o efeito de
 * desmontar), e o editor que abre logo depois na mesma consulta (o Voltar)
 * espera essa gravação antes de conferir o banco: lendo antes, ele pegaria o
 * `updated_at` de antes dela, e a primeira tecla seria recusada como "mudou
 * em outra aba".
 */
const ultimaGravacao = new Map<string, Promise<boolean>>();

/**
 * O rascunho do registro da consulta salva sozinho: 1,5 s depois da última
 * alteração (`salvar`) e na hora em que o nutri sai de um campo (`agora`).
 * Não há cópia no navegador: o registro é prontuário, e num computador
 * compartilhado o texto clínico ficaria lá para o próximo (spec, "o rascunho
 * só nasce quando o nutri começa a digitar"). O banco é o único lugar.
 *
 * UMA gravação por vez. Cada uma manda o `updated_at` que a anterior
 * devolveu (`p_visto_em`), e o banco recusa um valor velho como "mudou em
 * outra aba". Duas gravações ao mesmo tempo mandariam o mesmo `p_visto_em`,
 * e a segunda seria recusada sem que houvesse outra aba nenhuma: o nutri que
 * digita enquanto a primeira está em voo veria o aviso e perderia o texto.
 * Por isso a chamada que chega durante uma gravação vira a PRÓXIMA (fica na
 * fila, uma só), e só lê o `updated_at` quando a dela começa.
 *
 * O `updated_at` é guardado como o TEXTO que o banco mandou, nunca passa por
 * `Date`: o `Date` corta os microssegundos, e toda gravação seguinte seria
 * recusada como "mudou em outra aba".
 *
 * Ao abrir, confere o banco (`conferindo`): o Voltar do navegador e um link
 * para uma página vista há menos de 30 s mostram a página do cache do
 * roteador do Next, montada com o rascunho de ANTES, e o editor partiria de
 * um texto e de um `updated_at` velhos; a primeira tecla seria recusada como
 * "mudou em outra aba" e apagaria da tela o que estava no banco. Se o banco
 * tem outro, `aoConferir` recebe o que está lá (para o formulário refazer),
 * e o `updated_at` passa a ser o dele. Se a leitura falha, segue com o que
 * veio da página: a trava do banco continua valendo.
 *
 * Gravação que falha não perde nada: o que ia nela volta a esperar (a não ser
 * que já haja algo mais novo, que é o formulário inteiro e inclui o que
 * falhou), `pendente` continua verdadeiro e a próxima tecla, o próximo blur
 * ou o "Tentar de novo" (`agora`) tentam outra vez. `retido` é o que o
 * formulário não pode mandar (uma medida inválida): conta como pendente.
 * Enquanto há alteração fora do banco, fechar ou recarregar a página cai no
 * aviso do navegador.
 */
export function useSalvarRascunho(
  consultaId: string,
  inicial: { updatedAt: string | null },
  opcoes: {
    /** Há alteração na tela que não pode ir ao banco (medida inválida). */
    retido?: boolean;
    /** O banco tem outro registro que o desta página (ou nenhum); chamado uma vez, ao abrir. */
    aoConferir?: (noBanco: Registro | null) => void;
  } = {}
): {
  salvar: (campos: CamposRegistro) => void;
  agora: () => Promise<boolean>;
  descartar: () => Promise<string | null>;
  estado: EstadoRascunho;
  salvoEm: string | null;
  erro: string | null;
  updatedAt: string | null;
  pendente: boolean;
  conferindo: boolean;
} {
  const [estado, setEstado] = useState<EstadoRascunho>("ocioso");
  const [salvoEm, setSalvoEm] = useState<string | null>(inicial.updatedAt);
  const [erro, setErro] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(inicial.updatedAt);
  const [naFilaOuEmVoo, setPendente] = useState(false);
  const [conferindo, setConferindo] = useState(true);
  const retido = !!opcoes.retido;
  const pendente = naFilaOuEmVoo || retido;

  // Refs e não estado: a gravação lê o valor de AGORA, quando a vez dela
  // chega, e não o do render em que foi pedida.
  const inicio = useRef(inicial.updatedAt);
  const visto = useRef<string | null>(inicial.updatedAt);
  /** O formulário que ainda não foi para o banco (nulo = nada esperando). */
  const proximo = useRef<CamposRegistro | null>(null);
  /** A última gravação pedida; a seguinte espera ela terminar. */
  const fila = useRef<Promise<boolean>>(Promise.resolve(true));
  /** Já há uma gravação esperando a vez: outra chamada pega carona nela. */
  const naFila = useRef(false);
  const relogio = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retidoAgora = useRef(retido);
  retidoAgora.current = retido;
  const aoConferir = useRef(opcoes.aoConferir);
  aoConferir.current = opcoes.aoConferir;

  useEffect(() => {
    let vivo = true;
    (async () => {
      await ultimaGravacao.get(consultaId);
      const r = await getRegistroDaConsulta(createClient(), consultaId).catch(() => ({
        data: null,
        falhou: true,
      }));
      if (!vivo) return;
      if (!r.falhou && (r.data?.updated_at ?? null) !== inicio.current) {
        const noBanco = r.data;
        aoConferir.current?.(noBanco);
        // Concluído em outra aba: quem chama recarrega a página, que mostra o
        // registro travado; até lá o formulário fica desligado.
        if (noBanco?.status === "concluido") return;
        visto.current = noBanco?.updated_at ?? null;
        setUpdatedAt(visto.current);
        setSalvoEm(visto.current);
      }
      setConferindo(false);
    })();
    return () => {
      vivo = false;
    };
  }, [consultaId]);

  const gravar = useCallback((): Promise<boolean> => {
    if (naFila.current) return fila.current;
    naFila.current = true;
    const vez = fila.current.then(async () => {
      naFila.current = false;
      const campos = proximo.current;
      if (!campos) return true;
      proximo.current = null;
      setEstado("salvando");
      let r: Awaited<ReturnType<typeof chamarRegistro>>;
      try {
        r = await chamarRegistro("salvar_registro", {
          p_consulta: consultaId,
          p_campos: campos,
          p_visto_em: visto.current,
        });
      } catch {
        r = { erro: "Não foi possível salvar. Confira a conexão e tente de novo.", dados: null };
      }
      const novo = r.dados?.updated_at;
      // `ok` sem `updated_at` também é falha: sem ele a gravação seguinte iria
      // com o valor velho e seria recusada como "mudou em outra aba".
      if (r.erro || !novo) {
        proximo.current ??= campos;
        setErro(r.erro ?? "Não foi possível salvar.");
        setEstado("erro");
        return false;
      }
      visto.current = novo;
      setUpdatedAt(novo);
      setSalvoEm(novo);
      setErro(null);
      // Com alteração mais nova esperando, ainda não está tudo salvo: "Salvo
      // às" aqui daria a hora de um texto que já não é o da tela.
      if (proximo.current) {
        setEstado("salvando");
      } else {
        setEstado("salvo");
        setPendente(false);
      }
      return true;
    });
    fila.current = vez;
    ultimaGravacao.set(consultaId, vez);
    return vez;
  }, [consultaId]);

  const salvar = useCallback(
    (campos: CamposRegistro) => {
      proximo.current = campos;
      setPendente(true);
      parar(relogio);
      relogio.current = setTimeout(() => {
        relogio.current = null;
        void gravar();
      }, ESPERA_MS);
    },
    [gravar]
  );

  /**
   * Grava já o que estiver esperando (sair de um campo, "Tentar de novo",
   * antes de concluir) e diz se TUDO ficou no banco. Sem nada esperando, só
   * aguarda a gravação em voo, se houver. O que for digitado enquanto ela voa
   * vai em seguida, até não sobrar nada (ou até a primeira falha): sem isso,
   * `true` podia chegar com uma alteração ainda esperando. Medida inválida na
   * tela (`retido`) também é "não está tudo no banco".
   */
  const agora = useCallback(async (): Promise<boolean> => {
    parar(relogio);
    let ok = await (proximo.current ? gravar() : fila.current);
    while (ok && proximo.current) {
      parar(relogio);
      ok = await gravar();
    }
    return ok && !retidoAgora.current;
  }, [gravar]);

  /**
   * Apaga o rascunho no banco. Devolve a mensagem de erro, ou nulo.
   *
   * Espera a gravação em voo terminar antes: a primeira vai com `p_visto_em`
   * nulo, que o banco aceita como "criar", e chegando depois do descarte ela
   * criaria o rascunho de novo. Deu certo, o `updated_at` volta a nulo: um
   * rascunho novo nesta tela é outro, e nasce como o primeiro (com o valor
   * velho, o banco recusaria como "mudou em outra aba").
   */
  const descartar = useCallback(async (): Promise<string | null> => {
    parar(relogio);
    await fila.current;
    const guardado = proximo.current;
    proximo.current = null;
    const r = await chamarRegistro("descartar_rascunho", { p_consulta: consultaId }, "descartar").catch(
      () => ({
        erro: "Não foi possível descartar. Confira a conexão e tente de novo.",
        dados: null,
      })
    );
    if (r.erro) {
      // Não descartou: o que esperava gravação volta a esperar.
      proximo.current ??= guardado;
      return r.erro;
    }
    visto.current = null;
    fila.current = Promise.resolve(true);
    ultimaGravacao.delete(consultaId);
    setUpdatedAt(null);
    setSalvoEm(null);
    setErro(null);
    setEstado("ocioso");
    setPendente(false);
    return null;
  }, [consultaId]);

  // Sair pelo app (um link, o Voltar) desmonta a página sem o aviso do
  // navegador. O que ainda não foi para o banco vai na hora (o que esperava
  // os 1,5 s, e também o que uma gravação que falhou devolveu à fila); a
  // chamada segue sozinha depois de a tela sair.
  useEffect(
    () => () => {
      if (!proximo.current) return;
      parar(relogio);
      void gravar();
    },
    [gravar]
  );

  // Fechar ou recarregar com alteração fora do banco: o aviso do navegador.
  useEffect(() => {
    if (!pendente) return;
    function aoSair(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", aoSair);
    return () => window.removeEventListener("beforeunload", aoSair);
  }, [pendente]);

  return { salvar, agora, descartar, estado, salvoEm, erro, updatedAt, pendente, conferindo };
}
