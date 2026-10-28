"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { todayISO } from "@/lib/date";
import { idDaRefeicao } from "@/lib/lembretesDasRefeicoes";
import {
  ERRO_AO_MARCAR,
  estadoDaRefeicao,
  marcarRefeicao,
  podeMarcar,
  type EstadoDaRefeicao,
  type RespostaDaRefeicao,
  type RespostaGravada,
} from "@/lib/refeicoesDoPlano";
import BotoesDaRefeicao from "@/components/BotoesDaRefeicao";

export type ItemCardapioPaciente = {
  id: string;
  meal_type: string;
  position: number;
  description: string;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
};

// O cardápio prescrito, do lado do paciente, num cartão só (spec do visual do
// app do paciente, "Dieta (paciente)"): o título e de quem é o plano, a
// observação e, por fim, as refeições, cada uma com as opções em linhas
// separadas por traço, sem uma caixa por opção. O ganho principal é a
// resposta de cada refeição ("Comi", "Não comi", o "Comi isso" de cada opção):
// em vez de digitar a refeição, ela confirma o que já foi prescrito, vira um
// registro normal em `meals` e grava a resposta em meal_checks, a mesma da
// notificação dos lembretes (`marcarRefeicao`, uma regra para os dois).
export default function MealPlanView({
  nome,
  observacao,
  itens,
  date,
  registradas,
  respostas = [],
  refeicoesFalharam = false,
  respostasFalharam = false,
  onRegistrado,
  nutriNome,
  linkPlano = false,
}: {
  nome: string;
  observacao: string | null;
  itens: ItemCardapioPaciente[];
  date: string;
  /**
   * As refeições registradas no dia. O "comi" vem da resposta; a descrição só
   * diz qual opção foi (a refeição que o "Comi" gravou tem a descrição da
   * opção) e serve também às refeições de antes das respostas, que só casam
   * pela descrição.
   */
  registradas: { id: string; meal_type: string; description: string }[];
  /** As respostas do dia (meal_checks). */
  respostas?: RespostaGravada[];
  /**
   * A leitura das refeições do dia falhou. `registradas` chega vazia por falta
   * de dado, e não porque nada foi registrado: sem "· feito", sem "comi" e,
   * principalmente, sem botão (quem já registrou seria convidado a registrar de
   * novo, e o dia e a adesão do paciente contariam em dobro). O plano segue
   * legível, com uma linha de aviso.
   */
  refeicoesFalharam?: boolean;
  /** A leitura das respostas falhou: pelo mesmo motivo, nenhum botão. */
  respostasFalharam?: boolean;
  /** Quando ausente, recarrega a rota — serve o dashboard, que é servidor. */
  onRegistrado?: () => void;
  /** Primeiro nome do nutricionista, para "de Ricardo, seu nutricionista". */
  nutriNome?: string;
  /** Fora de "Meu plano", aponta de volta para lá — o cardápio aparece em
   *  mais de uma tela e a pessoa precisa saber qual é a fonte. */
  linkPlano?: boolean;
}) {
  const supabase = createClient();
  const router = useRouter();
  // Qual refeição grava, com qual resposta e qual opção: o giro vai no botão tocado.
  const [busy, setBusy] = useState<{ tipo: string; resposta: RespostaDaRefeicao; itemId: string | null } | null>(null);
  const [erroEm, setErroEm] = useState<{ tipo: string; texto: string } | null>(null);

  const tipos = Array.from(new Set(itens.map((i) => i.meal_type)));
  const semEstado = refeicoesFalharam || respostasFalharam;
  // Uma notificação velha não grava num dia de que a pessoa já não lembra
  // (marcarRefeicao recusa); a tela nem oferece.
  const dentroDaJanela = podeMarcar(date, todayISO());
  const comBotoes = !semEstado && dentroDaJanela;

  async function marcar(tipo: string, resposta: RespostaDaRefeicao, itemId: string | null = null) {
    setBusy({ tipo, resposta, itemId });
    setErroEm(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setBusy(null);
      setErroEm({ tipo, texto: ERRO_AO_MARCAR });
      return;
    }
    const r = await marcarRefeicao(supabase, user.id, { data: date, refeicao: tipo, resposta, itemId });
    setBusy(null);
    if (!r.ok) {
      setErroEm({ tipo, texto: r.erro || ERRO_AO_MARCAR });
      return;
    }
    if (onRegistrado) onRegistrado();
    else router.refresh();
  }

  if (itens.length === 0) return null;

  return (
    // O id é o destino do link da sugestão de proteína, na Início
    // (/app/dieta#plano); o scroll-mt deixa o cartão abaixo da barra de cima
    // do celular, que é fixa.
    <section
      id="plano"
      aria-labelledby="plano-titulo"
      className="card mb-6 scroll-mt-20 overflow-hidden p-0"
    >
      <div className="divide-y divide-app-linha">
        <div className="px-4 py-4">
          <h2 id="plano-titulo" className="section-title">
            {nome}
          </h2>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[13px] text-app-texto-2">
            <span>{nutriNome ? `de ${nutriNome}, seu nutricionista` : "Prescrito pelo seu nutricionista"}</span>
            {linkPlano && (
              <>
                <span aria-hidden="true">·</span>
                {/* 44 px de toque sem crescer a linha: a margem negativa
                    devolve o que o min-h acrescenta. */}
                <Link
                  href="/app/nutricionista?aba=cardapio"
                  className="tappable -my-3 inline-flex min-h-[44px] items-center font-medium text-app-primaria hover:underline"
                >
                  ver em Meu plano
                </Link>
              </>
            )}
          </p>
          {observacao && (
            <p className="mt-3 whitespace-pre-wrap text-[15px] leading-snug text-app-texto">{observacao}</p>
          )}
        </div>

        {refeicoesFalharam && (
          <p className="px-4 py-3 text-[15px] text-app-atencao">
            Não deu para carregar as refeições do dia, então o plano não mostra o que já foi registrado.
          </p>
        )}
        {!refeicoesFalharam && respostasFalharam && (
          <p className="px-4 py-3 text-[15px] text-app-atencao">Não deu para carregar as respostas das refeições.</p>
        )}
        {!semEstado && !dentroDaJanela && (
          <p className="px-4 py-3 text-[15px] text-app-texto-2">Dá para marcar o plano só nos últimos 7 dias.</p>
        )}

        {tipos.map((tipo) => {
          const opcoes = itens
            .filter((i) => i.meal_type === tipo)
            .sort((a, b) => a.position - b.position);
          const estado: EstadoDaRefeicao | null = semEstado
            ? null
            : estadoDaRefeicao({
                opcoes,
                resposta: respostas.find((r) => r.meal_type === tipo) ?? null,
                registradas: registradas.filter((r) => r.meal_type === tipo),
              });
          const feito = estado?.tipo === "registrada" || estado?.tipo === "comi";
          const comiEm = estado && (estado.tipo === "registrada" || estado.tipo === "comi") ? estado.opcaoId : null;
          const ocupadoAqui = busy?.tipo === tipo ? busy.resposta : null;

          return (
            // O id é o destino da notificação dos lembretes
            // (/app/dieta?data=…#refeicao-almoco); o scroll-mt deixa o
            // bloco abaixo da barra de cima do celular, que é fixa.
            <div key={tipo} id={idDaRefeicao(tipo)} className="scroll-mt-20">
              <h3 className="px-4 pb-1 pt-3.5 text-[15px] font-semibold text-app-texto">
                {tipo}
                {feito && (
                  <>
                    {" "}
                    <span className="text-[13px] font-normal text-app-primaria">· feito</span>
                  </>
                )}
              </h3>
              {comBotoes && estado?.tipo === "qual_opcao" && (
                <p className="px-4 pb-1 text-[13px] text-app-texto-2">Qual opção?</p>
              )}

              <ul className="divide-y divide-app-linha">
                {opcoes.map((o, i) => {
                  // "opção 1" só quando há mais de uma; os números são dado.
                  const meta = [
                    opcoes.length > 1 ? `opção ${i + 1}` : null,
                    o.calories ? `${Math.round(Number(o.calories)).toLocaleString("pt-BR")} kcal` : null,
                    o.protein_g ? `${Math.round(Number(o.protein_g))} g prot` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ");
                  const rotulo =
                    !comBotoes || !estado
                      ? null
                      : estado.tipo === "qual_opcao"
                        ? "Foi esta"
                        : estado.tipo === "sem_resposta" && opcoes.length > 1
                          ? "Comi isso"
                          : null;
                  const girando = busy?.tipo === tipo && busy.itemId === o.id;

                  return (
                    <li key={o.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="whitespace-pre-wrap text-[15px] text-app-texto">{o.description}</span>
                        {meta && <span className="tabular text-[13px] text-app-texto-2">{meta}</span>}
                      </div>
                      {comiEm === o.id ? (
                        <span className="inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold text-app-primaria">
                          <Check aria-hidden="true" className="h-4 w-4" />
                          comi
                        </span>
                      ) : rotulo ? (
                        // Secundário de 40 px, como na maquete; o ::after
                        // estende a área de toque a 44 px sem engordar o
                        // botão. O -3px é contado a partir da borda interna:
                        // com a borda de 1 px, -2px dava só 42 px de toque.
                        <button
                          onClick={() => marcar(tipo, "comi", o.id)}
                          disabled={busy !== null}
                          className="btn-ghost relative shrink-0 px-3 after:absolute after:inset-x-0 after:-inset-y-[3px] after:content-['']"
                        >
                          {girando && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}
                          {rotulo}
                        </button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>

              {comBotoes && estado && (
                <BotoesDaRefeicao
                  estado={estado}
                  umaOpcao={opcoes.length === 1}
                  ocupado={ocupadoAqui && busy?.itemId == null ? ocupadoAqui : null}
                  erro={erroEm?.tipo === tipo ? erroEm.texto : null}
                  onMarcar={(resposta) => marcar(tipo, resposta)}
                />
              )}
            </div>
          );
        })}
      </div>

    </section>
  );
}
