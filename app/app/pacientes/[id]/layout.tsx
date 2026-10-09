import { Instrument_Sans } from "next/font/google";
import { cssDoTemaClinico } from "@/lib/temaClinico";

// Piloto do visual "Clínico sereno": vale só para a página do paciente do
// nutricionista. Fica num layout da rota (e não no layout raiz) para o
// resto do app continuar exatamente como estava — as variáveis --clin-*
// só existem dentro do .tema-clinico abaixo, e a fonte só é carregada
// quando esta rota é visitada.
const fonte = Instrument_Sans({ subsets: ["latin"], variable: "--font-clinico" });

export default function PacienteLayout({
  children,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: cssDoTemaClinico() }} />
      <div
        className={`${fonte.variable} tema-clinico font-clinico bg-clin-chao text-clin-texto`}
      >
        {children}
      </div>
    </>
  );
}
