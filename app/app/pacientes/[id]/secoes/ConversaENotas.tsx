import { createClient } from "@/lib/supabase/server";
import { Secao } from "@/components/clinico/Secao";
import { Conversa } from "@/components/clinico/Conversa";
import { NotasPrivadas } from "@/components/clinico/NotasPrivadas";
import type { Mensagem } from "@/components/clinico/tipos";
import { ErroSecao } from "./ErroSecao";

export type Foco = "conversa" | "notas" | null;

// Conversa com o paciente e notas privadas. No computador ficam na coluna da
// direita, sempre à vista; no celular, no fim da página, e `?conversa=1` /
// `?notas=1` mostra só uma delas em tela cheia (quem esconde o resto é a
// página). Aqui só se esconde a outra parte, e só abaixo de `lg`: a partir
// dali as duas aparecem mesmo com o parâmetro na URL.
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
      <Secao
        id="notas"
        titulo="Notas privadas"
        className={foco === "conversa" ? "hidden lg:block" : ""}
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
