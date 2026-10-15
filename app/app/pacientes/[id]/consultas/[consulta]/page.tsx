import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { meuPerfil } from "@/lib/perfil";
import { todayISO } from "@/lib/date";
import { dataCurta, diaDaConsulta, rotuloDaConsulta, ROTULO_TIPO, situacao, type Consulta } from "@/lib/consultas";
import { getConsultasDoPaciente, getDesdeDoPaciente } from "@/lib/consultasDb";
import { textoDesdeUltima, tituloDesde } from "@/lib/desdeConsulta";
import { CAMPOS_META, getUltimaPrescricao, textoDaMeta, type CampoMeta, type MetasPrescritas } from "@/lib/nutri";
import { anteriores, FAIXAS, situacaoDoRegistro, textoDaMedida, type CampoMedida, type Registro } from "@/lib/registro";
import {
  getAdendos,
  getMedidasDasConsultas,
  getMedidasDoPaciente,
  getRegistroDaConsulta,
  getRegistrosDoPaciente,
  type LinhaDeMedida,
} from "@/lib/registroDb";
import { hrefDaAba } from "@/lib/abas";
import { ErroSecao } from "@/components/clinico/ErroSecao";
import { FOCO } from "@/components/clinico/estilos";
import { ContextoDaConsulta } from "@/components/registro/ContextoDaConsulta";
import { EditorRegistro } from "@/components/registro/EditorRegistro";
import { RegistroConcluido } from "@/components/registro/RegistroConcluido";
import { LinkPacientes, SemAcesso } from "../../secoes/SemAcesso";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return { title: "Registro · Paciente · Pace Fit" };
}

/** "1.800 kcal · 110 g de proteína · 2,5 L de água · peso alvo 62 kg" */
const FRASE_DA_META: Record<CampoMeta, (texto: string) => string> = {
  daily_calorie_goal: (t) => t,
  protein_goal_g: (t) => `${t} de proteína`,
  daily_water_goal_ml: (t) => `${t} de água`,
  weight_goal_kg: (t) => `peso alvo ${t}`,
};

function textoDasMetas(m: MetasPrescritas): string | null {
  const partes = CAMPOS_META.filter((c) => m[c] != null).map((c) =>
    FRASE_DA_META[c](textoDaMeta(c, Number(m[c])))
  );
  return partes.length ? partes.join(" · ") : null;
}

/**
 * A última medida que o paciente anotou (sem `measured_by`), em texto: "Peso
 * 65,4 kg em 13/10". Com teto em hoje: uma data futura entraria como a
 * "última" (a armadilha das janelas, CLAUDE.md).
 */
function ultimaEmCasa(serie: LinhaDeMedida[], hoje: string): string | null {
  for (const linha of serie) {
    if (linha.measured_by != null || linha.date > hoje) continue;
    const partes = (Object.keys(FAIXAS) as CampoMedida[])
      .filter((c) => typeof linha[c] === "number")
      .map((c) => textoDaMedida(c, linha[c] as number));
    if (partes.length) return `${partes.join(" · ")} em ${dataCurta(linha.date)}`;
  }
  return null;
}

function SoOErro({ secao }: { secao: string }) {
  return (
    <div className="max-w-2xl">
      <LinkPacientes />
      <div className="mt-4">
        <ErroSecao secao={secao} />
      </div>
    </div>
  );
}

/**
 * Consulta sem direito a registro (ainda não começou, pedido, falta ou
 * cancelamento) aberta pelo endereço. O formulário seria recusado pelo banco a
 * cada tecla; a página diz o porquê, com as palavras do banco.
 */
