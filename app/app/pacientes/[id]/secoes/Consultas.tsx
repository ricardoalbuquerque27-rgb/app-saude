import { Secao } from "@/components/clinico/Secao";
import { ErroSecao } from "@/components/clinico/ErroSecao";
import { MarcarConsulta } from "@/components/consultas/MarcarConsulta";
import { PainelConsulta } from "@/components/consultas/PainelConsulta";
import { CLASSE_SELO, SELO } from "@/components/consultas/aparencia";
import {
  ehPendencia,
  proximaConsulta,
  rotuloDaConsulta,
  ROTULO_MODO,
  ROTULO_SITUACAO,
  ROTULO_TIPO,
  situacao,
  tipoSugerido,
  type Consulta,
} from "@/lib/consultas";
import { FOCO } from "@/components/clinico/estilos";

// A aba Consultas: o que precisa do nutri no topo (pedido, pedido de
// remarcação, sem desfecho), a próxima consulta e o histórico. Cada consulta
// abre o mesmo painel da agenda; no histórico ele fica fechado num
// <details>, para a lista não virar uma parede de botões.
export async function Consultas({
  uid,
  nutriId,
  nome,
  consultas,
}: {
  uid: string;
  nutriId: string;
  nome: string;
  consultas: Promise<{ data: Consulta[]; falhou: boolean }>;
}) {
  const r = await consultas;
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
  const jaMostradas = new Set([...pendentes.map((c) => c.id), proxima?.id]);
  // Futuras além da próxima também entram no histórico, que vai da mais nova
  // para a mais antiga.
  const historico = r.data.filter((c) => !jaMostradas.has(c.id));

  const painel = (c: Consulta) => (
    <PainelConsulta consulta={c} nome={nome} agora={agora} nutriId={nutriId} mostrarNome={false} />
  );

  return (
    <Secao id="consultas" titulo="Consultas" acao={marcar}>
      {r.data.length === 0 ? (
        <p className="text-[15px] text-clin-texto-2">Nenhuma consulta marcada ainda.</p>
      ) : (
        <div className="space-y-6">
          {pendentes.length > 0 && (
            <div>
              <h3 className="mb-2 text-[15px] font-semibold text-clin-texto">Precisa de você</h3>
              <ul role="list" className="space-y-3">
                {pendentes.map((c) => (
                  <li key={c.id} className="rounded-md border border-dashed border-clin-atencao p-4">
                    {painel(c)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {mostrarProxima && proxima && (
            <div>
              <h3 className="mb-2 text-[15px] font-semibold text-clin-texto">Próxima consulta</h3>
              <div className="rounded-md border border-clin-linha p-4">{painel(proxima)}</div>
            </div>
          )}

          {historico.length > 0 && (
            <div>
              <h3 className="mb-2 text-[15px] font-semibold text-clin-texto">Histórico</h3>
              <ul role="list" className="divide-y divide-clin-linha border-y border-clin-linha">
                {historico.map((c) => {
                  const s = situacao(c, agora);
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
