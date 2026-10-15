import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  getDesviosAbertos,
  getUltimaPrescricao,
  resumirPacientes,
} from "@/lib/nutri";
import { SkelCard } from "@/components/Skeleton";
import { EdicaoProvider } from "@/components/clinico/Edicao";
import { AbasPaciente } from "@/components/clinico/AbasPaciente";
import { ABAS, abaDaUrl, hrefDaAba, type AbaPaciente } from "@/lib/abas";
import { Cabecalho } from "./secoes/Cabecalho";
import { Fila } from "./secoes/Fila";
import { Alimentacao } from "./secoes/Alimentacao";
import { Treino } from "./secoes/Treino";
import { Corpo } from "./secoes/Corpo";
import { Clinico } from "./secoes/Clinico";
import { Consultas } from "./secoes/Consultas";
import { getConsultasDoPaciente, getDesdeDoPaciente } from "@/lib/consultasDb";
import { getObservarDosPacientes, getRegistrosDasConsultas } from "@/lib/registroDb";
import { comDireitoAoRegistro } from "@/lib/registro";
import { ConversaENotas, type Foco } from "./secoes/ConversaENotas";
import { ErroSecao } from "@/components/clinico/ErroSecao";
import { LinkPacientes, SemAcesso } from "./secoes/SemAcesso";
import { FOCO } from "@/components/clinico/estilos";

export const dynamic = "force-dynamic";

// Um título por aba: cada aba é uma entrada do histórico, e com o mesmo
// título em todas o leitor de tela não anunciava a troca, e a lista do
// Voltar mostrava cinco linhas iguais.
export function generateMetadata({
  searchParams,
}: {
  searchParams: { [chave: string]: string | string[] | undefined };
}) {
  const aba = abaDaUrl(searchParams?.aba);
  const rotulo = ABAS.find((a) => a.id === aba)?.rotulo ?? "Resumo";
  return { title: `${rotulo} · Paciente · Pace Fit` };
}

