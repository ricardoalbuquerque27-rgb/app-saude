import { partesDaSugestao, type SugestaoDeProteina } from "@/lib/cardapio";

// O texto da sugestão de proteína, da Início e da Dieta: a frase numa linha
// própria e a descrição da opção, entre parênteses, cortada em duas linhas (spec
// "Sugestão para fechar a meta"). Uma descrição de 100 caracteres comia quatro
// linhas do cartão em 390 px.
//
// O corte é só de desenho (`line-clamp` esconde o excesso, não o remove): o
// texto inteiro continua no DOM, e o leitor de tela lê a frase e a descrição
// completas. O espaço entre os dois blocos existe para o texto, lido sem o
// estilo, não juntar "20 g" e "(".
export function TextoDaSugestao({ sugestao }: { sugestao: SugestaoDeProteina }) {
  const { frase, descricao } = partesDaSugestao(sugestao);
  return (
    <>
      <span className="block">{frase}</span>{" "}
      <span className="line-clamp-2">({descricao}).</span>
    </>
  );
}
