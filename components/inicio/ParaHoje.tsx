import Link from "next/link";
import { ChevronRight } from "lucide-react";
import NutriNotes, { type Nota } from "@/components/NutriNotes";
import PlanCheckIn from "@/components/PlanCheckIn";
import type { ParaHoje as ParaHojeMontado } from "@/lib/paraHoje";
import type { Completion, PlanSession } from "@/lib/planCheckIn";
import type { PendingItem } from "@/lib/pending";

// O cartão "Para hoje" da Início (spec "Início (paciente)", item 3). Quais
// linhas entram, a ordem e a contagem saem de `montarParaHoje`
// (lib/paraHoje.ts, testada); aqui só se desenha. Um cartão só, com as linhas
// separadas por traço: antes eram caixas dentro da caixa "Hoje", e cada uma
// somava uma borda e comia largura numa tela de 390 px.

const LINHA = "px-4 py-3.5";
const LINK_DA_LINHA =
  "tappable flex items-center gap-3 px-4 py-3.5 hover:bg-app-primaria-fundo";

export function ParaHoje({
  paraHoje,
  uid,
  hoje,
  notas,
  nutriNome,
  sessoes,
  completions,
  aplicacao,
  pendencias,
  temNutri,
  temTreinoHoje,
}: {
  paraHoje: ParaHojeMontado;
  uid: string;
  hoje: string;
  notas: Nota[];
  nutriNome: string;
  sessoes: PlanSession[];
  completions: Completion[];
  /** O remédio e a dose da aplicação de hoje ou atrasada. */
  aplicacao: { medicamento: string; dose: string | null } | null;
  pendencias: PendingItem[];
  temNutri: boolean;
  /** Há treino no plano de hoje (para a frase do "em dia"). */
  temTreinoHoje: boolean;
}) {
  const { linhas, pendentes, estado } = paraHoje;
  const contagem =
    estado === "em-dia"
      ? "em dia"
      : pendentes > 0
        ? `${pendentes} ${pendentes === 1 ? "pendente" : "pendentes"}`
        : null;

  // "Seu nutricionista vê essa confirmação" aparece UMA vez no cartão, junto
  // do primeiro treino que ainda pede resposta. Sem vínculo ativo, a frase
  // seria falsa: ninguém vê.
  const primeiroSemResposta = linhas.find((l) => l.tipo === "treino" && !l.confirmado);
  const notaEm = temNutri && primeiroSemResposta?.tipo === "treino" ? primeiroSemResposta.id : null;

  return (
    <section aria-labelledby="para-hoje">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="para-hoje" className="section-title">
          Para hoje
        </h2>
        {contagem && <span className="text-[13px] text-app-texto-2">{contagem}</span>}
      </div>

      <div className="card mt-2.5 overflow-hidden p-0">
        {estado === "incompleto" && (
          // Leitura que falha não é "não tem" (CLAUDE.md): sem esta linha, um
          // recado ou uma dose que não carregou deixava o cartão "em dia".
          <p className={`${LINHA} text-[15px] text-app-atencao ${linhas.length ? "border-b border-app-linha" : ""}`}>
            Não deu para carregar tudo. Recarregue a página.
          </p>
        )}

        {estado === "em-dia" ? (
          <p className={`${LINHA} text-[15px] text-app-texto`}>
            {temTreinoHoje
              ? "Treino de hoje já confirmado. Siga registrando o resto do dia."
              : "Dia de descanso no plano. Siga registrando o resto do dia."}
          </p>
        ) : linhas.length > 0 ? (
          <ul className="divide-y divide-app-linha">
            {linhas.map((l) => {
              switch (l.tipo) {
                case "recados":
                  return (
                    <NutriNotes key="recados" notas={notas} meuId={uid} nutriNome={nutriNome} compact />
                  );
                case "treino": {
                  const sessao = sessoes.find((s) => s.id === l.id);
                  if (!sessao) return null;
                  return (
                    <PlanCheckIn
                      key={`treino-${l.id}`}
                      sessions={[sessao]}
                      date={hoje}
                      completions={completions}
                      doNutri={l.doNutri}
                      nota={notaEm === l.id}
                      linha
                    />
                  );
                }
                case "aplicacao":
                  return (
                    <li key="aplicacao" className={`${LINHA} flex items-center gap-3`}>
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-[15px] font-semibold ${
                            l.atrasada ? "text-app-atencao" : "text-app-texto"
                          }`}
                        >
                          {l.atrasada ? "Aplicação atrasada" : "Aplicação de hoje"}
                        </p>
                        {aplicacao && (
                          <p className="text-[13px] text-app-texto-2">
                            {aplicacao.medicamento}
                            {aplicacao.dose ? ` · ${aplicacao.dose}` : ""}
                          </p>
                        )}
                      </div>
                      {/* Leva ao Tratamento, onde a dose se registra; daqui não
                          grava nada (spec). */}
                      <Link href="/app/tratamento" className="btn-ghost shrink-0 px-3">
                        Registrar
                      </Link>
                    </li>
                  );
                case "cardapio":
                  return (
                    <li key="cardapio">
                      <Link href="/app/dieta" className={LINK_DA_LINHA}>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[15px] font-semibold text-app-texto">
                            Cardápio de hoje
                          </span>
                          <span className="block text-[13px] text-app-texto-2">
                            {l.faltam === 1
                              ? "1 refeição ainda falta"
                              : `${l.faltam} refeições ainda faltam`}
                          </span>
                        </span>
                        <ChevronRight aria-hidden="true" className="h-5 w-5 shrink-0 text-app-texto-2" />
                      </Link>
                    </li>
                  );
                case "pendencia": {
                  const item = pendencias.find((p) => p.key === l.key);
                  if (!item) return null;
                  // Sem o pontinho colorido de antes: a urgente (a dose, quando
                  // a linha da aplicação não está) diz pelo título.
                  return (
                    <li key={`pendencia-${l.key}`}>
                      <Link href={item.href} className={LINK_DA_LINHA}>
                        <span className="min-w-0 flex-1">
                          <span
                            className={`block text-[15px] font-semibold ${
                              l.urgente ? "text-app-atencao" : "text-app-texto"
                            }`}
                          >
                            {item.label}
                          </span>
                          <span className="block text-[13px] text-app-texto-2">{item.description}</span>
                        </span>
                        <ChevronRight aria-hidden="true" className="h-5 w-5 shrink-0 text-app-texto-2" />
                      </Link>
                    </li>
                  );
                }
              }
            })}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
