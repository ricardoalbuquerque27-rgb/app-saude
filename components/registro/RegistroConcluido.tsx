import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { dataCurta, horaEmSaoPaulo, resumoDaConsulta, rotuloDaConsulta, type Consulta } from "@/lib/consultas";
import type { Res } from "@/lib/consultasDb";
import { dataNoBrasil, formatDate } from "@/lib/date";
import { hrefDaAba } from "@/lib/abas";
import {
  CAMPOS_MEDIDA,
  FAIXAS,
  imc,
  rotuloDaAnamnese,
  textoDaDiferenca,
  valorDaMedida,
  type Adendo,
  type Registro,
} from "@/lib/registro";
import { ErroSecao } from "@/components/clinico/ErroSecao";
import { FOCO } from "@/components/clinico/estilos";
import { CLASSE_SELO } from "@/components/consultas/aparencia";
import type { Antes } from "./CamposDeMedida";
import { NovoAdendo } from "./NovoAdendo";

const TITULO = "text-[17px] font-semibold leading-snug text-clin-texto";
const TEXTO = "whitespace-pre-wrap break-words text-[15px] leading-relaxed text-clin-texto";

/** "21/10/2026 às 13:40", em São Paulo (nunca o `slice` de um instante em UTC). */
function dataEHora(instante: string): string {
  return `${formatDate(dataNoBrasil(instante))} às ${horaEmSaoPaulo(instante)}`;
}

/** "Ana Lima · CRN-3 12345"; o que faltar na assinatura simplesmente não entra. */
function assinatura(nome: string | null, crn: string | null): string {
  return [nome, crn].filter(Boolean).join(" · ");
}

/** Uma das cinco partes, só para leitura. Em branco diz que ficou em branco. */
function Parte({ titulo, texto }: { titulo: string; texto: string | null }) {
  const escrito = (texto ?? "").trim() !== "";
  return (
    <section className="space-y-1.5">
      <h2 className={TITULO}>{titulo}</h2>
      {escrito ? <p className={TEXTO}>{texto}</p> : <p className="text-[15px] text-clin-texto-2">Não preenchido.</p>}
    </section>
  );
}

