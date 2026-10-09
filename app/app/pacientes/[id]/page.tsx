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
import { Cabecalho } from "./secoes/Cabecalho";
import { Fila } from "./secoes/Fila";
import { Alimentacao } from "./secoes/Alimentacao";
import { Treino } from "./secoes/Treino";
import { Corpo } from "./secoes/Corpo";
import { Clinico } from "./secoes/Clinico";
import { ConversaENotas, type Foco } from "./secoes/ConversaENotas";
import { ErroSecao } from "./secoes/ErroSecao";
import { LinkPacientes, SemAcesso } from "./secoes/SemAcesso";
import { FOCO } from "./secoes/estilos";

export const dynamic = "force-dynamic";

// O detalhe do paciente numa página só, por assunto: o que o nutricionista
// lê e o que ele edita moram na mesma seção. Substitui as 7 abas (e as 5
// abas internas da Prescrição), em que metas, plano e peso apareciam em duas
// abas e a conversa com mensagem não lida ficava a dois níveis da entrada.
//
// Cada seção é um componente de servidor com as próprias consultas, dentro
// do próprio Suspense: as rápidas aparecem sem esperar as lentas, e uma
// consulta que falha derruba só a sua seção.
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

  // ?t= era a aba aberta. A Atividade virou a página da linha do tempo; as
  // outras abas viraram seções desta página, e o parâmetro é ignorado.
  if (searchParams?.t === "atividade") {
    redirect(`/app/pacientes/${uid}/linha-do-tempo`);
  }
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

  const nome = profile.full_name || "Paciente";
  const nutriId = usuarioRes.data.user?.id ?? "";

  // Começam aqui e cada seção espera a sua parte. O resumo é o mesmo que a
  // Início usa (fila e números do topo, variação de peso do Corpo), só que
  // dizendo se alguma consulta falhou; a última prescrição é a "meta" da
  // Alimentação e do Corpo e o valor de "Reaplicar"; os avisos abertos vêm
  // juntos e cada seção separa o seu lado (separarDesvios): os de meta são os
  // da Alimentação e o que decide se "Reaplicar" aparece na fila, os do plano
  // de treino são os do Treino e a linha embaixo do Reaplicar. Uma consulta
  // para todos, em vez de uma por seção, para os números da página não
  // discordarem entre si.
  const resumo = resumirPacientes(supabase, [uid], { [uid]: nome });
  const prescricao = getUltimaPrescricao(supabase, uid);
  const desvios = getDesviosAbertos(supabase, uid);

  // Com `?conversa=1` ou `?notas=1`, abaixo de `lg` só aquela parte aparece,
  // em tela cheia. As outras seções continuam montadas, só escondidas: a
  // árvore é a mesma com e sem o parâmetro, então abrir a conversa e voltar
  // não desmonta um rascunho de metas aberto. Pelo mesmo motivo o
  // EdicaoProvider fica em volta de tudo, e nada aqui tem `key` que mude
  // quando os dados mudam: um router.refresh() (enviar mensagem, Reaplicar)
  // refaz as consultas sem perder o que está sendo editado.
  const foraDoFoco = foco ? "hidden lg:block" : "";

  return (
    <EdicaoProvider>
      {foco && (
        // `replace`: o Voltar troca a entrada do histórico em vez de empilhar
        // outra. Com push, o Voltar do aparelho depois disso reabria a
        // conversa que a pessoa tinha acabado de fechar.
        <Link
          href={`/app/pacientes/${uid}`}
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
          <Suspense fallback={<SkelCard className="mb-6" />}>
            <Fila
              uid={uid}
              resumo={resumo}
              prescricao={prescricao}
              desvios={desvios}
            />
          </Suspense>
          <Suspense fallback={<SkelCard />}>
            <Alimentacao
              uid={uid}
              nutriId={nutriId}
              perfil={{
                daily_calorie_goal: profile.daily_calorie_goal,
                protein_goal_g: profile.protein_goal_g,
                daily_water_goal_ml: profile.daily_water_goal_ml,
                weight_goal_kg: profile.weight_goal_kg,
                sex: profile.sex,
              }}
              prescricao={prescricao}
              desvios={desvios}
            />
          </Suspense>
          <Suspense fallback={<SkelCard />}>
            <Treino uid={uid} nutriId={nutriId} sexo={profile.sex} desvios={desvios} />
          </Suspense>
          <Suspense fallback={<SkelCard />}>
            <Corpo
              uid={uid}
              perfil={{
                daily_calorie_goal: profile.daily_calorie_goal,
                protein_goal_g: profile.protein_goal_g,
                daily_water_goal_ml: profile.daily_water_goal_ml,
                weight_goal_kg: profile.weight_goal_kg,
              }}
              resumo={resumo}
              prescricao={prescricao}
            />
          </Suspense>
          <Suspense fallback={<SkelCard />}>
            <Clinico uid={uid} />
          </Suspense>
        </div>

        {/* Numa coluna (até `xl`), no fim da página, com uma linha
            separando do Clínico, que a primeira seção daqui não tem. Em tela
            cheia no celular essa linha sairia colada no Voltar, por isso com
            foco ela só começa em `lg`. A partir de `xl`, a coluna da direita,
            presa no alto enquanto o resto rola. */}
        <aside
          aria-label="Conversa e notas privadas"
          className={`${
            foco
              ? "lg:border-t lg:border-clin-linha lg:pt-6"
              : "border-t border-clin-linha pt-6"
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
