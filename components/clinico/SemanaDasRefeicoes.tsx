import { Check, X } from "lucide-react";
import { rotuloDaCasa, type EstadoDaCasa } from "@/lib/nutri";

// As refeições da semana, na aba Alimentação (spec dos lembretes das
// refeições, "O que a nutricionista vê"): as refeições do cardápio nas linhas
// e os dias, de segunda a domingo, nas colunas. Cada casa diz por extenso o
// que o símbolo mostra, para o leitor de tela ("Almoço, terça: não comeu").
// A conta é `semanaDasRefeicoes`, testada; aqui só se desenha.
//
// "Comeu" é a resposta do paciente, e um toque é barato também para responder
// sem pensar: a semana mostra o padrão, não a verdade de cada refeição.

const DIAS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

function Simbolo({ estado }: { estado: EstadoDaCasa }) {
  if (estado === "comeu") return <Check className="mx-auto h-4 w-4 text-clin-primaria" aria-hidden="true" />;
  if (estado === "nao_comeu") return <X className="mx-auto h-4 w-4 text-clin-atencao" aria-hidden="true" />;
  if (estado === "sem_resposta") return <span className="text-clin-texto-2" aria-hidden="true">–</span>;
  return null;
}

export function SemanaDasRefeicoes({
  semana,
  falhou,
}: {
  semana: { refeicao: string; dias: { data: string; estado: EstadoDaCasa }[] }[];
  falhou: boolean;
}) {
  if (falhou) {
    return (
      <p role="alert" className="mt-2 rounded-md bg-clin-perigo-fundo px-4 py-3 text-[14px] leading-snug text-clin-perigo">
        Não deu para carregar as refeições da semana.
      </p>
    );
  }
  return (
    <>
      {/* Em 390 px a tabela rola dentro do bloco, nunca a página. */}
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[330px] border-collapse text-[13px]">
          <thead>
            <tr>
              <th scope="col" className="pb-1 text-left font-medium text-clin-texto-2">
                <span className="sr-only">Refeição</span>
              </th>
              {DIAS.map((d) => (
                <th key={d} scope="col" className="w-9 pb-1 text-center font-medium text-clin-texto-2">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-clin-linha">
            {semana.map((linha) => (
              <tr key={linha.refeicao}>
                <th scope="row" className="py-2 pr-2 text-left text-[14px] font-normal text-clin-texto">
                  {linha.refeicao}
                </th>
                {linha.dias.map((d) => (
                  <td key={d.data} className="py-2 text-center">
                    <Simbolo estado={d.estado} />
                    <span className="sr-only">{rotuloDaCasa(linha.refeicao, d.data, d.estado)}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-clin-texto-2">
        <span className="inline-flex items-center gap-1">
          <Check className="h-3.5 w-3.5 text-clin-primaria" aria-hidden="true" /> comeu
        </span>
        <span className="inline-flex items-center gap-1">
          <X className="h-3.5 w-3.5 text-clin-atencao" aria-hidden="true" /> não comeu
        </span>
        <span>– sem resposta</span>
      </p>
    </>
  );
}
