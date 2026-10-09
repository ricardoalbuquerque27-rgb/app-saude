// Mensagem de erro que fica colada ao formulário que falhou, em vez de num
// banner no topo da página: com a página do paciente numa tela só, um aviso
// lá em cima ficava fora da vista de quem acabou de apertar "Salvar" três
// seções abaixo. `perigo` sobre `perigo-fundo` é um par com contraste testado
// (lib/temaClinico.ts). O `role="alert"` faz o leitor de tela anunciar o erro
// quando ele aparece, sem mover o foco do formulário.
export function ErroInline({
  mensagem,
  className = "mt-3",
}: {
  mensagem: string | null;
  className?: string;
}) {
  if (!mensagem) return null;
  return (
    <p
      role="alert"
      className={`rounded-md bg-clin-perigo-fundo px-3 py-2 text-sm text-clin-perigo ${className}`}
    >
      {mensagem}
    </p>
  );
}
