import { Instrument_Sans } from "next/font/google";
import { cssDoTemaClinico } from "@/lib/temaClinico";

// O visual "Clínico sereno": a página do paciente do nutricionista e a
// agenda. Fica nos layouts dessas rotas (e não no layout raiz) para o resto
// do app continuar como estava: as variáveis --clin-* só existem dentro do
// .tema-clinico abaixo, e a fonte só carrega quando uma dessas rotas abre.
const fonte = Instrument_Sans({ subsets: ["latin"], variable: "--font-clinico" });

export function TemaClinico({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: cssDoTemaClinico() }} />
      <div className={`${fonte.variable} tema-clinico font-clinico bg-clin-chao text-clin-texto`}>
        {children}
      </div>
    </>
  );
}
