import { cssDoTemaClinico } from "@/lib/temaClinico";

// O visual "Clínico sereno": a página do paciente do nutricionista e a
// agenda. Fica nos layouts dessas rotas (e não no layout raiz) para as
// variáveis --clin-* só existirem dentro do .tema-clinico abaixo. A fonte vem
// da raiz (`--font-sans`, Instrument Sans em app/layout.tsx): era uma
// instância própria aqui, e o app todo passou a usar a mesma letra.
export function TemaClinico({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: cssDoTemaClinico() }} />
      <div className="tema-clinico font-clinico bg-clin-chao text-clin-texto">
        {children}
      </div>
    </>
  );
}
