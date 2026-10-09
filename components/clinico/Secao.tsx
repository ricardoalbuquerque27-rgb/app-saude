// Moldura de cada bloco da página do paciente: título, ação opcional (Editar,
// Ver histórico) e uma linha fina em cima em vez de caixa ou sombra.
//
// O `id` é a âncora dos botões da fila ("Ver semana" rola até Treino, "Ver
// clínico" até Clínico). `scroll-mt` deixa o título abaixo da borda de cima
// da janela depois do salto; sem ele a âncora cola o título no topo.
export function Secao({
  id,
  titulo,
  acao,
  children,
}: {
  id: string;
  titulo: string;
  acao?: React.ReactNode;
  children: React.ReactNode;
}) {
  const idTitulo = `${id}-titulo`;
  return (
    <section
      id={id}
      aria-labelledby={idTitulo}
      className="scroll-mt-20 border-t border-clin-linha py-6 first:border-t-0 first:pt-0"
    >
      <div className="mb-4 flex min-h-[40px] items-center justify-between gap-3">
        <h2
          id={idTitulo}
          className="text-lg font-semibold leading-snug text-clin-texto"
        >
          {titulo}
        </h2>
        {acao}
      </div>
      {children}
    </section>
  );
}
