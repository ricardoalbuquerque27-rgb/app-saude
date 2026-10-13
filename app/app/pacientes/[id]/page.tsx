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
import { abaDaUrl, hrefDaAba } from "@/lib/abas";
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

// O detalhe do paciente, em abas por assunto: Resumo (fila e números),
// Alimentação, Treino, Corpo e Clínico. Foi uma rolagem só; com dados reais,
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

  // ?t= era a aba aberta. A Atividade virou a página da linha do tempo; as
  // outras abas viraram seções desta página, e o parâmetro é ignorado.
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

  const nome = profile.full_name || "Paciente";
  const nutriId = usuarioRes.data.user?.id ?? "";

  // Começam aqui, e só as da aba aberta. O resumo é o mesmo que a Início usa
  // (fila e números do Resumo, variação de peso do Corpo), só que dizendo se
  // alguma consulta falhou; a última prescrição é a "meta" da Alimentação e
  // do Corpo e o valor de "Reaplicar"; os avisos abertos vêm juntos e cada
  // seção separa o seu lado (separarDesvios): os de meta são os da
  // Alimentação e o que decide se "Reaplicar" aparece na fila, os do plano de
  // treino são os do Treino e a linha embaixo do Reaplicar. Dentro de uma aba
  // é uma consulta para todas as seções, para os números não discordarem.
  const precisa = (...abas: (typeof aba)[]) => abas.includes(aba);
  const resumo = precisa("resumo", "corpo")
    ? resumirPacientes(supabase, [uid], { [uid]: nome })
    : null;
  const prescricao = precisa("resumo", "alimentacao", "corpo")
    ? getUltimaPrescricao(supabase, uid)
    : null;
  const desvios = precisa("resumo", "alimentacao", "treino")
    ? getDesviosAbertos(supabase, uid)
    : null;

  // Com `?conversa=1` ou `?notas=1`, abaixo de `lg` só aquela parte aparece,
  // em tela cheia. A aba aberta continua montada, só escondida (o endereço
  // da tela cheia leva `?aba=` junto, hrefDaAba): a árvore é a mesma com e
  // sem o parâmetro, então abrir a conversa e voltar não desmonta um rascunho
  // de metas aberto. Pelo mesmo motivo o EdicaoProvider fica em volta de
  // tudo, e nada aqui tem `key` que mude quando os dados mudam: um
  // router.refresh() (enviar mensagem, Reaplicar) refaz as consultas sem
  // perder o que está sendo editado. Trocar de ABA desmonta o editor: a barra
  // pergunta antes quando há alteração não salva (AbasPaciente).
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
          <div>

          {aba === "resumo" && resumo && prescricao && desvios && (
            <Suspense fallback={<SkelCard className="mb-6" />}>
              <Fila
                uid={uid}
                resumo={resumo}
                prescricao={prescricao}
                desvios={desvios}
              />
            </Suspense>
          )}
          {aba === "alimentacao" && prescricao && desvios && (
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
          )}
          {aba === "treino" && desvios && (
            <Suspense fallback={<SkelCard />}>
              <Treino uid={uid} nutriId={nutriId} sexo={profile.sex} desvios={desvios} />
            </Suspense>
          )}
          {aba === "corpo" && resumo && prescricao && (
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
          )}
          {aba === "clinico" && (
            <Suspense fallback={<SkelCard />}>
              <Clinico uid={uid} />
            </Suspense>
          )}
          </div>
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
