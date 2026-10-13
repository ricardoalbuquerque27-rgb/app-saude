import { Secao } from "@/components/clinico/Secao";
import { ErroSecao } from "@/components/clinico/ErroSecao";
import { MarcarConsulta } from "@/components/consultas/MarcarConsulta";
import { PainelConsulta } from "@/components/consultas/PainelConsulta";
import { CLASSE_SELO, SELO, SELO_REGISTRO } from "@/components/consultas/aparencia";
import {
  ehPendencia,
  proximaConsulta,
  rotuloDaConsulta,
  ROTULO_MODO,
  ROTULO_SITUACAO,
  ROTULO_TIPO,
  situacao,
  tipoSugerido,
  ultimaRealizada,
  type Consulta,
} from "@/lib/consultas";
import { FOCO } from "@/components/clinico/estilos";
import { ROTULO_REGISTRO, situacaoDoRegistro, type Registro } from "@/lib/registro";
import type { Res } from "@/lib/consultasDb";

type Grupo = "pendente" | "proxima" | "retorno";
const TITULO_DO_GRUPO: Record<Grupo, string> = {
  pendente: "Precisa de você",
  proxima: "Próxima consulta",
  retorno: "Sem retorno marcado",
};

// A aba Consultas: o que precisa do nutri no topo (pedido, pedido de
// remarcação, sem desfecho), a próxima consulta ou, sem nenhuma, a última
// realizada com o "Marcar retorno", e o histórico. Cada consulta
// abre o mesmo painel da agenda; no histórico ele fica fechado num
// <details>, para a lista não virar uma parede de botões.
//
// Cada consulta que já começou (e não é falta nem cancelamento) leva o selo do
// registro e, no painel, a porta para a página dele. Os registros e o
// "observar" chegam como promessas da página, que só os pede quando esta aba
// está aberta. Se a leitura dos registros falha, a lista segue sem selo
// nenhum e com o aviso: "Sem registro" em tudo diria o que não se sabe.
export async function Consultas({
  uid,
  nutriId,
  nome,
  consultas,
  registros: registrosP,
  observar: observarP,
}: {
  uid: string;
  nutriId: string;
  nome: string;
  consultas: Promise<Res<Consulta[]>>;
  registros: Promise<Res<Record<string, Registro["status"]>>>;
  observar: Promise<Res<Record<string, { texto: string; data: string }>>>;
}) {
  const [r, registros, observar] = await Promise.all([consultas, registrosP, observarP]);
  const agora = new Date().toISOString();

  const marcar = (
    <MarcarConsulta
      nutriId={nutriId}
      pacienteId={uid}
      inicial={{ tipo: r.falhou ? "retorno" : tipoSugerido(r.data) }}
    />
  );

  if (r.falhou) {
    return (
      <Secao id="consultas" titulo="Consultas" acao={marcar}>
        <ErroSecao secao="as consultas" />
      </Secao>
    );
  }

  const pendentes = r.data
    .filter((c) => ehPendencia(c, agora))
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
  const proxima = proximaConsulta(r.data, agora);
  const mostrarProxima = proxima && !pendentes.some((c) => c.id === proxima.id);
  // Sem próxima nem pedido: a última realizada sobe para o topo com o
  // "Marcar retorno". É o passo seguinte de fechar uma consulta (critério 4
  // da spec); no histórico ela ficaria fechada num <details>, lá embaixo.
  const semRetorno =
    !proxima && !r.data.some((c) => c.status === "pedido") ? ultimaRealizada(r.data, agora) : null;
  const jaMostradas = new Set([
    ...pendentes.map((c) => c.id),
    proxima?.id,
    semRetorno?.id,
  ]);
  // Futuras além da próxima também entram no histórico, que vai da mais nova
  // para a mais antiga.
  const historico = r.data.filter((c) => !jaMostradas.has(c.id));

  const destaques: { c: Consulta; grupo: Grupo }[] = [
    ...pendentes.map((c) => ({ c, grupo: "pendente" as const })),
    ...(mostrarProxima && proxima ? [{ c: proxima, grupo: "proxima" as const }] : []),
    ...(semRetorno ? [{ c: semRetorno, grupo: "retorno" as const }] : []),
  ];

  // Lido e falhou são coisas diferentes (ver PainelConsulta): "falhou" só
  // quando a leitura falhou, nulo quando ela deu certo e a consulta não tem.
  const registroDe = (c: Consulta) => (registros.falhou ? "falhou" : registros.data[c.id] ?? null);

  const painel = (c: Consulta) => (
    <PainelConsulta
      consulta={c}
      nome={nome}
      agora={agora}
      nutriId={nutriId}
      mostrarNome={false}
      registro={registroDe(c)}
      observar={observar.falhou ? "falhou" : observar.data[uid] ?? null}
    />
  );

  return (
    <Secao id="consultas" titulo="Consultas" acao={marcar}>
      {r.data.length === 0 ? (
        <p className="text-[15px] text-clin-texto-2">Nenhuma consulta marcada ainda.</p>
      ) : (
        <div className="space-y-6">
          {registros.falhou && <ErroSecao secao="os registros" />}

          {/* Pendências, próxima e "sem retorno" numa lista só, com a
              consulta como chave: quando a sem desfecho vira realizada, ela
              passa de "Precisa de você" para "Sem retorno marcado" e o React
              mantém o MESMO painel, com o "Marcar retorno" que ele abriu. Em
              listas separadas o painel era recriado no refresh e o formulário
              sumia no meio do preenchimento. O título sai quando o grupo muda. */}
          {destaques.length > 0 && (
            <ul role="list" className="space-y-3">
              {destaques.map(({ c, grupo }, i) => (
                <li key={c.id}>
                  {(i === 0 || destaques[i - 1].grupo !== grupo) && (
                    <h3 className={`mb-2 text-[15px] font-semibold text-clin-texto ${i > 0 ? "pt-3" : ""}`}>
                      {TITULO_DO_GRUPO[grupo]}
                    </h3>
                  )}
                  <div
                    className={`rounded-md border p-4 ${
                      grupo === "pendente" ? "border-dashed border-clin-atencao" : "border-clin-linha"
                    }`}
                  >
                    {painel(c)}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {historico.length > 0 && (
            <div>
              <h3 className="mb-2 text-[15px] font-semibold text-clin-texto">Histórico</h3>
              <ul role="list" className="divide-y divide-clin-linha border-y border-clin-linha">
                {historico.map((c) => {
                  const s = situacao(c, agora);
                  const status = registros.data[c.id];
                  const sr = situacaoDoRegistro(c, status ? { status } : null, agora);
                  return (
                    <li key={c.id}>
                      <details className="group">
                        <summary
                          className={`flex min-h-[44px] cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 py-2 ${FOCO}`}
                        >
                          <span className="text-[15px] tabular-nums text-clin-texto">{rotuloDaConsulta(c)}</span>
                          <span className="text-[14px] text-clin-texto-2">
                            {ROTULO_TIPO[c.kind]} · {ROTULO_MODO[c.mode]}
                          </span>
                          <span className={`${CLASSE_SELO} ${SELO[s]}`}>{ROTULO_SITUACAO[s]}</span>
                          {!registros.falhou && sr !== "sem-direito" && (
                            <span className={`${CLASSE_SELO} ${SELO_REGISTRO[sr]}`}>{ROTULO_REGISTRO[sr]}</span>
                          )}
                        </summary>
                        <div className="pb-4 pt-1">{painel(c)}</div>
                      </details>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </Secao>
  );
}
