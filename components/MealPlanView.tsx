"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

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
// separadas por traço, sem uma caixa por opção. O ganho principal é o botão
// "Comi isso": em vez de digitar a refeição, ele confirma o que já foi
// prescrito e vira um registro normal em `meals`.
export default function MealPlanView({
  nome,
  observacao,
  itens,
  date,
  jaRegistrados,
  registradas,
  onRegistrado,
  nutriNome,
  linkPlano = false,
}: {
  nome: string;
  observacao: string | null;
  itens: ItemCardapioPaciente[];
  date: string;
  /** meal_type das refeições já registradas no dia, para marcar "· feito". */
  jaRegistrados: string[];
  /**
   * Tipo e descrição das refeições registradas no dia. Com elas, a opção que
   * foi de fato registrada ("Comi isso" grava a descrição do item) diz "comi"
   * no lugar do botão; as outras opções da mesma refeição seguem com o botão.
   * Sem elas (Meu plano só lê os tipos), só o "· feito" da refeição aparece.
   */
  registradas?: { meal_type: string; description: string }[];
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
  const [busy, setBusy] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const tipos = Array.from(new Set(itens.map((i) => i.meal_type)));
  const comidas = new Set((registradas ?? []).map((r) => `${r.meal_type}\u0000${r.description.trim()}`));

  async function comiIsso(item: ItemCardapioPaciente) {
    setBusy(item.id);
    setErro(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setBusy(null);
      return;
    }
    const { error } = await supabase.from("meals").insert({
      user_id: user.id,
      date,
      meal_type: item.meal_type,
      description: item.description,
      calories: item.calories,
      protein_g: item.protein_g,
      carbs_g: item.carbs_g,
      fat_g: item.fat_g,
    });
    setBusy(null);
    if (error) {
      setErro("Não foi possível registrar. Tente de novo.");
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

        {tipos.map((tipo) => {
          const opcoes = itens
            .filter((i) => i.meal_type === tipo)
            .sort((a, b) => a.position - b.position);
          const feito = jaRegistrados.includes(tipo);

          return (
            <div key={tipo}>
              <h3 className="px-4 pb-1 pt-3.5 text-[15px] font-semibold text-app-texto">
                {tipo}
                {feito && (
                  <>
                    {" "}
                    <span className="text-[13px] font-normal text-app-primaria">· feito</span>
                  </>
                )}
              </h3>

              <ul className="divide-y divide-app-linha">
                {opcoes.map((o, i) => {
                  const comi = comidas.has(`${o.meal_type}\u0000${o.description.trim()}`);
                  // "opção 1" só quando há mais de uma; os números são dado.
                  const meta = [
                    opcoes.length > 1 ? `opção ${i + 1}` : null,
                    o.calories ? `${Math.round(Number(o.calories)).toLocaleString("pt-BR")} kcal` : null,
                    o.protein_g ? `${Math.round(Number(o.protein_g))} g prot` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ");

                  return (
                    <li key={o.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="whitespace-pre-wrap text-[15px] text-app-texto">{o.description}</span>
                        {meta && <span className="tabular text-[13px] text-app-texto-2">{meta}</span>}
                      </div>
                      {comi ? (
                        <span className="inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold text-app-primaria">
                          <Check aria-hidden="true" className="h-4 w-4" />
                          comi
                        </span>
                      ) : (
                        // Secundário de 40 px, como na maquete; o ::after
                        // estende a área de toque a 44 px sem engordar o
                        // botão. O -3px é contado a partir da borda interna:
                        // com a borda de 1 px, -2px dava só 42 px de toque.
                        <button
                          onClick={() => comiIsso(o)}
                          disabled={busy === o.id}
                          className="btn-ghost relative shrink-0 px-3 after:absolute after:inset-x-0 after:-inset-y-[3px] after:content-['']"
                        >
                          {busy === o.id && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}
                          Comi isso
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      {erro && (
        <p role="alert" className="border-t border-app-linha px-4 py-3 text-[15px] text-app-perigo">
          {erro}
        </p>
      )}
    </section>
  );
}
