import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { idadeEm, todayISO } from "@/lib/date";
import { ErroSecao } from "./ErroSecao";
import { ACAO_PRIMARIA, ACAO_SECUNDARIA, LINK } from "./estilos";

export type PerfilCabecalho = {
  full_name: string | null;
  sex: string | null;
  birth_date: string | null;
  height_cm: number | null;
};

// Nome, idade, sexo e altura, e as três saídas da página: Mensagem, Nota
// privada e Linha do tempo.
//
// Mensagem e Nota privada vão para lugares diferentes conforme a largura. No
// celular, `?conversa=1` / `?notas=1` abre só aquela parte em tela cheia, e
// o Voltar do aparelho fecha a conversa sem sair do paciente. No computador
// a conversa já está na coluna da direita, e o link só rola até ela. Os dois
// links existem no HTML e o CSS mostra um de cada vez: não há como o servidor
// saber a largura da tela.
export async function Cabecalho({
  uid,
  perfil,
}: {
  uid: string;
  perfil: PerfilCabecalho;
}) {
  const supabase = await createClient();
  // Não lida = mensagem DO PACIENTE com read_at nulo. Só o envio do
  // nutricionista marca as respostas como lidas (Conversa), então a conta
  // quer dizer "ainda sem resposta", que é o que importa para a fila.
  const { count, error } = await supabase
    .from("patient_notes")
    .select("id", { count: "exact", head: true })
    .eq("patient_id", uid)
    .eq("author_id", uid)
    .eq("visibility", "shared")
    .is("read_at", null);

  const nome = perfil.full_name || "Paciente";
  const idade = idadeEm(perfil.birth_date, todayISO());
  const sexo =
    perfil.sex === "F" ? "Feminino" : perfil.sex === "M" ? "Masculino" : null;
  const detalhes =
    [
      idade != null ? `${idade} anos` : null,
      sexo,
      perfil.height_cm ? `${perfil.height_cm} cm` : null,
    ]
      .filter(Boolean)
      .join(" · ") || "Perfil incompleto";
  const naoLidas = error ? 0 : count ?? 0;

  const rotuloMensagem = (
    <>
      Mensagem
      {naoLidas > 0 && (
        // `primaria` sobre `sobre-primaria` é o par testado ao contrário; a
        // razão de contraste não depende de quem é frente e quem é fundo.
        <span className="rounded-full bg-clin-sobre-primaria px-1.5 text-[13px] font-semibold tabular-nums text-clin-primaria">
          {naoLidas}
          <span className="sr-only">
            {naoLidas === 1 ? " não lida" : " não lidas"}
          </span>
        </span>
      )}
    </>
  );

  return (
    <header className="pb-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-semibold leading-tight text-clin-texto">
            {nome}
          </h1>
          <p className="mt-1 text-[14px] tabular-nums text-clin-texto-2">
            {detalhes}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/app/pacientes/${uid}?conversa=1`}
            className={`inline-flex lg:hidden ${ACAO_PRIMARIA}`}
          >
            {rotuloMensagem}
          </Link>
          <a href="#conversa" className={`hidden lg:inline-flex ${ACAO_PRIMARIA}`}>
            {rotuloMensagem}
          </a>
          <Link
            href={`/app/pacientes/${uid}?notas=1`}
            className={`inline-flex lg:hidden ${ACAO_SECUNDARIA}`}
          >
            Nota privada
          </Link>
          <a href="#notas" className={`hidden lg:inline-flex ${ACAO_SECUNDARIA}`}>
            Nota privada
          </a>
          <Link
            href={`/app/pacientes/${uid}/linha-do-tempo`}
            className={`inline-flex px-1 ${LINK}`}
          >
            Linha do tempo
          </Link>
        </div>
      </div>
      {/* Falhar a contagem não esconde o nome: o aviso vem embaixo, e o
          botão fica sem número em vez de dizer "0 não lidas" sem saber. */}
      {error && (
        <div className="mt-4">
          <ErroSecao secao="as mensagens não lidas" />
        </div>
      )}
    </header>
  );
}
