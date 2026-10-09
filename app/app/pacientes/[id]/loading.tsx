import { Skel, SkelCard } from "@/components/Skeleton";

// Só até o perfil do paciente voltar. Depois disso a página aparece e cada
// seção mostra o próprio esqueleto (o Suspense de cada uma em page.tsx).
export default function Loading() {
  return (
    <div>
      <Skel className="mb-4 h-4 w-24" />
      <Skel className="h-7 w-52" />
      <Skel className="mb-6 mt-2 h-3 w-40" />
      <SkelCard className="mb-6" />
      <SkelCard />
    </div>
  );
}
