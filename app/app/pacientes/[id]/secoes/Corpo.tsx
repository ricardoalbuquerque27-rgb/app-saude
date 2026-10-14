import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { hrefDaAba } from "@/lib/abas";
import { dataNoBrasil, formatDate, todayISO } from "@/lib/date";
import {
  pesoDoDia,
  textoVariacaoPeso,
  type MetasPrescritas,
  type PatientSummary,
} from "@/lib/nutri";
import { diaDaConsulta } from "@/lib/consultas";
import { getConsultasDoPaciente, type Res } from "@/lib/consultasDb";
import { getEvolucaoDoCorpo, getInicioDoAcompanhamento } from "@/lib/evolucaoDb";
import {
  descricaoDaMedida,
  descricaoDoPeso,
  escalaDoPeso,
  inicioDoPeriodo,
  pesoInicialDoPeriodo,
  pontosDaConsulta,
  progressoDaMeta,
  semanasDePeso,
  serieDeMedida,
  temGraficoDePeso,
  tituloDoPeso,
  type LinhaDoCorpo,
  type PontoDeMedida,
} from "@/lib/evolucao";
import { AnelDaMeta } from "@/components/clinico/graficos/AnelDaMeta";
import { GraficoPeso } from "@/components/clinico/graficos/GraficoPeso";
import { GraficoMedida } from "@/components/clinico/graficos/GraficoMedida";
import { Secao } from "@/components/clinico/Secao";
import { VerHistorico } from "@/components/clinico/VerHistorico";
import { ErroSecao } from "@/components/clinico/ErroSecao";
import { FOCO, LINK } from "@/components/clinico/estilos";
import { CLASSE_SELO } from "@/components/consultas/aparencia";

const TITULO_BLOCO = "text-[15px] font-semibold leading-snug text-clin-texto";

/** "68,4" — medida com no máximo uma casa, vírgula decimal. */
function medida(v: unknown): string {
  if (v == null || v === "") return "—";
  const n = Number(v);
  return Number.isFinite(n)
    ? n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })
    : "—";
}

