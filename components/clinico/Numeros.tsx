// Os três números de relance (dias com registro, treinos confirmados, variação
// de peso), separados por linha fina e sem caixa. O valor vem primeiro na
// tela e o rótulo depois, mas no HTML o rótulo (<dt>) vem antes do valor
// (<dd>): é a ordem que o leitor de tela lê como "Dias com registro, 5 de 7",
// e a que o <dl> exige. `flex-col-reverse` inverte só o desenho.
//
// `tabular-nums` mantém os algarismos alinhados quando o valor muda de uma
// semana para a outra.
export function Numeros({
  itens,
}: {
  itens: { valor: string; rotulo: string }[];
}) {
  return (
    <dl className="grid grid-cols-3 divide-x divide-clin-linha">
      {itens.map((item, i) => (
        <div
          key={`${item.rotulo}-${i}`}
          className={`flex flex-col-reverse justify-end gap-1 ${
            i === 0 ? "pr-3 sm:pr-5" : "px-3 sm:px-5"
          }`}
        >
          <dt className="text-[13px] leading-snug text-clin-texto-2">
            {item.rotulo}
          </dt>
          <dd className="break-words text-2xl font-semibold leading-none tabular-nums text-clin-texto">
            {item.valor}
          </dd>
        </div>
      ))}
    </dl>
  );
}
