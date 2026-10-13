"use client";

import { ChevronDown } from "lucide-react";
import {
  CAMPOS_EXTRAS,
  CAMPOS_PRINCIPAIS,
  FAIXAS,
  imc,
  lerMedida,
  type CampoMedida,
} from "@/lib/registro";
import { dataCurta } from "@/lib/consultas";
import type { Res } from "@/lib/consultasDb";
import { ErroSecao } from "@/components/clinico/ErroSecao";
import { FOCO, LINK } from "@/components/clinico/estilos";

/** O "antes" de cada medida (`anteriores` de lib/registro.ts). */
export type Antes = Partial<Record<CampoMedida, { valor: number; data: string }>>;

// Campos escritos com utilitários, e não com .input: dentro do tema clínico,
// no escuro, a cópia `.dark :where(.tema-clinico) .input` vence utilitário
// sem `dark:` (CLAUDE.md). A borda (`campo`, 3:1 sobre o chão, ou `perigo`)
// fica com quem usa. Serve também aos textos do EditorRegistro.
export const CAMPO = `w-full rounded-md border bg-clin-chao px-3 text-clin-texto [color-scheme:light] dark:[color-scheme:dark] disabled:opacity-60 ${FOCO}`;

/** "71,8": o número como o nutri digitaria, com vírgula. */
export function numero(v: number, casas = 2): string {
  return v.toLocaleString("pt-BR", { maximumFractionDigits: casas });
}

function rotuloDoCampo(c: CampoMedida): string {
  const f = FAIXAS[c];
  return f.unidade === "%" ? f.rotulo : `${f.rotulo} (${f.unidade})`;
}

// A parte Medidas do registro: peso, % de gordura, cintura e quadril à vista,
// as outras cinco atrás de "Mais medidas", o "antes" embaixo de cada uma e o
// IMC com a altura do perfil. Só mostra: o texto de cada campo, o que conta
// como "tocado" e o que vai ao banco moram no EditorRegistro, que monta o
// formulário inteiro a cada tecla.
//
// O erro do campo só aparece depois de "tocado" (saiu do campo ou parou de
// digitar): "7" a caminho de "71,8" está fora da faixa, e o aviso piscaria a
// cada tecla.
export function CamposDeMedida({
  idBase,
  valores,
  tocado,
  anteriores,
  alturaCm,
  aberto,
  aoAlternar,
  aoMudar,
  aoSair,
}: {
  idBase: string;
  valores: Record<CampoMedida, string>;
  tocado: Partial<Record<CampoMedida, boolean>>;
  anteriores: Res<Antes>;
  alturaCm: number | null;
  /** "Mais medidas" aberto. */
  aberto: boolean;
  aoAlternar: () => void;
  aoMudar: (campo: CampoMedida, texto: string) => void;
  aoSair: (campo: CampoMedida) => void;
}) {
  const peso = lerMedida("weight_kg", valores.weight_kg);
  const valorImc = imc(peso.ok ? peso.valor : null, alturaCm);

  const campo = (c: CampoMedida) => {
    const id = `${idBase}-${c}`;
    const lido = lerMedida(c, valores[c]);
    const erro = tocado[c] && !lido.ok ? lido.erro : null;
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
          value={valores[c]}
          aria-invalid={erro ? true : undefined}
          aria-describedby={[antes && `${id}-antes`, erro && `${id}-erro`].filter(Boolean).join(" ") || undefined}
          onChange={(e) => aoMudar(c, e.target.value)}
          onBlur={() => aoSair(c)}
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
    <section aria-labelledby={`${idBase}-medidas`} className="space-y-3">
      <h2 id={`${idBase}-medidas`} className="block text-[17px] font-semibold leading-snug text-clin-texto">
        Medidas
      </h2>
      {anteriores.falhou && <ErroSecao secao="as medidas anteriores" />}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">{CAMPOS_PRINCIPAIS.map(campo)}</div>
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
          aria-expanded={aberto}
          aria-controls={`${idBase}-extras`}
          onClick={aoAlternar}
          className={`inline-flex self-start text-left ${LINK}`}
        >
          Mais medidas: tórax, braço, coxa, panturrilha, pescoço
          <ChevronDown
            aria-hidden="true"
            className={`h-4 w-4 shrink-0 transition-transform ${aberto ? "rotate-180" : ""}`}
          />
        </button>
      </div>
      <div id={`${idBase}-extras`} className={`${aberto ? "grid" : "hidden"} grid-cols-2 gap-4 sm:grid-cols-4`}>
        {CAMPOS_EXTRAS.map(campo)}
      </div>
    </section>
  );
}