/** "13/10" de "2026-10-13". */
function ddmm(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

// Peso atual, variação, meta de peso (com o anel do caminho já feito), a
// Evolução (média semanal do peso, cintura e % de gordura, em gráficos) e as
// medidas. Só leitura: o peso alvo é gravado junto com as outras três metas
// por set_patient_goals, e mandar um campo vazio apaga a meta (spec, Seção 2).
// Por isso ele se edita nas metas, em Alimentação, e aqui há só o link.
//
// A variação é a mesma dos três números do topo (resumirPacientes), para a
// página não mostrar dois "peso em 30 dias" diferentes. A meta segue a mesma
// regra da Alimentação: a prescrita, ou a do perfil se nunca houve prescrição.
//
// A Evolução lê o período inteiro, do começo do vínculo até hoje
// (getEvolucaoDoCorpo), e não a lista de 60 linhas da tabela. Qualquer leitura
// que falha vira o erro da aba: sem as pesagens, "Ainda não dá para ver
// tendência" diria a quem pesa todo dia que não há tendência.
export async function Corpo({
  uid,
  perfil,
  resumo,
  prescricao,
}: {
  uid: string;
  perfil: MetasPrescritas;
  resumo: Promise<{ resumos: PatientSummary[]; falhou: boolean }>;
  prescricao: Promise<{ data: MetasPrescritas | null; error: unknown }>;
}) {
  const supabase = await createClient();
  const hoje = todayISO();

  // A Evolução começa no vínculo, e a leitura do período precisa do começo:
  // ela encadeia na do vínculo, mas corre junto das outras.
  const vinculoP = getInicioDoAcompanhamento(supabase, uid);
  const evolucaoP: Promise<Res<LinhaDoCorpo[]>> = vinculoP.then((v) =>
    // Sem vínculo ativo a página nem chegaria aqui (o perfil do paciente
    // voltaria nulo): data nula sem erro é leitura que não bateu, e não
    // "acompanhamento que começou hoje".
    v.falhou || !v.data
      ? { data: [], falhou: true }
      : getEvolucaoDoCorpo(supabase, uid, inicioDoPeriodo(v.data, hoje), hoje)
  );

  const [medidasRes, r, presc, vinculo, evolucao, consultas] = await Promise.all([
    // Com teto em hoje: medida lançada com data futura não é o "peso atual".
    supabase
      .from("body_measurements")
      .select("date, weight_kg, body_fat_pct, waist_cm, hip_cm, chest_cm, arm_cm, measured_by, created_at")
      .eq("user_id", uid)
      .lte("date", hoje)
      .order("date", { ascending: false })
      .limit(60),
    resumo,
    prescricao,
    vinculoP,
    evolucaoP,
    getConsultasDoPaciente(supabase, uid),
  ]);

  // O resumo entra na conta porque a variação vem dele: com uma consulta dele
  // falhando, "—" diria "sem variação" em vez de "não carregou". Pelo mesmo
  // motivo a Evolução: sem as pesagens, "Ainda não dá para ver tendência"
  // diria a quem pesa todo dia que não há tendência.
  if (
    medidasRes.error ||
    presc.error ||
    r.falhou ||
    vinculo.falhou ||
    !vinculo.data ||
    evolucao.falhou ||
    consultas.falhou
  ) {
    return (
      <Secao id="corpo" titulo="Corpo">
        <ErroSecao secao="as medidas" />
      </Secao>
    );
  }

  const [s] = r.resumos;
  const linhas = (medidasRes.data ?? []) as any[];
  // O peso atual é o do dia mais recente com peso, pela mesma regra do resumo
  // e da série (pesoDoDia). Pegar a primeira linha daquela data mostrava a
  // pesagem de casa ou a da consulta ao acaso, conforme a ordem em que o banco
  // trouxe, e a variação ao lado (resumirPacientes) podia partir de outro peso.
  const dataDoPeso: string | null =
    linhas.find((r) => r.weight_kg != null)?.date ?? null;
  const doDia =
    dataDoPeso != null
      ? linhas.filter((r) => r.date === dataDoPeso && r.weight_kg != null)
      : [];
  const peso = pesoDoDia(doDia);
  // pesoDoDia dá a vez à medida da consulta sempre que o dia tem uma com peso:
  // é essa a condição de o valor mostrado ser o dela.
  const pesoNaConsulta = doDia.some((r) => r.measured_by != null);
  const alvoBruto = (presc.data ?? perfil).weight_goal_kg;
  const alvo = alvoBruto == null ? null : Number(alvoBruto);
  const distancia =
    peso != null && alvo != null ? Math.abs(peso - alvo) : null;

  // ---- Evolução: o período, o peso inicial do anel e os três gráficos ----
  const desde = inicioDoPeriodo(vinculo.data, hoje);
  const limitadoEmUmAno = dataNoBrasil(vinculo.data.accepted_at ?? vinculo.data.created_at) < desde;
  const doPeriodo = evolucao.data;
  const semanas = semanasDePeso(doPeriodo, desde, hoje);
  const pesosDaConsulta = pontosDaConsulta(doPeriodo, "weight_kg");
  const cintura = serieDeMedida(doPeriodo, "waist_cm");
  const gordura = serieDeMedida(doPeriodo, "body_fat_pct");
  // Os dias das consultas realizadas dentro do período, com ou sem medida: o
  // traço vertical marca o que o nutri fez, não só o que mediu. Com piso e
  // teto, como toda janela de data.
  const datasDasConsultas = Array.from(
    new Set(
      consultas.data
        .filter((c) => c.status === "realizada")
        .map(diaDaConsulta)
        .filter((d) => d >= desde && d <= hoje)
    )
  ).sort();
  // Anel: do peso inicial do período ao Peso atual do topo, os dois pela
  // regra de pesoDoDia, para "4,3 de 8,6 kg" bater com o número ao lado.
  const pesoInicial = pesoInicialDoPeriodo(doPeriodo, desde);
  const metaDePeso = alvo != null && Number.isFinite(alvo) ? alvo : null;
  const progresso = progressoDaMeta(pesoInicial?.valor ?? null, peso, metaDePeso);

  const temTendencia = temGraficoDePeso(semanas, pesosDaConsulta);
  const tituloDoGrafico = tituloDoPeso(semanas, pesosDaConsulta);
  const semanasComMedia = semanas.filter((s) => s.media != null);
  const valoresDoPeso = [
    ...semanasComMedia.map((s) => s.media as number),
    ...pesosDaConsulta.map((p) => p.valor),
  ];
  const medidasDoCorpo: { nome: string; descricaoNome: string; unidade: string; pontos: PontoDeMedida[] }[] = [
    { nome: "Cintura", descricaoNome: "Cintura", unidade: "cm", pontos: cintura },
    { nome: "% de gordura", descricaoNome: "Gordura corporal", unidade: "%", pontos: gordura },
  ];
  const comGrafico = medidasDoCorpo.filter((m) => m.pontos.length >= 2);
  const semGrafico = medidasDoCorpo.filter((m) => m.pontos.length < 2);

  return (
    <Secao id="corpo" titulo="Corpo">
      <dl className="grid gap-4 sm:grid-cols-3">
        <div>
          <dt className="text-[13px] text-clin-texto-2">Peso atual</dt>
          <dd className="mt-0.5 text-[15px] font-semibold tabular-nums text-clin-texto">
            {peso != null ? `${medida(peso)} kg` : "—"}
          </dd>
          {dataDoPeso && (
            <dd className="text-[13px] tabular-nums text-clin-texto-2">
              {`em ${formatDate(dataDoPeso)}${pesoNaConsulta ? ", na consulta" : ""}`}
            </dd>
          )}
        </div>
        <div>
          <dt className="text-[13px] text-clin-texto-2">Variação em 30 dias</dt>
          <dd className="mt-0.5 text-[15px] font-semibold tabular-nums text-clin-texto">
            {textoVariacaoPeso(s.weightDelta30)}
          </dd>
        </div>
        <div>
          <dt className="text-[13px] text-clin-texto-2">Meta de peso</dt>
          {progresso && metaDePeso != null && pesoInicial ? (
            // O anel traz a meta, a porcentagem e "N de M kg desde dd/mm".
            <dd>
              <AnelDaMeta progresso={progresso} meta={metaDePeso} inicio={pesoInicial.data} />
            </dd>
          ) : (
            <>
              <dd className="mt-0.5 text-[15px] font-semibold tabular-nums text-clin-texto">
                {alvo != null ? `${medida(alvo)} kg` : "—"}
              </dd>
              {distancia != null && (
                <dd className="text-[13px] tabular-nums text-clin-texto-2">
                  {distancia < 0.05 ? "na meta" : `faltam ${medida(distancia)} kg`}
                </dd>
              )}
            </>
          )}
          <dd>
            {/* A meta de peso se edita junto das outras metas, na aba
                Alimentação. */}
            <Link href={hrefDaAba(uid, "alimentacao")} className={`inline-flex ${LINK}`}>
              editar nas metas
            </Link>
          </dd>
        </div>
      </dl>

      <section aria-labelledby="evolucao-titulo" className="mt-8 border-t border-clin-linha pt-6">
        <h3 id="evolucao-titulo" className={TITULO_BLOCO}>
          Evolução
        </h3>
        <p className="mt-0.5 text-[13px] text-clin-texto-2">
          {limitadoEmUmAno
            ? `Últimos 12 meses, desde ${formatDate(desde)}.`
            : `Desde ${formatDate(desde)}, o início do acompanhamento.`}
        </p>

        <div className="mt-4">
          {temTendencia && tituloDoGrafico ? (
            <GraficoPeso
              inicio={desde}
              semanas={semanas}
              pontosDaConsulta={pesosDaConsulta}
              datasDasConsultas={datasDasConsultas}
              meta={metaDePeso}
              escala={escalaDoPeso(valoresDoPeso, metaDePeso)}
              titulo={tituloDoGrafico}
              descricao={descricaoDoPeso(semanas, pesosDaConsulta, metaDePeso)}
            />
          ) : (
            // Tendência pede dois pontos. Com menos, mostra o que há, e
            // "ainda" diz que é questão de tempo (não de erro: a leitura que
            // falha nunca chega aqui, vira o erro da aba).
            <div className="rounded-md border border-clin-linha px-4 py-3">
              <p className="text-[15px] font-semibold text-clin-texto">Ainda não dá para ver tendência</p>
              <p className="mt-0.5 text-[14px] text-clin-texto-2">
                O gráfico do peso precisa de 2 semanas com pesagem em casa ou de 2 medidas na consulta.
              </p>
              {pesosDaConsulta.length + semanasComMedia.length > 0 ? (
                <ul className="mt-2 space-y-0.5 text-[14px] tabular-nums text-clin-texto">
                  {pesosDaConsulta.map((p) => (
                    <li key={`c-${p.data}`}>
                      Consulta de {ddmm(p.data)}: {medida(p.valor)} kg
                    </li>
                  ))}
                  {semanasComMedia.map((sem) => (
                    <li key={`s-${sem.inicio}`}>
                      Semana de {ddmm(sem.inicio)} a {ddmm(sem.fim)}: média {medida(sem.media)} kg ({sem.dias}
                      {"\u00a0"}
                      {sem.dias === 1 ? "pesagem" : "pesagens"})
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-[14px] text-clin-texto-2">
                  Nenhuma pesagem em casa nem medida na consulta no período, por enquanto.
                </p>
              )}
            </div>
          )}
        </div>

        {comGrafico.length > 0 && (
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            {comGrafico.map((m) => (
              <GraficoMedida
                key={m.nome}
                nome={m.nome}
                unidade={m.unidade}
                pontos={m.pontos}
                descricao={descricaoDaMedida(m.descricaoNome, m.unidade, m.pontos)}
              />
            ))}
          </div>
        )}
        {semGrafico.length > 0 && (
          <ul className="mt-4 space-y-1 text-[14px] text-clin-texto-2">
            {semGrafico.map((m) => (
              <li key={m.nome}>
                {m.nome}: {m.pontos.length === 0 ? "sem medidas" : "só 1 medida"} até agora. O gráfico precisa de 2.
              </li>
            ))}
          </ul>
        )}
      </section>

      <VerHistorico>
        <h3 className={TITULO_BLOCO}>Medidas registradas</h3>
        {linhas.length === 0 ? (
          <p className="mt-2 text-[14px] text-clin-texto-2">
            Nenhuma medida registrada.
          </p>
        ) : (
          // A tabela tem sete colunas e não cabe em 390 px: rola dentro da
          // própria caixa, e a página não ganha rolagem lateral. Caixa que
          // rola precisa receber foco, senão quem usa teclado não alcança as
          // colunas da direita.
          <div
            tabIndex={0}
            role="region"
            aria-label="Medidas registradas"
            className={`mt-2 overflow-x-auto rounded-md ${FOCO}`}
          >
            <table className="w-full min-w-[480px] border-collapse text-[14px] tabular-nums">
              <thead>
                <tr className="border-b border-clin-linha text-left text-[13px] text-clin-texto-2">
                  <th scope="col" className="py-2 pr-3 font-medium">Data</th>
                  <th scope="col" className="px-2 py-2 font-medium">Peso</th>
                  <th scope="col" className="px-2 py-2 font-medium">%GC</th>
                  <th scope="col" className="px-2 py-2 font-medium">Cintura</th>
                  <th scope="col" className="px-2 py-2 font-medium">Quadril</th>
                  <th scope="col" className="px-2 py-2 font-medium">Peito</th>
                  <th scope="col" className="py-2 pl-2 font-medium">Braço</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((r, i) => (
                  <tr
                    key={i}
                    className="border-b border-clin-linha text-clin-texto last:border-b-0"
                  >
                    <th
                      scope="row"
                      className="whitespace-nowrap py-2 pr-3 text-left text-[13px] font-normal text-clin-texto-2"
                    >
                      <span className="block">{formatDate(r.date)}</span>
                      {/* measured_by preenchido é a avaliação que o nutri
                          tirou numa consulta (prontuário), não uma medida que
                          o paciente anotou. Na linha de baixo, para não alargar
                          a coluna da data. */}
                      {r.measured_by && (
                        <span
                          className={`${CLASSE_SELO} mt-0.5 bg-clin-primaria-fundo text-clin-primaria`}
                        >
                          na consulta
                        </span>
                      )}
                    </th>
                    <td className="px-2 py-2">{medida(r.weight_kg)}</td>
                    <td className="px-2 py-2">{medida(r.body_fat_pct)}</td>
                    <td className="px-2 py-2">{medida(r.waist_cm)}</td>
                    <td className="px-2 py-2">{medida(r.hip_cm)}</td>
                    <td className="px-2 py-2">{medida(r.chest_cm)}</td>
                    <td className="py-2 pl-2">{medida(r.arm_cm)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </VerHistorico>
    </Secao>
  );
}
