"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CamposRegistro } from "@/lib/registro";
import { chamarRegistro } from "./acoes";

export type EstadoRascunho = "ocioso" | "salvando" | "salvo" | "erro";

/** Quanto esperar depois da última tecla para gravar. */
const ESPERA_MS = 1500;

function parar(relogio: { current: ReturnType<typeof setTimeout> | null }) {
  if (relogio.current) clearTimeout(relogio.current);
  relogio.current = null;
}

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
 * Gravação que falha não perde nada: o que ia nela volta a esperar (a não ser
 * que já haja algo mais novo, que é o formulário inteiro e inclui o que
 * falhou), `pendente` continua verdadeiro e a próxima tecla, o próximo blur
 * ou o "Tentar de novo" (`agora`) tentam outra vez. Enquanto há alteração
 * fora do banco, fechar ou recarregar a página cai no aviso do navegador.
 */
export function useSalvarRascunho(
  consultaId: string,
  inicial: { updatedAt: string | null }
): {
  salvar: (campos: CamposRegistro) => void;
  agora: () => Promise<boolean>;
  descartar: () => Promise<string | null>;
  estado: EstadoRascunho;
  salvoEm: string | null;
  erro: string | null;
  updatedAt: string | null;
  pendente: boolean;
} {
  const [estado, setEstado] = useState<EstadoRascunho>("ocioso");
  const [salvoEm, setSalvoEm] = useState<string | null>(inicial.updatedAt);
  const [erro, setErro] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(inicial.updatedAt);
  const [pendente, setPendente] = useState(false);

  // Refs e não estado: a gravação lê o valor de AGORA, quando a vez dela
  // chega, e não o do render em que foi pedida.
  const visto = useRef<string | null>(inicial.updatedAt);
  /** O formulário que ainda não foi para o banco (nulo = nada esperando). */
  const proximo = useRef<CamposRegistro | null>(null);
  /** A última gravação pedida; a seguinte espera ela terminar. */
  const fila = useRef<Promise<boolean>>(Promise.resolve(true));
  /** Já há uma gravação esperando a vez: outra chamada pega carona nela. */
  const naFila = useRef(false);
  const relogio = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      setEstado("salvo");
      if (!proximo.current) setPendente(false);
      return true;
    });
    fila.current = vez;
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
   * antes de concluir) e diz se tudo ficou no banco. Sem nada esperando, só
   * aguarda a gravação em voo, se houver.
   */
  const agora = useCallback((): Promise<boolean> => {
    parar(relogio);
    return proximo.current ? gravar() : fila.current;
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
    const r = await chamarRegistro("descartar_rascunho", { p_consulta: consultaId }).catch(() => ({
      erro: "Não foi possível descartar. Confira a conexão e tente de novo.",
      dados: null,
    }));
    if (r.erro) {
      // Não descartou: o que esperava gravação volta a esperar.
      proximo.current ??= guardado;
      return r.erro;
    }
    visto.current = null;
    fila.current = Promise.resolve(true);
    setUpdatedAt(null);
    setSalvoEm(null);
    setErro(null);
    setEstado("ocioso");
    setPendente(false);
    return null;
  }, [consultaId]);

  // Sair pelo app (um link, o Voltar) desmonta a página sem o aviso do
  // navegador. O que esperava os 1,5 s vai na hora; a chamada segue sozinha
  // depois de a tela sair.
  useEffect(
    () => () => {
      if (!relogio.current) return;
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

  return { salvar, agora, descartar, estado, salvoEm, erro, updatedAt, pendente };
}
