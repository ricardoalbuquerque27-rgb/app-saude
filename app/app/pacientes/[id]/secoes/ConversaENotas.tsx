import { createClient } from "@/lib/supabase/server";
import { Secao } from "@/components/clinico/Secao";
import { Conversa } from "@/components/clinico/Conversa";
import { NotasPrivadas } from "@/components/clinico/NotasPrivadas";
import type { Mensagem } from "@/components/clinico/tipos";
import { ErroSecao } from "./ErroSecao";

export type Foco = "conversa" | "notas" | null;

// Conversa com o paciente e notas privadas. A partir de `xl` ficam na coluna
// da direita, sempre à vista; abaixo disso, no fim da página, e no celular
// `?conversa=1` / `?notas=1` mostra só uma delas em tela cheia (quem esconde
// o resto é a página). Aqui só se esconde a outra parte, e só abaixo de
// `lg`: dali para cima as duas aparecem mesmo com o parâmetro na URL.
//
// Abrir a conversa não marca nada como lido. Só enviar marca (Conversa), e
// assim "não lida" continua querendo dizer "ainda sem resposta".
export async function ConversaENotas({
  uid,
  nutriId,
  foco,
}: {
  uid: string;
  nutriId: string;
  foco: Foco;
}) {
  const supabase = await createClient();
  // Conversa e notas vêm na mesma consulta. A RLS já garante que o paciente
  // nunca enxerga as privadas; aqui só se separa por visibility.
  const { data, error } = await supabase
    .from("patient_notes")
    .select("id, body, created_at, read_at, author_id, visibility")
    .eq("patient_id", uid)
    .order("created_at", { ascending: false })
    .limit(100);
  const todas = (data ?? []) as Mensagem[];

  return (
    <>
      <Secao
        id="conversa"
        titulo="Conversa"
        className={foco === "notas" ? "hidden lg:block" : ""}
      >
        {error ? (
          <ErroSecao secao="a conversa" />
        ) : (
          <Conversa
            pacienteId={uid}
            nutriId={nutriId}
            mensagens={todas.filter((m) => m.visibility === "shared")}
          />
        )}
      </Secao>
      {/* Com `?notas=1` no celular a Conversa some, mas continua sendo o
          primeiro filho, e o `first:` do Secao não tiraria a linha de cima
          das Notas: ela sairia colada no Voltar. `max-lg:` tira só ali; de
          `lg` para cima as duas aparecem e a linha entre elas volta. */}
      <Secao
        id="notas"
        titulo="Notas privadas"
        className={
          foco === "conversa"
            ? "hidden lg:block"
            : foco === "notas"
              ? "max-lg:border-t-0 max-lg:pt-0"
              : ""
        }
      >
        {error ? (
          <ErroSecao secao="as notas" />
        ) : (
          <NotasPrivadas
            pacienteId={uid}
            nutriId={nutriId}
            notas={todas.filter((m) => m.visibility === "private")}
          />
        )}
      </Secao>
    </>
  );
}