function SemDireito({ uid, nome, consulta }: { uid: string; nome: string; consulta: Consulta }) {
  const s = situacao(consulta, new Date().toISOString());
  return (
    <div className="max-w-2xl">
      <Link
        href={hrefDaAba(uid, "consultas")}
        className={`inline-flex min-h-[40px] items-center gap-1 rounded-md text-[14px] text-clin-texto-2 hover:text-clin-primaria ${FOCO}`}
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" /> {nome} · Consultas
      </Link>
      <h1 className="mt-1 text-2xl font-semibold leading-tight text-clin-texto">
        Consulta de {rotuloDaConsulta(consulta)}
      </h1>
      <p className="mt-4 rounded-md border border-clin-linha px-4 py-3 text-[14px] leading-snug text-clin-texto">
        {/* `situacao` diz "pedido" em qualquer horário: um pedido de ontem
            não aceito não "ainda não começou". */}
        {s === "faltou" || s === "cancelada"
          ? "Consulta com falta ou cancelada não tem registro."
          : s === "pedido"
            ? "Pedido de consulta ainda não aceito. O registro abre depois de aceitar e no horário dela."
            : "A consulta ainda não começou. O registro abre no horário dela."}
      </p>
    </div>
  );
}

// O registro de uma consulta (spec do registro da consulta, "Página do
// registro"). O tema clínico vem do layout de pacientes/[id], e o AppShell
// abre esta rota em tela larga como o detalhe do paciente.
//
// Todas as leituras saem juntas. A que falha aparece como erro no lugar
// dela, e não como "não tem" (CLAUDE.md, "Leitura que falha não é 'não
// tem'"); a do registro e a da consulta derrubam a página inteira: um
// formulário em branco por cima de um rascunho que não carregou seria salvo
// na primeira tecla e apagaria o que o nutri tinha escrito.
export default async function RegistroDaConsulta({
  params,
}: {
  params: { id: string; consulta: string };
}) {
  const uid = params.id;
  const supabase = await createClient();
  const hoje = todayISO();

  const [eu, perfilRes, consultas, registro, medidas, dasConsultas, registros, desde, prescricao] = await Promise.all([
    meuPerfil<{ id: string; role: string; crn: string | null }>(supabase, "id, role, crn"),
    supabase
      .from("profiles")
      .select("full_name, height_cm, daily_calorie_goal, protein_goal_g, daily_water_goal_ml, weight_goal_kg")
      .eq("id", uid)
      .maybeSingle(),
    // A consulta sai da lista do paciente, e não de uma leitura pelo id: a
    // de outro paciente nem está nela (notFound abaixo), e a lista dá a data
    // e o tipo das consultas dos registros anteriores.
    getConsultasDoPaciente(supabase, uid),
    getRegistroDaConsulta(supabase, params.consulta),
    getMedidasDoPaciente(supabase, uid),
    // O "antes" vem de uma leitura só das medidas de consulta: na série de
    // cima, com teto de 200, as pesagens de casa as empurravam para fora.
    getMedidasDasConsultas(supabase, uid),
    getRegistrosDoPaciente(supabase, uid),
    getDesdeDoPaciente(supabase, uid),
    getUltimaPrescricao(supabase, uid),
  ]);

  if (!eu) redirect("/login");
  if (eu.role !== "nutritionist") redirect("/app");
  if (perfilRes.error) return <SoOErro secao="este paciente" />;
  // Sem vínculo ativo a RLS devolve nulo (secoes/SemAcesso.tsx).
  const perfil = perfilRes.data;
  if (!perfil) return <SemAcesso />;
  if (consultas.falhou) return <SoOErro secao="esta consulta" />;
  const consulta = consultas.data.find((c) => c.id === params.consulta);
  if (!consulta || consulta.nutritionist_id !== eu.id) notFound();
  if (registro.falhou) return <SoOErro secao="o registro desta consulta" />;

  const nome = perfil.full_name || "Paciente";
  const alturaCm = perfil.height_cm == null ? null : Number(perfil.height_cm);
  const dia = diaDaConsulta(consulta);
  const anterioresDasMedidas = {
    data: dasConsultas.falhou ? {} : anteriores(dasConsultas.data, dia),
    falhou: dasConsultas.falhou,
  };
  if (registro.data?.status === "concluido") {
    // Os adendos dependem do id do registro, que só aqui se conhece.
    const adendos = await getAdendos(supabase, registro.data.id);
    return (
      <RegistroConcluido
        uid={uid}
        nome={nome}
        consulta={consulta}
        registro={registro.data}
        adendos={adendos}
        anteriores={anterioresDasMedidas}
        alturaCm={alturaCm}
      />
    );
  }
  // Com rascunho, o editor abre mesmo assim: uma consulta remarcada para a
  // frente depois de começar a escrever ainda precisa do "Descartar".
  if (!registro.data && situacaoDoRegistro(consulta, null, new Date().toISOString()) === "sem-direito") {
    return <SemDireito uid={uid} nome={nome} consulta={consulta} />;
  }

  const inicio = Date.parse(consulta.starts_at);

  // Os registros de consultas anteriores a esta, da mais nova para a mais
  // antiga. O "observar" é o do último CONCLUÍDO entre eles: o rascunho ainda
  // pode mudar ou sumir. E se esse último não deixou nada a observar, não se
  // cai num mais velho (a regra de getObservarDosPacientes): a orientação de
  // duas consultas atrás apareceria como se fosse a de agora.
  const porId = new Map(consultas.data.map((c) => [c.id, c]));
  const antes = registros.data
    .map((r) => ({ r, c: porId.get(r.appointment_id) }))
    .filter((x): x is { r: Registro; c: Consulta } => !!x.c && Date.parse(x.c.starts_at) < inicio)
    .sort((a, b) => Date.parse(b.c.starts_at) - Date.parse(a.c.starts_at));
  const ultimoConcluido = antes.find((x) => x.r.status === "concluido");
  const observar =
    ultimoConcluido && (ultimoConcluido.r.observar ?? "").trim() !== ""
      ? { texto: ultimoConcluido.r.observar as string, data: dataCurta(diaDaConsulta(ultimoConcluido.c)) }
      : null;

  // "Desde a última consulta" conta da última REALIZADA até hoje. Se ela não
  // é anterior a esta (é esta mesma, marcada como realizada antes de
  // registrar, ou uma posterior, no registro de uma consulta antiga), o texto
  // falaria do que veio depois desta consulta, e não do que o nutri precisa
  // ler para ela: fica de fora.
  const desdeTexto =
    !desde.falhou && desde.data && desde.data.desde < dia
      ? { titulo: tituloDesde(desde.data), texto: textoDesdeUltima(desde.data) }
      : null;

  // Meta em vigor é a da última prescrição; sem prescrição, a do perfil, que é
  // a que o app do paciente usa (a mesma regra da aba Alimentação).
  const metas: MetasPrescritas = prescricao.data ?? perfil;

  return (
    <EditorRegistro
      uid={uid}
      nome={nome}
      consulta={consulta}
      registro={registro.data}
      anteriores={anterioresDasMedidas}
      alturaCm={alturaCm}
      metas={{ data: textoDasMetas(metas), falhou: !!prescricao.error }}
      hoje={hoje}
      precisaCrn={!eu.crn?.trim()}
      contexto={
        <ContextoDaConsulta
          observar={observar}
          desde={desdeTexto}
          emCasa={medidas.falhou ? null : ultimaEmCasa(medidas.data, hoje)}
          registros={antes.map(({ r, c }) => ({
            href: `/app/pacientes/${uid}/consultas/${c.id}`,
            rotulo: `${dataCurta(diaDaConsulta(c))} · ${ROTULO_TIPO[c.kind]}${r.status === "rascunho" ? " · rascunho" : ""}`,
          }))}
          falhou={{ registros: registros.falhou, desde: desde.falhou, medidas: medidas.falhou }}
        />
      }
    />
  );
}