// O registro concluído (spec, "Concluído"; maquete 2): as cinco partes só
// para leitura, as medidas com a diferença para a consulta anterior e os
// adendos embaixo. Nada aqui se edita nem se apaga: o registro é prontuário, e
// a correção entra como adendo, datado e assinado.
//
// Não é "use client": só o NovoAdendo precisa de estado. Por isso nada de
// `CamposDeMedida` aqui (importar função de um módulo de cliente num componente
// de servidor entrega uma referência, e chamá-la quebra); o que é conta mora em
// lib/registro.ts.
export function RegistroConcluido({
  uid,
  nome,
  consulta,
  registro,
  adendos,
  anteriores,
  alturaCm,
}: {
  uid: string;
  nome: string;
  consulta: Consulta;
  registro: Registro;
  adendos: Res<Adendo[]>;
  /** O "antes" de cada medida (`anteriores` de lib/registro.ts); `falhou` se as medidas não carregaram. */
  anteriores: Res<Antes>;
  alturaCm: number | null;
}) {
  const quando = registro.concluded_at;
  const medidas = CAMPOS_MEDIDA.flatMap((c) => {
    const v = registro.medidas?.[c];
    return typeof v === "number" ? [{ campo: c, valor: v }] : [];
  });
  const peso = registro.medidas?.weight_kg;
  const valorImc = imc(typeof peso === "number" ? peso : null, alturaCm);
  const semAltura = typeof peso === "number" && (alturaCm == null || alturaCm <= 0);

  return (
    <div>
      <header className="border-b border-clin-linha pb-5">
        <Link
          href={hrefDaAba(uid, "consultas")}
          className={`inline-flex min-h-[40px] items-center gap-1 rounded-md text-[14px] text-clin-texto-2 hover:text-clin-primaria ${FOCO}`}
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" /> {nome} · Consultas
        </Link>
        <h1 className="mt-1 break-words text-[21px] font-semibold leading-tight text-clin-texto sm:text-2xl">
          Consulta de {rotuloDaConsulta(consulta)}
        </h1>
        <p className="mt-1 text-[15px] text-clin-texto-2">{resumoDaConsulta(consulta)}</p>
        <p className="mt-2 text-[14px] leading-relaxed text-clin-texto-2">
          <span className={`${CLASSE_SELO} bg-clin-primaria-fundo text-clin-primaria`}>Concluído</span>{" "}
          {quando && `em ${dataEHora(quando)}`}
          {registro.assinatura_nome && ` por ${registro.assinatura_nome}`}
          {registro.assinatura_crn && ` · ${registro.assinatura_crn}`}
        </p>
      </header>

      <div className="mt-6 max-w-3xl space-y-8">
        <Parte titulo={rotuloDaAnamnese(consulta.kind)} texto={registro.anamnese} />

        <section aria-labelledby="medidas-titulo" className="space-y-3">
          <h2 id="medidas-titulo" className={TITULO}>
            Medidas
          </h2>
          {anteriores.falhou && <ErroSecao secao="as medidas anteriores" />}
          {medidas.length === 0 ? (
            <p className="text-[15px] text-clin-texto-2">Nenhuma medida nesta consulta.</p>
          ) : (
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {medidas.map(({ campo, valor }) => {
                const antes = anteriores.data[campo];
                return (
                  <div key={campo} className="rounded-md border border-clin-linha px-3.5 py-3">
                    <dt className="text-[13px] text-clin-texto-2">{FAIXAS[campo].rotulo}</dt>
                    <dd className="mt-1 text-[17px] font-semibold tabular-nums text-clin-texto">
                      {valorDaMedida(campo, valor)}
                    </dd>
                    {antes && (
                      <dd className="mt-0.5 text-[13px] tabular-nums text-clin-texto-2">
                        {textoDaDiferenca(valor, antes.valor)} desde {dataCurta(antes.data)}
                      </dd>
                    )}
                  </div>
                );
              })}
              {valorImc != null && (
                <div className="rounded-md border border-clin-linha px-3.5 py-3">
                  <dt className="text-[13px] text-clin-texto-2">IMC</dt>
                  <dd className="mt-1 text-[17px] font-semibold tabular-nums text-clin-texto">
                    {valorImc.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                  </dd>
                  {/* O IMC não é gravado no registro: sai do peso daqui com a
                      altura de HOJE no perfil. Sem dizer isso, um IMC que muda
                      quando a altura é corrigida parecia parte do que foi
                      escrito no dia. */}
                  <dd className="mt-0.5 text-[13px] tabular-nums text-clin-texto-2">
                    com a altura atual do perfil ({(alturaCm as number).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} cm)
                  </dd>
                </div>
              )}
            </dl>
          )}
          {semAltura && <p className="text-[14px] text-clin-texto-2">IMC: altura não informada no perfil.</p>}
        </section>

        <Parte titulo="Diagnóstico nutricional" texto={registro.diagnostico} />
        <Parte titulo="Conduta" texto={registro.conduta} />
        <Parte titulo="Observar no retorno" texto={registro.observar} />

        <section aria-labelledby="adendos-titulo" className="space-y-3 border-t border-clin-linha pt-5">
          <h2 id="adendos-titulo" className={TITULO}>
            Adendos
          </h2>
          {adendos.falhou ? (
            <ErroSecao secao="os adendos" />
          ) : adendos.data.length === 0 ? (
            <p className="text-[15px] text-clin-texto-2">Nenhum adendo ainda.</p>
          ) : (
            adendos.data.map((a) => {
              const quem = assinatura(a.assinatura_nome, a.assinatura_crn);
              return (
                <article key={a.id} className="space-y-1 rounded-md border border-clin-linha px-4 py-3.5">
                  <p className="text-[13px] text-clin-texto-2">
                    {dataEHora(a.created_at)}
                    {quem && ` · ${quem}`}
                  </p>
                  <p className={TEXTO}>{a.body}</p>
                </article>
              );
            })
          )}
          <NovoAdendo registroId={registro.id} />
        </section>
      </div>
    </div>
  );
}
