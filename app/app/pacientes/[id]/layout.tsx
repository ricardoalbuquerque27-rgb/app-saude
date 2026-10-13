import { TemaClinico } from "@/components/clinico/TemaClinico";

// Piloto do visual "Clínico sereno" (components/clinico/TemaClinico.tsx).
export default function PacienteLayout({
  children,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  return <TemaClinico>{children}</TemaClinico>;
}
