import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarCheck,
  Droplets,
  Dumbbell,
  FileText,
  Scale,
  Syringe,
  Utensils,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/date";
import { getPatientActivity, type ActivityItem } from "@/lib/nutri";
import { ErroSecao } from "../secoes/ErroSecao";
import { LinkPacientes, SemAcesso } from "../secoes/SemAcesso";
import { FOCO } from "../secoes/estilos";

export const dynamic = "force-dynamic";

// O ícone diz o tipo do registro; o título ao lado diz o mesmo em texto, e
// por isso o ícone é decorativo (aria-hidden).
const ICONE: Record<ActivityItem["kind"], typeof Utensils> = {
  refeicao: Utensils,
  treino: Dumbbell,
  peso: Scale,
  diario: Droplets,
  exame: FileText,
  dose: Syringe,
  efeito: AlertTriangle,
  checkin: CalendarCheck,
};

// Tudo o que o paciente registrou nos últimos 30 dias, do mais recente para
// o mais antigo. Era a aba "Atividade" do detalhe; virou página própria
// porque na página única, por assunto, uma lista de 80 itens misturados
// empurrava as seções para longe. Os links antigos (?t=atividade) chegam
// aqui pelo redirect da página do paciente.
export default async function LinhaDoTempo({
  params,
}: {
  params: { id: string };
}) {
  const uid = params.id;
  const supabase = await createClient();
  const { data: perfil, error } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", uid)
    .maybeSingle();

  if (error) {
    return (
      <div className="max-w-2xl">
        <LinkPacientes />
        <div className="mt-4">
          <ErroSecao secao="este paciente" />
        </div>
      </div>
    );
  }
  // Mesma guarda da página do paciente: sem vínculo, nenhuma consulta roda.
  if (!perfil) return <SemAcesso />;

  const nome = perfil.full_name || "Paciente";
  const { itens, falhou } = await getPatientActivity(supabase, uid, 30, 80);

  // Agrupa por dia, preservando a ordem (mais recente primeiro).
  const porDia: { data: string; itens: ActivityItem[] }[] = [];
  for (const it of itens) {
    const ultimo = porDia[porDia.length - 1];
    if (ultimo && ultimo.data === it.date) ultimo.itens.push(it);
    else porDia.push({ data: it.date, itens: [it] });
  }

  return (
    <div className="max-w-2xl">
      <Link
        href={`/app/pacientes/${uid}`}
        className={`inline-flex min-h-[40px] items-center gap-1 rounded-md text-[14px] text-clin-texto-2 hover:text-clin-primaria ${FOCO}`}
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" /> Voltar para {nome}
      </Link>
      <h1 className="mt-2 text-2xl font-semibold leading-tight text-clin-texto">
        Linha do tempo
      </h1>
      <p className="mt-1 text-[14px] text-clin-texto-2">
        {nome} · últimos 30 dias
      </p>

      {falhou ? (
        // Uma tabela que falha não pode virar "nenhum registro": a lista
        // mostraria só o que chegou, como se fosse tudo.
        <div className="mt-6">
          <ErroSecao secao="a linha do tempo" />
        </div>
      ) : porDia.length === 0 ? (
        <p className="mt-6 text-[14px] text-clin-texto-2">
          Nenhum registro nos últimos 30 dias.
        </p>
      ) : (
        <div className="mt-6 space-y-6">
          {porDia.map((g) => (
            <section key={g.data} aria-labelledby={`dia-${g.data}`}>
              <h2
                id={`dia-${g.data}`}
                className="text-[13px] font-semibold tabular-nums text-clin-texto-2"
              >
                {formatDate(g.data)}
              </h2>
              <ul className="mt-2 divide-y divide-clin-linha border-t border-clin-linha">
                {g.itens.map((it, i) => {
                  const Icone = ICONE[it.kind];
                  return (
                    <li key={i} className="flex items-start gap-3 py-2.5">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-clin-primaria-fundo text-clin-primaria">
                        <Icone aria-hidden="true" className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[14px] font-medium leading-snug text-clin-texto">
                          {it.title}
                        </p>
                        {it.detail && (
                          <p className="text-[13px] leading-snug text-clin-texto-2">
                            {it.detail}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
