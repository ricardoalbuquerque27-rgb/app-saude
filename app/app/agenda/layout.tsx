import { TemaClinico } from "@/components/clinico/TemaClinico";

// A agenda usa o visual da página do paciente: os componentes de consulta
// (painel, formulário) são os mesmos nos dois lugares, e as cores deles têm
// contraste testado só dentro do .tema-clinico (lib/temaClinico.ts).
export default function AgendaLayout({ children }: { children: React.ReactNode }) {
  return <TemaClinico>{children}</TemaClinico>;
}