// O detalhe do paciente, em abas por assunto: Resumo (fila e números),
// Alimentação, Treino, Corpo, Clínico e Consultas. Foi uma rolagem só; com dados reais,
// a fila de alertas e as cinco seções empilhadas ficaram longas demais, e
// cada assunto novo (consultas, evolução) esticaria mais. O que o
// nutricionista lê e o que ele edita continuam na mesma aba.
//
// A aba vem do endereço (?aba=treino, lib/abas.ts) e só ela é montada: as
// consultas das outras abas nem começam. Cada seção é um componente de
// servidor com as próprias consultas, dentro do próprio Suspense: as rápidas
// aparecem sem esperar as lentas, e uma consulta que falha derruba só a sua
// seção. O cabeçalho e a conversa com as notas ficam fora das abas: o
// nutricionista manda mensagem olhando qualquer uma.
//
// Duas colunas (conversa e notas à direita) só a partir de `xl` (1280 px).
// Em `lg` a área de conteúdo do AppShell tem 720 px em qualquer largura, e
// com a coluna de 360 px a principal ficava com 336 px, mais estreita que
// um celular. O AppShell abre esta rota até `max-w-7xl`, e entre `lg` e `xl`
// a página fica numa coluna só. O modo de tela cheia (`?conversa=1`) continua
// abaixo de `lg`: dali para cima a conversa sempre está na página, e os links
// do cabeçalho só rolam até ela.
export default async function PacienteDetalhe({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { [chave: string]: string | string[] | undefined };
}) {
  const uid = params.id;

  // ?t= era a aba das primeiras versões. A Atividade virou a página da linha
  // do tempo; as outras são as abas de hoje, em ?aba=, e ?t= é ignorado.
  if (searchParams?.t === "atividade") {
    redirect(`/app/pacientes/${uid}/linha-do-tempo`);
  }
  const aba = abaDaUrl(searchParams?.aba);
  const foco: Foco =
    searchParams?.conversa === "1"
      ? "conversa"
      : searchParams?.notas === "1"
        ? "notas"
        : null;

  const supabase = await createClient();
  const [perfilRes, usuarioRes] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "full_name, sex, birth_date, height_cm, weight_goal_kg, daily_calorie_goal, protein_goal_g, daily_water_goal_ml"
      )
      .eq("id", uid)
      .maybeSingle(),
    supabase.auth.getUser(),
  ]);
  const profile = perfilRes.data;

  if (perfilRes.error) {
    return (
      <div className="max-w-2xl">
        <LinkPacientes />
        <div className="mt-4">
          <ErroSecao secao="este paciente" />
        </div>
      </div>
    );
  }
  // Sem vínculo ativo → a RLS devolve nulo, e nenhuma seção roda.
  if (!profile) return <SemAcesso />;
  // Já conferido acima; numa const o TypeScript sabe disso dentro das funções.
  const perfil = profile;

  const nome = profile.full_name || "Paciente";
  const nutriId = usuarioRes.data.user?.id ?? "";

  // Cada aba cria só as consultas dela, ali mesmo, e as outras nem começam.
  // O resumo é o mesmo que a Início usa (fila e números do Resumo, variação
  // de peso do Corpo), só que dizendo se alguma consulta falhou; a última
  // prescrição é a "meta" da Alimentação e do Corpo e o valor de "Reaplicar";
  // os avisos abertos vêm juntos e cada seção separa o seu lado
  // (separarDesvios): os de meta são os da Alimentação e o que decide se
  // "Reaplicar" aparece na fila, os do plano de treino são os do Treino e a
  // linha embaixo do Reaplicar.
  function conteudoDaAba(a: AbaPaciente) {
    switch (a) {
      case "resumo":
        return (
          <>
            {/* Sem alerta, o Resumo são só os números, sem título nenhum: o
                leitor de tela não teria onde se situar. */}
            <h2 className="sr-only">Resumo</h2>
            <Suspense fallback={<SkelCard className="mb-6" />}>
              <Fila
                uid={uid}
                resumo={resumirPacientes(supabase, [uid], { [uid]: nome })}
                prescricao={getUltimaPrescricao(supabase, uid)}
                desvios={getDesviosAbertos(supabase, uid)}
                desde={getDesdeDoPaciente(supabase, uid)}
              />
            </Suspense>
          </>
        );
      case "alimentacao":
        return (
          <Suspense fallback={<SkelCard />}>
            <Alimentacao
              uid={uid}
              nutriId={nutriId}
              perfil={{
                daily_calorie_goal: perfil.daily_calorie_goal,
                protein_goal_g: perfil.protein_goal_g,
                daily_water_goal_ml: perfil.daily_water_goal_ml,
                weight_goal_kg: perfil.weight_goal_kg,
                sex: perfil.sex,
              }}
              prescricao={getUltimaPrescricao(supabase, uid)}
              desvios={getDesviosAbertos(supabase, uid)}
            />
          </Suspense>
        );
      case "treino":
        return (
          <Suspense fallback={<SkelCard />}>
            <Treino
              uid={uid}
              nutriId={nutriId}
              sexo={perfil.sex}
              desvios={getDesviosAbertos(supabase, uid)}
            />
          </Suspense>
        );
      case "corpo":
        return (
          <Suspense fallback={<SkelCard />}>
            <Corpo
              uid={uid}
              nutriId={nutriId}
              perfil={{
                daily_calorie_goal: perfil.daily_calorie_goal,
                protein_goal_g: perfil.protein_goal_g,
                daily_water_goal_ml: perfil.daily_water_goal_ml,
                weight_goal_kg: perfil.weight_goal_kg,
              }}
              resumo={resumirPacientes(supabase, [uid], { [uid]: nome })}
              prescricao={getUltimaPrescricao(supabase, uid)}
            />
          </Suspense>
        );
      case "clinico":
        return (
          <Suspense fallback={<SkelCard />}>
            <Clinico uid={uid} sexo={perfil.sex} nascimento={perfil.birth_date} />
          </Suspense>
        );
      case "consultas": {
        // Os registros são só da aba Consultas (a regra de que só a aba aberta
        // consulta o banco). O "observar" corre junto das consultas; o selo de
        // cada uma só pede os registros das que têm direito a ele, depois de
        // as consultas chegarem.
        const consultas = getConsultasDoPaciente(supabase, uid);
        const agora = new Date().toISOString();
        return (
          <Suspense fallback={<SkelCard />}>
            <Consultas
              uid={uid}
              nutriId={nutriId}
              nome={nome}
              agora={agora}
              consultas={consultas}
              registros={consultas.then((c) =>
                getRegistrosDasConsultas(
                  supabase,
                  comDireitoAoRegistro(c.data, agora).map((x) => x.id),
                ),
              )}
              observar={getObservarDosPacientes(supabase, [uid])}
            />
          </Suspense>
        );
      }
    }
  }

  // Com `?conversa=1` ou `?notas=1`, abaixo de `lg` só aquela parte aparece,
  // em tela cheia. A aba aberta continua montada, só escondida (o endereço
  // da tela cheia leva `?aba=` junto, hrefDaAba): a árvore é a mesma com e
  // sem o parâmetro, então abrir a conversa e voltar não desmonta um rascunho
  // de metas aberto. Pelo mesmo motivo o EdicaoProvider fica em volta de
  // tudo, e nada aqui tem `key` que mude quando os dados mudam: um
  // router.refresh() (enviar mensagem, Reaplicar) refaz as consultas sem
  // perder o que está sendo editado. Trocar de ABA desmonta o editor: a barra
  // pergunta antes quando há alteração não salva e segura a troca com uma
  // gravação em voo (Edicao.tsx). O Voltar do navegador não pergunta.
  const foraDoFoco = foco ? "hidden lg:block" : "";

  return (
    <EdicaoProvider>
      {foco && (
        // `replace`: o Voltar troca a entrada do histórico em vez de empilhar
        // outra. Com push, o Voltar do aparelho depois disso reabria a
        // conversa que a pessoa tinha acabado de fechar.
        <Link
          href={hrefDaAba(uid, aba)}
          replace
          className={`mb-2 inline-flex min-h-[44px] items-center gap-1 rounded-md text-[15px] font-medium text-clin-primaria lg:hidden ${FOCO}`}
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" /> Voltar
        </Link>
      )}

      <div className={foraDoFoco}>
        <LinkPacientes />
        <div className="mt-2">
          <Suspense fallback={<SkelCard className="mb-6" />}>
            <Cabecalho
              uid={uid}
              aba={aba}
              perfil={{
                full_name: profile.full_name,
                sex: profile.sex,
                birth_date: profile.birth_date,
                height_cm: profile.height_cm,
              }}
            />
          </Suspense>
        </div>
      </div>

      <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_360px] xl:gap-6">
        <div className={`min-w-0 ${foraDoFoco}`}>
          <div className="mb-6">
            <AbasPaciente uid={uid} ativa={aba} />
          </div>

          {/* A aba num bloco só dela: a seção vira a primeira filha e perde a
              linha de cima (`first:` do Secao), que repetiria a da barra. */}
          <div>{conteudoDaAba(aba)}</div>
        </div>

        {/* No celular só aparece em tela cheia (Mensagem, Nota): embaixo de
            cada aba ela esticava todas de novo. De `lg` a `xl`, numa coluna,
            no fim da página, com uma linha separando da aba aberta; em tela
            cheia essa linha sairia colada no Voltar, por isso com foco ela só
            começa em `lg`. A partir de `xl`, a coluna da direita, presa no
            alto enquanto o resto rola. */}
        <aside
          aria-label="Conversa e notas privadas"
          className={`${
            foco
              ? "lg:border-t lg:border-clin-linha lg:pt-6"
              : "hidden lg:block lg:border-t lg:border-clin-linha lg:pt-6"
          } xl:sticky xl:top-6 xl:max-h-[calc(100dvh-3rem)] xl:self-start xl:overflow-y-auto xl:border-t-0 xl:pt-0`}
        >
          <Suspense fallback={<SkelCard />}>
            <ConversaENotas uid={uid} nutriId={nutriId} foco={foco} />
          </Suspense>
        </aside>
      </div>
    </EdicaoProvider>
  );
}
